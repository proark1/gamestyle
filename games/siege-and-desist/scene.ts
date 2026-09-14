import * as T from 'three';
import { label } from '../../shared/rendering/primitives';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import {
  ammoModel,
  blockModel,
  crewMember,
  defenders,
  gooseModel,
  poseCrew,
  potModel,
  siegeField,
  trebuchet,
} from './models';
import { freshSiege, newCrew, reconcileClashBots } from './simulation';
import {
  COLORS,
  SLING,
  SLING_RED,
  SLING_BLUE,
  TREBUCHET,
  TREBUCHET_RED,
  TREBUCHET_BLUE,
  idleInput,
  rangeFor,
  type AmmoKind,
  type GameMode,
  type SiegeAction,
  type SiegeInput,
  type SiegeSnapshot,
  type SiegeWorld,
} from './types';

/** The camera's resting angle above the ground, and the limits a drag may take
 *  it to. The default reproduces the framing it had before it could be moved. */
const REST_PITCH = 0.209;
const MIN_PITCH = 0.05;
const MAX_PITCH = 1.25;
const MIN_DOLLY = 0.45;
const MAX_DOLLY = 2.2;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
/**
 * Where the camera sits for a look point, swung round it by a yaw and lifted by
 * a pitch. Yaw runs the whole way round; pitch is clamped so a drag can neither
 * bury the camera in the ground nor tip it past straight down.
 */
export function orbitAround(
  look: { x: number; y: number; z: number },
  distance: number,
  yaw: number,
  pitch: number,
) {
  const lift = clamp(pitch, MIN_PITCH, MAX_PITCH);
  const flat = Math.cos(lift) * distance;
  return {
    x: look.x + flat * Math.sin(yaw),
    y: Math.max(1.2, look.y + Math.sin(lift) * distance),
    z: look.z + flat * Math.cos(yaw),
  };
}

/**
 * Projects screen-relative movement (WASD or touch joystick) into world space
 * based on the camera's orbit yaw, so pressing 'W' (forward) always moves the
 * character away from the camera into the screen.
 */
export function cameraRelativeInput(
  input: { x: number; z: number },
  yaw: number,
): { x: number; z: number } {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const wx = input.x * cos + input.z * sin;
  const wz = -input.x * sin + input.z * cos;
  const d = Math.max(1, Math.hypot(wx, wz));
  return { x: wx / d, z: wz / d };
}

