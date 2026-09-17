import * as T from 'three';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { poseScaffoldWorker } from './avatar';
import {
  createCradleMesh,
  createHelicopterMesh,
  createPigeonMesh,
  createSoapBucketMesh,
  createSpongeMesh,
  createSqueegeeMesh,
  createSkyscraperMesh,
  createWindowMesh,
} from './models';
import {
  CRADLE_WIDTH,
  RAILING_HEIGHT,
  ROOF_ALTITUDE,
  type PlayerInput,
  type Role,
  type ScaffoldAction,
  type ScaffoldSnapshot,
} from './types';

export type SceneCallbacks = {
  input: (input: PlayerInput) => void;
  action: (action: ScaffoldAction) => void;
};

export class ScaffoldScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;

  private skyscraperGroup: T.Group;
  private cradleGroup: T.Group;
  private helicopterGroup: T.Group;
  private mainRotorGroup: T.Group;
  private tailRotorGroup: T.Group;

  private cableLeftLine: T.Line;
  private cableRightLine: T.Line;

  private windowMeshes = new Map<
    string,
    {
      group: T.Group;
      dirtyMesh: T.Mesh;
      foamMesh: T.Mesh;
      spotlessMesh: T.Mesh;
      sparkleMesh: T.Group;
    }
  >();

  private bucketMeshes = new Map<string, { root: T.Group; suds: T.Mesh }>();
  private pigeonMeshes = new Map<
    string,
    { root: T.Group; wingL: T.Group; wingR: T.Group }
  >();

  private playerMeshes = new Map<
    string,
    {
      root: T.Group;
      toolSqueegee: T.Group;
      toolSponge: T.Group;
      tetherLine: T.Line;
    }
  >();

  private cameraTarget = new T.Vector3(0, 50, 0);
  private keys = new Set<string>();
  private localId = '';
  private localRole: Role = 'cleaner';
  private dragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private orbitOffset = { yaw: 0, pitch: 0.12, distance: 16.5 };
  private destroyed = false;
  private animId = 0;

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
  ) {
    this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Sky gradient background
    this.scene.background = new T.Color('#93c5fd');

    this.camera = new T.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.5,
      250,
    );

    // Lighting
    const hemi = new T.HemisphereLight('#bae6fd', '#334155', 0.95);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight('#fffbeb', 1.35);
    sun.position.set(15, 75, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 140;
    const d = 30;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    // Create Skyscraper
    this.skyscraperGroup = createSkyscraperMesh();
    this.scene.add(this.skyscraperGroup);

    // Create Cradle
    this.cradleGroup = createCradleMesh();
    this.scene.add(this.cradleGroup);

    // Create Helicopter
    const heli = createHelicopterMesh();
    this.helicopterGroup = heli.root;
    this.mainRotorGroup = heli.mainRotor;
    this.tailRotorGroup = heli.tailRotor;
    this.scene.add(this.helicopterGroup);

    // Suspension Cables (Left and Right)
    const cableMat = new T.LineBasicMaterial({
      color: '#334155',
      linewidth: 3,
    });
    const cableGeoLeft = new T.BufferGeometry().setFromPoints([
      new T.Vector3(-CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2),
      new T.Vector3(-CRADLE_WIDTH / 2, 50, 1.2),
    ]);
    this.cableLeftLine = new T.Line(cableGeoLeft, cableMat);
    this.scene.add(this.cableLeftLine);

    const cableGeoRight = new T.BufferGeometry().setFromPoints([
      new T.Vector3(CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2),
      new T.Vector3(CRADLE_WIDTH / 2, 50, 1.2),
    ]);
    this.cableRightLine = new T.Line(cableGeoRight, cableMat);
    this.scene.add(this.cableRightLine);

    this.bindEvents();
    this.startLoop();
  }

  public setLocalPlayer(id: string, role: Role) {
    this.localId = id;
    this.localRole = role;
  }

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.handleResize);

    this.container.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.handleResize);

    this.container.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys.add(e.code);

    if (e.code === 'KeyT' || e.code === 'Tab') {
      e.preventDefault();
      this.cb.action({ type: 'switchTool' });
    } else if (e.code === 'KeyF' || e.code === 'Space') {
      e.preventDefault();
      this.cb.action({ type: 'useTool' });
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.dragging = true;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.previousMousePosition.x;
    const dy = e.clientY - this.previousMousePosition.y;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    this.orbitOffset.yaw += dx * 0.005;
    this.orbitOffset.pitch = Math.max(
      -0.25,
      Math.min(0.65, this.orbitOffset.pitch + dy * 0.005),
    );
  };

  private handleMouseUp = () => {
    this.dragging = false;
  };

  private pollInput() {
    let x = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;

    // Direct winch controls:
    // Left Winch: Q (Up), Z (Down)
    // Right Winch: E (Up), C / R (Down)
    const crankLeftUp = this.keys.has('KeyQ');
    const crankLeftDown = this.keys.has('KeyZ');
    const crankRightUp = this.keys.has('KeyE');
    const crankRightDown = this.keys.has('KeyR') || this.keys.has('KeyC');

    const action =
      this.keys.has('Space') || this.keys.has('KeyF') || this.keys.has('Enter');
    const jump = this.keys.has('KeyW') || this.keys.has('ArrowUp');

    this.cb.input({
      x,
      z: 0,
      crankLeftUp,
      crankLeftDown,
      crankRightUp,
      crankRightDown,
      action,
      jump,
      switchTool: false,
      seq: Date.now(),
    });
  }

  public render(snapshot: ScaffoldSnapshot) {
    const { world } = snapshot;

    // 1. Update Windows
    for (const win of world.windows) {
      let winObj = this.windowMeshes.get(win.id);
      if (!winObj) {
        winObj = createWindowMesh();
        winObj.group.position.set(win.x, win.y, 0.05);
        this.scene.add(winObj.group);
        this.windowMeshes.set(win.id, winObj);
      }

      // Update state visibility
      if (win.status === 'dirty') {
        winObj.dirtyMesh.visible = true;
        winObj.foamMesh.visible = false;
        winObj.spotlessMesh.visible = false;
        winObj.sparkleMesh.visible = false;
      } else if (win.status === 'foamed') {
        winObj.dirtyMesh.visible = false;
        winObj.foamMesh.visible = true;
        winObj.spotlessMesh.visible = false;
        winObj.sparkleMesh.visible = false;
      } else {
        // spotless
        winObj.dirtyMesh.visible = false;
        winObj.foamMesh.visible = false;
        winObj.spotlessMesh.visible = true;
        winObj.sparkleMesh.visible = win.sparkleTimer > 0;
        if (win.sparkleTimer > 0) {
          winObj.sparkleMesh.rotation.z += 0.08;
        }
      }
    }

    // 2. Update Cradle Position & Tilt
    this.cradleGroup.position.set(
      world.cradle.swayX,
      world.cradle.centerHeight,
      1.2 + world.cradle.swayZ,
    );
    this.cradleGroup.rotation.z = world.cradle.tiltRad;

    // 3. Update Suspension Cables
    // Left Cable from Roof to Left Winch
    const leftAnchorX =
      (-CRADLE_WIDTH / 2) * Math.cos(world.cradle.tiltRad) + world.cradle.swayX;
    const leftAnchorY = world.cradle.leftHeight;
    const leftPos = this.cableLeftLine.geometry.attributes.position;
    leftPos.setXYZ(0, -CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2);
    leftPos.setXYZ(1, leftAnchorX, leftAnchorY + 1.7, 1.2);
    leftPos.needsUpdate = true;

    // Right Cable from Roof to Right Winch
    const rightAnchorX =
      (CRADLE_WIDTH / 2) * Math.cos(world.cradle.tiltRad) + world.cradle.swayX;
    const rightAnchorY = world.cradle.rightHeight;
    const rightPos = this.cableRightLine.geometry.attributes.position;
    rightPos.setXYZ(0, CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2);
    rightPos.setXYZ(1, rightAnchorX, rightAnchorY + 1.7, 1.2);
    rightPos.needsUpdate = true;

    // 4. Update Buckets
    for (const bucket of world.buckets) {
      let bMesh = this.bucketMeshes.get(bucket.id);
      if (!bMesh) {
        bMesh = createSoapBucketMesh();
        this.cradleGroup.add(bMesh.root);
        this.bucketMeshes.set(bucket.id, bMesh);
      }
      bMesh.root.position.set(bucket.x, 0.06, 0);
      if (bucket.spilled) {
        bMesh.root.rotation.z = bucket.x < 0 ? -Math.PI / 2 : Math.PI / 2;
        bMesh.suds.visible = false;
      } else {
        bMesh.root.rotation.z = 0;
        bMesh.suds.visible = true;
      }
    }

    // 5. Update Pigeons
    for (const pigeon of world.pigeons) {
      let pMesh = this.pigeonMeshes.get(pigeon.id);
      if (!pMesh) {
        pMesh = createPigeonMesh();
        this.scene.add(pMesh.root);
        this.pigeonMeshes.set(pigeon.id, pMesh);
      }

      pMesh.root.position.set(pigeon.x, pigeon.y, 1.35);

      // Flapping wings animation
      const flap = Math.sin(pigeon.flapTimer * 18) * 0.75;
      if (!pigeon.perched) {
        pMesh.wingL.rotation.z = -flap;
        pMesh.wingR.rotation.z = flap;
      } else {
        pMesh.wingL.rotation.z = 0;
        pMesh.wingR.rotation.z = 0;
      }
    }

    // 6. Update Helicopter
    this.helicopterGroup.position.set(0, world.helicopter.y, 14.0);
    this.mainRotorGroup.rotation.y = world.helicopter.bladeAngle;
    this.tailRotorGroup.rotation.x = world.helicopter.bladeAngle * 1.5;

    // 7. Update Players
    const activeIds = new Set(world.players.map((p) => p.id));
    for (const [id, pMesh] of this.playerMeshes) {
      if (!activeIds.has(id)) {
        this.cradleGroup.remove(pMesh.root);
        this.cradleGroup.remove(pMesh.tetherLine);
        this.playerMeshes.delete(id);
      }
    }

    const now = Date.now() * 0.001;
    for (const player of world.players) {
      let pObj = this.playerMeshes.get(player.id);
      if (!pObj) {
        const char = dressedWorker(player.color, {
          shirt:
            player.color === 0
              ? '#ea580c'
              : player.color === 1
                ? '#0284c7'
                : '#16a34a',
          overalls: '#334155',
        });
        const root = char.model;
        root.scale.set(0.92, 0.92, 0.92);

        // Tool models
        const toolSqueegee = createSqueegeeMesh();
        const toolSponge = createSpongeMesh();
        root.add(toolSqueegee);
        root.add(toolSponge);

        // Safety harness tether line
        const tetherGeo = new T.BufferGeometry().setFromPoints([
          new T.Vector3(0, 0, 0),
          new T.Vector3(0, 0, 0),
        ]);
        const tetherMat = new T.LineBasicMaterial({
          color: '#ef4444',
          linewidth: 2,
        });
        const tetherLine = new T.Line(tetherGeo, tetherMat);

        this.cradleGroup.add(root);
        this.cradleGroup.add(tetherLine);

        pObj = { root, toolSqueegee, toolSponge, tetherLine };
        this.playerMeshes.set(player.id, pObj);
      }

      pObj.root.position.set(player.deckX, player.deckY, 0.25);
      pObj.root.rotation.y = player.facing > 0 ? Math.PI / 2 : -Math.PI / 2;

      // Tool in hand
      if (player.tool === 'squeegee') {
        pObj.toolSqueegee.visible = true;
        pObj.toolSponge.visible = false;
        pObj.toolSqueegee.position.set(0.25 * player.facing, 0.6, 0.3);
      } else if (player.tool === 'sponge') {
        pObj.toolSqueegee.visible = false;
        pObj.toolSponge.visible = true;
        pObj.toolSponge.position.set(0.25 * player.facing, 0.6, 0.3);
      } else {
        pObj.toolSqueegee.visible = false;
        pObj.toolSponge.visible = false;
      }

      // Safety tether line connecting player back to overhead rail
      const tetherPos = pObj.tetherLine.geometry.attributes.position;
      tetherPos.setXYZ(0, player.deckX, RAILING_HEIGHT + 0.9, -0.9);
      tetherPos.setXYZ(1, player.deckX, player.deckY + 0.95, 0.25);
      tetherPos.needsUpdate = true;

      // Pose avatar limbs
      poseScaffoldWorker(pObj.root, now, {
        state: player.state,
        moving: Math.abs(player.vx) > 0.2,
        color: player.color,
        facing: player.facing,
      });
    }

    // 8. Vertigo Camera Follow
    const targetY = world.cradle.centerHeight + 1.2;
    this.cameraTarget.y += (targetY - this.cameraTarget.y) * 0.08;
    this.cameraTarget.x +=
      (world.cradle.swayX * 0.4 - this.cameraTarget.x) * 0.08;

    const camDistance = this.orbitOffset.distance;
    const yaw = this.orbitOffset.yaw;
    const pitch = this.orbitOffset.pitch;

    this.camera.position.set(
      this.cameraTarget.x + Math.sin(yaw) * Math.cos(pitch) * camDistance,
      this.cameraTarget.y + Math.sin(pitch) * camDistance + 1.5,
      Math.cos(yaw) * Math.cos(pitch) * camDistance,
    );
    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y, 0.5);
  }

  private startLoop() {
    const loop = () => {
      if (this.destroyed) return;
      this.animId = requestAnimationFrame(loop);
      this.pollInput();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  public destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    this.unbindEvents();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
