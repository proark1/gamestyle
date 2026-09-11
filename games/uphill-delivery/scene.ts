import * as T from 'three';
import { FrameStats } from '../../shared/rendering/frame-stats';
import { label, disposeGeometry } from '../../shared/rendering/primitives';
import { bridgePose, goatPose, GOATS, LEVEL, routeStage } from './level';
import {
  deliverySofa,
  deliveryWorker,
  goatModel,
  villageModel,
} from './objects';
import { DeliveryMotion, DeliveryQuality } from './motion';
import {
  DELIVERY_CAMERAS,
  DeliveryLook,
  EYE_HEIGHT,
  type DeliveryCameraMode,
} from './camera';
import { freshDelivery, deliveryPlayer, deliverySnapshot } from './simulation';
import {
  GRIPS,
  SOFA_CENTER,
  idleInput,
  type DeliveryAction,
  type DeliveryInput,
  type DeliverySnapshot,
} from './types';

export class DeliveryScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  eyes = new T.PerspectiveCamera(76, 1, 0.08, 250);
  look = new DeliveryLook();
  village = villageModel();
  sofa = deliverySofa();
  workers = new Map<string, T.Group>();
  goats = GOATS.map(() => goatModel());
  grips = GRIPS.map(
    () =>
      new T.Mesh(
        new T.SphereGeometry(0.11, 8, 6),
        new T.MeshBasicMaterial({ color: '#ffecaa' }),
      ),
  );
  ropes = GRIPS.map(
    () =>
      new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(),
          new T.Vector3(),
        ]),
        new T.LineBasicMaterial({ color: '#f6d372' }),
      ),
  );
  ring = new T.Mesh(
    new T.RingGeometry(0.47, 0.56, 28),
    new T.MeshBasicMaterial({ color: '#f8db79', side: T.DoubleSide }),
  );
  resize: ResizeObserver;
  abort = new AbortController();
  frame = 0;
  resizeFrame = 0;
  last = 0;
  stats = new FrameStats();
  motion = new DeliveryMotion();
  quality = new DeliveryQuality();
  width = 0;
  height = 0;
  viewSize = 30;
  basePixelRatio = 1;
  resizeCount = 0;
  private focus = new T.Vector3();
  private point = new T.Vector3();
  private offset = new T.Vector3();
  private roll = new T.Quaternion();
  private axis = new T.Vector3(1, 0, 0);
  private bridgeBoxes = LEVEL.filter((box) => box.bridge);
  inputAt = 0;
  keys = new Set<string>();
  touch = { x: 0, z: 0 };
  seq = 0;
  jump = false;
  paused = false;
  get yaw() {
    return this.look.yaw;
  }
  set yaw(value: number) {
    this.look.yaw = value;
  }
  zoom = 1;
  mode: DeliveryCameraMode = DELIVERY_CAMERAS[0];
  get firstPerson() {
    return (
      this.active &&
      this.mode === 'first-person' &&
      this.workers.has(this.snapshot.you)
    );
  }
  center = new T.Vector3(-7, 5, 5);
  snapshot: DeliverySnapshot;
  active = false;
  readyPose = false;
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(
    public host: HTMLElement,
    public callbacks: {
      input: (i: DeliveryInput) => void;
      action: (a: DeliveryAction) => void;
      tick?: () => void;
      camera?: (mode: DeliveryCameraMode) => void;
    },
  ) {
    const w = freshDelivery(Date.now());
    w.players = [0, 1, 2, 3].map((i) =>
      deliveryPlayer(`demo-${i}`, '', i, w.clock),
    );
    this.snapshot = deliverySnapshot(w, '', '', '', 0);
    const mobile = matchMedia('(pointer:coarse)').matches;
    this.renderer = new T.WebGLRenderer({
      antialias: !mobile,
      powerPreference: 'high-performance',
    });
    this.basePixelRatio = Math.min(devicePixelRatio, mobile ? 1.3 : 1.8);
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.shadowMap.enabled = !mobile;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Uphill Delivery mountain. WASD moves, Space jumps, E grabs or releases, F opens gates, R turns the sofa, V changes camera. Drag to orbit and scroll to zoom. In first person, click for mouse look, Escape releases the mouse, or drag or use IJKL to look.',
    );
    host.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color('#c7d3b6');
    this.scene.fog = new T.Fog('#c7d3b6', 100, 180);
    this.scene.add(new T.HemisphereLight('#fff2d4', '#8fa282', 3));
    const sun = new T.DirectionalLight('#fff1d2', 3.2);
    sun.position.set(-18, 48, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -35,
      right: 35,
      top: 40,
      bottom: -40,
      far: 140,
    });
    sun.shadow.normalBias = 0.06;
    sun.target.position.set(0, 10, -7);
    this.scene.add(sun, sun.target, this.village.group, this.sofa);
    this.goats.forEach((g) => this.scene.add(g));
    this.grips.forEach((g) => this.sofa.add(g));
    this.ropes.forEach((g) => this.scene.add(g));
    this.ropes.forEach((g) => {
      g.frustumCulled = false;
    });
    this.grips.forEach((g, i) =>
      g.position.set(GRIPS[i].x, GRIPS[i].y, GRIPS[i].z),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.resize = new ResizeObserver(() => {
      cancelAnimationFrame(this.resizeFrame);
      this.resizeFrame = requestAnimationFrame(() => this.layout());
    });
    this.resize.observe(host);
    this.layout();
    this.bind();
    this.frame = requestAnimationFrame(this.draw);
  }
  layout() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height);
    this.eyes.aspect = width / height;
    this.eyes.updateProjectionMatrix();
    this.resizeCount++;
    this.projection(0);
  }
  projection(dt: number) {
    const { width, height } = this;
    if (!width || !height) return;
    const target =
      (!this.active || this.mode === 'overview' ? 30 : width < 700 ? 14 : 11) /
      this.zoom;
    const size =
      !this.readyPose || this.reduced
        ? target
        : this.viewSize + (target - this.viewSize) * (1 - Math.exp(-dt * 8));
    if (dt && Math.abs(size - this.viewSize) < 0.0001) return;
    this.viewSize = size;
    this.camera.left = (-size * width) / height;
    this.camera.right = (size * width) / height;
    this.camera.top = size;
    this.camera.bottom = -size;
    this.camera.near = 0.1;
    this.camera.far = 250;
    this.camera.updateProjectionMatrix();
  }
  setSnapshot(s: DeliverySnapshot) {
    if (
      s.you !== this.snapshot.you ||
      s.world.started !== this.snapshot.world.started
    ) {
      const me = s.world.players.find((p) => p.id === s.you);
      if (me)
        this.yaw = Math.atan2(me.x - s.world.sofa.x, me.z - s.world.sofa.z);
      this.look.pitch = -0.12;
    }
    if (
      s.world.started !== this.snapshot.world.started ||
      s.code !== this.snapshot.code
    )
      this.readyPose = false;
    this.active = true;
    this.snapshot = s;
    this.motion.push(s, performance.now());
    this.seq = Math.max(
      this.seq,
      s.world.players.find((p) => p.id === s.you)?.input.seq ?? 0,
    );
  }
  setPaused(value: boolean) {
    this.paused = value;
    if (value) this.releaseControls();
  }
  releaseControls() {
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
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
    if (!this.paused) {
      this.jump = true;
      this.sendInput();
    }
  }
  cycleCamera() {
    this.releaseControls();
    this.mode =
      DELIVERY_CAMERAS[
        (DELIVERY_CAMERAS.indexOf(this.mode) + 1) % DELIVERY_CAMERAS.length
      ];
    this.readyPose = false;
    this.callbacks.camera?.(this.mode);
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
            'input,textarea,select,[contenteditable=true],[role=dialog]',
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
        if (this.firstPerson && ['i', 'j', 'k', 'l'].includes(key)) {
          e.preventDefault();
          this.look.turn(
            (Number(key === 'l') - Number(key === 'j')) * 12,
            (Number(key === 'k') - Number(key === 'i')) * 12,
          );
          this.sendInput();
        }
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
          ].includes(key)
        )
          this.sendInput();
        if (key === ' ') this.jumpNow();
        if (key === 'e') this.callbacks.action({ type: 'grab' });
        if (key === 'q') this.callbacks.action({ type: 'release' });
        if (key === 'r') this.callbacks.action({ type: 'rotate' });
        if (key === 'f') this.callbacks.action({ type: 'interact' });
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
        if (document.hidden) {
          this.releaseControls();
          cancelAnimationFrame(this.frame);
        } else {
          this.last = 0;
          this.frame = requestAnimationFrame(this.draw);
        }
      },
      options,
    );
    let drag: { id: number; x: number; y: number } | null = null;
    let locking = false;
    let dragged = false;
    const locked = () => document.pointerLockElement === canvas;
    document.addEventListener(
      'pointerlockchange',
      () => {
        drag = null;
        if (!locked() || this.paused || document.hidden) this.releaseControls();
      },
      options,
    );
    document.addEventListener(
      'mousemove',
      (e) => {
        if (locked() && this.firstPerson && !this.paused)
          this.look.turn(e.movementX, e.movementY);
      },
      options,
    );
    canvas.addEventListener(
      'pointerdown',
      (e) => {
        if (e.button !== 0 || this.paused) return;
        canvas.focus();
        if (locked()) return;
        dragged = false;
        drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      },
      options,
    );
    canvas.addEventListener(
      'pointermove',
      (e) => {
        if (this.paused || locked() || drag?.id !== e.pointerId) return;
        if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 2)
          dragged = true;
        if (this.firstPerson)
          this.look.turn(e.clientX - drag.x, e.clientY - drag.y);
        else this.yaw -= (e.clientX - drag.x) * 0.007;
        drag.x = e.clientX;
        drag.y = e.clientY;
      },
      options,
    );
    const end = () => {
      drag = null;
    };
    canvas.addEventListener('pointerup', end, options);
    canvas.addEventListener('pointercancel', end, options);
    canvas.addEventListener('lostpointercapture', end, options);
    canvas.addEventListener(
      'click',
      (e) => {
        if (
          !this.firstPerson ||
          this.paused ||
          dragged ||
          e.pointerType !== 'mouse' ||
          locked() ||
          locking ||
          !canvas.requestPointerLock
        )
          return;
        locking = true;
        // Embedded browsers can deny mouse capture; dragging still works.
        try {
          void Promise.resolve(canvas.requestPointerLock())
            .catch(() => {})
            .finally(() => {
              locking = false;
            });
        } catch {
          locking = false;
        }
      },
      options,
    );
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.firstPerson || this.paused) return;
        this.zoom = Math.max(0.55, Math.min(1.8, this.zoom - e.deltaY * 0.001));
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
      ...this.look.walk(x, z),
      jump: this.jump,
      seq: ++this.seq,
    });
    this.jump = false;
  }
  draw = (now: number) => {
    const begin = performance.now(),
      gap = this.last ? now - this.last : 0;
    if (document.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.firstPerson && !this.paused)
      this.look.turn(
        (Number(this.keys.has('l')) - Number(this.keys.has('j'))) * dt * 330,
        (Number(this.keys.has('k')) - Number(this.keys.has('i'))) * dt * 250,
      );
    if (now - this.inputAt > 50) {
      this.sendInput();
      this.inputAt = now;
    }
    this.callbacks.tick?.();
    this.motion.advance(now);
    const w = this.snapshot.world,
      mix = this.readyPose ? 1 - Math.exp(-dt * 16) : 1;
    this.motion.sofa(this.snapshot, this.sofa.position, this.sofa.quaternion);
    for (const [id, model] of this.workers)
      if (!w.players.some((p) => p.id === id)) {
        model.removeFromParent();
        this.disposeObject(model);
        this.workers.delete(id);
      }
    for (const p of w.players) {
      let model = this.workers.get(p.id);
      if (!model) {
        model = deliveryWorker(p.color);
        model.position.set(p.x, p.y, p.z);
        if (p.name) {
          const tag = label(p.name, '#fff4d7', '#294a45', 1.9);
          tag.position.y = 2.45;
          model.add(tag);
        }
        this.workers.set(p.id, model);
        this.scene.add(model);
      }
      const displayedAngle = this.motion.player(p, model.position);
      const angle =
        p.grip !== null
          ? Math.atan2(
              this.sofa.position.x - model.position.x,
              this.sofa.position.z - model.position.z,
            )
          : displayedAngle;
      model.rotation.y +=
        Math.atan2(
          Math.sin(angle - model.rotation.y),
          Math.cos(angle - model.rotation.y),
        ) * mix;
      const moving = Math.hypot(p.velocity.x, p.velocity.z) > 0.2;
      const stride =
        !this.reduced && moving ? Math.sin(now / 95 + p.color) * 0.5 : 0;
      model.userData.legL.rotation.x = stride;
      model.userData.legR.rotation.x = -stride;
      model.userData.armL.rotation.x = p.grip !== null ? -1.15 : -stride * 0.7;
      model.userData.armR.rotation.x = p.grip !== null ? -1.15 : stride * 0.7;
      model.userData.body.rotation.z =
        p.stumble > w.clock && !this.reduced ? Math.sin(now / 65) * 0.15 : 0;
      model.visible = !(this.firstPerson && p.id === this.snapshot.you);
    }
    for (let i = 0; i < GRIPS.length; i++) {
      const p = w.players.find((p) => p.grip === i),
        rope = this.ropes[i];
      this.grips[i].visible = !p;
      rope.visible = !!p;
      if (p) {
        const a = this.point
          .set(GRIPS[i].x, GRIPS[i].y, GRIPS[i].z)
          .applyQuaternion(this.sofa.quaternion)
          .add(this.sofa.position);
        const positions = rope.geometry.attributes
          .position as T.BufferAttribute;
        positions.setXYZ(0, a.x, a.y, a.z);
        const hand = this.workers.get(p.id)!.position;
        positions.setXYZ(1, hand.x, hand.y + 1.25, hand.z);
        positions.needsUpdate = true;
      }
    }
    this.village.gate.rotation.y = this.motion.panel(this.snapshot, 'gate');
    this.village.door.rotation.y = this.motion.panel(this.snapshot, 'door');
    const clock = this.active
      ? Math.max(0, this.motion.cursor - w.started)
      : now;
    for (const box of this.bridgeBoxes) {
      const pose = bridgePose(box, clock);
      const mesh = this.village.bridges.get(box.id)!;
      mesh.position.y = pose.y;
      mesh.quaternion
        .set(
          box.quaternion.x,
          box.quaternion.y,
          box.quaternion.z,
          box.quaternion.w,
        )
        .multiply(this.roll.setFromAxisAngle(this.axis, pose.roll));
    }
    this.goats.forEach((g, i) => {
      const p = goatPose(i, clock);
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.angle;
    });
    const me = w.players.find((p) => p.id === this.snapshot.you);
    const mover = me && this.workers.get(me.id);
    this.ring.visible = !!me && !this.firstPerson;
    if (mover) this.ring.position.copy(mover.position).y += 0.025;
    const overview = !this.active || this.mode === 'overview';
    const focus = overview
      ? this.focus.set(-1, 11, -6)
      : this.mode === 'sofa' || !mover
        ? this.focus.copy(this.sofa.position).add(this.offset.set(0, 1, 0))
        : this.focus.copy(mover.position).add(this.offset.set(0, 2, 0));
    this.center.lerp(
      focus,
      !this.readyPose || this.reduced ? 1 : 1 - Math.exp(-dt * 9),
    );
    this.camera.position
      .copy(this.center)
      .add(
        this.offset.set(Math.sin(this.yaw) * 52, 40, Math.cos(this.yaw) * 52),
      );
    this.camera.lookAt(this.center);
    this.projection(dt);
    if (this.firstPerson && mover) {
      // The same interpolated pose as the cargo, with no camera lag or head bob.
      this.eyes.position.copy(mover.position).y += EYE_HEIGHT;
      this.look.direction(this.point);
      this.point.add(this.eyes.position);
      this.eyes.lookAt(this.point);
    }
    this.renderer.render(
      this.scene,
      this.firstPerson ? this.eyes : this.camera,
    );
    this.stats.record(gap, performance.now() - begin);
    if (this.quality.record(gap)) {
      this.renderer.setPixelRatio(
        Math.max(
          0.75,
          this.basePixelRatio * (this.quality.level === 1 ? 0.8 : 0.65),
        ),
      );
      if (this.quality.level === 2) this.renderer.shadowMap.enabled = false;
    }
    this.readyPose = true;
    this.frame = requestAnimationFrame(this.draw);
  };
  hint() {
    return routeStage(this.snapshot.world.sofa.y - SOFA_CENTER);
  }
  diagnostics() {
    const player = this.workers.get(this.snapshot.you);
    return {
      ...this.stats.read(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      pixelRatio: this.renderer.getPixelRatio(),
      qualityLevel: this.quality.level,
      canvasResizes: this.resizeCount,
      viewport: this.renderer.getSize(new T.Vector2()).toArray(),
      player: player?.position.toArray() ?? null,
      camera: this.center.toArray(),
      cameraMode: this.mode,
      cameraPosition: (this.firstPerson
        ? this.eyes
        : this.camera
      ).position.toArray(),
      look: { yaw: this.yaw, pitch: this.look.pitch },
      pointerLocked: document.pointerLockElement === this.renderer.domElement,
      ownAvatarVisible: player?.visible ?? null,
      sofa: this.sofa.position.toArray(),
    };
  }
  disposeObject(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line)
        disposeGeometry(o.geometry);
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  dispose() {
    cancelAnimationFrame(this.frame);
    cancelAnimationFrame(this.resizeFrame);
    this.abort.abort();
    this.resize.disconnect();
    this.releaseControls();
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
