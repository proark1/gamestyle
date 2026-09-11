import { disposeGeometry } from '../../shared/rendering/primitives';
import * as T from 'three';
import {
  createKitchen,
  createRobot,
  createTable,
  createUtensil,
  poseRobot,
} from './models';
import { freshBreakfast, handPosition } from './simulation';
import {
  idleInput,
  LIMBS,
  type BrainAction,
  type BrainInput,
  type BrainSnapshot,
} from './types';

type Callbacks = {
  input: (i: BrainInput) => void;
  action: (a: BrainAction) => void;
  tick: () => void;
  failure: () => void;
};
export class BreakfastScene {
  private scene = new T.Scene();
  private renderer: T.WebGLRenderer;
  private camera = new T.OrthographicCamera(-12, 12, 10, -10, 0.1, 100);
  private robot = createRobot();
  private table = createTable();
  private utensils = [createUtensil('pan'), createUtensil('jug')];
  private spills: T.Mesh[] = [];
  private fan: T.Group;
  private ring = new T.Mesh(
    new T.TorusGeometry(0.43, 0.035, 6, 28),
    new T.MeshBasicMaterial({ color: '#ffffff' }),
  );
  private observer: ResizeObserver;
  private abort = new AbortController();
  private frame = 0;
  private snapshot: BrainSnapshot | null = null;
  private demo = freshBreakfast(100000);
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private held = { use: false, steady: false, up: false, down: false };
  private id = '';
  private blocked = false;
  private stopped = false;
  private wide = true;
  private lastInput = 0;
  private lastFrame = 0;
  private current = idleInput();
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private v1 = new T.Vector3();
  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor('#c5d6bf');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Breakfast kitchen. WASD controls your limb. E grabs, Space uses or kicks.',
    );
    container.appendChild(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight('#fff8dc', '#789b88', 2.8));
    const sun = new T.DirectionalLight('#fff0d1', 3.2);
    sun.position.set(-5, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -12,
      right: 12,
      top: 12,
      bottom: -12,
    });
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.fan = createKitchen(this.scene);
    this.scene.add(this.robot.body, this.table.group, this.ring);
    for (const limb of this.robot.limbs) this.scene.add(limb.group);
    for (const u of this.utensils) this.scene.add(u.group);
    const spillGeo = new T.CircleGeometry(0.6, 14);
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(
        spillGeo,
        new T.MeshBasicMaterial({
          color: '#a97341',
          transparent: true,
          opacity: 0.65,
        }),
      );
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.spills.push(m);
    }
    this.ring.rotation.x = Math.PI / 2;
    this.camera.position.set(9, 14, 18);
    this.camera.lookAt(0, 1, 0);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    const options = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, options);
    window.addEventListener('keyup', this.keyUp, options);
    window.addEventListener('blur', this.resetInput, options);
    document.addEventListener('visibilitychange', this.hidden, options);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLost,
      options,
    );
    this.frame = requestAnimationFrame(this.render);
  }
  setSession(id: string) {
    this.id = id;
  }
  focus() {
    this.renderer.domElement.focus({ preventScroll: true });
  }
  setSnapshot(s: BrainSnapshot | null) {
    this.snapshot = s;
    if (!s) this.resetInput();
  }
  move(v: { x: number; z: number }) {
    this.touch = v;
  }
  hold(key: keyof typeof this.held, value: boolean) {
    this.held[key] = value;
  }
  setBlocked(value: boolean) {
    this.blocked = value;
    if (value) this.resetInput();
  }
  changeCamera() {
    this.wide = !this.wide;
  }
  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.held = { use: false, steady: false, up: false, down: false };
    this.current = idleInput();
    this.cb.input(this.current);
  };
  private hidden = () => {
    if (document.hidden) this.resetInput();
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.resetInput();
    this.stopped = true;
    this.cb.failure();
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      this.blocked ||
      !this.snapshot ||
      this.snapshot.world.phase !== 'playing' ||
      (e.target instanceof Element &&
        e.target.closest(
          'input, textarea, [role="dialog"], [contenteditable="true"]',
        ))
    )
      return;
    const key = e.key.toLowerCase();
    // Buttons keep native Space/Enter; movement works after clicking a limb.
    if (
      (key === ' ' || key === 'enter') &&
      e.target instanceof Element &&
      e.target.closest('button')
    )
      return;
    if (
      [
        'w',
        'a',
        's',
        'd',
        'arrowup',
        'arrowdown',
        'arrowleft',
        'arrowright',
        ' ',
        'r',
        'f',
        'e',
        'q',
        'shift',
        '1',
        '2',
        '3',
        '4',
        'v',
      ].includes(key)
    )
      e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
    if (/^[1-4]$/.test(key)) {
      this.resetInput();
      this.cb.action({ type: 'claim', limb: Number(key) - 1 });
    } else if (key === 'e') this.cb.action({ type: 'grab' });
    else if (key === 'q') this.cb.action({ type: 'center' });
    else if (key === ' ') {
      const p = this.snapshot.world.players.find((p) => p.id === this.id);
      if (p && p.limb > 1) this.cb.action({ type: 'kick' });
    } else if (key === 'v') this.changeCamera();
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private resize() {
    const width = this.container.clientWidth,
      height = this.container.clientHeight;
    this.renderer.setSize(width, height, false);
    const ratio = width / Math.max(1, height),
      view = Math.max(8.5, 10 / ratio);
    this.camera.left = -view * ratio;
    this.camera.right = view * ratio;
    this.camera.top = view;
    this.camera.bottom = -view;
    this.camera.updateProjectionMatrix();
  }
  private render = (now: number) => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.render);
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (now - this.lastInput > 40) {
      this.lastInput = now;
      const key = (a: string, b?: string) =>
        this.keys.has(a) || (b ? this.keys.has(b) : false);
      this.current = this.blocked
        ? idleInput()
        : {
            x:
              Number(key('d', 'arrowright')) -
              Number(key('a', 'arrowleft')) +
              this.touch.x,
            z:
              Number(key('s', 'arrowdown')) -
              Number(key('w', 'arrowup')) +
              this.touch.z,
            lift:
              Number(key('r') || this.held.up) -
              Number(key('f') || this.held.down),
            use: key(' ') || this.held.use,
            steady: key('shift') || this.held.steady,
            seq: this.current.seq + 1,
          };
      // Movement stays aligned with the screen in both camera modes.
      const x = this.current.x,
        z = this.current.z;
      this.current.x = x * 0.8944 + z * 0.4472;
      this.current.z = z * 0.8944 - x * 0.4472;
      this.cb.input(this.current);
    }
    this.cb.tick();
    const w = this.snapshot?.world ?? this.demo,
      r = w.robot;
    poseRobot(this.robot, w, now, !!this.snapshot);
    this.table.group.position.set(w.table.x, 0, w.table.z);
    this.table.group.rotation.z = Math.sin(now * 0.03) * w.table.jolt * 0.09;
    this.table.cakes.children.forEach((c, i) => {
      c.visible = i < w.pancakes;
    });
    this.table.coffee.visible = w.coffee > 0.01;
    this.table.coffee.scale.setScalar(Math.max(0.15, Math.sqrt(w.coffee)));
    for (let i = 0; i < w.utensils.length; i++) {
      const u = w.utensils[i],
        model = this.utensils[i];
      model.group.position.set(u.x, u.y, u.z);
      const owner =
        u.held === null ? undefined : w.players.find((p) => p.limb === u.held);
      model.group.rotation.z =
        u.held !== null
          ? r.lean * 0.5 + (u.id === 'jug' && owner?.input.use ? -0.3 : 0)
          : u.y < 0.4
            ? 0.3
            : 0;
      model.food.visible =
        u.id === 'pan' ? u.fill > 0 : !!owner?.input.use && u.fill > 0;
      if (u.id === 'pan')
        model.food.position.y =
          w.clock - w.limbs[u.held ?? 0].useAt < 500 && u.flipped
            ? Math.sin(
                ((w.clock - w.limbs[u.held ?? 0].useAt) / 500) * Math.PI,
              ) * 0.9
            : 0;
    }
    for (let i = 0; i < this.spills.length; i++) {
      const s = w.spills[i],
        m = this.spills[i];
      m.visible = !!s;
      if (s) {
        m.position.set(s.x, 0.03, s.z);
        (m.material as T.MeshBasicMaterial).color.set(s.color);
        (m.material as T.MeshBasicMaterial).opacity = Math.min(
          0.6,
          (24000 - w.clock + s.at) / 8000,
        );
      }
    }
    const me = w.players.find((p) => p.id === this.id);
    this.ring.visible = !!me && w.phase === 'playing';
    if (me) {
      const h = handPosition(w, me.limb);
      this.ring.position.set(h.x, h.y + 0.08, h.z);
      (this.ring.material as T.MeshBasicMaterial).color.set(
        LIMBS[me.limb].color,
      );
    }
    const reduced = this.reducedMotion.matches;
    this.fan.rotation.y = reduced ? 0.3 : now * 0.0025;
    const targetZoom = this.wide || !this.snapshot ? 1 : 1.55;
    this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
    const cx = this.wide ? 0 : r.x * 0.6,
      cz = this.wide ? 0 : r.z * 0.6;
    this.camera.position.lerp(
      this.v1.set(9 + cx, 14, 18 + cz),
      Math.min(1, dt * 3),
    );
    this.camera.lookAt(cx, 1, cz);
    this.renderer.render(this.scene, this.camera);
  };
  dispose() {
    this.stopped = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.observer.disconnect();
    this.resetInput();
    const geometry = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Sprite) {
        if (o instanceof T.Mesh) geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometry.forEach((g) => disposeGeometry(g));
    materials.forEach((m) => {
      const map = (m as T.MeshStandardMaterial).map;
      map?.dispose();
      m.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
