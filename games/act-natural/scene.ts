import * as T from 'three';
import { cowModel, farmModel, keyModel, ladder } from './objects';
import { farmSnapshot, freshFarm } from './simulation';
import {
  cowExposed,
  fenceDistance,
  shockAge,
  SHOCK_EXPOSURE_MS,
  SHOCK_STUN_MS,
} from './fence';
import { farmerSees } from './visibility';
import { FarmMotion } from './motion';
import { farmCameraInput } from './movement';
import {
  createSightGeometry,
  updateSightGeometry,
  FarmFlashlight,
  NIGHT,
} from './flashlight';
import {
  distance,
  farmMode,
  GATE,
  PANEL,
  LADDER_EXIT,
  type CowInput,
  type FarmAction,
  type FarmSnapshot,
} from './types';
export type FarmHud = {
  hint: string;
  target: string;
  watched: boolean;
  grazing: boolean;
};
export class FarmScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  farm = farmModel();
  cows = new Map<string, T.Group>();
  items = new Map<string, T.Group>();
  resize: ResizeObserver;
  abort = new AbortController();
  frame = 0;
  last = 0;
  lastHud = 0;
  receivedAt = 0;
  keys = new Set<string>();
  touch = { x: 0, z: 0 };
  grazing = false;
  paused = false;
  selected = '';
  zoom = 1;
  yaw = 0.5;
  snapshot: FarmSnapshot = farmSnapshot(freshFarm(Date.now()), '', '', '', 0);
  active = false;
  ring = new T.Mesh(
    new T.RingGeometry(0.75, 0.83, 32),
    new T.MeshBasicMaterial({
      color: '#ffdf7f',
      side: T.DoubleSide,
      depthTest: false,
    }),
  );
  targetRing = new T.Mesh(
    new T.RingGeometry(0.84, 0.9, 32),
    new T.MeshBasicMaterial({
      color: '#f7edcd',
      side: T.DoubleSide,
      depthTest: false,
    }),
  );
  sight: T.Mesh;
  motion = new FarmMotion();
  flashlight = new FarmFlashlight();
  hemisphere = new T.HemisphereLight('#fff2d4', '#8fa282', 3);
  sun = new T.DirectionalLight('#fff1d2', 3.2);
  night = false;
  lastSight = { x: Infinity, z: Infinity, angle: Infinity };
  walkDistance = 0;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(
    public host: HTMLElement,
    public callbacks: {
      input: (i: CowInput) => void;
      action: (a: FarmAction) => void;
      hud: (h: FarmHud) => void;
    },
  ) {
    const mobile = matchMedia('(pointer:coarse)').matches;
    this.renderer = new T.WebGLRenderer({
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.3 : 1.8));
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Blend Business pasture. WASD to move, Space to graze, E to interact or inspect, Q to drop. Click a cow to select it.',
    );
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color('#c7d3b6');
    this.scene.fog = new T.Fog('#c7d3b6', 65, 120);
    this.scene.add(this.hemisphere);
    const sun = this.sun;
    sun.position.set(-13, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
    });
    sun.shadow.normalBias = 0.05;
    this.scene.add(sun, this.farm.group);
    this.ring.rotation.x = this.targetRing.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.13;
    this.targetRing.position.y = 0.14;
    this.ring.renderOrder = this.targetRing.renderOrder = 5;
    this.scene.add(this.ring, this.targetRing);
    this.sight = new T.Mesh(
      createSightGeometry(),
      new T.MeshBasicMaterial({
        color: '#f8dda1',
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.sight.frustumCulled = false;
    this.scene.add(this.sight);
    for (let i = 0; i < 18; i++) {
      const cow = cowModel(i);
      cow.userData.cowId = `cow-${i}`;
      this.cows.set(`cow-${i}`, cow);
      this.scene.add(cow);
    }
    for (const item of this.snapshot.world.items) {
      const model = item.kind === 'ladder' ? ladder() : keyModel();
      this.items.set(item.id, model);
      this.scene.add(model);
    }
    this.flashlight.bind(this.scene);
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(host);
    this.layout();
    const signal = this.abort.signal;
    window.addEventListener(
      'keydown',
      (e) => {
        if (
          this.paused ||
          !this.active ||
          (e.target instanceof HTMLElement &&
            (e.target.closest('input,textarea,[role="dialog"]') ||
              (e.code === 'Space' && e.target.closest('button'))))
        )
          return;
        const key = e.code;
        if (
          [
            'Space',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'KeyE',
            'KeyQ',
            'KeyV',
          ].includes(key)
        )
          e.preventDefault();
        this.keys.add(key);
        if (e.repeat) return;
        if (key === 'Space') this.toggleGraze();
        if (key === 'KeyE') this.interact();
        if (key === 'KeyQ') callbacks.action({ type: 'drop' });
        if (key === 'KeyV') {
          this.zoom = this.zoom === 1 ? 1.35 : 1;
          this.layout();
        }
      },
      { signal },
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), {
      signal,
    });
    window.addEventListener('blur', () => this.clearInput(), { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.clearInput();
      },
      { signal },
    );
    this.renderer.domElement.addEventListener(
      'pointerdown',
      (e) => {
        if (this.paused || !this.active) return;
        this.renderer.domElement.focus();
        const r = this.renderer.domElement.getBoundingClientRect(),
          ray = new T.Raycaster();
        ray.setFromCamera(
          new T.Vector2(
            ((e.clientX - r.left) / r.width) * 2 - 1,
            1 - ((e.clientY - r.top) / r.height) * 2,
          ),
          this.camera,
        );
        const hits = ray.intersectObjects(
          [...this.cows.values()].filter((cow) => cow.visible),
          true,
        );
        let obj: T.Object3D | null = hits[0]?.object ?? null;
        while (obj && !obj.userData.cowId) obj = obj.parent;
        this.selected = obj?.userData.cowId ?? '';
      },
      { signal },
    );
    this.renderer.domElement.addEventListener(
      'wheel',
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        this.zoom = Math.max(0.8, Math.min(1.5, this.zoom - e.deltaY * 0.001));
        this.layout();
      },
      { signal, passive: false },
    );
    this.frame = requestAnimationFrame((t) => this.render(t));
  }
  layout() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h,
      half = Math.max(14, 14 / aspect) / this.zoom;
    Object.assign(this.camera, {
      left: -half * aspect,
      right: half * aspect,
      top: half,
      bottom: -half,
      near: 0.1,
      far: 180,
    });
    this.camera.position.set(
      Math.sin(this.yaw) * 35,
      33,
      Math.cos(this.yaw) * 35,
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
  setSnapshot(snapshot: FarmSnapshot) {
    const changed = snapshot.world.round !== this.snapshot.world.round;
    const ownCow = snapshot.world.cows.find((c) => c.id === snapshot.you.cowId);
    const previousCow = this.snapshot.world.cows.find(
      (c) => c.id === snapshot.you.cowId,
    );
    if (ownCow?.shockedAt && ownCow.shockedAt !== previousCow?.shockedAt)
      this.grazing = false;
    this.snapshot = snapshot;
    if (!snapshot.world.cows.some((c) => c.id === this.selected))
      this.selected = '';
    this.receivedAt = performance.now();
    this.motion.push(snapshot, this.receivedAt);
    this.active = true;
    if (changed) {
      this.grazing =
        snapshot.world.cows.find((c) => c.id === snapshot.you.cowId)?.grazing ??
        false;
      this.selected = '';
      this.clearInput();
    }
  }
  reset() {
    this.snapshot = farmSnapshot(freshFarm(Date.now()), '', '', '', 0);
    this.motion = new FarmMotion();
    this.active = false;
    this.clearInput();
  }
  clearInput() {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.callbacks.input({ x: 0, z: 0, graze: this.grazing });
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.clearInput();
  }
  toggleGraze() {
    if (this.snapshot.you.role === 'farmer') return;
    this.grazing = !this.grazing;
    this.sendInput();
  }
  interact() {
    if (this.paused) return;
    this.callbacks.action({
      type: this.snapshot.you.role === 'farmer' ? 'inspect' : 'interact',
      ...(this.snapshot.you.role === 'farmer' && this.selected
        ? { target: this.selected }
        : {}),
    });
  }
  readInput() {
    const k = this.keys,
      x = this.paused
        ? 0
        : Number(k.has('KeyD') || k.has('ArrowRight')) -
          Number(k.has('KeyA') || k.has('ArrowLeft')) +
          this.touch.x,
      z = this.paused
        ? 0
        : Number(k.has('KeyS') || k.has('ArrowDown')) -
          Number(k.has('KeyW') || k.has('ArrowUp')) +
          this.touch.z;
    return farmCameraInput(x, z, this.yaw, this.grazing);
  }
  sendInput() {
    const input = this.readInput();
    this.callbacks.input(input);
    return input;
  }
  render(time: number) {
    const dt = Math.min((time - this.last) / 1000 || 0.016, 0.06);
    this.last = time;
    const w = this.snapshot.world,
      clock = w.clock + (this.active ? Math.max(0, time - this.receivedAt) : 0),
      me = w.cows.find((c) => c.id === this.snapshot.you.cowId),
      farmer = this.snapshot.you.role === 'farmer';
    // Sample every frame; the connection sends only changes and throttles the wire.
    const input = this.sendInput();
    const pose = this.motion.frame(time, dt, input, this.paused);
    const viewWorld = { ...w, farmer: pose };
    const night = this.active && farmMode(w) === 'human' && w.phase !== 'lobby';
    if (night !== this.night) {
      this.night = night;
      this.lastSight.x = Infinity;
      (this.scene.background as T.Color).set(night ? NIGHT.sky : '#c7d3b6');
      (this.scene.fog as T.Fog).color.set(night ? NIGHT.sky : '#c7d3b6');
      this.hemisphere.color.set(night ? NIGHT.moon : '#fff2d4');
      this.hemisphere.groundColor.set(night ? NIGHT.ground : '#8fa282');
      this.hemisphere.intensity = night ? 0.55 : 3;
      this.sun.color.set(night ? NIGHT.moon : '#fff1d2');
      this.sun.intensity = night ? 0.8 : 3.2;
      this.renderer.toneMappingExposure = night ? 1 : 1.25;
      (this.sight.material as T.MeshBasicMaterial).opacity = night
        ? 0.045
        : 0.15;
    }
    this.flashlight.update(pose, night);
    this.farm.flashlight.visible = night;
    const visibleIds = new Set(w.cows.map((c) => c.id));
    for (const [id, model] of this.cows)
      if (!visibleIds.has(id)) model.visible = false;
    this.farm.cover.visible = this.active && farmMode(w) === 'human';
    for (const c of w.cows) {
      const model = this.cows.get(c.id)!;
      const age = shockAge(c, clock);
      const shocked = age < SHOCK_STUN_MS;
      // Finish the hit even if a nearby farmer captures the cow on this snapshot.
      const visual = this.motion.cow(c);
      model.visible =
        !c.escaped &&
        (!c.captured || shocked) &&
        (!night ||
          !farmer ||
          cowExposed(c, clock) ||
          shocked ||
          farmerSees(viewWorld, visual));
      if (!model.visible) continue;
      const progress = Math.min(1, age / SHOCK_STUN_MS);
      const kick = shocked ? Math.sin(progress * Math.PI) : 0;
      const target = new T.Vector3(visual.x, 0, visual.z);
      if (!this.active) target.y = 0;
      // Interpolated samples already have a continuous clock: don't ease twice.
      model.position.copy(target);
      let delta = visual.angle - model.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      model.rotation.y += delta * Math.min(1, dt * 12);
      const head = model.userData.head as T.Group;
      head.rotation.x = T.MathUtils.lerp(
        head.rotation.x,
        c.interacting ? 0.7 : c.grazing ? 1.03 : 0,
        Math.min(1, dt * 8),
      );
      head.position.y = c.grazing ? 0.9 : 1.15;
      const legs = model.userData.legs as T.Group[];
      legs.forEach(
        (leg, i) =>
          (leg.rotation.x =
            c.moving && !this.reduced
              ? Math.sin(time * 0.011 + (i % 2) * Math.PI) * 0.32
              : 0),
      );
      const body = model.userData.body as T.Group;
      body.position.y =
        !this.reduced && c.grazing
          ? Math.sin(time * 0.003 + Number(c.id.slice(4))) * 0.025
          : 0;
      body.rotation.set(0, 0, 0);
      for (const leg of legs) leg.rotation.z = 0;
      if (shocked) {
        body.position.y = this.reduced ? 0.06 : kick * 0.38;
        body.rotation.x = this.reduced ? -0.06 : -kick * 0.18;
        body.rotation.z = this.reduced
          ? 0
          : Math.sin(age * 0.045) * 0.12 * (1 - progress);
        head.rotation.x = -0.35;
        head.position.y = 1.22;
        for (let i = 0; i < legs.length; i++) {
          legs[i].rotation.x = i % 2 ? -0.35 : 0.35;
          legs[i].rotation.z = i < 2 ? 0.22 : -0.22;
        }
      }
      model.userData.exposed.visible =
        w.phase === 'playing' && cowExposed(c, clock);
      model.userData.sparks.visible = shocked && !this.reduced;
      model.userData.sparkMaterial.opacity = shocked ? 1 - progress * 0.75 : 0;
      model.userData.ladder.visible = c.carrying === 'ladder';
      model.userData.key.visible =
        c.id === me?.id && !!c.carrying && c.carrying !== 'ladder';
    }
    const walked = Math.hypot(
      pose.x - this.farm.farmer.position.x,
      pose.z - this.farm.farmer.position.z,
    );
    this.walkDistance += Math.min(walked, 0.3);
    this.farm.farmer.position.set(pose.x, 0, pose.z);
    this.farm.farmer.rotation.y = pose.angle;
    const stride =
      !this.reduced && walked > 0.001
        ? Math.sin(this.walkDistance * 7) * 0.42
        : 0;
    const limbs = this.farm.farmer.userData;
    for (const [name, angle] of [
      ['legL', stride],
      ['legR', -stride],
      ['armL', -stride * 0.7],
      ['armR', night ? -1.2 : stride * 0.7],
    ] as const)
      (limbs[name] as T.Group).rotation.x = T.MathUtils.lerp(
        (limbs[name] as T.Group).rotation.x,
        angle,
        1 - Math.exp(-dt * 20),
      );
    this.sight.visible = this.active && w.phase === 'playing';
    if (
      this.sight.visible &&
      (distance(pose, this.lastSight) > 0.003 ||
        Math.abs(pose.angle - this.lastSight.angle) > 0.001)
    ) {
      updateSightGeometry(this.sight.geometry, viewWorld);
      Object.assign(this.lastSight, pose);
    }
    const marker = farmer ? pose : me && this.motion.cow(me);
    this.ring.visible =
      this.active && !!marker && (!me || (!me.captured && !me.escaped));
    if (marker) this.ring.position.set(marker.x, 0.13, marker.z);
    const selected = w.cows.find((c) => c.id === this.selected);
    this.targetRing.visible =
      farmer &&
      !!selected &&
      !selected.captured &&
      !selected.escaped &&
      !!this.cows.get(selected.id)?.visible;
    if (selected) {
      const point = this.motion.cow(selected);
      this.targetRing.position.set(point.x, 0.14, point.z);
    }
    for (const model of this.items.values()) model.visible = false;
    for (const item of w.items) {
      const model = this.items.get(item.id)!;
      model.visible =
        !item.holder &&
        !item.delivered &&
        (!night || !farmer || farmerSees(viewWorld, item));
      model.position.set(
        item.x,
        item.kind === 'key'
          ? 0.6 + (!this.reduced ? Math.sin(time * 0.002) * 0.1 : 0)
          : 0.1,
        item.z,
      );
      if (item.kind === 'key') model.rotation.y = time * 0.0008;
    }
    this.farm.gate.rotation.y = w.keysDelivered === 2 ? -1.3 : 0;
    this.farm.escapeLadder.visible = w.ladderPlaced;
    this.farm.wires.visible = true;
    this.farm.wireMaterial.color.set(w.powerOff ? '#777f7c' : '#2a7ea7');
    this.farm.wireMaterial.emissiveIntensity = w.powerOff ? 0 : 0.5;
    this.farm.panelLight.material.color.set(w.powerOff ? '#8aad75' : '#f2ca63');
    if (time - this.lastHud > 150) {
      let hint =
        'Wander or graze near other cows. Space to graze, E to interact.';
      let watched = false;
      if (farmer)
        hint = selected
          ? `Selected cow · ${distance(selected, w.farmer).toFixed(1)} m away · E to inspect`
          : 'Sweep your flashlight across the herd. Face a nearby cow, then click or press E to inspect.';
      else if (me) {
        const dx = me.x - w.farmer.x,
          dz = me.z - w.farmer.z,
          len = Math.hypot(dx, dz);
        watched =
          len < 7 &&
          (Math.sin(w.farmer.angle) * dx + Math.cos(w.farmer.angle) * dz) /
            Math.max(0.01, len) >
            0.2;
        if (farmMode(w) === 'human') watched = farmerSees(w, me);
        if (me.captured || me.escaped)
          hint = me.escaped
            ? 'You escaped. Watch your friends finish the round.'
            : 'Caught! Watch the rest of the herd until the next round.';
        else if (cowExposed(me, clock))
          hint =
            shockAge(me, clock) < SHOCK_STUN_MS
              ? 'ZAPPED! The live fence exposed you!'
              : `EXPOSED! The farmer can spot you for ${Math.ceil((SHOCK_EXPOSURE_MS - shockAge(me, clock)) / 1000)} more seconds.`;
        else if (me.task)
          hint = 'Cutting the power… stay still for four seconds.';
        else if (!w.powerOff && distance(me, PANEL) < 2)
          hint = 'E · Cut the power (stay still for 4 seconds)';
        else if (distance(me, GATE) < 2)
          hint =
            me.carrying && me.carrying !== 'ladder'
              ? 'E · Unlock a gate lock'
              : w.keysDelivered === 2 && w.powerOff
                ? 'E · Escape through the gate'
                : 'The gate needs two keys and the power off.';
        else if (
          distance(me, LADDER_EXIT) < 2 &&
          (me.carrying === 'ladder' || w.ladderPlaced)
        )
          hint =
            me.carrying === 'ladder'
              ? 'E · Place ladder at the fence'
              : 'E · Climb out (power must be off)';
        else if (me.carrying)
          hint =
            me.carrying === 'ladder'
              ? 'Take the ladder to the east fence. Q to drop.'
              : 'Take the key to the south gate. Q to drop.';
        else if (
          w.items.some(
            (i) => !i.holder && !i.delivered && distance(me, i) < 1.8,
          )
        )
          hint = 'E · Pick up the nearby item';
        else if (!w.powerOff && fenceDistance(me) < 2.5)
          hint = 'Live electric fence! Touching it will shock and expose you.';
      }
      this.callbacks.hud({
        hint,
        target: this.selected,
        watched,
        grazing: this.grazing,
      });
      this.lastHud = time;
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((t) => this.render(t));
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.resize.disconnect();
    const geometries = new Set<T.BufferGeometry>();
    const mats = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          mats.add(m);
      } else if (o instanceof T.Sprite) mats.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    mats.forEach((m) => {
      if ('map' in m && m.map instanceof T.Texture) m.map.dispose();
      m.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
