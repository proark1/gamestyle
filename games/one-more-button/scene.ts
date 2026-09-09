import * as T from 'three';
import { label, disposeGeometry } from '../../shared/rendering/primitives';
import { contestant, hazardModel, stage } from './models';
import { glovePose, spinnerAngle } from './level';
import { doorOpen, freshButton, newContestant } from './simulation';
import {
  COLORS,
  idleInput,
  type ButtonAction,
  type ButtonInput,
  type ButtonSnapshot,
} from './types';

type Callbacks = {
  input: (i: ButtonInput) => void;
  action: (a: ButtonAction) => void;
  tick: () => void;
  failure: () => void;
};
export class ButtonScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(43, 1, 0.1, 160);
  private renderer: T.WebGLRenderer;
  private stage = stage();
  private people = new Map<string, T.Group>();
  private hazards = new Map<number, T.Group>();
  private snapshot: ButtonSnapshot | null = null;
  private demo = freshButton(100000);
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frame = 0;
  private last = 0;
  private lastInput = 0;
  private seq = 0;
  private localId = '';
  private wide = true;
  private blocked = false;
  private disposed = false;
  private ring = new T.Mesh(
    new T.RingGeometry(0.65, 0.76, 32),
    new T.MeshBasicMaterial({ color: '#fff2b7', side: T.DoubleSide }),
  );
  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setClearColor('#bad5ce');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'One More Button arena. WASD moves, E presses, Space jumps, X exits, Q shouts STOP.',
    );
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.add(new T.HemisphereLight('#fff4d7', '#618d91', 2.8));
    const sun = new T.DirectionalLight('#fff3d7', 3);
    sun.position.set(-12, 28, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -20,
      right: 20,
      top: 20,
      bottom: -20,
    });
    sun.shadow.normalBias = 0.06;
    this.scene.add(sun, this.stage);
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    for (let i = 0; i < 4; i++)
      this.demo.players.push(
        newContestant(
          `demo-${i}`,
          ['Greedy', 'Sensible', 'Oops', 'One more?'][i],
          i,
          100000,
        ),
      );
    this.camera.position.set(0, 28, 31);
    this.camera.lookAt(0, 0, 0);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    const opts = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, opts);
    window.addEventListener('keyup', this.keyUp, opts);
    window.addEventListener('blur', this.resetInput, opts);
    document.addEventListener('visibilitychange', this.hidden, opts);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        this.cb.failure();
      },
      opts,
    );
    this.frame = requestAnimationFrame(this.render);
  }
  setSession(id: string) {
    this.localId = id;
  }
  setSnapshot(s: ButtonSnapshot | null) {
    this.snapshot = s;
    if (!s) this.resetInput();
  }
  setBlocked(value: boolean) {
    this.blocked = value;
    if (value) this.resetInput();
  }
  move(v: { x: number; z: number }) {
    if (!this.blocked) this.touch = v;
  }
  changeCamera() {
    this.wide = !this.wide;
  }
  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.cb.input(idleInput());
  };
  private hidden = () => {
    if (document.hidden) this.resetInput();
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      this.blocked ||
      (e.target as HTMLElement)?.closest(
        'input, textarea, [role="dialog"], [contenteditable="true"]',
      )
    )
      return;
    const key = e.key.toLowerCase();
    if (
      (e.target as HTMLElement)?.closest('button') &&
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
        'e',
        'x',
        'q',
        'f',
        ' ',
        'v',
      ].includes(key)
    )
      return;
    e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
    const action = {
      e: 'press',
      x: 'exit',
      q: 'stop',
      f: 'help',
      ' ': 'jump',
    } as const;
    if (key in action)
      this.cb.action({ type: action[key as keyof typeof action] });
    if (key === 'v') this.changeCamera();
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  private render = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (now - this.lastInput > 40) {
      const x = this.blocked
        ? 0
        : this.touch.x +
          Number(this.keys.has('d') || this.keys.has('arrowright')) -
          Number(this.keys.has('a') || this.keys.has('arrowleft'));
      const z = this.blocked
        ? 0
        : this.touch.z +
          Number(this.keys.has('s') || this.keys.has('arrowdown')) -
          Number(this.keys.has('w') || this.keys.has('arrowup'));
      const d = Math.max(1, Math.hypot(x, z));
      this.cb.input({ x: x / d, z: z / d, seq: ++this.seq });
      this.lastInput = now;
    }
    this.cb.tick();
    const w = this.snapshot?.world ?? this.demo;
    const ids = new Set(w.players.map((p) => p.id));
    for (const [id, model] of this.people)
      if (!ids.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.people.delete(id);
      }
    for (const p of w.players) {
      let model = this.people.get(p.id);
      if (!model) {
        model = contestant(COLORS[p.color % 4]);
        const name = label(p.name, '#fff3d8', '#31575a', 2.1);
        name.position.y = 2.8;
        model.add(name);
        const stop = label('STOP!', '#e55e47', '#fff7db', 2.1);
        stop.name = 'stop';
        stop.position.y = 3.5;
        model.add(stop);
        model.position.set(p.x, p.y, p.z);
        this.people.set(p.id, model);
        this.scene.add(model);
      }
      const t = Math.min(1, dt * 18);
      model.position.lerp(new T.Vector3(p.x, p.y, p.z), t);
      model.rotation.y = p.facing;
      model.rotation.z =
        p.y > 0.5 && p.stunnedUntil > w.clock ? Math.sin(now * 0.014) * 1.2 : 0;
      model.visible = p.hearts > 0 && !p.escaped;
      model.getObjectByName('stop')!.visible = p.shoutUntil > w.clock;
      const walk =
        Math.hypot(p.vx, p.vz) > 0.5 ? Math.sin(now * 0.014) * 0.5 : 0;
      for (let i = 0; i < 2; i++) {
        model.getObjectByName(`leg${i}`)!.rotation.x = walk * (i ? 1 : -1);
        model.getObjectByName(`arm${i}`)!.rotation.x =
          p.y > 0.5 ? -2.4 : walk * (i ? -1 : 1);
      }
    }
    const hazardIds = new Set(w.hazards.map((h) => h.id));
    for (const [id, model] of this.hazards)
      if (!hazardIds.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.hazards.delete(id);
      }
    for (const h of w.hazards) {
      let model = this.hazards.get(h.id);
      if (!model) {
        model = hazardModel(h);
        this.scene.add(model);
        this.hazards.set(h.id, model);
      }
      const scale = Math.min(
        1,
        Math.max(0.05, (w.clock - h.starts + 1400) / 900),
      );
      model.scale.y = scale;
      if (h.kind === 'glove') {
        const pose = glovePose(h, w.clock),
          dx = pose.x - h.x;
        model.getObjectByName('glove')!.position.x = dx;
        model.getObjectByName('warning')!.visible =
          pose.warning && Math.sin(now * 0.02) > -0.2;
        const spring = model.getObjectByName('spring')!;
        spring.position.x = dx / 2;
        spring.scale.x = Math.max(1, Math.abs(dx));
      }
      if (h.kind === 'spinner')
        model.getObjectByName('sofa')!.rotation.y = spinnerAngle(h, w.clock);
      if (h.kind === 'conveyor' && w.clock > h.starts)
        for (let i = 0; i < 20; i++)
          model.getObjectByName(`slat${i}`)!.position.z =
            -5.7 +
            ((((i * 0.6 + ((w.clock - h.starts) / 1000) * h.direction * 2) %
              12) +
              12) %
              12);
    }
    this.stage.getObjectByName('cap')!.position.y =
      w.clock - w.lastPress < 250 ? 1.24 : 1.5;
    this.stage.getObjectByName('door')!.scale.y = doorOpen(w) ? 0.04 : 1;
    const me = w.players.find((p) => p.id === this.localId);
    this.ring.visible = !!me && me.hearts > 0 && !me.escaped;
    if (me) this.ring.position.set(me.x, 0.3, me.z);
    const narrow = this.camera.aspect < 1;
    const follow = !this.wide && me;
    const zoom = narrow ? 1.55 : 1;
    this.camera.position.lerp(
      new T.Vector3(
        follow ? me.x * 0.55 : 0,
        (follow ? 20 : 28) * zoom,
        (follow ? 23 + me.z * 0.35 : 31) * zoom,
      ),
      Math.min(1, dt * 4),
    );
    this.camera.lookAt(follow ? me.x * 0.4 : 0, 0, follow ? me.z * 0.4 : 0);
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  };
  private release(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) disposeGeometry(o.geometry);
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.observer.disconnect();
    this.release(this.scene);
    this.ring.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
