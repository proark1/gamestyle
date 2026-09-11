import * as T from 'three';
import { worker } from '../../shared/rendering/worker';
import { poseWrecker } from './avatar';
import { SiteMotion, emptyPose } from './motion';
import { CABLE } from './physics';
import { PIANO_BAY, buildHouse } from './structure';
import {
  DustBursts,
  JIB_Y,
  PART_COLORS,
  cable,
  crane,
  palette,
  partMesh,
  piano,
  pianoBeacon,
  site,
  trolley,
  wreckingBall,
} from './models';
import {
  PART_HITS,
  PIANO_INTEGRITY,
  alive,
  idleInput,
  type LoadAction,
  type LoadInput,
  type LoadSnapshot,
} from './types';

type Callbacks = {
  input: (i: LoadInput) => void;
  action: (a: LoadAction) => void;
  aim: (partId: string | null) => void;
  tick: () => void;
  failure: () => void;
};

const ACTION_KEYS: Record<string, LoadAction['type']> = {
  KeyE: 'swing',
  KeyQ: 'mark',
  KeyF: 'help',
  KeyC: 'crane',
  KeyG: 'wave',
  KeyX: 'crane-drop',
};
const KEY_AXES: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export class LoadBearingScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(46, 1, 0.1, 260);
  private renderer: T.WebGLRenderer;
  private parts = new Map<string, T.Group>();
  private people = new Map<string, T.Group>();
  private pianoMesh = piano();
  private craneMesh = crane();
  private ball = wreckingBall();
  private cableLine = cable();
  private trolleyMesh = trolley();
  private beacon = pianoBeacon();
  private snapshot: LoadSnapshot | null = null;
  private localId = '';
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frame = 0;
  private last = 0;
  private lastInput = 0;
  private seq = 0;
  private orbit = { angle: 0.6, height: 0.42, distance: 26 };
  private dragging = false;
  private overview = true;
  private disposed = false;
  private aimed: string | null = null;
  private blocked = false;
  private touchJump = false;
  private craneHeld = 0;
  private pointer = new T.Vector2();
  private caster = new T.Raycaster();
  private preview = new T.Group();
  private motion = new SiteMotion();
  private dust = new DustBursts();
  private pose = emptyPose();
  private time = 0;
  private shake = 0;
  private falling = 0;
  private reduceMotion = false;

  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.setClearColor(palette.sky);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Load Bearing demolition site. WASD moves, E swings the hammer, C takes the crane, Q marks a part, F helps a teammate.',
    );
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new T.Fog(palette.sky, 65, 175);
    this.scene.add(new T.HemisphereLight('#fff2d4', palette.sage, 3));
    const sun = new T.DirectionalLight('#fff1d2', 3.2);
    sun.position.set(-16, 30, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -26,
      right: 26,
      top: 26,
      bottom: -26,
    });
    sun.shadow.normalBias = 0.06;
    this.scene.add(
      sun,
      site(),
      this.preview,
      this.pianoMesh,
      this.beacon,
      this.craneMesh,
      this.ball,
      this.cableLine,
      this.trolleyMesh,
      this.dust.group,
    );
    this.craneMesh.position.set(0, 0, -12);
    // The lobby needs its subject. Stand the condemned house up, with the
    // piano beaconing through its walls, until a real world arrives.
    for (const part of buildHouse()) {
      const mesh = partMesh(part);
      mesh.position.set(part.x, part.y, part.z);
      this.preview.add(mesh);
    }
    this.pianoMesh.position.set(PIANO_BAY.x, 4.25, PIANO_BAY.z);
    this.beacon.position.copy(this.pianoMesh.position);

    const signal = this.abort.signal;
    const dom = this.renderer.domElement;
    addEventListener('keydown', this.onKey, { signal });
    addEventListener('keyup', this.onKey, { signal });
    addEventListener('blur', () => this.keys.clear(), { signal });
    dom.addEventListener('pointerdown', this.onPointerDown, { signal });
    dom.addEventListener('pointermove', this.onPointerMove, { signal });
    addEventListener('pointerup', () => (this.dragging = false), { signal });
    dom.addEventListener('wheel', this.onWheel, { signal, passive: false });
    this.reduceMotion =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.loop(0);
  }

  setSession(id: string) {
    this.localId = id;
  }
  setSnapshot(snapshot: LoadSnapshot | null) {
    this.snapshot = snapshot;
    this.preview.visible = !snapshot;
    if (snapshot) this.motion.push(snapshot, performance.now());
    else this.motion.clear();
  }
  /** The part under the cursor, so the HUD and actions agree on the target. */
  get target() {
    return this.aimed;
  }
  move(vector: { x: number; z: number }) {
    this.touch = { x: vector.x, z: vector.z };
  }
  /** Touch jump lasts one input frame, matching a Space press. */
  jump() {
    this.touchJump = true;
  }
  setBlocked(blocked: boolean) {
    this.blocked = blocked;
    if (blocked) this.keys.clear();
  }
  toggleCamera() {
    this.overview = !this.overview;
  }

  private onKey = (event: KeyboardEvent) => {
    if (event.repeat) return;
    const down = event.type === 'keydown';
    if (KEY_AXES[event.code] || ['Space'].includes(event.code))
      event.preventDefault();
    if (down) this.keys.add(event.code);
    else this.keys.delete(event.code);
    if (!down || this.blocked) return;
    if (event.code === 'KeyV') return this.toggleCamera();
    const action = ACTION_KEYS[event.code];
    if (!action) return;
    // Aiming with the cursor lets the crew agree on a part before swinging.
    this.cb.action(
      action === 'swing' || action === 'mark'
        ? { type: action, ...(this.aimed ? { target: this.aimed } : {}) }
        : { type: action },
    );
  };

  /** The hoist is nudged while the operator holds a direction. */
  private driveCrane(now: number) {
    const world = this.snapshot?.world;
    if (this.blocked || !world || world.crane.owner !== this.localId) return;
    if (now - this.craneHeld < 110) return;
    let x = 0;
    let z = 0;
    let y = 0;
    for (const code of this.keys) {
      const axis = KEY_AXES[code];
      if (axis) {
        x += axis[0];
        z += axis[1];
      }
    }
    if (this.keys.has('KeyR')) y += 1;
    if (this.keys.has('KeyZ')) y -= 1;
    if (!x && !z && !y) return;
    this.craneHeld = now;
    const cos = Math.cos(this.orbit.angle);
    const sin = Math.sin(this.orbit.angle);
    this.cb.action({
      type: 'crane-move',
      x: x * cos - z * sin,
      z: x * sin + z * cos,
      y,
    });
  }
  private onPointerDown = (event: PointerEvent) => {
    this.dragging = true;
    this.renderer.domElement.focus();
    this.updatePointer(event);
  };
  private onPointerMove = (event: PointerEvent) => {
    this.updatePointer(event);
    if (!this.dragging) return;
    this.orbit.angle -= event.movementX * 0.005;
    this.orbit.height = Math.max(
      0.12,
      Math.min(1.2, this.orbit.height + event.movementY * 0.004),
    );
  };
  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.orbit.distance = Math.max(
      10,
      Math.min(48, this.orbit.distance + event.deltaY * 0.02),
    );
  };
  private updatePointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private sendInput(now: number) {
    let x = this.touch.x;
    let z = this.touch.z;
    for (const code of this.keys) {
      const axis = KEY_AXES[code];
      if (axis) {
        x += axis[0];
        z += axis[1];
      }
    }
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    // Movement is camera relative, so the crew steers by what they can see.
    const cos = Math.cos(this.orbit.angle);
    const sin = Math.sin(this.orbit.angle);
    const input: LoadInput = {
      x: x * cos - z * sin,
      z: x * sin + z * cos,
      jump: this.keys.has('Space') || this.touchJump,
      seq: this.seq,
    };
    this.touchJump = false;
    if (input.jump) this.seq++;
    if (now - this.lastInput < 55) return;
    this.lastInput = now;
    this.cb.input(input);
  }

  private syncParts() {
    const world = this.snapshot?.world;
    if (!world) return;
    const live = new Set<string>();
    let falling = 0;
    for (const part of world.parts) {
      if (!alive(part)) continue;
      live.add(part.id);
      if (part.falling) falling++;
      let mesh = this.parts.get(part.id);
      if (!mesh) {
        mesh = partMesh(part);
        this.parts.set(part.id, mesh);
        this.scene.add(mesh);
      }
      const pose = this.motion.part(part, this.pose);
      mesh.position.set(pose.x, pose.y, pose.z);
      mesh.quaternion.copy(pose.quaternion);
      const cracks = mesh.userData.cracks as T.Mesh;
      // Cracks read the blows taken; strain shades what is about to give way.
      const damage = 1 - part.hits / PART_HITS[part.kind];
      const opacity = part.falling ? 0 : Math.max(damage, part.strain * 0.45);
      (cracks.material as T.MeshBasicMaterial).opacity = opacity;
      (mesh.userData.paint as T.Mesh).visible = !!part.markedBy;
    }
    for (const [id, mesh] of this.parts)
      if (!live.has(id)) {
        const kind = mesh.userData.kind as keyof typeof PART_COLORS;
        this.dust.burst(
          mesh.position.x,
          mesh.position.y,
          mesh.position.z,
          PART_COLORS[kind] ?? palette.clay,
          1.3,
        );
        this.scene.remove(mesh);
        this.parts.delete(id);
        // Something just left the structure: rattle the camera for it.
        if (!this.reduceMotion) this.shake = Math.min(1, this.shake + 0.55);
      }
    if (falling > this.falling && !this.reduceMotion)
      this.shake = Math.min(1, this.shake + (falling - this.falling) * 0.16);
    this.falling = falling;
  }

  private syncPeople() {
    const world = this.snapshot?.world;
    if (!world) return;
    const live = new Set<string>();
    for (const player of world.players) {
      live.add(player.id);
      let mesh = this.people.get(player.id);
      if (!mesh) {
        mesh = worker(player.color);
        this.people.set(player.id, mesh);
        this.scene.add(mesh);
      }
      const shown = this.motion.player(player);
      const moving =
        Math.hypot(mesh.position.x - shown.x, mesh.position.z - shown.z) >
        0.012;
      mesh.position.set(shown.x, shown.y, shown.z);
      mesh.rotation.y = shown.facing;
      poseWrecker(mesh, this.time, {
        moving,
        down: player.down,
        color: player.color,
        still: this.reduceMotion,
        hammer:
          player.swingUntil > world.clock
            ? -2.5 + Math.cos((player.swingUntil - world.clock) / 90) * 1.6
            : null,
      });
    }
    for (const [id, mesh] of this.people)
      if (!live.has(id)) {
        this.scene.remove(mesh);
        this.people.delete(id);
      }
  }

  private syncMachinery() {
    const world = this.snapshot?.world;
    if (!world) return;
    const piano = this.motion.piano(world.piano);
    this.pianoMesh.position.set(piano.x, piano.y, piano.z);
    this.pianoMesh.visible = world.piano.integrity > 0;
    this.beacon.visible = world.piano.integrity > 0;
    this.beacon.position.set(piano.x, piano.y, piano.z);
    const hurt = 1 - world.piano.integrity / PIANO_INTEGRITY;
    this.pianoMesh.rotation.z = hurt * 0.25;
    const owned = !!world.crane.owner;
    this.ball.visible = owned;
    this.cableLine.visible = owned;
    this.trolleyMesh.visible = owned;
    if (owned) {
      const ball = this.motion.ball({
        x: world.crane.ballX,
        y: world.crane.ballY,
        z: world.crane.ballZ,
      });
      this.ball.position.set(ball.x, ball.y, ball.z);
      this.ball.rotation.x = this.time * 0.6;
      this.trolleyMesh.position.set(
        world.crane.x,
        world.crane.y,
        world.crane.z,
      );
      // Jib tip, down to the trolley, then out to the ball on its cable.
      this.cableLine.geometry.setFromPoints([
        new T.Vector3(world.crane.x, JIB_Y, world.crane.z),
        new T.Vector3(world.crane.x, world.crane.y, world.crane.z),
        new T.Vector3(ball.x, ball.y + CABLE * 0.02, ball.z),
      ]);
    }
    const jib = this.craneMesh.userData.jib as T.Object3D;
    jib.rotation.y = Math.atan2(
      world.crane.x - this.craneMesh.position.x,
      world.crane.z - this.craneMesh.position.z,
    );
  }

  /** Highlight whatever the crew is pointing at, so a plan can be agreed. */
  private syncAim() {
    this.caster.setFromCamera(this.pointer, this.camera);
    const hits = this.caster.intersectObjects([...this.parts.values()], true);
    // Walk up to the part group rather than searching every subtree each frame.
    let found: string | null = null;
    for (
      let node: T.Object3D | null = hits[0]?.object ?? null;
      node;
      node = node.parent
    )
      if (typeof node.userData.partId === 'string') {
        found = node.userData.partId;
        break;
      }
    if (found !== this.aimed) {
      this.aimed = found;
      this.cb.aim(found);
    }
  }

  private placeCamera(delta: number) {
    const world = this.snapshot?.world;
    const me = world?.players.find((p) => p.id === this.localId);
    const shown = me ? this.motion.player(me) : null;
    const target =
      !this.overview && shown
        ? new T.Vector3(shown.x, shown.y + 1.3, shown.z)
        : new T.Vector3(0, 3.4, 0);
    const distance = this.overview ? this.orbit.distance : 9.5;
    const wanted = new T.Vector3(
      target.x + Math.sin(this.orbit.angle) * distance,
      target.y + this.orbit.height * distance,
      target.z + Math.cos(this.orbit.angle) * distance,
    );
    this.camera.position.lerp(wanted, Math.min(1, delta * 6));
    this.camera.lookAt(target);
    // A collapse is felt through the camera as well as heard.
    if (this.shake > 0.001) {
      const amount = this.shake * 0.34;
      this.camera.position.x += Math.sin(this.time * 47) * amount;
      this.camera.position.y += Math.sin(this.time * 39 + 1.7) * amount;
      this.camera.position.z += Math.cos(this.time * 43) * amount;
      this.shake = Math.max(0, this.shake - delta * 1.9);
    }
  }

  private loop = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const delta = Math.min(0.1, (time - this.last) / 1000) || 0;
    this.last = time;
    this.time += delta;
    this.motion.advance(time);
    this.dust.update(delta);
    try {
      this.cb.tick();
    } catch {
      this.cb.failure();
    }
    if (this.snapshot?.world.crane.owner === this.localId)
      this.driveCrane(time);
    else this.sendInput(time);
    this.syncParts();
    this.syncPeople();
    this.syncMachinery();
    this.syncAim();
    this.placeCamera(delta);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.observer.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.cb.input(idleInput());
  }
}
