import * as T from 'three';
import { worker } from '../../shared/rendering/worker';
import { poseCurler } from './avatar';
import {
  createBananaMesh,
  createCurlingRinkMesh,
  createGadgetMesh,
  createStoneMesh,
} from './models';
import {
  HACK_Z,
  TEE_Z,
  type GadgetId,
  type PanicCurlingSnapshot,
  type PanicCurlingWorld,
  type PlayerInput,
} from './types';

type SceneCallbacks = {
  input: (inp: PlayerInput) => void;
};

export class PanicCurlingScene {
  private container: HTMLDivElement;
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;
  private resizeObserver: ResizeObserver;

  private rinkGroup: T.Group;
  private aimArrow: T.Group;
  private stoneMeshes = new Map<string, T.Group>();
  private playerMeshes = new Map<string, T.Group>();
  private gadgetMeshes = new Map<string, T.Group>();
  private tileMeshes = new Map<string, T.Mesh>();
  private hazardMeshes = new Map<string, T.Group>();

  private particles: {
    mesh: T.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
  }[] = [];
  private snowflakes: { mesh: T.Mesh; vx: number; vy: number; vz: number }[] =
    [];
  private particleGeo = new T.BoxGeometry(0.06, 0.06, 0.06);
  private snowMat = new T.MeshBasicMaterial({ color: '#ffffff' });
  private steamMat = new T.MeshBasicMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.7,
  });

  private callbacks: SceneCallbacks;
  private time = 0;
  private localPlayerId = '';
  private cameraTarget = new T.Vector3(0, 0, HACK_Z + 4);
  private trauma = 0;

  constructor(container: HTMLDivElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Setup Renderer with ACES Filmic Tone Mapping
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    // 2. Setup Scene and Atmospheric Winter Fog
    this.scene.background = new T.Color('#9bc5de');
    this.scene.fog = new T.FogExp2('#9bc5de', 0.012);

    // 3. Camera
    this.camera = new T.PerspectiveCamera(
      44,
      container.clientWidth / container.clientHeight,
      0.5,
      140,
    );
    this.camera.position.set(0, 5.0, HACK_Z - 5.5);
    this.camera.lookAt(0, 0.4, HACK_Z + 12);

    // 4. Lighting: Warm Golden Winter Sunlight & Sky Ambient
    const ambient = new T.AmbientLight('#c8e4f8', 1.25);
    this.scene.add(ambient);

    const sun = new T.DirectionalLight('#fff8ea', 1.85);
    sun.position.set(16, 28, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -15;
    this.scene.add(sun);

    // 5. Rink Mesh
    this.rinkGroup = createCurlingRinkMesh();
    this.scene.add(this.rinkGroup);

    // 6. Aiming Guide Arrow
    this.aimArrow = this.createAimArrow();
    this.scene.add(this.aimArrow);

    // 7. Ambient Falling Snow Particles
    this.initSnowflakes();

    // 8. Resize Observer
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    });
    this.resizeObserver.observe(container);
  }

  public setLocalPlayer(id: string) {
    this.localPlayerId = id;
  }

  public render(snapshot: PanicCurlingSnapshot) {
    const world = snapshot.world;
    this.time += 0.016;

    // 1. Synchronize Ice Tiles (Thin Ice Cracking & Breaking)
    this.syncIceTiles(world);

    // 2. Synchronize Stones
    this.syncStones(world);

    // 3. Synchronize Players & Gadgets
    this.syncPlayers(world);

    // 4. Synchronize Hazards (Bananas)
    this.syncHazards(world);

    // 5. Process Visual Particles & Events
    this.processEvents(world);
    this.updateParticles();
    this.updateSnowflakes(0.016);

    // 6. Update Aim Arrow
    this.updateAimArrow(world);

    // 7. Camera Tracking
    this.updateCamera(world);

    this.renderer.render(this.scene, this.camera);
  }

  private syncIceTiles(world: PanicCurlingWorld) {
    for (const tile of world.iceTiles) {
      let mesh = this.tileMeshes.get(tile.id);
      if (!mesh) {
        const geo = new T.PlaneGeometry(tile.w * 0.96, tile.d * 0.96);
        const mat = new T.MeshStandardMaterial({
          color: '#e2f4fd',
          roughness: 0.15,
          metalness: 0.1,
          transparent: true,
          opacity: 0.2,
        });
        mesh = new T.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(tile.x, 0.01, tile.z);
        this.scene.add(mesh);
        this.tileMeshes.set(tile.id, mesh);
      }
    }
  }

  private syncStones(world: PanicCurlingWorld) {
    const aliveIds = new Set<string>();

    for (const s of world.stones) {
      if (s.outOfBounds) continue;
      aliveIds.add(s.id);

      let group = this.stoneMeshes.get(s.id);
      if (!group) {
        group = createStoneMesh(s.kind, s.team);
        this.scene.add(group);
        this.stoneMeshes.set(s.id, group);
      }

      group.position.set(s.x, s.y, s.z);
      group.rotation.y = s.rotation;

      // Basket teammate wobble
      if (s.kind === 'basket' && s.active) {
        group.rotation.z = Math.sin(this.time * 18) * 0.12;
      }
    }

    // Remove obsolete stone meshes
    for (const [id, mesh] of this.stoneMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(mesh);
        this.stoneMeshes.delete(id);
      }
    }
  }

  private syncPlayers(world: PanicCurlingWorld) {
    const aliveIds = new Set<string>();

    for (const p of world.players) {
      aliveIds.add(p.id);

      let group = this.playerMeshes.get(p.id);
      let gadgetGroup = this.gadgetMeshes.get(p.id);

      if (!group) {
        const teamColor = p.team === 'red' ? '#d94b38' : '#3277b3';
        group = worker(p.color, {
          shirt: teamColor,
          overalls: '#223242',
          boots: '#111822',
          cap: true,
        });
        this.scene.add(group);
        this.playerMeshes.set(p.id, group);

        // Attach Gadget
        gadgetGroup = createGadgetMesh(p.gadget);
        this.scene.add(gadgetGroup);
        this.gadgetMeshes.set(p.id, gadgetGroup);
      }

      group.position.set(p.x, p.y, p.z);
      group.rotation.y = p.rotation;

      // Posing
      const isMoving = Math.hypot(p.vx, p.vz) > 0.1;
      poseCurler(group, this.time, {
        status: p.status,
        moving: isMoving,
        sweepIntensity: p.sweepIntensity,
        color: p.color,
      });

      // Update gadget position and visibility
      if (gadgetGroup) {
        if (p.role === 'sweeper') {
          gadgetGroup.visible = true;
          // Position right in front of the curler's hands
          const fx = p.x + Math.sin(p.rotation) * 0.45;
          const fz = p.z + Math.cos(p.rotation) * 0.45;
          gadgetGroup.position.set(fx, 0.05, fz);
          gadgetGroup.rotation.y = p.rotation;

          // Jiggle gadget during active sweeping
          if (p.sweepIntensity > 0) {
            gadgetGroup.position.x += Math.sin(this.time * 28) * 0.08;
            this.spawnSweepParticles(fx, fz, p.gadget);
          }
        } else {
          gadgetGroup.visible = false;
        }
      }
    }

    // Remove old player meshes
    for (const [id, mesh] of this.playerMeshes.entries()) {
      if (!aliveIds.has(id)) {
        this.scene.remove(mesh);
        this.playerMeshes.delete(id);
        const gMesh = this.gadgetMeshes.get(id);
        if (gMesh) {
          this.scene.remove(gMesh);
          this.gadgetMeshes.delete(id);
        }
      }
    }
  }

  private syncHazards(world: PanicCurlingWorld) {
    const activeIds = new Set<string>();

    for (const h of world.hazards) {
      if (!h.active) continue;
      activeIds.add(h.id);

      let group = this.hazardMeshes.get(h.id);
      if (!group) {
        group = createBananaMesh();
        this.scene.add(group);
        this.hazardMeshes.set(h.id, group);
      }
      group.position.set(h.x, 0.02, h.z);
    }

    for (const [id, mesh] of this.hazardMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.hazardMeshes.delete(id);
      }
    }
  }

  private createAimArrow(): T.Group {
    const g = new T.Group();
    // Shaft
    const shaftGeo = new T.CylinderGeometry(0.05, 0.05, 3.5, 8);
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.translate(0, 0, 1.75);
    const shaftMat = new T.MeshBasicMaterial({ color: '#f39c12' });
    const shaft = new T.Mesh(shaftGeo, shaftMat);
    g.add(shaft);

    // Arrowhead
    const headGeo = new T.ConeGeometry(0.22, 0.6, 8);
    headGeo.rotateX(Math.PI / 2);
    headGeo.translate(0, 0, 3.6);
    const head = new T.Mesh(headGeo, shaftMat);
    g.add(head);

    g.position.set(0, 0.08, HACK_Z + 0.4);
    g.visible = false;
    return g;
  }

  private updateAimArrow(world: PanicCurlingWorld) {
    if (world.phase === 'aiming') {
      this.aimArrow.visible = true;
      const deliverer = world.players.find(
        (p) => p.team === world.turnTeam && p.role === 'deliverer',
      );
      const angle = deliverer ? deliverer.input.aimAngle : 0;
      this.aimArrow.rotation.y = angle;
    } else {
      this.aimArrow.visible = false;
    }
  }

  private updateCamera(world: PanicCurlingWorld) {
    const activeStone = world.stones.find((s) => s.id === world.activeStoneId);

    if (world.phase === 'sliding' && activeStone && !activeStone.stopped) {
      if (activeStone.z > 21.0) {
        // Elevated broadcast angle as stone approaches House rings
        this.cameraTarget.lerp(new T.Vector3(0, 0.1, TEE_Z + 0.5), 0.07);
        this.camera.position.lerp(new T.Vector3(0, 8.8, TEE_Z - 5.8), 0.07);
      } else {
        // Intimate dynamic tracking dolly behind active stone down the sheet
        const targetZ = activeStone.z;
        const targetX = activeStone.x * 0.45;
        this.cameraTarget.lerp(
          new T.Vector3(targetX, 0.35, targetZ + 3.2),
          0.09,
        );

        const camZ = targetZ - 5.6;
        const camY = 4.2;
        this.camera.position.lerp(
          new T.Vector3(targetX * 0.6, camY, camZ),
          0.09,
        );
      }
    } else if (world.phase === 'end_summary') {
      // Zoom in on the House rings to inspect scoring
      this.cameraTarget.lerp(new T.Vector3(0, 0, TEE_Z), 0.06);
      this.camera.position.lerp(new T.Vector3(0, 9.2, TEE_Z - 5.5), 0.06);
    } else {
      // Aiming / warmup view: low dramatic perspective right behind hack
      this.cameraTarget.lerp(new T.Vector3(0, 0.4, HACK_Z + 14.0), 0.08);
      this.camera.position.lerp(new T.Vector3(0, 5.0, HACK_Z - 5.5), 0.08);
    }

    // Apply trauma screen shake
    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.trauma = Math.max(0, this.trauma - 0.016 * 2.2);
    }

    this.camera.lookAt(this.cameraTarget);
  }

  private initSnowflakes() {
    const flakeMat = new T.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.85,
    });
    const flakeGeo = new T.BoxGeometry(0.08, 0.08, 0.08);
    for (let i = 0; i < 75; i++) {
      const mesh = new T.Mesh(flakeGeo, flakeMat);
      mesh.position.set(
        (Math.random() - 0.5) * 22,
        Math.random() * 12 + 0.5,
        (Math.random() - 0.5) * 50 + 12,
      );
      this.scene.add(mesh);
      this.snowflakes.push({
        mesh,
        vx: (Math.random() - 0.5) * 0.4 - 0.15,
        vy: -0.8 - Math.random() * 0.9,
        vz: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  private updateSnowflakes(dt: number) {
    for (const f of this.snowflakes) {
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.y += f.vy * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.rotation.x += dt * 1.5;
      f.mesh.rotation.y += dt * 2.0;

      // Wrap around bounds
      if (f.mesh.position.y < 0.05) {
        f.mesh.position.y = 12.0;
        f.mesh.position.x = (Math.random() - 0.5) * 22;
        f.mesh.position.z = (Math.random() - 0.5) * 50 + 12;
      }
    }
  }

  public addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  private spawnSweepParticles(x: number, z: number, gadget: GadgetId) {
    const count = gadget === 'blowtorch' ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const mat = gadget === 'broom' ? this.snowMat : this.steamMat;
      const mesh = new T.Mesh(this.particleGeo, mat);
      mesh.position.set(
        x + (Math.random() - 0.5) * 0.4,
        0.08,
        z + (Math.random() - 0.5) * 0.3,
      );
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 0.8 + Math.random() * 1.2,
        vz: (Math.random() - 0.5) * 1.5,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }
  }

  private processEvents(world: PanicCurlingWorld) {
    for (const ev of world.events) {
      if (ev.type === 'stone_clack') {
        this.addTrauma(0.25);
      } else if (ev.type === 'banana_slip') {
        this.addTrauma(0.2);
      }
    }
  }

  private spawnWaterSplashParticles(x: number, z: number) {
    for (let i = 0; i < 16; i++) {
      const mesh = new T.Mesh(this.particleGeo, this.steamMat);
      mesh.position.set(x, 0.1, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 3.5,
        vy: 2.2 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 3.5,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3,
      });
    }
  }

  private updateParticles() {
    const dt = 0.016;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 9.8 * dt; // gravity

      const scale = Math.max(0, 1 - p.life / p.maxLife);
      p.mesh.scale.set(scale, scale, scale);

      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  public dispose() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }
}
