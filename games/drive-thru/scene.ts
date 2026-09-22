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
import { CAR, carPoint, GRILL_BOUNDS, TRAY_LEDGE_POS } from './physics';
import { keyboardInput } from './controls';
import { poseDriver, poseCook } from './avatar';
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
  private trayKey = '';
  private wheelAngle = 0;
  private updateTime = performance.now();
  private cameraReady = false;
  private cameraTarget = new T.Vector3();
  private cameraLook = new T.Vector3();
  private held = new Set<string>();
  private enabled = false;

  public resetInput(): void {
    this.keys.clear();
    this.held.clear();
    this.updateInput();
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.resetInput();
  }

  public holdControl(code: string, down: boolean): void {
    if (down) this.held.add(code);
    else this.held.delete(code);
    this.updateInput();
  }

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
    window.addEventListener('blur', () => this.resetInput(), {
      signal: this.abort.signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.resetInput();
      },
      { signal: this.abort.signal },
    );
    window.addEventListener('keydown', this.onKeyDown, {
      signal: this.abort.signal,
    });
    window.addEventListener('keyup', this.onKeyUp, {
      signal: this.abort.signal,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (
      !this.enabled ||
      (e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)))
    )
      return;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)
    ) {
      e.preventDefault();
    }
    if (
      e.target instanceof HTMLButtonElement &&
      (e.code === 'Space' || e.code === 'Enter')
    )
      return;
    this.keys.add(e.code);
    this.updateInput();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.updateInput();
  };

  private updateInput(): void {
    const next = this.enabled
      ? keyboardInput(new Set([...this.keys, ...this.held]), this.localRole)
      : idleInput();
    this.currentInput = { ...next, seq: this.currentInput.seq + 1 };

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
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.updateTime) / 1000);
    this.updateTime = now;
    if (this.localRole !== snapshot.myRole) {
      this.localRole = snapshot.myRole;
      this.resetInput();
    }

    // 1. Update Sedan
    this.sedanMesh.position.set(snapshot.car.x, snapshot.car.y, snapshot.car.z);
    this.sedanMesh.rotation.y = -snapshot.car.yaw;
    if (snapshot.phase !== 'completed' && snapshot.phase !== 'meltdown')
      this.wheelAngle -= (snapshot.car.speed * dt) / CAR.wheelRadius;
    for (let i = 0; i < 4; i++) {
      const pivot = this.sedanMesh.getObjectByName(`wheel-${i}`);
      const roll = this.sedanMesh.getObjectByName(`wheel-roll-${i}`);
      if (pivot) pivot.rotation.y = i < 2 ? -snapshot.car.steer : 0;
      if (roll) roll.rotation.x = this.wheelAngle;
    }

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
    if (speakerPole)
      speakerPole.rotation.z = snapshot.car.reversedIntoPole
        ? Math.min(1.4, speakerPole.rotation.z + dt * 3)
        : 0;

    // 2. Update Patties
    this.pattyMeshes.forEach((mesh, i) => {
      mesh.visible = i < snapshot.kitchen.patties.length;
    });
    snapshot.kitchen.patties.forEach((p, i) => {
      let mesh = this.pattyMeshes[i];
      if (!mesh) {
        mesh = createPattyMesh();
        this.pattyMeshes.push(mesh);
        this.scene.add(mesh);
      }
      mesh.visible = true;
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

    // Only rebuild food when its contents change, not every frame.
    const trayKey = `${snapshot.kitchen.trayStack.join(',')}:${snapshot.kitchen.sodasPoured}`;
    if (trayKey !== this.trayKey) {
      this.trayKey = trayKey;
      if (this.trayMesh) {
        this.scene.remove(this.trayMesh);
        disposeObject(this.trayMesh);
      }
      this.trayMesh =
        snapshot.kitchen.trayStack.length || snapshot.kitchen.sodasPoured
          ? createOrderTray(
              snapshot.kitchen.trayStack,
              snapshot.kitchen.sodasPoured,
            )
          : null;
      if (this.trayMesh) this.scene.add(this.trayMesh);
    }
    if (this.trayMesh) {
      this.trayMesh.rotation.set(0, 0, 0);
      if (snapshot.kitchen.trayDroppedInCurb) {
        this.trayMesh.position.set(1.5, 0.12, 0);
        this.trayMesh.rotation.set(0.3, 0.4, 0.3);
      } else if (snapshot.kitchen.trayGrabbed) {
        const p = carPoint(snapshot.car, 0.5, -0.5);
        const reach = snapshot.car.passengerReach;
        this.trayMesh.position.set(
          p.x + (TRAY_LEDGE_POS.x - p.x) * reach,
          1.2 + (TRAY_LEDGE_POS.y - 1.2) * reach,
          p.z + (TRAY_LEDGE_POS.z - p.z) * reach,
        );
        this.trayMesh.rotation.set(
          0,
          -snapshot.car.yaw,
          snapshot.car.balanceMeter * 0.3,
        );
      } else {
        const travel = snapshot.rush.trayTravel;
        this.trayMesh.position.set(
          4.4 + (TRAY_LEDGE_POS.x - 4.4) * travel,
          0.95 + (TRAY_LEDGE_POS.y - 0.95) * travel,
          -0.2 + (TRAY_LEDGE_POS.z + 0.2) * travel,
        );
        this.trayMesh.rotation.z = snapshot.car.balanceMeter * 0.15;
      }
    }

    // 5. Update Worker Avatars
    for (const [id, worker] of this.workerMeshes) {
      const player = snapshot.players.find((p) => p.id === id);
      if (!player || worker.userData.role !== player.role) {
        worker.removeFromParent();
        disposeObject(worker);
        this.workerMeshes.delete(id);
      }
    }
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
        worker.userData.role = p.role;
        this.workerMeshes.set(p.id, worker);
        this.scene.add(worker);
      }

      worker.rotation.set(0, 0, 0);
      if (p.role === 'driver' || p.role === 'passenger') {
        const reach = p.role === 'passenger' ? snapshot.car.passengerReach : 0;
        const point = carPoint(
          snapshot.car,
          (p.role === 'driver' ? -0.5 : 0.5) + reach * 0.65,
          -0.12,
        );
        worker.position.set(
          point.x,
          snapshot.car.y + 0.23 - reach * 0.13,
          point.z,
        );
        worker.scale.setScalar(0.9);
        // Avatars face +Z; the car faces -Z.
        worker.rotation.set(0, Math.PI - snapshot.car.yaw, reach * 0.45);
        poseDriver(worker, now / 1000, false);
        const rig = worker.userData;
        for (const leg of [rig.legL, rig.legR]) if (leg) leg.rotation.x = -1.25;
        if (p.role === 'passenger' && rig.armL)
          rig.armL.rotation.set(-0.65, 0, 0.15 + reach * 1.1);
      } else {
        worker.scale.setScalar(1);
        worker.position.set(
          p.role === 'grill' ? 5.7 : 3.8,
          0.05,
          p.role === 'grill' ? -0.5 : 1.5,
        );
        worker.rotation.y = -Math.PI / 2;
        poseCook(worker, now / 1000, false);
      }
    }

    // 6. Camera Placement
    this.updateCamera(snapshot, dt);
  }

  private updateCamera(snapshot: DriveThruSnapshot, dt: number): void {
    const c = snapshot.car;
    const portrait = this.camera.aspect < 1;
    if (this.localRole === 'driver' || this.localRole === 'passenger') {
      const behind = portrait ? 11.5 : 9.5;
      const point = carPoint(c, -3.4, behind);
      this.cameraTarget.set(point.x, portrait ? 7.4 : 6.3, point.z);
      const focus = carPoint(c, 0.5, -2.2);
      this.cameraLook.set(focus.x, 0.9, focus.z);
    } else {
      this.cameraTarget.set(-3, portrait ? 6.5 : 5, 6.5);
      this.cameraLook.set(4.4, 1, -0.2);
    }
    if (!this.cameraReady) {
      this.camera.position.copy(this.cameraTarget);
      this.cameraReady = true;
    }
    this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-5 * dt));
    this.camera.lookAt(this.cameraLook);
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