// Negative angles carry the throwing end toward the castle, positive ones back
// over the crew. Winding therefore counts up, and the release sweeps down past
// rest and over the top: the beam whips the way the shot actually flies.
const RELAXED = -0.55;
const WOUND = 0.48;
const SWEEP = -1.45;
/** Where the arm sits at a given wind, and how it whips through a release. */
export function armAngle(w: { wind: number; loosedAt: number }, clock: number) {
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
  private engineBlue: T.Group | null = null;
  private wallGuards = defenders();
  private people = new Map<string, T.Group>();
  private blocks = new Map<number, T.Group>();
  private shots = new Map<number, T.Group>();
  private pots = new Map<number, T.Group>();
  private payload: { kind: AmmoKind; model: T.Group } | null = null;
  private payloadBlue: { kind: AmmoKind; model: T.Group } | null = null;
  private goose: T.Group | null = null;
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
  private view: 'shot' | 'follow' | 'overview' = 'shot';
  /** Where the crew has dragged the camera to, around whatever it is watching. */
  private orbit = { yaw: 0, pitch: REST_PITCH, dolly: 1 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
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
      'Siege and Desist field. WASD moves, hold R to wind the counterweight, F looses, Q and E swing the aim, C rides the sling.',
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
    this.setMode('clash2v2');
    this.camera.position.set(0, 16, 42);
    this.camera.lookAt(0, 4, 0);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    const opts = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, opts);
    window.addEventListener('keyup', this.keyUp, opts);
    window.addEventListener('blur', this.resetInput, opts);
    document.addEventListener('visibilitychange', this.hidden, opts);
    const canvas = this.renderer.domElement;
    for (const type of [
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ] as const)
      canvas.addEventListener(type, this.orbitPointer, opts);
    canvas.addEventListener('wheel', this.orbitWheel, {
      ...opts,
      passive: false,
    });
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

  setMode(mode: GameMode) {
    if (this.snapshot) return;
    this.demo = freshSiege(100000, mode);
    if (mode === 'clash2v2') {
      reconcileClashBots(this.demo);
      for (const p of this.demo.players) {
        p.facing = p.team === 'blue' ? 0 : Math.PI;
      }
    } else {
      for (let i = 0; i < 3; i++)
        this.demo.players.push(
          newCrew(`demo-${i}`, ['Kayi', 'Bahadir', 'Selim'][i], i, 100000),
        );
      this.demo.wind = 0.65;
    }
    for (const [, model] of this.blocks) {
      this.scene.remove(model);
      this.release(model);
    }
    this.blocks.clear();
    for (const [, model] of this.people) {
      this.scene.remove(model);
      this.release(model);
    }
    this.people.clear();
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
    this.view =
      this.view === 'shot'
        ? 'follow'
        : this.view === 'follow'
          ? 'overview'
          : 'shot';
    // Also the way back to a sensible angle once a drag has gone wandering.
    this.orbit = { yaw: 0, pitch: REST_PITCH, dolly: 1 };
  }
  resetInput = () => {
    if (this.keys.has('r')) this.cb.action({ type: 'stopWind' });
    if (this.keys.has('q') || this.keys.has('e'))
      this.cb.action({ type: 'stopPush' });
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.cb.input(idleInput());
  };
  private hidden = () => {
    if (document.hidden) this.resetInput();
  };
  /** Dragging the field swings the camera round it; two fingers pinch to zoom.
   *  The HUD sits above the canvas, so a drag on a panel or a thumb control
   *  never reaches this. */
  private orbitPointer = (e: PointerEvent) => {
    const canvas = this.renderer.domElement;
    if (e.type === 'pointerdown') {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinch = this.spread();
      try {
        // Keeps the drag alive past the edge of the canvas. Refused for a
        // pointer the browser no longer owns, which must not kill the drag.
        canvas.setPointerCapture(e.pointerId);
      } catch {
        /* Dragging still works without capture. */
      }
      return;
    }
    if (e.type !== 'pointermove') {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      return;
    }
    const last = this.pointers.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size > 1) {
      const gap = this.spread();
      if (this.pinch > 0 && gap > 0) this.dolly(this.pinch / gap);
      this.pinch = gap;
      return;
    }
    // The field follows the finger: drag right and the siege swings right.
    this.orbit.yaw -= dx * 0.006;
    this.orbit.pitch = clamp(
      this.orbit.pitch + dy * 0.005,
      MIN_PITCH,
      MAX_PITCH,
    );
  };
  private orbitWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.dolly(Math.exp(e.deltaY * 0.0012));
  };
  private dolly(factor: number) {
    this.orbit.dolly = clamp(this.orbit.dolly * factor, MIN_DOLLY, MAX_DOLLY);
  }
  private spread() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
  /** Camera position for a look point, swung to wherever the crew dragged it. */
  private orbitPos(look: T.Vector3, distance: number, bias = 0) {
    const at = orbitAround(
      look,
      distance * this.orbit.dolly,
      this.orbit.yaw,
      this.orbit.pitch + bias,
    );
    return new T.Vector3(at.x, at.y, at.z);
  }
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
    // Q and E swing the aim. Which way you lean used to depend on which side of
    // the frame you had walked round to, which nobody ever worked out.
    if (key === 'q') this.cb.action({ type: 'push', side: 1 });
    if (key === 'e') this.cb.action({ type: 'push', side: -1 });
    const once = {
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
    if (key === 'q' || key === 'e') this.cb.action({ type: 'stopPush' });
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
      }
    for (const p of w.players) {
      let model = this.people.get(p.id);
      if (!model) {
        let colorHex = COLORS[p.color % 4];
        if (w.mode === 'clash2v2') {
          colorHex =
            p.team === 'blue'
              ? p.color % 2 === 0
                ? '#2f7d74'
                : '#7c5aa0'
              : p.color % 2 === 0
                ? '#c2472f'
                : '#d8a13d';
        }
        model = crewMember(
          colorHex,
          this.localId === p.id ? getEquippedLook() : undefined,
        );
        const displayName = p.bot ? `${p.name} [Bot]` : p.name;
        const name = label(displayName, '#2a2420', '#f0dcb4', 2.1);
        name.position.y = 2.6;
        model.add(name);
        model.position.set(p.x, p.y, p.z);
        this.people.set(p.id, model);
        this.scene.add(model);
      }
      const snap =
        p.flying ||
        w.rider === p.id ||
        (w.engineBlue && w.engineBlue.rider === p.id);
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
      poseCrew(model, now, {
        walking: !stunned && !p.flying && Math.hypot(p.vx, p.vz) > 0.4,
        winding: p.winding || p.pushing !== 0,
        flying: p.flying,
      });
    }
  }

  private syncEngine(w: SiegeWorld, now: number) {
    const is2v2 = w.mode === 'clash2v2';
    const redPos = is2v2 ? TREBUCHET_RED : TREBUCHET;
    this.engine.position.set(redPos.x, 0, redPos.z);

    const bed = this.engine.getObjectByName('bed')!;
    bed.rotation.y = w.turn;
    const arm = this.engine.getObjectByName('arm')!;
    arm.rotation.x = armAngle(w, w.clock);
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

    // 2v2 Blue Engine sync
    if (is2v2) {
      if (!this.engineBlue) {
        this.engineBlue = trebuchet(TREBUCHET_BLUE, 'blue');
        this.engineBlue.rotation.y = Math.PI;
        this.scene.add(this.engineBlue);
      }
      this.engineBlue.visible = true;
      const bState = w.engineBlue;
      const bedB = this.engineBlue.getObjectByName('bed')!;
      bedB.rotation.y = bState ? bState.turn : 0;
      const armB = this.engineBlue.getObjectByName('arm')!;
      const angleB = bState
        ? armAngle({ wind: bState.wind, loosedAt: bState.loosedAt }, w.clock)
        : -0.55;
      armB.rotation.x = angleB;
      this.engineBlue.getObjectByName('counterweight')!.rotation.x = -angleB;
      this.engineBlue.getObjectByName('sling')!.rotation.x = -angleB;
      const payloadSlotB = this.engineBlue.getObjectByName('payload')!;
      const showingB = bState?.loaded ?? null;
      if (this.payloadBlue?.kind !== showingB) {
        if (this.payloadBlue) {
          payloadSlotB.remove(this.payloadBlue.model);
          this.release(this.payloadBlue.model);
          this.payloadBlue = null;
        }
        if (showingB) {
          const modelB = ammoModel(showingB);
          payloadSlotB.add(modelB);
          this.payloadBlue = { kind: showingB, model: modelB };
        }
      }
      const drumB = this.engineBlue.getObjectByName('drum')!;
      drumB.rotation.y = bState ? bState.wind * 26 : 0;
      const leverHandleB = this.engineBlue
        .getObjectByName('lever')!
        .getObjectByName('handle')!;
      const sinceLooseB = bState ? w.clock - bState.loosedAt : -1;
      leverHandleB.rotation.x =
        sinceLooseB >= 0 && sinceLooseB < 500 ? -0.9 : 0;
      this.wallGuards.visible = false;
    } else {
      if (this.engineBlue) this.engineBlue.visible = false;
      this.wallGuards.visible = w.beesUntil <= w.clock;
    }

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

  private syncGoose(w: SiegeWorld, now: number) {
    if (w.goose) {
      if (!this.goose) {
        this.goose = gooseModel();
        this.scene.add(this.goose);
      }
      this.goose.visible = true;
      this.goose.position.set(w.goose.x, 0, w.goose.z);
      this.goose.rotation.y = Math.atan2(w.goose.vx, w.goose.vz);
      const honking = w.clock < w.goose.honkUntil;
      const wL = this.goose.getObjectByName('wingL');
      const wR = this.goose.getObjectByName('wingR');
      if (wL) wL.rotation.z = honking ? Math.sin(now * 0.035) * 0.8 : 0;
      if (wR) wR.rotation.z = honking ? -Math.sin(now * 0.035) * 0.8 : 0;
    } else if (this.goose) {
      this.goose.visible = false;
    }
  }

  private frameCamera(w: SiegeWorld, dt: number) {
    const me = w.players.find((p) => p.id === this.localId);
    const flight = w.shots.find((s) => !s.landed && s.y > 1.2);
    const narrow = this.camera.aspect < 1;
    const zoom = narrow ? 1.45 : 1;
    let target: T.Vector3;
    let look: T.Vector3;

    if (this.view === 'overview') {
      look = new T.Vector3(0, 3, 0);
      target = this.orbitPos(look, 68 * zoom, 0.28);
    } else if (flight && this.view === 'shot') {
      look = new T.Vector3(flight.x, Math.max(1, flight.y), flight.z);
      const zOffset = flight.vz > 0 ? -9 : 9;
      target = new T.Vector3(
        flight.x - flight.vx * 0.55,
        Math.max(6, flight.y + 7),
        flight.z - flight.vz * 0.55 + zOffset,
      );
    } else if (me && this.view === 'follow') {
      look = new T.Vector3(me.x, 1.4, me.z + (me.team === 'blue' ? 3 : -3));
      target = this.orbitPos(look, 19.5 * zoom, 0.19);
    } else {
      if (w.mode === 'clash2v2' && me?.team === 'blue') {
        look = new T.Vector3(0, 5, -8);
        target = this.orbitPos(look, 48 * zoom, 0);
      } else if (w.mode === 'clash2v2' && !me) {
        look = new T.Vector3(0, 4, 0);
        target = this.orbitPos(look, 56 * zoom, 0.22);
      } else {
        look = new T.Vector3(0, 5, -10);
        target = this.orbitPos(look, 48 * zoom);
      }
    }

    const chase = flight ? 6 : this.pointers.size ? 12 : 2.6;
    this.camera.position.lerp(target, Math.min(1, dt * chase));
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
      const relative = cameraRelativeInput({ x, z }, this.orbit.yaw);
      this.cb.input({ ...relative, seq: ++this.seq });
      this.lastInput = now;
    }
    this.cb.tick();
    const w = this.snapshot?.world ?? this.demo;
    this.syncBlocks(w);
    this.syncShots(w);
    this.syncCrew(w, now, dt);
    this.syncEngine(w, now);
    this.syncGoose(w, now);

    const me = w.players.find((p) => p.id === this.localId);
    this.ring.visible = !!me && !me.flying;
    if (me) this.ring.position.set(me.x, 0.06, me.z);

    // Ground ring showing where the engine will land
    this.aim.visible = w.phase === 'playing' || w.phase === 'relief';
    const isBlue = w.mode === 'clash2v2' && me?.team === 'blue';
    const activeEngine = isBlue && w.engineBlue ? w.engineBlue : w;
    const range = rangeFor(activeEngine.wind);

    if (isBlue) {
      this.aim.position.set(
        SLING_BLUE.x + Math.sin(activeEngine.turn) * range,
        0.05,
        SLING_BLUE.z + Math.cos(activeEngine.turn) * range,
      );
    } else {
      const slingPos = w.mode === 'clash2v2' ? SLING_RED : SLING;
      this.aim.position.set(
        slingPos.x - Math.sin(activeEngine.turn) * range,
        0.05,
        slingPos.z - Math.cos(activeEngine.turn) * range,
      );
    }

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
