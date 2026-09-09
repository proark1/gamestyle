import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeGeometry } from '../../shared/rendering/primitives';
import * as THREE from 'three';
import {
  ANGLER_COLORS,
  LANDING_MS,
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
  material,
  nameLabel,
} from './models';
import { SeaScene } from './sea-scene';

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
      'Fishing lake. Click the water to cast; use WASD to move.',
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
      ].includes(key)
    )
      return;
    e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
    if (key === 'v') this.changeCamera();
    if (key === ' ') this.cb.action({ type: 'cast' });
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
    this.yaw.position.lerp(
      new THREE.Vector3(b.x, 0.16 + Math.sin(now / 900) * 0.06, b.z),
      smooth,
    );
    this.yaw.rotation.y += (b.yaw - this.yaw.rotation.y) * smooth;
    this.boat.rotation.z +=
      ((this.snapshot ? b.roll : Math.sin(now / 1400) * 0.07) -
        this.boat.rotation.z) *
      smooth;
    this.boat.rotation.x += (b.pitch - this.boat.rotation.x) * smooth;
    this.boat.getObjectByName('tire')!.visible = world.gear.tire;
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
        object = createAngler(ANGLER_COLORS[p.color]);
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
        } else {
          parent.add(object);
          object.position.set(p.x, p.swimming ? -0.45 : 0.52, p.z);
        }
      }
      object.position.lerp(
        new THREE.Vector3(
          p.x,
          p.swimming ? -0.48 + Math.sin(now / 200) * 0.08 : 0.52,
          p.z,
        ),
        smooth,
      );
      object.rotation.y = p.facing + (p.swimming ? b.yaw : 0);
      const falling =
        p.swimming && now - (object.userData.fellAt ?? -1000) < 500;
      object.rotation.x = falling
        ? Math.sin(((now - object.userData.fellAt) / 500) * Math.PI) * 0.9
        : 0;
      object.rotation.z = falling
        ? 0.65
        : p.input.brace
          ? -0.12
          : Math.sin(now / 110) *
            Math.min(0.06, Math.hypot(p.input.x, p.input.z) * 0.06);
      const line = this.lines.get(p.id)!,
        bobber = this.bobbers.get(p.id)!;
      line.visible = bobber.visible = !!p.line;
      if (p.line) {
        this.yaw.updateMatrixWorld(true);
        const start = object.localToWorld(new THREE.Vector3(0.4, 2.5, 1.85));
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
      const y = f.surge
        ? 0.45 + Math.abs(Math.sin(now / 230)) * 0.65
        : -0.03 + Math.sin(now / 650 + f.x) * 0.05;
      object.position.lerp(new THREE.Vector3(f.x, y, f.z), smooth);
      object.rotation.set(0, f.angle, f.surge ? Math.sin(now / 90) * 0.12 : 0);
    }
    const splash = (now - this.splashAt) / 420;
    this.splash.visible = splash >= 0 && splash < 1;
    if (this.splash.visible) {
      this.splash.scale.setScalar(0.35 + splash * 1.5);
      (this.splash.material as THREE.MeshBasicMaterial).opacity =
        0.9 * (1 - splash);
    }
    const zoom = this.wide ? 1.6 : 1;
    const small = this.camera.aspect < 0.8 ? 1.2 : 1;
    this.camera.position.lerp(
      new THREE.Vector3(b.x, 25 * zoom * small, b.z + 27 * zoom * small),
      1 - Math.exp(-3 * dt),
    );
    this.camera.lookAt(this.yaw.position.x, 0, this.yaw.position.z);
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
