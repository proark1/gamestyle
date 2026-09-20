import { disposeObject } from '../../shared/rendering/dispose-object';
import * as T from 'three';
import {
  createDriveThruEnvironment,
  createDriveThruWorker,
  createOrderTray,
  createPattyMesh,
  createSedanModel,
  createSpatulaMesh,
} from './models';
import {
  idleInput,
  type DriveThruAction,
  type DriveThruSnapshot,
  type PlayerInput,
  type RoleId,
} from './types';
import { GRILL_BOUNDS, TRAY_LEDGE_POS } from './physics';
import { createRenderer } from '../../shared/rendering/create-renderer';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
  SKY,
} from '../../shared/rendering/house-light';

type Callbacks = {
  input: (i: PlayerInput) => void;
  action: (a: DriveThruAction) => void;
};

export class DriveThruScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1, 0.1, 150);
  private renderer: T.WebGLRenderer;
  private envGroup: T.Group;
  private sedanMesh: T.Group;
  private spatulaMesh: T.Group;
  private trayMesh: T.Group | null = null;
  private pattyMeshes: T.Group[] = [];
  private workerMeshes = new Map<string, T.Group>();

  private keys = new Set<string>();
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frameId = 0;
  private lastTime = performance.now();
  private currentInput: PlayerInput = idleInput();
  private localRole: RoleId = 'driver';
  private wiperAngle = 0;

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = createRenderer(this.container, {
      exposure: HOUSE_EXPOSURE,
      focusable: false,
    }).renderer;

    // Build static environment
    this.envGroup = createDriveThruEnvironment();
    this.scene.add(this.envGroup);

    // Build sedan
    this.sedanMesh = createSedanModel();
    this.scene.add(this.sedanMesh);

    // Build spatula
    this.spatulaMesh = createSpatulaMesh();
    this.scene.add(this.spatulaMesh);

    // Setup 3 initial patties
    for (let i = 0; i < 3; i++) {
      const p = createPattyMesh();
      this.pattyMeshes.push(p);
      this.scene.add(p);
    }

    this.setupLighting();
    this.bindEvents();

    this.observer = new ResizeObserver(() => this.onResize());
    this.observer.observe(this.container);
    this.onResize();

    this.frameId = requestAnimationFrame(this.renderLoop);
  }

  private setupLighting(): void {
    // The collection's house light over the diner lot.
    const { sun } = addHouseLight(this.scene, {
      sky: SKY.coast,
      fog: { near: 40, far: 100 },
    });
    sun.position.set(-15, 25, 20);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;

    // Kitchen warm neon downlight
    const kitchenLight = new T.PointLight('#fef08a', 2.2, 12);
    kitchenLight.position.set(4.5, 3.5, 0);
    this.scene.add(kitchenLight);
  }

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown, {
      signal: this.abort.signal,
    });
    window.addEventListener('keyup', this.onKeyUp, {
      signal: this.abort.signal,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
    ) {
      e.preventDefault();
    }
    this.keys.add(e.code);
    this.updateInput();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateInput();
  };

  private updateInput(): void {
    let x = 0;
    let z = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;

    const action1 = this.keys.has('Space') || this.keys.has('KeyW');
    const action2 =
      this.keys.has('KeyR') ||
      this.keys.has('KeyS') ||
      this.keys.has('ShiftLeft');
    const action3 = this.keys.has('KeyE') || this.keys.has('KeyH');

    this.currentInput = {
      x,
      z,
      action1,
      action2,
      action3,
      seq: this.currentInput.seq + 1,
    };

    this.cb.input(this.currentInput);
  }

  private onResize(): void {
    const w = this.container.clientWidth || 640;
    const h = this.container.clientHeight || 480;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public update(snapshot: DriveThruSnapshot): void {
    this.localRole = snapshot.myRole;

    // 1. Update Sedan
    this.sedanMesh.position.set(snapshot.car.x, snapshot.car.y, snapshot.car.z);
    this.sedanMesh.rotation.y = snapshot.car.yaw;

    // Windshield Splat
    const splat = this.sedanMesh.getObjectByName('windshield-splat') as T.Mesh;
    if (splat) {
      splat.visible = snapshot.car.windshieldSplat > 0.05;
      splat.scale.setScalar(0.2 + snapshot.car.windshieldSplat * 0.8);
    }

    // Wipers animation
    if (snapshot.car.wipersActive) {
      this.wiperAngle = Math.sin(performance.now() * 0.015) * 0.6;
      const wiperL = this.sedanMesh.getObjectByName('wiper-l');
      const wiperR = this.sedanMesh.getObjectByName('wiper-r');
      if (wiperL) wiperL.rotation.z = this.wiperAngle;
      if (wiperR) wiperR.rotation.z = this.wiperAngle;
    }

    // Speaker pole knock down animation if reversed into
    const speakerPole = this.envGroup.getObjectByName('speaker-pole');
    if (speakerPole && snapshot.car.reversedIntoPole) {
      speakerPole.rotation.z = Math.min(1.4, speakerPole.rotation.z + 0.1);
    }

    // 2. Update Patties
    snapshot.kitchen.patties.forEach((p, i) => {
      let mesh = this.pattyMeshes[i];
      if (!mesh) {
        mesh = createPattyMesh();
        this.pattyMeshes.push(mesh);
        this.scene.add(mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.x = p.flipAngle;

      // Color coding by state
      const child = mesh.children[0] as T.Mesh | undefined;
      if (child && child.material) {
        const mat = child.material as T.MeshStandardMaterial;
        if (p.state === 'raw') mat.color.set('#f87171');
        else if (p.state === 'sizzling') mat.color.set('#b45309');
        else if (p.state === 'cooked') mat.color.set('#451a03');
        else if (p.state === 'burnt') mat.color.set('#1c1917');
        else if (p.state === 'fire') mat.color.set('#ef4444');
      }
    });

    // 3. Update Spatula
    this.spatulaMesh.position.set(
      snapshot.kitchen.spatulaX,
      GRILL_BOUNDS.y + 0.08,
      snapshot.kitchen.spatulaZ,
    );

    // 4. Update Tray
    if (
      snapshot.kitchen.trayStack.length > 0 ||
      snapshot.kitchen.sodasPoured > 0
    ) {
      if (this.trayMesh) {
        this.scene.remove(this.trayMesh);
      }
      this.trayMesh = createOrderTray(
        snapshot.kitchen.trayStack,
        snapshot.kitchen.sodasPoured,
      );

      if (snapshot.kitchen.trayDroppedInCurb) {
        // Dropped down drain
        this.trayMesh.position.set(1.5, -0.4, 0);
        this.trayMesh.rotation.set(0.6, 0.4, 0.5);
      } else if (snapshot.kitchen.trayGrabbed) {
        // In car passenger hands
        this.trayMesh.position.set(snapshot.car.x + 0.4, 0.85, snapshot.car.z);
      } else if (snapshot.kitchen.trayAtWindow) {
        // On window sill ledge
        this.trayMesh.position.set(
          TRAY_LEDGE_POS.x,
          TRAY_LEDGE_POS.y,
          TRAY_LEDGE_POS.z,
        );
      } else {
        // On kitchen prep counter
        this.trayMesh.position.set(4.4, 0.95, -0.2);
      }
      this.scene.add(this.trayMesh);
    }

    // 5. Update Worker Avatars
    for (const p of snapshot.players) {
      let worker = this.workerMeshes.get(p.id);
      if (!worker) {
        // Each role has one player; yours shows your wardrobe items.
        const mine = !p.bot && p.role === snapshot.myRole;
        worker = createDriveThruWorker(
          p.role,
          p.color,
          mine ? getEquippedLook() : undefined,
        );
        this.workerMeshes.set(p.id, worker);
        this.scene.add(worker);
      }

      // Position worker according to role
      if (p.role === 'driver') {
        worker.position.set(
          snapshot.car.x - 0.45,
          snapshot.car.y + 0.25,
          snapshot.car.z - 0.1,
        );
        worker.rotation.y = snapshot.car.yaw;
      } else if (p.role === 'passenger') {
        // Ragdoll lean out the right window
        const reach = snapshot.car.passengerReach;
        const leanX = snapshot.car.x + 0.55 + reach * 0.75;
        const leanY = snapshot.car.y + 0.25 - reach * 0.2;
        worker.position.set(leanX, leanY, snapshot.car.z);
        worker.rotation.y = snapshot.car.yaw;
        worker.rotation.z = -reach * 0.55; // Leaning out window
      } else if (p.role === 'grill') {
        worker.position.set(5.8, 0, -0.5);
        worker.rotation.y = -Math.PI / 2; // Facing grill
      } else if (p.role === 'barista') {
        worker.position.set(3.4, 0, 0);
        worker.rotation.y = -Math.PI; // Facing window
      }
    }

    // 6. Camera Placement
    this.updateCamera(snapshot);
  }

  private updateCamera(snapshot: DriveThruSnapshot): void {
    if (this.localRole === 'driver' || this.localRole === 'passenger') {
      // Dynamic chase camera following sedan
      const targetCamX = snapshot.car.x - Math.sin(snapshot.car.yaw) * 6.5;
      const targetCamZ = snapshot.car.z + Math.cos(snapshot.car.yaw) * 6.5;
      const targetCamY = 3.6;

      this.camera.position.lerp(
        new T.Vector3(targetCamX, targetCamY, targetCamZ),
        0.12,
      );
      this.camera.lookAt(snapshot.car.x, 1.2, snapshot.car.z);
    } else {
      // Kitchen grill view
      const kitchenCam = new T.Vector3(6.5, 3.2, 0);
      this.camera.position.lerp(kitchenCam, 0.1);
      this.camera.lookAt(2.8, 1.1, 0);
    }
  }

  private renderLoop = (time: number): void => {
    this.frameId = requestAnimationFrame(this.renderLoop);
    this.lastTime = time;
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    cancelAnimationFrame(this.frameId);
    this.abort.abort();
    this.observer.disconnect();
    disposeObject(this.scene);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
