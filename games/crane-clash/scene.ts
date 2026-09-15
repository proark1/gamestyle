import * as T from 'three';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import {
  createCraneMesh,
  createCrateMesh,
  createLaserLine,
  createPlatformMesh,
} from './models';
import { poseCraneWorker } from './avatar';
import {
  CRANE_CONFIG,
  PAD_Y,
  TEAMS,
  type CraneClashAction,
  type CraneClashSnapshot,
  type PlayerInput,
  type Role,
  type TeamId,
} from './types';

export type SceneCallbacks = {
  input: (input: PlayerInput) => void;
  action: (action: CraneClashAction) => void;
};

export class CraneClashScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;

  private cranes: Record<TeamId, T.Group>;
  private platforms: Record<TeamId, T.Group>;
  private lasers: Record<TeamId, T.Group>;
  private crateMeshes = new Map<string, T.Group>();
  private playerMeshes = new Map<string, T.Group>();

  private orbit = {
    angle: -Math.PI / 2,
    pitch: 0.58,
    distance: 32,
    target: new T.Vector3(0, 3.5, 2.5),
  };

  private dragging = false;
  private cameraMode: 'overview' | 'follow' = 'overview';
  private keys = new Set<string>();
  private localId = '';
  private localTeam: TeamId = 'orange';
  private localRole: Role = 'swinger';
  private isSoloTeam = true;
  private swappedControls = false;
  private inputSeq = 0;
  private rafId = 0;
  private lastInputSend = 0;
  private destroyed = false;

  public isControlsSwapped(): boolean {
    return this.swappedControls;
  }

  public toggleControlsSwap(): boolean {
    this.swappedControls = !this.swappedControls;
    return this.swappedControls;
  }

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

    this.scene.background = new T.Color('#dce7e9');

    this.camera = new T.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.5,
      120,
    );

    // Setup Lighting
    const hemi = new T.HemisphereLight('#fef0d9', '#637a85', 0.85);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight('#fff5e3', 1.4);
    sun.position.set(18, 35, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 70;
    const d = 26;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    // Ground mesh
    const groundGeom = new T.PlaneGeometry(90, 70);
    const groundMat = new T.MeshStandardMaterial({
      color: '#b8c7b8',
      roughness: 0.9,
    });
    const ground = new T.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Build platform pads
    this.platforms = {
      orange: createPlatformMesh('orange'),
      teal: createPlatformMesh('teal'),
    };
    this.scene.add(this.platforms.orange);
    this.scene.add(this.platforms.teal);

    // Laser height lines
    this.lasers = {
      orange: createLaserLine('orange'),
      teal: createLaserLine('teal'),
    };
    this.scene.add(this.lasers.orange);
    this.scene.add(this.lasers.teal);

    // 2 Cranes
    this.cranes = {
      orange: createCraneMesh('orange'),
      teal: createCraneMesh('teal'),
    };
    this.scene.add(this.cranes.orange);
    this.scene.add(this.cranes.teal);

    // Event listeners
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    container.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    container.addEventListener('wheel', this.onWheel, { passive: false });

    this.animate();
  }

  setLocalPlayer(id: string, team: TeamId, role: Role) {
    this.localId = id;
    this.localTeam = team;
    this.localRole = role;
  }

  render(snapshot: CraneClashSnapshot) {
    const { world } = snapshot;

    // Update Cranes
    for (const team of TEAMS) {
      const craneState = world.cranes[team];
      const craneMesh = this.cranes[team];
      const cfg = CRANE_CONFIG[team];

      if (craneMesh.userData.jib) {
        // Negative sign aligns Three.js Y-rotation with world (X, Z) trigonometry
        craneMesh.userData.jib.rotation.y = -craneState.angle;
      }
      if (craneMesh.userData.trolley) {
        craneMesh.userData.trolley.position.x = craneState.trolleyDist;
      }
      if (craneMesh.userData.hook) {
        // Hook is the grabber/pulley block just above swinger's head
        craneMesh.userData.hook.position.set(
          craneState.hookX - cfg.mast.x,
          craneState.hookY + 0.65,
          craneState.hookZ - cfg.mast.z,
        );
      }
      if (craneMesh.userData.cable) {
        // Position solid 3D cylinder from bottom of trolley to top of hook
        const tLocalX = craneState.trolleyX - cfg.mast.x;
        const tLocalY = cfg.boomY - 0.35;
        const tLocalZ = craneState.trolleyZ - cfg.mast.z;

        const hLocalX = craneState.hookX - cfg.mast.x;
        const hLocalY = craneState.hookY + 0.75;
        const hLocalZ = craneState.hookZ - cfg.mast.z;

        const pA = new T.Vector3(tLocalX, tLocalY, tLocalZ);
        const pB = new T.Vector3(hLocalX, hLocalY, hLocalZ);
        const delta = new T.Vector3().subVectors(pB, pA);
        const len = Math.max(0.1, delta.length());

        const cableMesh = craneMesh.userData.cable as T.Mesh;
        cableMesh.position.set(
          (tLocalX + hLocalX) * 0.5,
          (tLocalY + hLocalY) * 0.5,
          (tLocalZ + hLocalZ) * 0.5,
        );
        cableMesh.scale.set(1, len, 1);
        cableMesh.quaternion.setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          delta.normalize(),
        );
      }

      // Update Laser heights
      const score = world.scores[team];
      const laser = this.lasers[team];
      if (laser) {
        laser.position.y = Math.max(PAD_Y + 0.1, PAD_Y + score.height);
      }
    }

    // Update Crates
    const activeCrateIds = new Set(world.crates.map((c) => c.id));
    for (const [id, mesh] of this.crateMeshes) {
      if (!activeCrateIds.has(id)) {
        this.scene.remove(mesh);
        this.crateMeshes.delete(id);
      }
    }

    for (const crate of world.crates) {
      let mesh = this.crateMeshes.get(crate.id);
      if (!mesh) {
        mesh = createCrateMesh(crate.kind);
        this.scene.add(mesh);
        this.crateMeshes.set(crate.id, mesh);
      }
      mesh.position.set(crate.x, crate.y, crate.z);
      if (crate.quaternion) {
        mesh.quaternion.set(
          crate.quaternion.x,
          crate.quaternion.y,
          crate.quaternion.z,
          crate.quaternion.w,
        );
      }
    }

    // Update Player Avatars
    const humansOnMyTeam = world.players.filter(
      (p) => !p.bot && p.team === this.localTeam,
    );
    this.isSoloTeam = humansOnMyTeam.length <= 1;

    const activePlayerIds = new Set(world.players.map((p) => p.id));
    for (const [id, mesh] of this.playerMeshes) {
      if (!activePlayerIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
      }
    }

    const nowSec = performance.now() / 1000;
    for (const p of world.players) {
      let mesh = this.playerMeshes.get(p.id);
      if (!mesh) {
        mesh = dressedWorker(p.color).model;
        this.scene.add(mesh);
        this.playerMeshes.set(p.id, mesh);
      }

      if (p.role === 'operator') {
        const craneState = world.cranes[p.team];
        const cfg = CRANE_CONFIG[p.team];
        if (craneState) {
          const ang = craneState.angle;
          const cabX = cfg.mast.x + 1.1 * Math.cos(ang) + 0.9 * Math.sin(ang);
          const cabZ = cfg.mast.z + 1.1 * Math.sin(ang) - 0.9 * Math.cos(ang);
          mesh.position.set(cabX, cfg.cabinY - 0.4, cabZ);
          mesh.rotation.y = -ang;
        } else {
          mesh.position.set(p.x, p.y, p.z);
          mesh.rotation.y = p.facing;
        }
      } else {
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.y = p.facing;
      }

      poseCraneWorker(mesh, nowSec, {
        moving: Math.hypot(p.vx, p.vz) > 0.3,
        swinging: p.role === 'swinger',
        color: p.color,
        still: Math.hypot(p.vx, p.vy, p.vz) < 0.1,
      });
    }

    // Update Camera Target if in Follow mode
    if (this.cameraMode === 'follow') {
      const myPlayer = world.players.find((p) => p.id === this.localId);
      if (myPlayer) {
        this.orbit.target.lerp(
          new T.Vector3(myPlayer.x, myPlayer.y + 1.5, myPlayer.z),
          0.08,
        );
      }
    } else {
      this.orbit.target.lerp(new T.Vector3(0, 3.5, 2.5), 0.05);
    }
  }

  private pollInput() {
    if (this.destroyed) return;
    const now = performance.now();
    if (now - this.lastInputSend < 30) return; // 33Hz input rate

    // Gather WASD inputs
    let wasdX = 0;
    let wasdZ = 0;
    if (this.keys.has('KeyA')) wasdX -= 1;
    if (this.keys.has('KeyD')) wasdX += 1;
    if (this.keys.has('KeyW')) wasdZ -= 1;
    if (this.keys.has('KeyS')) wasdZ += 1;

    // Gather Arrow inputs
    let arrowX = 0;
    let arrowZ = 0;
    if (this.keys.has('ArrowLeft')) arrowX -= 1;
    if (this.keys.has('ArrowRight')) arrowX += 1;
    if (this.keys.has('ArrowUp')) arrowZ += 1; // Trolley OUT
    if (this.keys.has('ArrowDown')) arrowZ -= 1; // Trolley IN

    // Gather Hoist inputs
    let hoistY = 0;
    if (this.keys.has('KeyQ') || this.keys.has('KeyR')) hoistY += 1; // Up
    if (this.keys.has('KeyZ') || this.keys.has('KeyF')) hoistY -= 1; // Down

    let swingRawX = 0;
    let swingRawZ = 0;
    let craneX = 0;
    let craneZ = 0;
    const craneY = hoistY;

    if (this.isSoloTeam) {
      // Solo player on team: Simultaneous Dual Control!
      if (!this.swappedControls) {
        // Standard: WASD = Swinger, Arrow keys = Crane
        swingRawX = wasdX;
        swingRawZ = wasdZ;
        craneX = arrowX;
        craneZ = arrowZ;
      } else {
        // Swapped (Tab): WASD = Crane, Arrow keys = Swinger
        swingRawX = arrowX;
        swingRawZ = -arrowZ;
        craneX = wasdX;
        craneZ = -wasdZ;
      }
    } else {
      // 2 players on team: Split Roles!
      if (this.localRole === 'operator') {
        // Operator can use WASD or Arrows to drive crane
        craneX = wasdX !== 0 ? wasdX : arrowX;
        craneZ = wasdZ !== 0 ? -wasdZ : arrowZ;
      } else {
        // Swinger can use WASD or Arrows to swing
        swingRawX = wasdX !== 0 ? wasdX : arrowX;
        swingRawZ = wasdZ !== 0 ? wasdZ : -arrowZ;
      }
    }

    // Rotate swing input relative to camera azimuth
    const camAngle = this.orbit.angle;
    const cos = Math.cos(camAngle);
    const sin = Math.sin(camAngle);
    const worldSwingX = swingRawX * cos - swingRawZ * sin;
    const worldSwingZ = swingRawX * sin + swingRawZ * cos;

    this.inputSeq = (this.inputSeq + 1) % 10000;
    this.lastInputSend = now;

    this.cb.input({
      x: clamp(worldSwingX, -1, 1),
      z: clamp(worldSwingZ, -1, 1),
      y: clamp(craneY, -1, 1),
      craneX: clamp(craneX, -1, 1),
      craneZ: clamp(craneZ, -1, 1),
      craneY: clamp(craneY, -1, 1),
      grab: false,
      seq: this.inputSeq,
    });
  }

  private animate = () => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.animate);

    this.pollInput();

    // Position camera using spherical orbit
    const cosPitch = Math.cos(this.orbit.pitch);
    const sinPitch = Math.sin(this.orbit.pitch);
    const cx =
      this.orbit.target.x +
      this.orbit.distance * cosPitch * Math.sin(this.orbit.angle);
    const cy = this.orbit.target.y + this.orbit.distance * sinPitch;
    const cz =
      this.orbit.target.z +
      this.orbit.distance * cosPitch * Math.cos(this.orbit.angle);

    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.orbit.target);

    this.renderer.render(this.scene, this.camera);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }
    this.keys.add(e.code);

    if (e.code === 'KeyV') {
      this.cameraMode = this.cameraMode === 'overview' ? 'follow' : 'overview';
    } else if (e.code === 'Tab') {
      e.preventDefault();
      this.swappedControls = !this.swappedControls;
    } else if (e.code === 'KeyE' || e.code === 'Space') {
      e.preventDefault();
      this.cb.action({ type: 'grab' });
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (_e: PointerEvent) => {
    this.dragging = true;
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.orbit.angle += e.movementX * 0.005;
    this.orbit.pitch = clamp(this.orbit.pitch + e.movementY * 0.004, 0.15, 1.2);
  };

  private onPointerUp = () => {
    this.dragging = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.orbit.distance = clamp(this.orbit.distance + e.deltaY * 0.02, 12, 60);
  };

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('wheel', this.onWheel);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(
        this.renderer.domElement,
      );
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
