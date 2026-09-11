import * as T from 'three';
import { label, disposeGeometry } from '../../shared/rendering/primitives';
import { cottage, itemModel, poseThief, thief } from './objects';
import { bodyPoint, FOOT, restingItemPosition, wakePose } from './level';
import { GiantModel } from './giant-model';
import { freshGiant, giantSnapshot } from './simulation';
import {
  idleInput,
  type GiantAction,
  type GiantInput,
  type GiantSnapshot,
} from './types';

export class GiantScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  giant: GiantModel;
  players = new Map<string, T.Group>();
  items = new Map<string, T.Group>();
  rings = new Map<number, T.Mesh>();
  cottage = cottage();
  ring = new T.Mesh(
    new T.RingGeometry(0.35, 0.43, 24),
    new T.MeshBasicMaterial({ color: '#ffdb73', side: T.DoubleSide }),
  );
  sleepTag = label('Z z z', '#e7dec2', '#6f806a', 2);
  footTag = label('TICKLE?', '#f4d489', '#6c5940', 1.7);
  alarmTag = label('!', '#c8704e', '#fff4d6', 1.1);
  resize: ResizeObserver;
  abort = new AbortController();
  frame = 0;
  last = 0;
  inputAt = 0;
  seq = 0;
  jump = false;
  paused = false;
  active = false;
  readyPose = false;
  yaw = 0.43;
  zoom = 1;
  mode: 'follow' | 'overview' = 'follow';
  keys = new Set<string>();
  touch = { x: 0, z: 0 };
  creep = false;
  center = new T.Vector3(0, 2.8, 0);
  snapshot: GiantSnapshot;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(
    public host: HTMLElement,
    public callbacks: {
      input: (input: GiantInput) => void;
      action: (action: GiantAction) => void;
    },
  ) {
    this.snapshot = giantSnapshot(freshGiant(Date.now()), '', '', '', 0);
    this.giant = new GiantModel(this.snapshot.world);
    const mobile = matchMedia('(pointer:coarse)').matches;
    this.renderer = new T.WebGLRenderer({
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.3 : 1.8));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    const canvas = this.renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      'aria-label',
      'Giant cottage. WASD moves, Space jumps, Shift creeps, E grabs or banks, Q places, F tickles, H helps, X exits, V changes camera. Drag to orbit.',
    );
    host.appendChild(canvas);
    this.scene.background = new T.Color('#343f39');
    this.scene.add(new T.HemisphereLight('#fff1ce', '#64756d', 2.3));
    const lamp = new T.DirectionalLight('#ffdd9e', 3.3);
    lamp.position.set(-9, 17, 10);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.normalBias = 0.025;
    Object.assign(lamp.shadow.camera, {
      left: -24,
      right: 24,
      top: 22,
      bottom: -22,
      far: 75,
    });
    const moon = new T.DirectionalLight('#a4cbce', 1.1);
    moon.position.set(10, 10, -15);
    const glow = new T.PointLight('#ffc96c', 27, 15, 2);
    glow.position.set(-6.5, 5.1, -3.35);
    this.scene.add(lamp, moon, glow, this.cottage, this.giant);
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.sleepTag.position.set(4.4, 6.2, -6);
    this.footTag.position.set(FOOT.x, 4.3, FOOT.z + 0.2);
    this.alarmTag.position.set(2, 6.1, -5.4);
    this.scene.add(this.sleepTag, this.footTag, this.alarmTag);
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(host);
    this.layout();
    this.bind();
    this.frame = requestAnimationFrame(this.draw);
  }
  layout() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const size =
      (!this.active || this.mode === 'overview'
        ? width < 700
          ? 22
          : 15
        : width < 700
          ? this.snapshot.world.phase === 'escape'
            ? 15
            : 9
          : this.snapshot.world.phase === 'escape'
            ? 13
            : 7) / this.zoom;
    this.camera.left = (-size * width) / height;
    this.camera.right = (size * width) / height;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.near = 0.1;
    this.camera.far = 160;
    this.camera.updateProjectionMatrix();
  }
  setSnapshot(s: GiantSnapshot) {
    if (
      s.world.started !== this.snapshot.world.started ||
      s.code !== this.snapshot.code
    )
      this.readyPose = false;
    if (!this.active) {
      this.active = true;
      this.layout();
    }
    const changedPhase = s.world.phase !== this.snapshot.world.phase;
    this.snapshot = s;
    if (changedPhase) this.layout();
    this.seq = Math.max(
      this.seq,
      s.world.players.find((p) => p.id === s.you)?.input.seq ?? 0,
    );
  }
  menu() {
    this.active = false;
    this.snapshot = giantSnapshot(freshGiant(Date.now()), '', '', '', 0);
    this.readyPose = false;
    this.layout();
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.releaseControls();
  }
  releaseControls() {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.jump = false;
    this.callbacks.input({ ...idleInput(), seq: ++this.seq });
  }
  setTouch(vector: { x: number; z: number }) {
    this.touch = vector;
    this.sendInput();
  }
  jumpNow() {
    if (!this.paused && this.active) {
      this.jump = true;
      this.sendInput();
    }
  }
  cycleCamera() {
    this.mode = this.mode === 'follow' ? 'overview' : 'follow';
    this.layout();
  }
  bind() {
    const options = { signal: this.abort.signal },
      canvas = this.renderer.domElement;
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          e.target instanceof Element &&
          e.target.closest(
            'input,textarea,select,button,a,[contenteditable=true],[role=dialog]',
          )
        )
          return;
        if (this.paused || !this.active) return;
        const key = e.key.toLowerCase();
        if (
          [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)
        )
          e.preventDefault();
        this.keys.add(key);
        if (e.repeat) return;
        if (key === ' ') this.jumpNow();
        const actions: Record<string, GiantAction['type']> = {
          e: 'interact',
          q: 'drop',
          f: 'tickle',
          h: 'help',
          x: 'exit',
          r: 'rotate',
        };
        if (actions[key]) this.callbacks.action({ type: actions[key] });
        if (key === 'v') this.cycleCamera();
      },
      options,
    );
    window.addEventListener(
      'keyup',
      (e) => {
        this.keys.delete(e.key.toLowerCase());
        this.sendInput();
      },
      options,
    );
    window.addEventListener('blur', () => this.releaseControls(), options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.releaseControls();
      },
      options,
    );
    let drag: { id: number; x: number } | null = null;
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0) return;
        canvas.focus({ preventScroll: true });
        drag = { id: e.pointerId, x: e.clientX };
        canvas.setPointerCapture(e.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (drag?.id === e.pointerId) {
          this.yaw -= (e.clientX - drag.x) * 0.007;
          drag.x = e.clientX;
        }
      },
      options,
    );
    for (const kind of ['pointerup', 'pointercancel', 'lostpointercapture'])
      canvas.addEventListener(
        kind,
        () => {
          drag = null;
        },
        options,
      );
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = Math.max(0.6, Math.min(1.8, this.zoom - e.deltaY * 0.001));
        this.layout();
      },
      { ...options, passive: false },
    );
  }
  sendInput() {
    if (this.paused || !this.active) return;
    const x =
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft')) +
      this.touch.x;
    const z =
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup')) +
      this.touch.z;
    this.callbacks.input({
      x: x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: z * Math.cos(this.yaw) - x * Math.sin(this.yaw),
      jump: this.jump,
      crouch: this.creep || this.keys.has('shift'),
      seq: ++this.seq,
    });
    this.jump = false;
  }
  draw = (now: number) => {
    this.frame = requestAnimationFrame(this.draw);
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (now - this.inputAt > 50) {
      this.sendInput();
      this.inputAt = now;
    }
    const w = this.snapshot.world,
      mix = this.readyPose ? 1 - Math.exp(-dt * 18) : 1;
    if (!this.active) w.clock = Date.now();
    this.giant.update(w, mix);
    for (const [id, model] of this.players)
      if (!w.players.some((p) => p.id === id)) {
        model.removeFromParent();
        this.disposeObject(model);
        this.players.delete(id);
      }
    for (const p of w.players) {
      let model = this.players.get(p.id);
      if (!model) {
        model = thief(p.color);
        const tag = label(p.name, '#fff1ca', '#435b4e', 3);
        tag.position.y = 2.8;
        model.add(tag);
        this.players.set(p.id, model);
        this.scene.add(model);
      }
      model.visible = !p.escaped && !p.caught;
      model.position.lerp(new T.Vector3(p.x, p.y, p.z), mix);
      model.rotation.y +=
        Math.atan2(
          Math.sin(p.angle - model.rotation.y),
          Math.cos(p.angle - model.rotation.y),
        ) * mix;
      poseThief(model, now, {
        walking: !this.reduced && Math.hypot(p.velocity.x, p.velocity.z) > 0.15,
        crouch: p.input.crouch,
        carrying: w.items.some((i) => i.heldBy === p.id),
        down: p.downUntil > w.clock,
      });
    }
    for (const [id, model] of this.items) {
      if (!w.items.some((item) => item.id === id)) {
        model.removeFromParent();
        this.disposeObject(model);
        this.items.delete(id);
      }
    }
    for (const item of w.items) {
      let model = this.items.get(item.id);
      if (!model) {
        model = itemModel(item.kind);
        if (item.value) {
          const tag = label(`${item.value}`, '#f8da86', '#6c532e', 0.8);
          tag.position.y = 0.85;
          model.add(tag);
          const halo = new T.Mesh(
            new T.RingGeometry(0.39, 0.46, 24),
            new T.MeshBasicMaterial({
              color: '#efc864',
              transparent: true,
              opacity: 0.45,
              side: T.DoubleSide,
              depthWrite: false,
            }),
          );
          halo.rotation.x = -Math.PI / 2;
          halo.position.y = -0.09;
          halo.userData.ownedMaterial = true;
          model.userData.halo = halo;
          model.add(halo);
        }
        this.items.set(item.id, model);
        this.scene.add(model);
      }
      model.visible = !item.banked;
      const resting = restingItemPosition(w, item, this.giant.clock);
      if (resting) {
        const seated = item.support?.startsWith('item:')
          ? resting
          : this.giant.restingLootPosition(resting, item.kind);
        model.position.set(seated.x, seated.y, seated.z);
      } else model.position.lerp(new T.Vector3(item.x, item.y, item.z), mix);
      model.rotation.y = (item.rotation * Math.PI) / 2;
      if (model.userData.halo) model.userData.halo.visible = !item.heldBy;
    }
    for (const e of w.events)
      if (e.kind === 'noise' && w.clock - e.at < 950 && !this.rings.has(e.id)) {
        const ring = new T.Mesh(
          new T.RingGeometry(0.25, 0.3, 24),
          new T.MeshBasicMaterial({
            color: e.strength > 5 ? '#df8b5c' : '#edd08a',
            transparent: true,
            side: T.DoubleSide,
            depthWrite: false,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(e.x, e.y + 0.04, e.z);
        ring.userData.at = e.at;
        this.rings.set(e.id, ring);
        this.scene.add(ring);
      }
    for (const [id, ring] of this.rings) {
      const age = (w.clock - ring.userData.at) / 950;
      if (age > 1 || age < 0) {
        ring.removeFromParent();
        disposeGeometry(ring.geometry);
        (ring.material as T.Material).dispose();
        this.rings.delete(id);
      } else {
        ring.scale.setScalar(1 + age * 6);
        (ring.material as T.MeshBasicMaterial).opacity = (1 - age) * 0.65;
      }
    }
    this.sleepTag.visible =
      w.phase === 'lobby' || (w.phase === 'playing' && !w.pending);
    this.sleepTag.position.y =
      6.7 + (this.reduced ? 0 : Math.sin(now / 900) * 0.15);
    const wake = wakePose(w);
    const headPosition = bodyPoint(
      { x: 2, y: 5.2, z: -6.1 },
      wake.angle,
      wake.lift,
      wake.shift,
    );
    this.alarmTag.position.set(
      headPosition.x,
      headPosition.y + 1.5,
      headPosition.z,
    );
    this.alarmTag.visible = !!w.pending || w.phase === 'escape';
    const pulse =
      w.pending && !this.reduced ? 1 + Math.sin(now / 150) * 0.1 : 1;
    this.alarmTag.scale.set(1.1 * pulse, 0.275 * pulse, 1);
    this.footTag.visible = this.active && w.phase === 'playing';
    const me = w.players.find((p) => p.id === this.snapshot.you),
      overview =
        !this.active || this.mode === 'overview' || me?.escaped || me?.caught;
    this.ring.visible = !!me && !me.escaped && !me.caught;
    if (me) this.ring.position.set(me.x, me.y + 0.028, me.z);
    const focus =
      overview || !me
        ? new T.Vector3(this.active ? 0 : -2.5, 2.4 + wake.stand * 3, 0)
        : new T.Vector3(me.x, me.y + 1.2, me.z);
    if (w.phase === 'escape' && wake.elapsed < 6000 && !this.reduced)
      focus.lerp(
        new T.Vector3(headPosition.x, headPosition.y - 2, headPosition.z),
        0.4,
      );
    this.center.lerp(
      focus,
      !this.readyPose || this.reduced ? 1 : 1 - Math.exp(-dt * 6),
    );
    this.camera.position
      .copy(this.center)
      .add(new T.Vector3(Math.sin(this.yaw) * 38, 32, Math.cos(this.yaw) * 38));
    this.camera.lookAt(this.center);
    this.renderer.render(this.scene, this.camera);
    this.readyPose = true;
  };
  disposeObject(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line)
        disposeGeometry(o.geometry);
      if (o instanceof T.Mesh && o.userData.ownedMaterial) {
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material])
          material.dispose();
      }
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.resize.disconnect();
    this.releaseControls();
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
