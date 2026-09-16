import * as T from 'three';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { poseWorker } from '../../shared/rendering/worker-pose';
import {
  createAirportTerminal,
  createItemMesh,
  createSizerBoxMesh,
  createSuitcaseMesh,
} from './models';
import { computeSuitcaseBulge, SIZER_X, SIZER_Z } from './physics';
import { type CarryOnSnapshot, type PlayerInput } from './types';

export type SceneCallbacks = {
  input: (inp: PlayerInput) => void;
  onInteract: (action: 'grab' | 'compress' | 'zip' | 'drop') => void;
};

export class CarryOnScene {
  container: HTMLElement;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
  renderer: T.WebGLRenderer;

  terminalRoot: T.Group;
  sizerMesh: T.Group;
  playerMeshes = new Map<string, T.Group>();
  suitcaseMeshes = new Map<string, T.Group>();
  itemMeshes = new Map<string, T.Group>();
  particles: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
  }[] = [];

  callbacks: SceneCallbacks;
  activeInput: PlayerInput = {
    x: 0,
    z: 0,
    jump: false,
    grab: false,
    compress: false,
    zip: false,
    drop: false,
    seq: 0,
  };

  keysDown = new Set<string>();
  disposed = false;
  animFrameId = 0;
  clock = 0;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene setup
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#dbeafe'); // Cheerful airport sky
    this.scene.fog = new T.FogExp2('#dbeafe', 0.018);

    // 2. Camera setup: elevated dynamic isometric angle looking down on terminal
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new T.PerspectiveCamera(45, aspect, 0.1, 100);
    this.camera.position.set(1.5, 11.5, 14.5);
    this.camera.lookAt(1.5, 0.8, 0);

    // 3. Renderer setup
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    const ambient = new T.AmbientLight('#ffffff', 0.85);
    this.scene.add(ambient);

    const sun = new T.DirectionalLight('#fffbeb', 1.4);
    sun.position.set(6, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 35;
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);

    // 5. Environment & Sizer Box
    this.terminalRoot = createAirportTerminal();
    this.scene.add(this.terminalRoot);

    this.sizerMesh = createSizerBoxMesh();
    this.sizerMesh.position.set(SIZER_X, 0, SIZER_Z);
    this.scene.add(this.sizerMesh);

    // 6. Listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  onResize = () => {
    if (!this.container || this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keysDown.add(e.code);
    this.updateInputFromKeys();

    if (e.code === 'KeyE') this.callbacks.onInteract('grab');
    if (e.code === 'KeyR') this.callbacks.onInteract('compress');
    if (e.code === 'KeyF') this.callbacks.onInteract('zip');
    if (e.code === 'KeyQ') this.callbacks.onInteract('drop');
  };

  onKeyUp = (e: KeyboardEvent) => {
    this.keysDown.delete(e.code);
    this.updateInputFromKeys();
  };

  updateInputFromKeys() {
    let ix = 0;
    let iz = 0;

    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) iz -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) iz += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) ix -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) ix += 1;

    // Normalize diagonal
    const len = Math.hypot(ix, iz);
    if (len > 0.001) {
      ix /= len;
      iz /= len;
    }

    const jump = this.keysDown.has('Space');
    const grab = this.keysDown.has('KeyE');
    const compress = this.keysDown.has('KeyR');
    const zip = this.keysDown.has('KeyF');
    const drop = this.keysDown.has('KeyQ');

    this.activeInput = {
      x: ix,
      z: iz,
      jump,
      grab,
      compress,
      zip,
      drop,
      seq: this.activeInput.seq + 1,
    };
    this.callbacks.input(this.activeInput);
  }

  /** Spawn colourful piñata bursting confetti */
  spawnBurstParticles(pos: [number, number, number]) {
    const colors = [
      '#f43f5e',
      '#fbbf24',
      '#10b981',
      '#3b82f6',
      '#8b5cf6',
      '#ffffff',
    ];
    const geom = new T.BoxGeometry(0.12, 0.12, 0.12);

    for (let i = 0; i < 28; i++) {
      const mat = new T.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.4,
      });
      const mesh = new T.Mesh(geom, mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 3 + Math.random() * 5,
        vz: Math.sin(angle) * speed,
        life: 1.0,
      });
    }
  }

  render(snap: CarryOnSnapshot, localPlayerId: string) {
    if (this.disposed) return;
    this.clock += 0.016;
    const world = snap.world;
    const now = world.clock;

    // 1. Synchronize Travelers
    const activePlayerIds = new Set<string>();
    for (const p of world.players) {
      activePlayerIds.add(p.id);
      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        mesh = dressedWorker(p.color, {
          shirt: p.wearingTinFoil ? '#94a3b8' : undefined,
          overalls: p.color === 0 ? '#1e3a8a' : undefined,
        }).model;
        mesh.castShadow = true;
        this.scene.add(mesh);
        this.playerMeshes.set(p.id, mesh);
      }

      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.facing;

      // Traveler animation posing
      const rig = mesh.userData as {
        body?: T.Group;
        legL?: T.Group;
        legR?: T.Group;
        armL?: T.Group;
        armR?: T.Group;
      };

      if (now < p.downUntil) {
        // Flattened / Stunned by suitcase burst explosion!
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.2;
      } else if (p.sittingOn) {
        // Sitting on suitcase to compress it
        mesh.rotation.x = 0;
        if (rig.legL && rig.legR && rig.armL && rig.armR) {
          rig.legL.rotation.set(-1.4, 0, -0.2);
          rig.legR.rotation.set(-1.4, 0, 0.2);
          rig.armL.rotation.set(-0.6, 0, 0.4);
          rig.armR.rotation.set(-0.6, 0, -0.4);
        }
      } else if (p.zippingSuitcase) {
        // Zipping posture: crouching forward, hands pulling zipper seam
        mesh.rotation.x = 0.2;
        if (rig.armL && rig.armR) {
          rig.armL.rotation.set(-1.2, 0.3, 0.2);
          rig.armR.rotation.set(-1.2, -0.3, -0.2);
        }
      } else if (p.holdingSuitcase || p.holdingItem) {
        // Carrying item/suitcase in hands
        mesh.rotation.x = 0;
        const moving = Math.hypot(p.vx, p.vz) > 0.2;
        poseWorker(mesh, this.clock, moving ? 'walk' : 'still');
        if (rig.armL && rig.armR) {
          rig.armL.rotation.set(-1.1, 0.2, 0.1);
          rig.armR.rotation.set(-1.1, -0.2, -0.1);
        }
      } else {
        // Standard walk or idle
        mesh.rotation.x = 0;
        const moving = Math.hypot(p.vx, p.vz) > 0.2;
        poseWorker(mesh, this.clock, moving ? 'walk' : 'still');
      }
    }

    // Cleanup disconnected players
    for (const [id, mesh] of this.playerMeshes) {
      if (!activePlayerIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
      }
    }

    // 2. Synchronize Suitcases
    const activeSuitcaseIds = new Set<string>();
    for (const sc of world.suitcases) {
      activeSuitcaseIds.add(sc.id);
      let mesh = this.suitcaseMeshes.get(sc.id);
      if (!mesh) {
        mesh = createSuitcaseMesh(sc);
        this.scene.add(mesh);
        this.suitcaseMeshes.set(sc.id, mesh);
      }

      mesh.position.set(sc.x, sc.y, sc.z);
      mesh.rotation.y = sc.yaw;

      // Dynamic bulging and compression mesh update
      const lid = mesh.getObjectByName('suitcase-lid') as T.Group | undefined;
      const bulgeBelly = mesh.getObjectByName('bulge-belly') as
        | T.Mesh
        | undefined;
      const zipperTab = mesh.getObjectByName('zipper-tab') as
        | T.Mesh
        | undefined;
      const statusTag = mesh.getObjectByName('status-tag') as
        | T.Mesh
        | undefined;

      if (lid && bulgeBelly) {
        // Compute current bulging scale
        const stats = computeSuitcaseBulge(sc, world.items);
        const bulgeScaleY = 1.0 + stats.bulge * 2.8;
        const bulgeScaleXZ = 1.0 + stats.bulge * 0.45;
        bulgeBelly.scale.set(
          bulgeScaleXZ,
          Math.max(0.1, bulgeScaleY),
          bulgeScaleXZ,
        );

        // Raise upper lid shell
        const lidShell = lid.getObjectByName('lid-shell');
        if (lidShell) {
          lidShell.position.y = 0.225 + stats.bulge * 0.45;
        }

        // Move zipper tab along perimeter based on zipped ratio
        if (zipperTab) {
          const zipAngle = sc.zipped * Math.PI * 2;
          zipperTab.position.x = Math.cos(zipAngle) * 0.42;
          zipperTab.position.z = Math.sin(zipAngle) * 0.22;
        }
      }

      // Status tag color update
      if (statusTag) {
        const mat = statusTag.material as T.MeshStandardMaterial;
        if (sc.approved) mat.color.set('#22c55e');
        else if (sc.rejected) mat.color.set('#ef4444');
        else mat.color.set('#ffffff');
      }
    }

    // Cleanup missing suitcases
    for (const [id, mesh] of this.suitcaseMeshes) {
      if (!activeSuitcaseIds.has(id)) {
        this.scene.remove(mesh);
        this.suitcaseMeshes.delete(id);
      }
    }

    // 3. Synchronize Items
    const activeItemIds = new Set<string>();
    for (const it of world.items) {
      if (it.packedIn) {
        // Item is packed inside suitcase: hide from scene
        const existing = this.itemMeshes.get(it.id);
        if (existing) {
          this.scene.remove(existing);
          this.itemMeshes.delete(it.id);
        }
        continue;
      }

      activeItemIds.add(it.id);
      let mesh = this.itemMeshes.get(it.id);
      if (!mesh) {
        mesh = createItemMesh(it);
        this.scene.add(mesh);
        this.itemMeshes.set(it.id, mesh);
      }

      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.y = it.rotation;
    }

    for (const [id, mesh] of this.itemMeshes) {
      if (!activeItemIds.has(id)) {
        this.scene.remove(mesh);
        this.itemMeshes.delete(id);
      }
    }

    // 4. Update Sizer Box Siren
    const sirenDome = this.sizerMesh.getObjectByName('siren-light') as
      | T.Mesh
      | undefined;
    if (sirenDome) {
      const mat = sirenDome.material as T.MeshStandardMaterial;
      if (world.sizer.status === 'rejected') {
        // Flash bright red
        const flash = Math.sin(this.clock * 20) > 0;
        mat.color.set(flash ? '#ff0000' : '#450a0a');
      } else if (world.sizer.status === 'approved') {
        mat.color.set('#22c55e');
      } else {
        mat.color.set('#b91c1c');
      }
    }

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= 0.02;
      p.mesh.position.x += p.vx * 0.016;
      p.mesh.position.y += p.vy * 0.016;
      p.mesh.position.z += p.vz * 0.016;
      p.vy -= 9.8 * 0.016;
      p.mesh.rotation.x += 0.1;
      p.mesh.rotation.y += 0.1;

      if (p.life <= 0 || p.mesh.position.y <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // 6. Camera smooth follow local player
    const me = world.players.find((p) => p.id === localPlayerId);
    if (me) {
      const targetCamX = me.x * 0.45 + 1.5;
      const targetCamZ = me.z * 0.35 + 14.0;
      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.08;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.08;
      this.camera.lookAt(me.x * 0.5 + 1.5, 0.8, me.z * 0.2);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    cancelAnimationFrame(this.animFrameId);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}
