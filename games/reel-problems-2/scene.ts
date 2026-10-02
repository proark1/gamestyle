import { DeckJobsScene } from './deck-jobs-scene';
import { SurvivalScene } from './survival-scene';
import { MissionScene } from './mission-scene';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeGeometry } from '../../shared/rendering/primitives';
import * as THREE from 'three';
import {
  ANGLER_COLORS,
  DOCK,
  LANDING_MS,
  LEAK_WINDOW_MS,
  WELL_SURFACE,
  idleInput,
  landingPose,
  landingScale,
  type ReelInput,
  type ReelAction,
  type ReelSnapshot,
  type Vector,
} from './types';
import { freshReel, newAngler } from './simulation';
import {
  addShore,
  createAngler,
  createBoat,
  createCatch,
  createCrab,
  createPaddle,
  createFloatingHat,
  createFloatingScore,
  createLakeManagerShadow,
  deckSway,
  material,
  nameLabel,
  poseAngler,
} from './models';
import { SeaScene } from './sea-scene';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  DEFAULT_CAMERA_MODE,
  firstPersonPose,
  nextCameraMode,
  type CameraMode,
} from './camera';

type Callbacks = {
  input: (input: ReelInput) => void;
  action: (action: ReelAction) => void;
  tick: () => void;
  failure: () => void;
  camera: (mode: CameraMode) => void;
};
export class ReelScene {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 220);
  private boat = createBoat();
  private survivalScene = new SurvivalScene();
  private missionScene = new MissionScene(this.boat);
  private deckJobsScene = new DeckJobsScene(this.boat);
  private sea: SeaScene;
  private yaw = new THREE.Group();
  private anglers = new Map<string, THREE.Group>();
  private fish = new Map<string, THREE.Group>();
  private lines = new Map<string, THREE.Line>();
  private bobbers = new Map<string, THREE.Mesh>();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.15);
  private target = new THREE.Vector3();
  private ring = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.48, 24),
    new THREE.MeshBasicMaterial({ color: '#fff3b4', side: THREE.DoubleSide }),
  );
  private splash = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.34, 18),
    new THREE.MeshBasicMaterial({
      color: '#f0ffff',
      side: THREE.DoubleSide,
      transparent: true,
    }),
  );
  private splashAt = -1e9;
  private hull = 0;
  /** The stowaway, kept after it is punted so it can fly off the deck. */
  private crab = createCrab();
  private crabGoneAt = -1e9;
  /** Points a swimmer at the dock while the boat is on the lake bed. */
  private dockArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 0.9, 3),
    new THREE.MeshBasicMaterial({ color: '#ffd24a' }),
  );
  private dockBeacon = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.12, 6, 28),
    new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true }),
  );
  private swimRipples = new Map<string, THREE.Mesh>();
  private observer: ResizeObserver;
  private resizePending = true;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private abort = new AbortController();
  private frame = 0;
  private last = 0;
  private lastInput = 0;
  private keys = new Set<string>();
  private touch: Vector = { x: 0, z: 0 };
  private held = { reel: false, brace: false, work: false };
  private input = idleInput();
  private snapshot: ReelSnapshot | null = null;
  private demo = freshReel(100000);
  private localId = '';
  private cameraMode: CameraMode = DEFAULT_CAMERA_MODE;
  private snapCamera = true;
  private cameraTarget = new THREE.Vector3();
  private firstPersonOrigin = new THREE.Vector3();
  private firstPersonRotation = new THREE.Quaternion();
  private stopped = false;
  private trauma = 0;
  private lastProcessedEvent = 0;
  private floatingScores: {
    sprite: THREE.Sprite;
    born: number;
    duration: number;
    startY: number;
  }[] = [];
  private floatingHats = new Map<string, THREE.Group>();
  private splashParticles: {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];
  private splashPoints!: THREE.Points;
  private sparkParticles: {
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    maxLife: number;
  }[] = [];
  private sparkPoints!: THREE.Points;
  private lakeManagerShadow = createLakeManagerShadow();
  private deckFishMeshes = new Map<string, THREE.Group>();
  private boatWake!: THREE.Mesh;
  private flyingFishMesh = createCatch('salmon');
  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = createRenderer(container, {
      label:
        'Fishing lake. Click the water to cast; WASD moves, J jumps and P takes a paddle.',
    }).renderer;
    this.renderer.setClearColor('#cee4d5');
    this.scene.fog = new THREE.Fog('#cee4d5', 75, 145);
    this.scene.add(new THREE.HemisphereLight('#fff6dd', '#5c9597', 2.5));
    const sun = new THREE.DirectionalLight('#fff4d9', 3.2);
    sun.position.set(-22, 36, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.normalBias = 0.08;
    this.scene.add(sun);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(43, 96),
      material('#5baeb0', 0.36),
    );
    water.rotation.x = -Math.PI / 2;
    water.receiveShadow = true;
    water.position.y = -0.02;
    this.scene.add(water);
    this.sea = new SeaScene(this.scene, sun, water.material);
    addShore(this.scene);
    this.yaw.add(this.boat);
    this.scene.add(
      this.missionScene.root,
      this.survivalScene.root,
      this.deckJobsScene.root,
    );
    this.scene.add(this.yaw);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.1;
    this.ring.visible = false;
    this.scene.add(this.ring);
    // Rides in the boat so the splash stays over the well however it pitches.
    this.splash.rotation.x = -Math.PI / 2;
    this.splash.position.set(0, WELL_SURFACE + 0.02, 0);
    this.splash.visible = false;
    this.boat.add(this.splash);
    this.crab.visible = false;
    this.boat.add(this.crab);
    const wakeGeom = new THREE.PlaneGeometry(3.6, 5.5, 3, 3);
    wakeGeom.rotateX(-Math.PI / 2);
    this.boatWake = new THREE.Mesh(
      wakeGeom,
      new THREE.MeshBasicMaterial({
        color: '#cbf1f4',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.boatWake.position.set(0, 0.02, 4.0);
    this.yaw.add(this.boatWake);

    const splashGeom = new THREE.BufferGeometry();
    const splashPositions = new Float32Array(160 * 3);
    splashGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(splashPositions, 3),
    );
    this.splashPoints = new THREE.Points(
      splashGeom,
      new THREE.PointsMaterial({
        color: '#e0f7fa',
        size: 0.32,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.splashPoints.frustumCulled = false;
    this.scene.add(this.splashPoints);

    const sparkGeom = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(80 * 3);
    sparkGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(sparkPositions, 3),
    );
    this.sparkPoints = new THREE.Points(
      sparkGeom,
      new THREE.PointsMaterial({
        color: '#ffcc00',
        size: 0.28,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);

    this.lakeManagerShadow.visible = false;
    this.scene.add(this.lakeManagerShadow);

    this.flyingFishMesh.visible = false;
    this.flyingFishMesh.scale.setScalar(0.75);
    this.scene.add(this.flyingFishMesh);
    this.dockBeacon.rotation.x = -Math.PI / 2;
    this.dockBeacon.position.set(DOCK.x, 0.15, DOCK.z - 1);
    this.dockBeacon.visible = false;
    this.dockArrow.visible = false;
    this.scene.add(this.dockBeacon, this.dockArrow);
    for (let i = 0; i < 4; i++)
      this.demo.players.push(
        newAngler(
          `demo-${i}`,
          ['Captain', 'Skipper', 'Trouble', 'Bait'][i],
          i,
          this.demo.clock,
        ),
      );
    // Ripples mark a lake surface at a glance without a costly full-water simulation.
    const rippleGeometry = new THREE.TorusGeometry(0.5, 0.014, 3, 16),
      rippleMaterial = new THREE.MeshBasicMaterial({
        color: '#9bd2c8',
        transparent: true,
        opacity: 0.55,
      });
    const ripples = new THREE.Group();
    for (let i = 0; i < 45; i++) {
      const m = new THREE.Mesh(rippleGeometry, rippleMaterial);
      m.rotation.x = Math.PI / 2;
      m.position.set(Math.sin(i * 7.1) * 33, 0.03, Math.cos(i * 3.7) * 33);
      m.scale.setScalar(0.6 + (i % 3));
      ripples.add(m);
    }
    // They are placed once and never touched again, so they draw as one.
    batchScenery(ripples);
    this.scene.add(ripples);
    this.camera.position.set(0, 28, 30);
    this.camera.lookAt(0, 0, 0);
    // Observer delivery must not write layout and trigger another delivery.
    // The existing animation loop applies the latest size before drawing.
    this.observer = new ResizeObserver(() => {
      this.resizePending = true;
    });
    this.observer.observe(container);
    this.resize();
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, options);
    window.addEventListener('keyup', this.keyUp, options);
    window.addEventListener('blur', this.resetInput, options);
    document.addEventListener('visibilitychange', this.hidden, options);
    this.renderer.domElement.addEventListener('pointermove', this.aim, options);
    this.renderer.domElement.addEventListener(
      'pointerdown',
      this.cast,
      options,
    );
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost,
      options,
    );
    this.frame = requestAnimationFrame(this.render);
  }
  setSession(id: string) {
    this.localId = id;
  }
  setSnapshot(snapshot: ReelSnapshot | null) {
    this.snapshot = snapshot;
    if (!snapshot) this.resetInput();
  }
  move(v: Vector) {
    this.touch = v;
  }
  hold(key: 'reel' | 'brace' | 'work', value: boolean) {
    this.held[key] = value;
  }
  setCameraMode(mode: CameraMode) {
    if (mode === this.cameraMode) return;
    this.cameraMode = mode;
    this.snapCamera = true;
    this.cb.camera(mode);
  }
  changeCamera() {
    this.setCameraMode(nextCameraMode(this.cameraMode));
  }
  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.held = { reel: false, brace: false, work: false };
    this.input = idleInput();
    this.cb.input(this.input);
  };
  private spawnSplash(
    x: number,
    y: number,
    z: number,
    count = 18,
    speed = 4.2,
  ) {
    for (let i = 0; i < count; i++) {
      if (this.splashParticles.length >= 150) this.splashParticles.shift();
      const angle = Math.random() * Math.PI * 2;
      const spread = (Math.random() * 0.5 + 0.5) * speed;
      this.splashParticles.push({
        pos: new THREE.Vector3(
          x + (Math.random() - 0.5) * 0.4,
          y + 0.05,
          z + (Math.random() - 0.5) * 0.4,
        ),
        vel: new THREE.Vector3(
          Math.cos(angle) * spread * 0.65,
          Math.random() * speed + 1.2,
          Math.sin(angle) * spread * 0.65,
        ),
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
      });
    }
  }
  private hidden = () => {
    if (document.hidden) this.resetInput();
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.cb.failure();
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      (e.target as HTMLElement)?.closest(
        'input, textarea, [role="dialog"], [contenteditable="true"]',
      )
    )
      return;
    const key = e.key.toLowerCase();
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('button') &&
      (key === ' ' || key === 'enter')
    )
      return;
    if (
      ![
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        ' ',
        'e',
        'q',
        'r',
        'f',
        'shift',
        'v',
        'j',
        'p',
        'c',
        '1',
        '2',
        '3',
      ].includes(key)
    )
      return;
    e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
    if (this.snapshot?.world.mission && ['1', '2', '3'].includes(key))
      this.cb.action({
        type: 'sail',
        destination: (['fish', 'home', 'repair'] as const)[Number(key) - 1],
      });
    if (key === 'v') this.changeCamera();
    if (key === ' ') this.cb.action({ type: 'cast' });
    if (key === 'j') this.cb.action({ type: 'jump' });
    if (key === 'p') this.cb.action({ type: 'paddle' });
    if (key === 'q') this.cb.action({ type: 'cut' });
    if (key === 'r') this.cb.action({ type: 'untangle' });
    if (key === 'f') this.cb.action({ type: 'rescue' });
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private point(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    return this.ray.ray.intersectPlane(this.plane, this.target);
  }
  private aim = (e: PointerEvent) => {
    const point = this.point(e);
    this.ring.visible = !!point && this.snapshot?.world.phase === 'playing';
    if (point) this.ring.position.set(point.x, 0.1, point.z);
  };
  private cast = (e: PointerEvent) => {
    if (e.button !== 0 || this.snapshot?.world.phase !== 'playing') return;
    const p = this.point(e);
    if (p) this.cb.action({ type: 'cast', x: p.x, z: p.z });
  };
  private resize() {
    this.resizePending = false;
    const w = Math.max(1, this.container.clientWidth),
      h = Math.max(1, this.container.clientHeight);
    if (w === this.viewportWidth && h === this.viewportHeight) return;
    this.viewportWidth = w;
    this.viewportHeight = h;
    // CSS owns the displayed size; only resize the WebGL drawing buffer.
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  private render = (now: number) => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.render);
    const dt = Math.min(
      0.05,
      Math.max(0.001, (now - (this.last || now)) / 1000),
    );
    this.last = now;
    if (document.hidden) return;
    if (this.resizePending) this.resize();
    const x =
      this.touch.x +
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const z =
      this.touch.z +
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'));
    const norm = Math.max(1, Math.hypot(x, z));
    this.input = {
      x: x / norm,
      z: z / norm,
      seq: this.input.seq + 1,
      reel: this.held.reel || this.keys.has('e'),
      work: this.held.work || this.keys.has('c'),
      brace: this.held.brace || this.keys.has('shift'),
    };
    if (now - this.lastInput > 35) {
      this.cb.input(this.input);
      this.lastInput = now;
    }
    this.cb.tick();
    const world = this.snapshot?.world ?? this.demo,
      b = world.boat;
    this.sea.update(world, now);
    this.missionScene.update(world);
    this.survivalScene.update(world);
    this.deckJobsScene.update(world);
    const smooth = 1 - Math.exp(-12 * dt);
    // A new boat bobs up at the dock rather than gliding over from the wreck.
    if ((b.hull ?? 0) !== this.hull) {
      this.hull = b.hull ?? 0;
      this.yaw.position.set(b.x, -2.5, b.z);
      this.yaw.rotation.y = b.yaw;
    }
    // Hosts from before leaks send no water level.
    const flood = b.flood ?? 0;
    // It sits lower as it fills, then slips under and stays there.
    this.yaw.position.lerp(
      new THREE.Vector3(
        b.x,
        0.16 + Math.sin(now / 900) * 0.06 - flood * 0.45 - (b.sunk ? 3.2 : 0),
        b.z,
      ),
      b.sunk ? 1 - Math.exp(-1.5 * dt) : smooth,
    );
    this.yaw.rotation.y += (b.yaw - this.yaw.rotation.y) * smooth;
    this.boat.rotation.z +=
      ((this.snapshot
        ? b.roll + (b.sunk ? 0.45 : 0)
        : Math.sin(now / 1400) * 0.07) -
        this.boat.rotation.z) *
      smooth;
    this.boat.rotation.x += (b.pitch - this.boat.rotation.x) * smooth;
    this.boat.getObjectByName('tire')!.visible = world.gear.tire;
    const bilge = this.boat.getObjectByName('bilge')!;
    bilge.visible = flood > 0.01;
    bilge.position.y = 0.45 + flood * 0.6;
    const leak = this.boat.getObjectByName('leak')!,
      open = world.leak;
    leak.visible = !!open && !b.sunk;
    if (open) {
      leak.position.set(open.x, 0.51, open.z);
      leak
        .getObjectByName('jet')!
        .scale.set(
          1,
          0.6 +
            Math.abs(Math.sin(now / 90)) * 0.6 +
            (world.clock - open.at >= LEAK_WINDOW_MS ? 0.7 : 0),
          1,
        );
      (
        (leak.getObjectByName('leak-ring') as THREE.Mesh)
          .material as THREE.MeshBasicMaterial
      ).opacity = 0.45 + Math.sin(now / 160) * 0.35;
    }
    for (const side of [-1, 1])
      this.boat.getObjectByName(
        side < 0 ? 'paddle-port' : 'paddle-starboard',
      )!.visible = !world.players.some((p) => !p.swimming && p.paddle === side);
    const ids = new Set(world.players.map((p) => p.id));
    for (const [id, object] of this.anglers)
      if (!ids.has(id)) {
        this.scene.remove(object);
        this.boat.remove(object);
        this.disposeObject(object);
        this.anglers.delete(id);
        const line = this.lines.get(id);
        if (line) {
          this.scene.remove(line);
          this.disposeObject(line);
          this.lines.delete(id);
        }
        const bobber = this.bobbers.get(id);
        if (bobber) {
          this.scene.remove(bobber);
          this.disposeObject(bobber);
          this.bobbers.delete(id);
        }
        const ripple = this.swimRipples.get(id);
        if (ripple) {
          this.scene.remove(ripple);
          this.disposeObject(ripple);
          this.swimRipples.delete(id);
        }
        const hat = this.floatingHats.get(id);
        if (hat) {
          this.scene.remove(hat);
          this.disposeObject(hat);
          this.floatingHats.delete(id);
        }
      }
    for (const p of world.players) {
      let object = this.anglers.get(p.id);
      if (!object) {
        object = createAngler(
          ANGLER_COLORS[p.color],
          p.id === this.localId ? getEquippedLook() : undefined,
        );
        const label = nameLabel(
          p.id === this.localId
            ? `${p.name} · YOU`
            : p.bot
              ? `${p.name} · NPC`
              : p.name,
          ANGLER_COLORS[p.color],
        );
        label.name = 'label';
        object.add(label);
        this.anglers.set(p.id, object);
        const points = new Float32Array(18 * 3),
          geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        const line = new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color: ANGLER_COLORS[p.color] }),
        );
        line.frustumCulled = false;
        this.lines.set(p.id, line);
        this.scene.add(line);
        const bobber = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 6),
          material(ANGLER_COLORS[p.color]),
        );
        this.bobbers.set(p.id, bobber);
        this.scene.add(bobber);
      }
      object.visible =
        this.cameraMode !== 'first-person' || p.id !== this.localId;
      const parent =
        p.swimming || p.support === 'dock' ? this.scene : this.boat;
      if (object.parent !== parent) {
        if (p.swimming && object.parent) {
          // Keep the world position at the rim so the fall visibly reaches the water.
          parent.attach(object);
          object.userData.fellAt = now;
          // Still in the air on its last frame aboard: that was a jump, not a slip.
          object.userData.dove = object.userData.airborne === true;
        } else {
          parent.add(object);
          object.position.set(p.x, p.swimming ? -0.45 : 0.52, p.z);
        }
      }
      // A host from before jumping sends no height.
      const lift = p.swimming ? 0 : (p.y ?? 0);
      object.userData.airborne = lift > 0;
      const downed = p.swimming && world.clock < p.downedUntil;
      const falling =
        p.swimming && now - (object.userData.fellAt ?? -1000) < 500;
      const moving = Math.hypot(p.input.x, p.input.z) > 0.1;
      // Height alone tells the story: face down, hanging on, or back aboard.
      const height = downed
        ? -0.74
        : p.clinging
          ? -0.5 + p.climb * 1.02
          : p.swimming
            ? moving
              ? -0.28 + Math.sin((now / 1500) * Math.PI * 4) * 0.025
              : -0.5 + Math.sin(now / 220) * 0.05
            : 0.52 + lift;
      object.position.lerp(new THREE.Vector3(p.x, height, p.z), smooth);
      // Yaw first keeps a prone swimmer aligned with their travel direction.
      object.rotation.order = 'YXZ';
      const facing = p.facing + (p.swimming ? b.yaw : 0);
      const turn = Math.atan2(
        Math.sin(facing - object.rotation.y),
        Math.cos(facing - object.rotation.y),
      );
      object.rotation.y += turn * (p.swimming ? smooth : 1);
      const tumbling = !p.swimming && world.clock < (p.tumbleUntil ?? 0);
      const trophy = !p.swimming && world.clock < (p.trophyUntil ?? 0);
      const sliding =
        !p.swimming &&
        !tumbling &&
        (Math.abs(p.slipX) > 0.08 || Math.abs(p.slipZ) > 0.08);
      const hookedByTeammate =
        !p.swimming &&
        world.players.some(
          (other) =>
            other.id !== p.id &&
            other.line?.kind === 'player' &&
            other.line.target === p.id,
        );
      const isShocked = world.clock < (p.shockedUntil ?? 0);

      if (falling) {
        // A jump goes in head first; a slip tumbles in sideways.
        const dove = object.userData.dove === true;
        object.rotation.x =
          Math.sin(((now - object.userData.fellAt) / 500) * Math.PI) *
          (dove ? 1.4 : 0.9);
        object.rotation.z = dove ? 0 : 0.65;
      } else {
        let targetRotX = 0;
        let targetRotZ = 0;
        if (downed) {
          targetRotX = 1.45;
          targetRotZ = 0.6;
        } else if (tumbling) {
          targetRotX = 1.4;
          targetRotZ = Math.sin(now / 100) * 0.2;
        } else if (hookedByTeammate) {
          targetRotX = -0.55;
          targetRotZ = Math.sin(now / 45) * 0.25;
        } else if (trophy) {
          targetRotX = -0.05;
          targetRotZ = 0;
        } else if (p.clinging) {
          // Scrambling up the side: the harder you haul, the more you swing.
          targetRotX = -0.35;
          targetRotZ = Math.sin(now / 90) * (p.input.reel ? 0.18 : 0.05);
        } else if (p.swimming) {
          if (moving) {
            targetRotX = 1.35;
            targetRotZ = Math.sin((now / 1500) * Math.PI * 2) * 0.1;
          } else {
            targetRotX = 0.32;
            targetRotZ = Math.sin(now / 220) * 0.05;
          }
        } else {
          targetRotX = 0;
          targetRotZ = deckSway(now, p.input);
        }
        object.rotation.x += (targetRotX - object.rotation.x) * smooth;
        object.rotation.z += (targetRotZ - object.rotation.z) * smooth;
      }
      if (isShocked) {
        object.position.x += (Math.random() - 0.5) * 0.14;
        object.position.z += (Math.random() - 0.5) * 0.14;
      }
      poseAngler(
        object,
        now,
        moving,
        lift > 0,
        p.swimming && !downed && !falling,
        p.clinging,
        p.clinging && p.input.reel,
        downed,
        tumbling,
        trophy,
        sliding,
        hookedByTeammate,
        isShocked,
      );
      // Rod is stowed while swimming, paddling, tumbling, or holding trophy
      const paddling = !p.swimming && !!p.paddle;
      const rod = object.getObjectByName('rod');
      if (rod)
        rod.visible =
          !paddling &&
          !p.swimming &&
          p.support !== 'dock' &&
          !tumbling &&
          !trophy &&
          !hookedByTeammate;

      const hookedFish =
        p.line?.kind === 'fish'
          ? world.fish.find((f) => f.id === p.line?.target)
          : undefined;
      if (typeof object.userData.updateRod === 'function') {
        object.userData.updateRod(
          p.line?.tension ?? 0,
          hookedFish?.surge ?? false,
          now,
        );
      }

      // Hat on head vs floating hat in water
      object.traverse((child) => {
        if (child.name === 'angler-hat') child.visible = !p.lostHat;
      });

      let floatingHat = this.floatingHats.get(p.id);
      if (p.lostHat) {
        if (!floatingHat) {
          floatingHat = createFloatingHat(ANGLER_COLORS[p.color]);
          this.scene.add(floatingHat);
          this.floatingHats.set(p.id, floatingHat);
          floatingHat.position.set(p.x, 0.04, p.z);
        }
        floatingHat.visible = true;
        floatingHat.position.y = 0.04 + Math.sin(now / 350 + p.x) * 0.03;
        floatingHat.rotation.y += dt * 0.5;
        floatingHat.rotation.z = Math.sin(now / 400) * 0.15;
      } else if (floatingHat) {
        floatingHat.visible = false;
      }

      // Trophy fish mesh
      const trophyMesh = object.getObjectByName('trophy-fish');
      if (trophyMesh) trophyMesh.visible = trophy;

      // Comic reaction bubbles
      const alertBubble = object.getObjectByName('bubble-alert');
      const sweatBubble = object.getObjectByName('bubble-sweat');
      const dizzyBubble = object.getObjectByName('bubble-dizzy');
      if (alertBubble)
        alertBubble.visible =
          !downed &&
          !tumbling &&
          (hookedByTeammate ||
            isShocked ||
            (p.line?.tension ?? 0) > 0.85 ||
            p.line?.tangled === true);
      if (sweatBubble)
        sweatBubble.visible =
          !downed &&
          !tumbling &&
          !hookedByTeammate &&
          (p.clinging ||
            sliding ||
            ((p.line?.tension ?? 0) > 0.65 && (p.line?.tension ?? 0) <= 0.85));
      if (dizzyBubble) dizzyBubble.visible = downed || tumbling || isShocked;
      const label = object.getObjectByName('label');
      if (label) {
        const targetY = p.swimming ? (moving ? 1.8 : 2.2) : 2.65;
        const targetZ = p.swimming ? (moving ? 0.7 : 0.2) : 0;
        const cosX = Math.cos(object.rotation.x);
        const sinX = Math.sin(object.rotation.x);
        label.position.set(
          0,
          targetY * cosX + targetZ * sinX,
          -targetY * sinX + targetZ * cosX,
        );
      }
      let ripple = this.swimRipples.get(p.id);
      const showRipple = p.swimming && !downed && !falling;
      if (showRipple) {
        if (!ripple) {
          const geom = new THREE.RingGeometry(0.35, 0.72, 20);
          const mat = new THREE.MeshBasicMaterial({
            color: '#dff6f7',
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          ripple = new THREE.Mesh(geom, mat);
          ripple.rotation.x = -Math.PI / 2;
          this.scene.add(ripple);
          this.swimRipples.set(p.id, ripple);
        }
        ripple.visible = true;
        const pulse = moving ? Math.sin(now / 160) : Math.sin(now / 300);
        const s = moving ? 1 + pulse * 0.25 : 0.85 + pulse * 0.12;
        ripple.scale.set(s, s, s);
        (ripple.material as THREE.MeshBasicMaterial).opacity = moving
          ? 0.45 + pulse * 0.2
          : 0.3 + pulse * 0.1;
        ripple.position.set(p.x, 0.02, p.z);
      } else if (ripple) {
        ripple.visible = false;
      }
      let paddle = object.userData.paddle as THREE.Group | undefined;
      if (paddling && !paddle) {
        paddle = createPaddle();
        paddle.scale.setScalar(0.9);
        object.add(paddle);
        object.userData.paddle = paddle;
      }
      if (paddle) {
        paddle.visible = paddling;
        // Paddlers face the bow, so the outboard rail is on their other hand.
        const out = -(p.paddle || 1);
        const stroke = Math.abs(p.input.z) > 0.2;
        paddle.position.set(out * 0.3, 1.25, 0.25);
        paddle.rotation.set(
          stroke ? Math.sin(now / 260) * 0.6 * Math.sign(-p.input.z) : 0.2,
          0,
          Math.PI + out * 0.46,
        );
      }
      const line = this.lines.get(p.id)!,
        bobber = this.bobbers.get(p.id)!;
      line.visible = bobber.visible = !!p.line;
      if (p.line) {
        this.yaw.updateMatrixWorld(true);
        const start = object.localToWorld(
          (object.userData.rodTip as THREE.Vector3).clone(),
        );
        const positions = line.geometry.getAttribute(
          'position',
        ) as THREE.BufferAttribute;
        for (let i = 0; i < 18; i++) {
          const t = i / 17;
          positions.setXYZ(
            i,
            start.x + (p.line.x - start.x) * t,
            Math.max(
              0.1,
              start.y * (1 - t) +
                0.18 * t -
                Math.sin(t * Math.PI) * Math.max(0, 1 - p.line.tension) * 1.2,
            ),
            start.z + (p.line.z - start.z) * t,
          );
        }
        positions.needsUpdate = true;
        (line.material as THREE.LineBasicMaterial).color.set(
          p.line.tangled || p.line.tension > 1
            ? '#ef594f'
            : ANGLER_COLORS[p.color],
        );
        bobber.position.set(
          p.line.x,
          0.2 + Math.sin(now / 150) * 0.06,
          p.line.z,
        );
      }
    }
    const activeFish = new Set(world.fish.map((f) => f.id));
    for (const [id, model] of this.fish)
      if (!activeFish.has(id)) {
        this.scene.remove(model);
        this.disposeObject(model);
        this.fish.delete(id);
      }
    for (const f of world.fish) {
      let object = this.fish.get(f.id);
      if (object && object.userData.kind !== f.kind) {
        this.scene.remove(object);
        this.disposeObject(object);
        this.fish.delete(f.id);
        object = undefined;
      }
      if (!object) {
        object = createCatch(f.kind);
        object.userData.kind = f.kind;
        // createCatch already sizes fish but not salvage; keep whichever it chose.
        object.userData.size = object.scale.x;
        this.fish.set(f.id, object);
        this.scene.add(object);
        object.position.set(f.x, 0.05, f.z);
      }
      // land() is the only thing that sets respawnAt, so this edge is a catch
      // coming aboard. Every client sees it from the snapshot alone.
      const afloat = !f.respawnAt;
      if (object.userData.afloat === false && afloat)
        object.position.set(f.x, 0.05, f.z);
      else if (object.userData.afloat && !afloat) {
        object.userData.landedAt = now;
        object.userData.from = object.position.clone();
        this.splashAt = now + LANDING_MS * 0.86;
      }
      object.userData.afloat = afloat;
      const landing = afloat
        ? 0
        : Math.min(1, (now - (object.userData.landedAt ?? -1e9)) / LANDING_MS);
      object.visible = afloat || landing < 1;
      if (!object.visible) continue;
      if (landing) {
        this.yaw.updateMatrixWorld(true);
        const well = this.boat.localToWorld(
          new THREE.Vector3(0, WELL_SURFACE, 0),
        );
        const t = landing,
          pose = landingPose(t, object.userData.from as THREE.Vector3, well);
        object.position.set(pose.x, pose.y, pose.z);
        // Flip tail over head on the way in, then settle on the water line.
        object.rotation.set(t * Math.PI * 2.4, f.angle, Math.sin(t * 9) * 0.5);
        object.scale.setScalar(landingScale(t, object.userData.size));
        continue;
      }
      object.scale.setScalar(object.userData.size);
      // A cannonballed fish floats belly up, wobbling.
      const dazed = world.clock < (f.stunnedUntil ?? 0);
      const y = f.surge
        ? 0.45 + Math.abs(Math.sin(now / 230)) * 0.65
        : dazed
          ? 0.1
          : -0.03 + Math.sin(now / 650 + f.x) * 0.05;
      object.position.lerp(new THREE.Vector3(f.x, y, f.z), smooth);
      object.rotation.set(
        0,
        f.angle,
        dazed
          ? Math.PI + Math.sin(now / 200) * 0.3
          : f.surge
            ? Math.sin(now / 90) * 0.12
            : 0,
      );
    }
    const splash = (now - this.splashAt) / 420;
    this.splash.visible = splash >= 0 && splash < 1;
    if (this.splash.visible) {
      this.splash.scale.setScalar(0.35 + splash * 1.5);
      (this.splash.material as THREE.MeshBasicMaterial).opacity =
        0.9 * (1 - splash);
    }
    // The crab rides the deck, and cartwheels off it once it is gone.
    const crab = world.crab;
    if (crab && !b.sunk) {
      this.crab.visible = true;
      this.crabGoneAt = -1e9;
      this.crab.position.set(crab.x, 0.51, crab.z);
      this.crab.rotation.set(0, crab.angle + Math.sin(now / 60) * 0.2, 0);
      const snap = Math.sin(now / 110) * 0.25;
      this.crab.getObjectByName('clawL')!.rotation.y = snap;
      this.crab.getObjectByName('clawR')!.rotation.y = -snap;
    } else if (this.crab.visible) {
      if (this.crabGoneAt < 0) this.crabGoneAt = now;
      const t = (now - this.crabGoneAt) / 650;
      this.crab.position.y = 0.51 + Math.sin(Math.min(1, t) * Math.PI) * 1.8;
      this.crab.position.x += Math.sign(this.crab.position.x || 1) * dt * 5;
      this.crab.rotation.z += dt * 14;
      if (t >= 1) this.crab.visible = false;
    }

    // Flopping fish on boat deck
    const activeDeckFish = new Set<string>();
    for (const df of world.deckFish ?? []) {
      activeDeckFish.add(df.id);
      let m = this.deckFishMeshes.get(df.id);
      if (!m) {
        m = createCatch(df.kind);
        m.scale.setScalar(0.46);
        this.boat.add(m);
        this.deckFishMeshes.set(df.id, m);
      }
      m.visible = true;
      const flop = Math.abs(Math.sin(now / 70 + df.x * 12));
      m.position.set(df.x, 0.52 + flop * 0.18, df.z);
      m.rotation.set(
        Math.PI / 2 + Math.sin(now / 55) * 0.4,
        df.angle + Math.sin(now / 80) * 0.5,
        Math.sin(now / 60) * 0.35,
      );
    }
    for (const [id, m] of this.deckFishMeshes) {
      if (!activeDeckFish.has(id)) {
        this.boat.remove(m);
        this.disposeObject(m);
        this.deckFishMeshes.delete(id);
      }
    }

    // "The Lake Manager" boss shadow beneath the boat
    const monster = world.fish.find((f) => f.kind === 'monster');
    const monsterHooked =
      monster &&
      world.players.some(
        (p) => p.line?.kind === 'fish' && p.line.target === monster.id,
      );
    if (monster && !monster.respawnAt) {
      this.lakeManagerShadow.visible = true;
      const shadowY = monsterHooked
        ? -0.65 + Math.sin(now / 350) * 0.12
        : -2.1 + Math.sin(now / 600) * 0.15;
      this.lakeManagerShadow.position.set(monster.x, shadowY, monster.z);
      this.lakeManagerShadow.rotation.y = monster.angle;
      const shadowScale = monsterHooked
        ? 1.05 + Math.sin(now / 200) * 0.05
        : 0.95;
      this.lakeManagerShadow.scale.set(shadowScale, 1, shadowScale);
    } else {
      this.lakeManagerShadow.visible = false;
    }

    // Sparks when 2 or more players team-pull the monster boss
    const reelingMonsterPlayers = world.players.filter(
      (p) =>
        p.input.reel &&
        p.line?.kind === 'fish' &&
        monster &&
        p.line.target === monster.id,
    );
    if (reelingMonsterPlayers.length >= 2) {
      for (const p of reelingMonsterPlayers) {
        const obj = this.anglers.get(p.id);
        if (obj && Math.random() < 0.4) {
          const worldTip = obj.localToWorld(
            (obj.userData.rodTip as THREE.Vector3).clone(),
          );
          for (let s = 0; s < 2; s++) {
            this.sparkParticles.push({
              pos: worldTip.clone(),
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                Math.random() * 3 + 1,
                (Math.random() - 0.5) * 4,
              ),
              life: 0,
              maxLife: 0.25 + Math.random() * 0.2,
            });
          }
        }
      }
    }

    const me = world.players.find((p) => p.id === this.localId);
    this.dockBeacon.visible = !!b.sunk && !world.mission;
    if (b.sunk) {
      this.dockBeacon.scale.setScalar(1 + Math.sin(now / 250) * 0.15);
      (this.dockBeacon.material as THREE.MeshBasicMaterial).opacity =
        0.6 + Math.sin(now / 250) * 0.3;
    }
    this.dockArrow.visible = !!b.sunk && !!me?.swimming && !world.mission;
    if (this.dockArrow.visible && me) {
      const dx = DOCK.x - me.x,
        dz = DOCK.z - 1 - me.z,
        d = Math.max(0.01, Math.hypot(dx, dz));
      this.dockArrow.position.set(
        me.x + (dx / d) * 2.2,
        0.6,
        me.z + (dz / d) * 2.2,
      );
      this.dockArrow.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx / d, 0, dz / d),
      );
    }
    // Follow your own swim when there is no boat to watch, or it is far away.
    const focus =
      me?.support === 'dock' ||
      (me?.swimming && (b.sunk || Math.hypot(me.x - b.x, me.z - b.z) > 14))
        ? me
        : null;
    const localAngler = me ? this.anglers.get(me.id) : undefined;
    const firstPerson =
      this.cameraMode === 'first-person' && !!me && !!localAngler;
    const desiredFov = firstPerson ? 70 : 43;
    const desiredNear = firstPerson ? 0.04 : 0.1;
    if (this.camera.fov !== desiredFov || this.camera.near !== desiredNear) {
      this.camera.fov = desiredFov;
      this.camera.near = desiredNear;
      this.camera.updateProjectionMatrix();
    }
    if (firstPerson && localAngler) {
      localAngler.updateWorldMatrix(true, false);
      localAngler.getWorldPosition(this.firstPersonOrigin);
      localAngler.getWorldQuaternion(this.firstPersonRotation);
      const pose = firstPersonPose(
        this.firstPersonOrigin,
        this.firstPersonRotation,
      );
      this.camera.position.set(pose.eye.x, pose.eye.y, pose.eye.z);
      this.cameraTarget.set(pose.look.x, pose.look.y, pose.look.z);
      this.camera.lookAt(this.cameraTarget);
      (this.camera.userData.look ??= new THREE.Vector3()).copy(
        this.cameraTarget,
      );
    } else {
      const zoom = world.mission?.survival ? 1.12 : 1;
      const ahead =
        world.mission?.survival?.stage === 'fight' && !focus ? 4 : 0;
      const small = this.camera.aspect < 0.8 ? 1.2 : 1;
      const fx = focus ? focus.x : b.x,
        fz = focus ? focus.z : b.z;
      this.cameraTarget.set(
        fx,
        25 * zoom * small,
        fz + ahead + 27 * zoom * small,
      );
      if (this.snapCamera) this.camera.position.copy(this.cameraTarget);
      else this.camera.position.lerp(this.cameraTarget, 1 - Math.exp(-3 * dt));
      const look = (this.camera.userData.look ??=
        this.yaw.position.clone()) as THREE.Vector3;
      this.cameraTarget.set(
        focus ? focus.x : this.yaw.position.x,
        0,
        focus ? focus.z : this.yaw.position.z + ahead,
      );
      if (this.snapCamera) look.copy(this.cameraTarget);
      else look.lerp(this.cameraTarget, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(look);
    }
    this.snapCamera = false;

    // Process new events for camera trauma, splashes, floating scores
    if (world.events && world.events.length > 0) {
      for (const ev of world.events) {
        if (ev.id > this.lastProcessedEvent) {
          this.lastProcessedEvent = ev.id;
          if (
            ev.kind === 'thunder' ||
            ev.kind === 'shark' ||
            ev.kind === 'ram' ||
            ev.kind === 'boss'
          ) {
            this.trauma = Math.min(1, this.trauma + 0.65);
          } else if (
            ev.kind === 'snap' ||
            ev.kind === 'slap' ||
            ev.kind === 'bump' ||
            ev.kind === 'slip' ||
            ev.kind === 'shock'
          ) {
            this.trauma = Math.min(1, this.trauma + 0.35);
          } else if (ev.kind === 'sink') {
            this.trauma = Math.min(1, this.trauma + 0.85);
          }

          if (ev.kind === 'splash' || ev.kind === 'slap') {
            this.spawnSplash(
              b.x + (Math.random() - 0.5) * 3,
              0.2,
              b.z + (Math.random() - 0.5) * 3,
              25,
              3.5,
            );
          } else if (ev.kind === 'thunder') {
            this.spawnSplash(
              world.weather.lightningX,
              0.2,
              world.weather.lightningZ,
              35,
              6,
            );
          } else if (ev.kind === 'catch' || ev.kind === 'trophy') {
            const scoreText =
              ev.kind === 'trophy' ? '⭐ TROPHY! +100' : ev.text;
            const scoreSprite = createFloatingScore(
              scoreText,
              ev.kind === 'trophy' ? '#ffd24a' : '#7bed9f',
            );
            scoreSprite.position.set(b.x, 3.8, b.z);
            this.scene.add(scoreSprite);
            this.floatingScores.push({
              sprite: scoreSprite,
              born: now,
              duration: 1800,
              startY: 3.8,
            });
          }
        }
      }
    }

    // Flying fish mesh update
    const ff = world.flyingFish;
    if (ff) {
      const elapsed = world.clock - ff.at;
      const t = Math.min(1, Math.max(0, elapsed / ff.duration));
      const fx = ff.fromX + (ff.toX - ff.fromX) * t;
      const fz = ff.fromZ + (ff.toZ - ff.fromZ) * t;
      const fy = Math.sin(t * Math.PI) * 2.2;
      const angle = Math.atan2(ff.toX - ff.fromX, ff.toZ - ff.fromZ);
      this.flyingFishMesh.visible = true;
      this.flyingFishMesh.position.set(fx, fy, fz);
      this.flyingFishMesh.rotation.set(
        Math.sin(now / 80) * 0.4,
        angle,
        Math.cos(now / 80) * 0.4,
      );
    } else {
      this.flyingFishMesh.visible = false;
    }

    // Boat wake update
    const speed = Math.hypot(b.vx, b.vz);
    const targetWakeOpacity = Math.min(0.55, speed * 0.15);
    const wakeMat = this.boatWake.material as THREE.MeshBasicMaterial;
    wakeMat.opacity += (targetWakeOpacity - wakeMat.opacity) * smooth;
    this.boatWake.visible = wakeMat.opacity > 0.01 && !b.sunk;

    // Splash particles update
    const splashPos = this.splashPoints.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    let activeParticles = 0;
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const sp = this.splashParticles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.splashParticles.splice(i, 1);
        continue;
      }
      sp.vel.y -= 9.8 * dt * 1.4;
      sp.pos.addScaledVector(sp.vel, dt);
      splashPos.setXYZ(
        activeParticles,
        sp.pos.x,
        Math.max(0.01, sp.pos.y),
        sp.pos.z,
      );
      activeParticles++;
    }
    for (let i = activeParticles; i < 160; i++) {
      splashPos.setXYZ(i, 0, -999, 0);
    }
    splashPos.needsUpdate = true;

    // Sparks particles update
    const sparkPos = this.sparkPoints.geometry.getAttribute(
      'position',
    ) as THREE.BufferAttribute;
    let activeSparks = 0;
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.sparkParticles.splice(i, 1);
        continue;
      }
      sp.vel.y -= 9.8 * dt * 0.8;
      sp.pos.addScaledVector(sp.vel, dt);
      sparkPos.setXYZ(
        activeSparks,
        sp.pos.x,
        Math.max(0.01, sp.pos.y),
        sp.pos.z,
      );
      activeSparks++;
    }
    for (let i = activeSparks; i < 80; i++) {
      sparkPos.setXYZ(i, 0, -999, 0);
    }
    sparkPos.needsUpdate = true;

    // Floating scores update
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const item = this.floatingScores[i];
      const age = now - item.born;
      const progress = age / item.duration;
      if (progress >= 1) {
        this.scene.remove(item.sprite);
        this.disposeObject(item.sprite);
        this.floatingScores.splice(i, 1);
      } else {
        item.sprite.position.y = item.startY + progress * 2.2;
        (item.sprite.material as THREE.SpriteMaterial).opacity =
          1 - progress * progress;
      }
    }

    // Camera trauma / shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 1.2);
      const shake = this.trauma * this.trauma;
      this.camera.position.x += (Math.random() - 0.5) * 0.9 * shake;
      this.camera.position.y += (Math.random() - 0.5) * 0.6 * shake;
      this.camera.position.z += (Math.random() - 0.5) * 0.6 * shake;
      this.camera.rotation.z += (Math.random() - 0.5) * 0.04 * shake;
    }
    this.renderer.render(this.scene, this.camera);
  };
  private disposeObject(root: THREE.Object3D) {
    root.traverse((o) => {
      if (
        o instanceof THREE.Mesh ||
        o instanceof THREE.Line ||
        o instanceof THREE.Sprite
      ) {
        if ('geometry' in o) disposeGeometry(o.geometry);
        for (const mat of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          if ('map' in mat) (mat.map as THREE.Texture | null)?.dispose();
          mat.dispose();
        }
      }
    });
  }
  dispose() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.observer.disconnect();
    this.resetInput();
    for (const item of this.floatingScores) {
      this.disposeObject(item.sprite);
    }
    this.floatingScores.length = 0;
    for (const hat of this.floatingHats.values()) {
      this.disposeObject(hat);
    }
    this.floatingHats.clear();
    for (const m of this.deckFishMeshes.values()) {
      this.boat.remove(m);
      this.disposeObject(m);
    }
    this.deckFishMeshes.clear();
    this.sparkParticles.length = 0;
    this.disposeObject(this.sparkPoints);
    this.disposeObject(this.lakeManagerShadow);
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
