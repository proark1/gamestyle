import * as T from 'three';
import { label } from '../../shared/rendering/primitives';
import {
  ammoModel,
  blockModel,
  crewMember,
  defenders,
  potModel,
  siegeField,
  trebuchet,
} from './models';
import { freshSiege, newCrew } from './simulation';
import {
  COLORS,
  SLING,
  idleInput,
  rangeFor,
  type AmmoKind,
  type SiegeAction,
  type SiegeInput,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';

const RELAXED = 0.55;
const WOUND = -0.48;
const SWEEP = 1.45;
/** Where the arm sits at a given wind, and how it whips through a release. */
export function armAngle(w: SiegeWorld, clock: number) {
  const since = clock - w.loosedAt;
  if (since >= 0 && since < 1200) {
    const t = since / 1000;
    if (t < 0.3) return WOUND + (SWEEP - WOUND) * (t / 0.3) ** 0.6;
    const settle = (t - 0.3) / 0.9;
    return SWEEP + (RELAXED - SWEEP) * settle ** 0.5;
  }
  return RELAXED + (WOUND - RELAXED) * w.wind;
}

type Callbacks = {
  input: (i: SiegeInput) => void;
  action: (a: SiegeAction) => void;
  tick: () => void;
  failure: () => void;
};

export class SiegeScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(44, 1, 0.1, 320);
  private renderer: T.WebGLRenderer;
  private field = siegeField();
  private engine = trebuchet();
  private wallGuards = defenders();
  private people = new Map<string, T.Group>();
  private blocks = new Map<number, T.Group>();
  private shots = new Map<number, T.Group>();
  private pots = new Map<number, T.Group>();
  private carried = new Map<string, { kind: AmmoKind; model: T.Group }>();
  private payload: { kind: AmmoKind; model: T.Group } | null = null;
  private snapshot: SiegeSnapshot | null = null;
  private demo = freshSiege(100000);
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frame = 0;
  private last = 0;
  private lastInput = 0;
  private seq = 0;
  private localId = '';
  private view: 'shot' | 'follow' = 'shot';
  private blocked = false;
  private disposed = false;
  private look = new T.Vector3(0, 1, -2);
  private ring = new T.Mesh(
    new T.RingGeometry(0.62, 0.74, 28),
    new T.MeshBasicMaterial({ color: '#e8c46a', side: T.DoubleSide }),
  );
  private aim = new T.Mesh(
    new T.RingGeometry(1.5, 1.85, 40),
    new T.MeshBasicMaterial({
      color: '#e8c46a',
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.55,
    }),
  );

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    // A hundred rigid bodies plus soft shadows is a lot for a handset GPU, so
    // touch devices and small screens render leaner rather than dropping frames.
    const lean =
      matchMedia('(pointer: coarse)').matches ||
      Math.min(innerWidth, innerHeight) < 820;
    this.renderer = new T.WebGLRenderer({
      antialias: !lean,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, lean ? 1.3 : 1.7));
    this.renderer.setClearColor('#d9bb8a');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Siege and Desist field. WASD moves, R winds the winch, E loads, Q swings the aim, F looses, C rides the sling.',
    );
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new T.Fog('#d9bb8a', 70, 190);
    this.scene.add(new T.HemisphereLight('#ffe6bc', '#5f6a45', 2.5));
    const sun = new T.DirectionalLight('#ffdca8', 2.7);
    sun.position.set(-24, 34, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lean ? 1024 : 2048, lean ? 1024 : 2048);
    Object.assign(sun.shadow.camera, {
      left: -38,
      right: 38,
      top: 42,
      bottom: -32,
    });
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, this.field, this.engine, this.wallGuards);
    this.ring.rotation.x = -Math.PI / 2;
    this.aim.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring, this.aim);
    for (let i = 0; i < 3; i++)
      this.demo.players.push(
        newCrew(`demo-${i}`, ['Kayi', 'Bahadir', 'Selim'][i], i, 100000),
      );
    this.demo.wind = 0.65;
    this.camera.position.set(0, 15, 44);
    this.camera.lookAt(0, 5, -10);
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
  setSnapshot(s: SiegeSnapshot | null) {
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
    this.view = this.view === 'shot' ? 'follow' : 'shot';
  }
  resetInput = () => {
    if (this.keys.has('r')) this.cb.action({ type: 'stopWind' });
    if (this.keys.has('q')) this.cb.action({ type: 'stopPush' });
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
    const known = [
      'w',
      'a',
      's',
      'd',
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'e',
      'r',
      'q',
      'f',
      'c',
      'h',
      ' ',
      'v',
    ];
    if (!known.includes(key)) return;
    e.preventDefault();
    const held = this.keys.has(key);
    this.keys.add(key);
    if (e.repeat || held) return;
    if (key === 'r') this.cb.action({ type: 'wind' });
    if (key === 'q') this.cb.action({ type: 'push' });
    const once = {
      e: 'grab',
      f: 'loose',
      c: 'ride',
      h: 'help',
      ' ': 'jump',
    } as const;
    if (key in once) this.cb.action({ type: once[key as keyof typeof once] });
    if (key === 'v') this.changeCamera();
  };
  private keyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (!this.keys.has(key)) return;
    this.keys.delete(key);
    if (key === 'r') this.cb.action({ type: 'stopWind' });
    if (key === 'q') this.cb.action({ type: 'stopPush' });
  };
  private resize() {
    const { width, height } = this.container.getBoundingClientRect();
    this.camera.aspect = Math.max(1, width) / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private syncBlocks(w: SiegeWorld) {
    const ids = new Set(w.blocks.map((b) => b.id));
    for (const [id, model] of this.blocks)
      if (!ids.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.blocks.delete(id);
      }
    for (const b of w.blocks) {
      let model = this.blocks.get(b.id);
      if (!model) {
        model = blockModel(b);
        this.scene.add(model);
        this.blocks.set(b.id, model);
      }
      model.position.set(b.x, b.y, b.z);
      model.quaternion.set(b.qx, b.qy, b.qz, b.qw);
      const fire = model.getObjectByName('fire');
      if (fire) fire.visible = b.burning > w.clock;
    }
  }

  private syncShots(w: SiegeWorld) {
    const ids = new Set(w.shots.map((s) => s.id));
    for (const [id, model] of this.shots)
      if (!ids.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.shots.delete(id);
      }
    for (const s of w.shots) {
      let model = this.shots.get(s.id);
      if (!model) {
        model = ammoModel(s.kind);
        this.scene.add(model);
        this.shots.set(s.id, model);
      }
      model.position.set(s.x, s.y, s.z);
      model.visible = !s.rider;
      model.rotation.x += 0.06;
      model.rotation.z = s.spin * 0.02 + model.rotation.z * 0.98;
    }
    const potIds = new Set(w.pots.map((p) => p.id));
    for (const [id, model] of this.pots)
      if (!potIds.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.pots.delete(id);
      }
    for (const p of w.pots) {
      let model = this.pots.get(p.id);
      if (!model) {
        model = potModel();
        this.scene.add(model);
        this.pots.set(p.id, model);
      }
      model.position.set(p.x, p.y, p.z);
      model.rotation.z += 0.15;
    }
  }

  private syncCrew(w: SiegeWorld, now: number, dt: number) {
    const ids = new Set(w.players.map((p) => p.id));
    for (const [id, model] of this.people)
      if (!ids.has(id)) {
        this.scene.remove(model);
        this.release(model);
        this.people.delete(id);
        this.carried.delete(id);
      }
    for (const p of w.players) {
      let model = this.people.get(p.id);
      if (!model) {
        model = crewMember(COLORS[p.color % 4]);
        const name = label(p.name, '#2a2420', '#f0dcb4', 2.1);
        name.position.y = 2.6;
        model.add(name);
        model.position.set(p.x, p.y, p.z);
        this.people.set(p.id, model);
        this.scene.add(model);
      }
      const snap = p.flying || w.rider === p.id;
      model.position.lerp(
        new T.Vector3(p.x, p.y, p.z),
        snap ? 1 : Math.min(1, dt * 18),
      );
      model.rotation.y = p.facing;
      const stunned = p.stunnedUntil > w.clock;
      model.rotation.z = p.flying
        ? now * 0.011
        : stunned
          ? Math.PI / 2.1
          : model.rotation.z * 0.8;
      // Carried payloads ride in front of the crewmate who fetched them.
      const slot = model.getObjectByName('carried')!;
      const held = this.carried.get(p.id);
      if (held?.kind !== p.carrying) {
        if (held) {
          slot.remove(held.model);
          this.release(held.model);
          this.carried.delete(p.id);
        }
        if (p.carrying) {
          const item = ammoModel(p.carrying);
          item.scale.setScalar(p.carrying === 'cow' ? 0.55 : 0.9);
          slot.add(item);
          this.carried.set(p.id, { kind: p.carrying, model: item });
        }
      }
      const walking = !stunned && !p.flying && Math.hypot(p.vx, p.vz) > 0.4;
      const swing = walking ? Math.sin(now * 0.013) * 0.55 : 0;
      const winding = p.winding || p.pushing !== 0;
      for (let i = 0; i < 2; i++) {
        model.getObjectByName(`leg${i}`)!.rotation.x = swing * (i ? 1 : -1);
        model.getObjectByName(`arm${i}`)!.rotation.x = p.carrying
          ? -1.3
          : winding
            ? -1.15 + Math.sin(now * 0.009) * 0.35
            : p.flying
              ? -2.5
              : swing * (i ? -1 : 1);
      }
    }
  }

  private syncEngine(w: SiegeWorld, now: number) {
    const bed = this.engine.getObjectByName('bed')!;
    bed.rotation.y = w.turn;
    const arm = this.engine.getObjectByName('arm')!;
    arm.rotation.x = armAngle(w, w.clock);
    // Counterweight and sling hang plumb regardless of the beam's angle.
    this.engine.getObjectByName('counterweight')!.rotation.x = -arm.rotation.x;
    const sling = this.engine.getObjectByName('sling')!;
    sling.rotation.x = -arm.rotation.x;
    const payloadSlot = this.engine.getObjectByName('payload')!;
    const showing = w.loaded;
    if (this.payload?.kind !== showing) {
      if (this.payload) {
        payloadSlot.remove(this.payload.model);
        this.release(this.payload.model);
        this.payload = null;
      }
      if (showing) {
        const model = ammoModel(showing);
        payloadSlot.add(model);
        this.payload = { kind: showing, model };
      }
    }
    const drum = this.engine.getObjectByName('drum')!;
    drum.rotation.y = w.wind * 26;
    const leverHandle = this.engine
      .getObjectByName('lever')!
      .getObjectByName('handle')!;
    const sinceLoose = w.clock - w.loosedAt;
    leverHandle.rotation.x = sinceLoose >= 0 && sinceLoose < 500 ? -0.9 : 0;
    this.wallGuards.visible = w.beesUntil <= w.clock;
    for (const guard of this.wallGuards.children) {
      const throwing = guard.getObjectByName('throw');
      if (throwing)
        throwing.rotation.x =
          Math.sin(now * 0.004 + guard.position.x) * 0.6 - 0.4;
    }
    for (const [, model] of this.blocks) {
      const cloth = model.getObjectByName('cloth');
      if (cloth) cloth.rotation.y = Math.sin(now * 0.003) * 0.16;
    }
  }

  private frameCamera(w: SiegeWorld, dt: number) {
    const me = w.players.find((p) => p.id === this.localId);
    const flight = w.shots.find((s) => !s.landed && s.y > 1.2);
    const narrow = this.camera.aspect < 1;
    const zoom = narrow ? 1.45 : 1;
    let target: T.Vector3;
    let look: T.Vector3;
    if (flight && this.view === 'shot') {
      // Ride behind the shot so the crew can see where it is going to land.
      look = new T.Vector3(flight.x, Math.max(1, flight.y), flight.z);
      target = new T.Vector3(
        flight.x - flight.vx * 0.55,
        Math.max(6, flight.y + 7),
        flight.z - flight.vz * 0.55 + 9,
      );
    } else if (me && this.view === 'follow') {
      look = new T.Vector3(me.x, 1.4, me.z - 3);
      target = new T.Vector3(me.x * 0.7, 9 * zoom, me.z + 15 * zoom);
    } else {
      // Behind and above the engine, so the crew, the trebuchet and the keep
      // are all in one frame and the throw reads as an arc rather than a plan.
      look = new T.Vector3(0, 5, -10);
      target = new T.Vector3(0, 15 * zoom, 44 * zoom);
    }
    this.camera.position.lerp(target, Math.min(1, dt * (flight ? 6 : 2.6)));
    this.look.lerp(look, Math.min(1, dt * (flight ? 6 : 3)));
    this.camera.lookAt(this.look);
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
    this.syncBlocks(w);
    this.syncShots(w);
    this.syncCrew(w, now, dt);
    this.syncEngine(w, now);
    const me = w.players.find((p) => p.id === this.localId);
    this.ring.visible = !!me && !me.flying;
    if (me) this.ring.position.set(me.x, 0.06, me.z);
    // A ground ring shows the crew where the current wind and aim would land.
    this.aim.visible = w.phase === 'playing' || w.phase === 'relief';
    const range = rangeFor(w.wind);
    this.aim.position.set(
      SLING.x - Math.sin(w.turn) * range,
      0.05,
      SLING.z - Math.cos(w.turn) * range,
    );
    this.frameCamera(w, dt);
    if (!document.hidden) this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.render);
  };

  private release(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
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
    this.aim.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
