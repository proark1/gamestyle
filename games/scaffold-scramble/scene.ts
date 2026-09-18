import * as T from 'three';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import { poseScaffoldWorker } from './avatar';
import {
  createCloudMesh,
  createCradleMesh,
  createHelicopterMesh,
  createPigeonMesh,
  createSoapBucketMesh,
  createSpongeMesh,
  createSqueegeeMesh,
  createSkyscraperMesh,
  createWindowMesh,
  type TrafficCar,
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
import { createRenderer } from '../../shared/rendering/create-renderer';

export type SceneCallbacks = {
  input: (input: PlayerInput) => void;
  action: (action: ScaffoldAction) => void;
};

type ParticleType =
  | 'bubble'
  | 'water'
  | 'sparkle'
  | 'wind'
  | 'feather'
  | 'spark'
  | 'confetti';

type Particle = {
  mesh: T.Mesh | T.Group;
  type: ParticleType;
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  scale: number;
  growth: number;
  life: number;
  maxLife: number;
};

export class ScaffoldScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;

  private skyscraperGroup: T.Group;
  private windsockMesh: T.Group;
  private trafficCars: TrafficCar[] = [];
  private clouds: {
    group: T.Group;
    speed: number;
    baseZ: number;
    baseY: number;
  }[] = [];

  private cradleGroup: T.Group;
  private drumLeft: T.Object3D | null = null;
  private drumRight: T.Object3D | null = null;
  private crankArmLeft: T.Object3D | null = null;
  private crankArmRight: T.Object3D | null = null;
  private beaconBulb: T.Mesh | null = null;

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

  // Particle System Pool
  private particles: Particle[] = [];
  private particleGroup = new T.Group();

  // Screen Shake & Camera
  private trauma = 0;
  private cameraTarget = new T.Vector3(0, 50, 0);
  private keys = new Set<string>();
  private localId = '';
  private localRole: Role = 'cleaner';
  private dragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private orbitOffset = { yaw: 0, pitch: 0.12, distance: 16.5 };
  private destroyed = false;
  private animId = 0;
  private lastTime = performance.now();
  private lastHandledEventId = 0;
  private prevLeftHeight = 50;
  private prevRightHeight = 50;

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
  ) {
    this.renderer = createRenderer(container, {
      exposure: 1.25,
      focusable: false,
    }).renderer;
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // High altitude vibrant sky with atmospheric haze
    this.scene.background = new T.Color('#7ec3f2');
    this.scene.fog = new T.FogExp2('#9fd7f8', 0.0035);

    this.camera = new T.PerspectiveCamera(
      48,
      container.clientWidth / container.clientHeight,
      0.5,
      350,
    );

    // Lighting setup
    const hemi = new T.HemisphereLight('#cffafe', '#1e293b', 1.05);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight('#fffbeb', 1.6);
    sun.position.set(22, 95, 45);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 200;
    const d = 36;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    // Skyscraper & Helipad assembly
    const sky = createSkyscraperMesh();
    this.skyscraperGroup = sky.root;
    this.windsockMesh = sky.windsock;
    this.trafficCars = sky.cars;
    this.scene.add(this.skyscraperGroup);

    // 3D Low-poly clouds drifting at multiple depths and altitudes
    for (let i = 0; i < 16; i++) {
      const cloud = createCloudMesh();
      const baseZ = -30 + (i % 4) * 22 + (Math.random() * 8 - 4);
      const baseY = 18 + i * 5.2 + Math.random() * 3;
      const initialX = -45 + ((i * 9.5) % 90) + Math.random() * 4;
      const scale = 0.75 + (i % 3) * 0.35;
      cloud.scale.set(scale, scale, scale);
      cloud.position.set(initialX, baseY, baseZ);
      this.scene.add(cloud);
      this.clouds.push({
        group: cloud,
        speed: 1.2 + (i % 5) * 0.6,
        baseZ,
        baseY,
      });
    }

    // Suspended Cradle
    this.cradleGroup = createCradleMesh();
    this.drumLeft = this.cradleGroup.getObjectByName('drumLeft') ?? null;
    this.drumRight = this.cradleGroup.getObjectByName('drumRight') ?? null;
    this.crankArmLeft =
      this.cradleGroup.getObjectByName('crankArmLeft') ?? null;
    this.crankArmRight =
      this.cradleGroup.getObjectByName('crankArmRight') ?? null;
    this.beaconBulb =
      (this.cradleGroup.getObjectByName('beaconBulb') as T.Mesh) ?? null;
    this.scene.add(this.cradleGroup);

    // CEO's Helicopter
    const heli = createHelicopterMesh();
    this.helicopterGroup = heli.root;
    this.mainRotorGroup = heli.mainRotor;
    this.tailRotorGroup = heli.tailRotor;
    this.scene.add(this.helicopterGroup);

    // Suspension Cables (Left and Right)
    const cableMat = new T.LineBasicMaterial({
      color: '#1e293b',
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

    // Particle pool setup
    this.scene.add(this.particleGroup);
    this.initParticles();

    this.bindEvents();
    this.startLoop();
  }

  public setLocalPlayer(id: string, role: Role) {
    this.localId = id;
    this.localRole = role;
  }

  public addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  private initParticles() {
    // Pre-allocate 140 pooled particle meshes
    const bubbleGeo = new T.SphereGeometry(0.18, 8, 6);
    const bubbleMat = new T.MeshStandardMaterial({
      color: '#e0f2fe',
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.85,
    });

    const waterGeo = new T.SphereGeometry(0.09, 6, 5);
    const waterMat = new T.MeshStandardMaterial({
      color: '#38bdf8',
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.8,
    });

    const starGeo = new T.BoxGeometry(0.24, 0.05, 0.02);
    const starMat = new T.MeshBasicMaterial({ color: '#facc15' });

    const windGeo = new T.BoxGeometry(2.4, 0.05, 0.05);
    const windMat = new T.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.55,
    });

    const featherGeo = new T.BoxGeometry(0.28, 0.1, 0.02);
    const featherMat = new T.MeshStandardMaterial({
      color: '#e2e8f0',
      roughness: 0.9,
    });

    const sparkGeo = new T.BoxGeometry(0.12, 0.12, 0.03);
    const sparkMat = new T.MeshBasicMaterial({ color: '#f97316' });

    const confettiMat = [
      new T.MeshBasicMaterial({ color: '#ef4444', side: T.DoubleSide }),
      new T.MeshBasicMaterial({ color: '#3b82f6', side: T.DoubleSide }),
      new T.MeshBasicMaterial({ color: '#10b981', side: T.DoubleSide }),
      new T.MeshBasicMaterial({ color: '#facc15', side: T.DoubleSide }),
      new T.MeshBasicMaterial({ color: '#a855f7', side: T.DoubleSide }),
    ];
    const confettiGeo = new T.PlaneGeometry(0.25, 0.15);

    for (let i = 0; i < 140; i++) {
      let mesh: T.Mesh | T.Group;
      const type: ParticleType =
        i < 30
          ? 'bubble'
          : i < 60
            ? 'water'
            : i < 80
              ? 'sparkle'
              : i < 95
                ? 'wind'
                : i < 110
                  ? 'feather'
                  : i < 125
                    ? 'spark'
                    : 'confetti';

      if (type === 'bubble') {
        mesh = new T.Mesh(bubbleGeo, bubbleMat.clone());
      } else if (type === 'water') {
        mesh = new T.Mesh(waterGeo, waterMat.clone());
      } else if (type === 'sparkle') {
        const g = new T.Group();
        const m1 = new T.Mesh(starGeo, starMat);
        const m2 = new T.Mesh(new T.BoxGeometry(0.05, 0.24, 0.02), starMat);
        g.add(m1);
        g.add(m2);
        mesh = g;
      } else if (type === 'wind') {
        mesh = new T.Mesh(windGeo, windMat);
      } else if (type === 'feather') {
        mesh = new T.Mesh(featherGeo, featherMat);
      } else if (type === 'spark') {
        mesh = new T.Mesh(sparkGeo, sparkMat);
      } else {
        mesh = new T.Mesh(confettiGeo, confettiMat[i % confettiMat.length]);
      }

      mesh.visible = false;
      this.particleGroup.add(mesh);

      this.particles.push({
        mesh,
        type,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        vRotX: 0,
        vRotY: 0,
        vRotZ: 0,
        scale: 1,
        growth: 0,
        life: 0,
        maxLife: 1,
      });
    }
  }

  public spawnParticles(
    type: ParticleType,
    pos: { x: number; y: number; z: number },
    count = 1,
  ) {
    let spawned = 0;
    for (const p of this.particles) {
      if (p.active || p.type !== type) continue;

      p.active = true;
      p.mesh.visible = true;
      p.x = pos.x;
      p.y = pos.y;
      p.z = pos.z;

      if (type === 'bubble') {
        p.vx = (Math.random() - 0.5) * 1.8;
        p.vy = 0.5 + Math.random() * 1.5;
        p.vz = 0.2 + Math.random() * 0.8;
        p.scale = 0.6 + Math.random() * 0.8;
        p.growth = 0.2;
        p.life = 0;
        p.maxLife = 0.9 + Math.random() * 0.6;
      } else if (type === 'water') {
        p.vx = (Math.random() - 0.5) * 1.2;
        p.vy = -1.5 - Math.random() * 2.5;
        p.vz = (Math.random() - 0.5) * 0.4;
        p.scale = 0.8 + Math.random() * 0.5;
        p.growth = -0.2;
        p.life = 0;
        p.maxLife = 0.7 + Math.random() * 0.4;
      } else if (type === 'sparkle') {
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = (Math.random() - 0.5) * 1.5;
        p.vz = 0.2 + Math.random() * 0.4;
        p.vRotZ = 6.0 + Math.random() * 6.0;
        p.scale = 0.4;
        p.growth = 1.6;
        p.life = 0;
        p.maxLife = 0.6 + Math.random() * 0.4;
      } else if (type === 'wind') {
        const dir = Math.sign(p.x || 1);
        p.vx = (p.vx || -12) * dir;
        p.vy = (Math.random() - 0.5) * 0.6;
        p.vz = 0;
        p.scale = 1.0;
        p.growth = 0;
        p.life = 0;
        p.maxLife = 1.1;
      } else if (type === 'feather') {
        p.vx = (Math.random() - 0.5) * 2.5;
        p.vy = 1.2 + Math.random() * 1.5;
        p.vz = (Math.random() - 0.5) * 1.2;
        p.vRotZ = (Math.random() - 0.5) * 8.0;
        p.scale = 0.9;
        p.growth = 0;
        p.life = 0;
        p.maxLife = 1.4;
      } else if (type === 'spark') {
        p.vx = (Math.random() - 0.5) * 4.0;
        p.vy = 1.5 + Math.random() * 3.0;
        p.vz = (Math.random() - 0.5) * 1.5;
        p.scale = 0.9;
        p.growth = -1.2;
        p.life = 0;
        p.maxLife = 0.35;
      } else if (type === 'confetti') {
        p.vx = (Math.random() - 0.5) * 8.0;
        p.vy = 4.0 + Math.random() * 6.0;
        p.vz = (Math.random() - 0.5) * 4.0;
        p.vRotX = (Math.random() - 0.5) * 10;
        p.vRotY = (Math.random() - 0.5) * 10;
        p.vRotZ = (Math.random() - 0.5) * 10;
        p.scale = 1.0;
        p.growth = 0;
        p.life = 0;
        p.maxLife = 2.4;
      }

      p.mesh.position.set(p.x, p.y, p.z);
      spawned++;
      if (spawned >= count) break;
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Physics integration
      if (p.type === 'bubble') {
        p.vy += dt * 0.4;
        p.x += Math.sin(p.life * 8) * dt * 0.8;
      } else if (p.type === 'water') {
        p.vy -= dt * 9.8; // Gravity
      } else if (p.type === 'feather') {
        p.vy -= dt * 1.8; // Gentle float down
        p.x += Math.sin(p.life * 6) * dt * 1.2;
      } else if (p.type === 'spark') {
        p.vy -= dt * 14.0;
      } else if (p.type === 'confetti') {
        p.vy -= dt * 6.5;
        p.vx *= 0.97;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      p.rotX += p.vRotX * dt;
      p.rotY += p.vRotY * dt;
      p.rotZ += p.vRotZ * dt;

      p.scale = Math.max(0.01, p.scale + p.growth * dt);

      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.set(p.rotX, p.rotY, p.rotZ);
      p.mesh.scale.set(p.scale, p.scale, p.scale);
    }
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
    const nowSec = performance.now() * 0.001;

    // Handle incoming game events for visual FX triggers
    for (const evt of world.events) {
      if (evt.id <= this.lastHandledEventId) continue;
      this.lastHandledEventId = evt.id;

      if (evt.type === 'soap_apply') {
        const p = world.players.find((pl) => pl.id === evt.playerId);
        const px = p ? p.deckX * Math.cos(world.cradle.tiltRad) : 0;
        const py =
          world.cradle.centerHeight +
          (p ? p.deckX * Math.sin(world.cradle.tiltRad) + 1.2 : 0);
        this.spawnParticles('bubble', { x: px, y: py, z: 0.8 }, 16);
      } else if (evt.type === 'window_clean') {
        const p = world.players.find((pl) => pl.id === evt.playerId);
        const px = p ? p.deckX * Math.cos(world.cradle.tiltRad) : 0;
        const py =
          world.cradle.centerHeight +
          (p ? p.deckX * Math.sin(world.cradle.tiltRad) + 1.2 : 0);
        this.spawnParticles('water', { x: px, y: py, z: 0.8 }, 20);
        this.spawnParticles('sparkle', { x: px, y: py, z: 0.9 }, 5);
        this.addTrauma(0.15);
      } else if (evt.type === 'pigeon_shoo') {
        const p = world.players.find((pl) => pl.id === evt.playerId);
        const px = p ? p.deckX : 0;
        this.spawnParticles(
          'feather',
          { x: px, y: world.cradle.centerHeight + 1.5, z: 1.2 },
          8,
        );
      } else if (evt.type === 'slip' || evt.type === 'dangle') {
        this.addTrauma(0.38);
        const p = world.players.find((pl) => pl.id === evt.playerId);
        const px = p ? p.deckX : 0;
        this.spawnParticles(
          'spark',
          { x: px, y: world.cradle.centerHeight + 0.2, z: 1.2 },
          6,
        );
      } else if (evt.type === 'bucket_spill') {
        this.addTrauma(0.45);
        this.spawnParticles(
          'water',
          { x: 0, y: world.cradle.centerHeight + 0.3, z: 1.2 },
          22,
        );
      } else if (evt.type === 'tilt_warning') {
        this.addTrauma(0.25);
      } else if (evt.type === 'wind_gust') {
        this.addTrauma(0.2);
        this.spawnParticles(
          'wind',
          {
            x: world.wind.strength > 0 ? -18 : 18,
            y: world.cradle.centerHeight + 2.0,
            z: 2.0,
          },
          3,
        );
      } else if (evt.type === 'win') {
        this.spawnParticles(
          'confetti',
          { x: -CRADLE_WIDTH / 2, y: world.cradle.centerHeight + 2.5, z: 1.5 },
          35,
        );
        this.spawnParticles(
          'confetti',
          { x: CRADLE_WIDTH / 2, y: world.cradle.centerHeight + 2.5, z: 1.5 },
          35,
        );
      }
    }

    // 1. Update Windows
    for (const win of world.windows) {
      let winObj = this.windowMeshes.get(win.id);
      if (!winObj) {
        winObj = createWindowMesh();
        winObj.group.position.set(win.x, win.y, 0.05);
        this.scene.add(winObj.group);
        this.windowMeshes.set(win.id, winObj);
      }

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
          const s = 1.0 + Math.sin(nowSec * 10) * 0.2;
          winObj.sparkleMesh.scale.set(s, s, s);
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

    // 3. Winch Drum & Handle Animations
    const dLeftH = world.cradle.leftHeight - this.prevLeftHeight;
    const dRightH = world.cradle.rightHeight - this.prevRightHeight;
    this.prevLeftHeight = world.cradle.leftHeight;
    this.prevRightHeight = world.cradle.rightHeight;

    if (Math.abs(dLeftH) > 0.001) {
      const crankSpin = Math.sign(dLeftH) * 0.45;
      if (this.drumLeft) this.drumLeft.rotation.x += crankSpin;
      if (this.crankArmLeft) this.crankArmLeft.rotation.x += crankSpin * 1.8;
    }
    if (Math.abs(dRightH) > 0.001) {
      const crankSpin = Math.sign(dRightH) * 0.45;
      if (this.drumRight) this.drumRight.rotation.x += crankSpin;
      if (this.crankArmRight) this.crankArmRight.rotation.x += crankSpin * 1.8;
    }

    // 4. Strobe Warning Beacon on Cradle Rail
    if (this.beaconBulb) {
      const absTilt = Math.abs(world.cradle.tiltDeg);
      const bulbMat = this.beaconBulb.material as T.MeshStandardMaterial;
      if (absTilt >= 20.0) {
        // Frantic red emergency strobe!
        const flash = Math.floor(nowSec * 14) % 2 === 0;
        bulbMat.color.set('#ef4444');
        bulbMat.emissive.set('#ef4444');
        bulbMat.emissiveIntensity = flash ? 2.2 : 0.08;
      } else if (absTilt >= 15.0) {
        // Warning amber pulse
        bulbMat.color.set('#f59e0b');
        bulbMat.emissive.set('#f59e0b');
        bulbMat.emissiveIntensity = 0.4 + Math.sin(nowSec * 9) * 0.6;
      } else {
        // Normal dim amber standby
        bulbMat.color.set('#eab308');
        bulbMat.emissive.set('#eab308');
        bulbMat.emissiveIntensity = 0.2;
      }
    }

    // 5. Update Suspension Cables with tension vibration
    const cableVib =
      (Math.sin(nowSec * 45) * 0.025 + Math.cos(nowSec * 60) * 0.015) *
      (world.wind.active ? 2.0 : 0.6);

    // Left Cable from Roof to Left Winch
    const leftAnchorX =
      (-CRADLE_WIDTH / 2) * Math.cos(world.cradle.tiltRad) + world.cradle.swayX;
    const leftAnchorY = world.cradle.leftHeight;
    const leftPos = this.cableLeftLine.geometry.attributes.position;
    leftPos.setXYZ(0, -CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2);
    leftPos.setXYZ(1, leftAnchorX + cableVib, leftAnchorY + 1.7, 1.2);
    leftPos.needsUpdate = true;

    // Right Cable from Roof to Right Winch
    const rightAnchorX =
      (CRADLE_WIDTH / 2) * Math.cos(world.cradle.tiltRad) + world.cradle.swayX;
    const rightAnchorY = world.cradle.rightHeight;
    const rightPos = this.cableRightLine.geometry.attributes.position;
    rightPos.setXYZ(0, CRADLE_WIDTH / 2, ROOF_ALTITUDE + 3.4, 1.2);
    rightPos.setXYZ(1, rightAnchorX - cableVib, rightAnchorY + 1.7, 1.2);
    rightPos.needsUpdate = true;

    // 6. Helipad Windsock reaction to wind
    if (this.windsockMesh) {
      const windDir = world.wind.strength >= 0 ? 0 : Math.PI;
      const targetRotY = windDir + Math.sin(nowSec * 4) * 0.15;
      this.windsockMesh.rotation.y +=
        (targetRotY - this.windsockMesh.rotation.y) * 0.1;
      const droop = (1.0 - Math.min(1.0, Math.abs(world.wind.strength))) * 0.7;
      this.windsockMesh.rotation.z = droop + Math.sin(nowSec * 6) * 0.08;
    }

    // 7. Update Buckets
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

    // 8. Update Pigeons
    for (const pigeon of world.pigeons) {
      let pMesh = this.pigeonMeshes.get(pigeon.id);
      if (!pMesh) {
        pMesh = createPigeonMesh();
        this.scene.add(pMesh.root);
        this.pigeonMeshes.set(pigeon.id, pMesh);
      }

      pMesh.root.position.set(pigeon.x, pigeon.y, 1.35);

      const flap = Math.sin(pigeon.flapTimer * 18) * 0.75;
      if (!pigeon.perched) {
        pMesh.wingL.rotation.z = -flap;
        pMesh.wingR.rotation.z = flap;
      } else {
        pMesh.wingL.rotation.z = 0;
        pMesh.wingR.rotation.z = 0;
      }
    }

    // 9. Update Helicopter
    this.helicopterGroup.position.set(0, world.helicopter.y, 14.0);
    this.mainRotorGroup.rotation.y = world.helicopter.bladeAngle;
    this.tailRotorGroup.rotation.x = world.helicopter.bladeAngle * 1.5;

    // 10. Update Players
    const activeIds = new Set(world.players.map((p) => p.id));
    for (const [id, pMesh] of this.playerMeshes) {
      if (!activeIds.has(id)) {
        this.cradleGroup.remove(pMesh.root);
        this.cradleGroup.remove(pMesh.tetherLine);
        this.playerMeshes.delete(id);
      }
    }

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

        // Safety harness tether line (high-visibility safety orange lanyard)
        const tetherGeo = new T.BufferGeometry().setFromPoints([
          new T.Vector3(0, 0, 0),
          new T.Vector3(0, 0, 0),
        ]);
        const tetherMat = new T.LineBasicMaterial({
          color: '#ea580c',
          linewidth: 3,
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
      poseScaffoldWorker(pObj.root, nowSec, {
        state: player.state,
        moving: Math.abs(player.vx) > 0.2,
        color: player.color,
        facing: player.facing,
      });
    }

    // 11. Vertigo Camera Follow with Screen Shake
    const targetY = world.cradle.centerHeight + 1.2;
    this.cameraTarget.y += (targetY - this.cameraTarget.y) * 0.08;
    this.cameraTarget.x +=
      (world.cradle.swayX * 0.4 - this.cameraTarget.x) * 0.08;

    const shakeFactor = this.trauma * this.trauma;
    const shakeX =
      (Math.sin(nowSec * 50) * 0.35 + Math.cos(nowSec * 65) * 0.2) *
      shakeFactor;
    const shakeY =
      (Math.cos(nowSec * 45) * 0.35 + Math.sin(nowSec * 60) * 0.2) *
      shakeFactor;

    const camDistance = this.orbitOffset.distance;
    const yaw = this.orbitOffset.yaw;
    const pitch = this.orbitOffset.pitch;

    this.camera.position.set(
      this.cameraTarget.x +
        Math.sin(yaw) * Math.cos(pitch) * camDistance +
        shakeX,
      this.cameraTarget.y + Math.sin(pitch) * camDistance + 1.5 + shakeY,
      Math.cos(yaw) * Math.cos(pitch) * camDistance,
    );
    this.camera.lookAt(
      this.cameraTarget.x + shakeX * 0.3,
      this.cameraTarget.y + shakeY * 0.3,
      0.5,
    );
  }

  private startLoop() {
    const loop = () => {
      if (this.destroyed) return;
      this.animId = requestAnimationFrame(loop);

      const now = performance.now();
      const dt = Math.min(0.1, (now - this.lastTime) * 0.001);
      this.lastTime = now;

      // Poll input keys
      this.pollInput();

      // Decay screen shake trauma
      this.trauma = Math.max(0, this.trauma - dt * 1.6);

      // Animate drifting low-poly clouds
      for (const c of this.clouds) {
        c.group.position.x += c.speed * dt;
        if (c.group.position.x > 50) {
          c.group.position.x = -50;
        }
      }

      // Animate moving ground traffic far below
      for (const car of this.trafficCars) {
        car.mesh.position.x += car.speed * car.dir * dt;
        if (car.dir > 0 && car.mesh.position.x > car.maxX) {
          car.mesh.position.x = car.minX;
        } else if (car.dir < 0 && car.mesh.position.x < car.minX) {
          car.mesh.position.x = car.maxX;
        }
      }

      // Update particle effects
      this.updateParticles(dt);

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
