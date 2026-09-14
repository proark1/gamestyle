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
  deckSway,
  material,
  nameLabel,
  poseAngler,
} from './models';
import { SeaScene } from './sea-scene';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';

type Callbacks = {
  input: (input: ReelInput) => void;
  action: (action: ReelAction) => void;
  tick: () => void;
  failure: () => void;
};
export class ReelScene {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(43, 1, 0.1, 220);
  private boat = createBoat();
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
  private held = { reel: false, brace: false };
  private input = idleInput();
  private snapshot: ReelSnapshot | null = null;
  private demo = freshReel(100000);
  private localId = '';
  private wide = false;
  private stopped = false;
  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#cee4d5');
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Fishing lake. Click the water to cast; WASD moves, J jumps and P takes a paddle.',
    );
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
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
  hold(key: 'reel' | 'brace', value: boolean) {
    this.held[key] = value;
  }
  changeCamera() {
    this.wide = !this.wide;
  }
  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.held = { reel: false, brace: false };
    this.input = idleInput();
    this.cb.input(this.input);
  };
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
      ].includes(key)
    )
      return;
    e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
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
      }
    for (const p of world.players) {
      let object = this.anglers.get(p.id);
      if (!object) {
        object = createAngler(
          ANGLER_COLORS[p.color],
          p.id === this.localId ? getEquippedLook() : undefined,
        );
        object.add(
          nameLabel(
            p.id === this.localId ? `${p.name} · YOU` : p.name,
            ANGLER_COLORS[p.color],
          ),
        );
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
      const parent = p.swimming ? this.scene : this.boat;
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
      // Height alone tells the story: face down, hanging on, or back aboard.
      const height = downed
        ? -0.74
        : p.clinging
          ? -0.5 + p.climb * 1.02
          : p.swimming
            ? -0.48 + Math.sin(now / 200) * 0.08
            : 0.52 + lift;
      object.position.lerp(new THREE.Vector3(p.x, height, p.z), smooth);
      object.rotation.y = p.facing + (p.swimming ? b.yaw : 0);
      if (falling) {
        // A jump goes in head first; a slip tumbles in sideways.
        const dove = object.userData.dove === true;
        object.rotation.x =
          Math.sin(((now - object.userData.fellAt) / 500) * Math.PI) *
          (dove ? 1.4 : 0.9);
        object.rotation.z = dove ? 0 : 0.65;
      } else if (downed) {
        object.rotation.x = 1.45;
        object.rotation.z = 0.6;
      } else if (p.clinging) {
        // Scrambling up the side: the harder you haul, the more you swing.
        object.rotation.x = -0.35;
        object.rotation.z = Math.sin(now / 90) * (p.input.reel ? 0.18 : 0.05);
      } else {
        object.rotation.x = 0;
        object.rotation.z = deckSway(now, p.input);
      }
      poseAngler(
        object,
        now,
        !p.swimming && Math.hypot(p.input.x, p.input.z) > 0.1,
        lift > 0,
      );
      // A paddle in hand replaces the rod, and strokes swing it through the water.
      const paddling = !p.swimming && !!p.paddle;
      object.getObjectByName('rod')!.visible = !paddling;
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
    for (const f of world.fish) {
      let object = this.fish.get(f.id);
      if (!object) {
        object = createCatch(f.kind);
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
    const me = world.players.find((p) => p.id === this.localId);
    this.dockBeacon.visible = !!b.sunk;
    if (b.sunk) {
      this.dockBeacon.scale.setScalar(1 + Math.sin(now / 250) * 0.15);
      (this.dockBeacon.material as THREE.MeshBasicMaterial).opacity =
        0.6 + Math.sin(now / 250) * 0.3;
    }
    this.dockArrow.visible = !!b.sunk && !!me?.swimming;
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
      me?.swimming && (b.sunk || Math.hypot(me.x - b.x, me.z - b.z) > 14)
        ? me
        : null;
    const zoom = this.wide ? 1.6 : 1;
    const small = this.camera.aspect < 0.8 ? 1.2 : 1;
    const fx = focus ? focus.x : b.x,
      fz = focus ? focus.z : b.z;
    this.camera.position.lerp(
      new THREE.Vector3(fx, 25 * zoom * small, fz + 27 * zoom * small),
      1 - Math.exp(-3 * dt),
    );
    const look = (this.camera.userData.look ??= this.yaw.position.clone());
    (look as THREE.Vector3).lerp(
      focus
        ? new THREE.Vector3(focus.x, 0, focus.z)
        : new THREE.Vector3(this.yaw.position.x, 0, this.yaw.position.z),
      1 - Math.exp(-4 * dt),
    );
    this.camera.lookAt(look as THREE.Vector3);
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
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
