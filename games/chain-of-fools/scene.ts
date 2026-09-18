import * as T from 'three';
import { label, material } from '../../shared/rendering/primitives';
import { COLORS } from '../../shared/rendering/palette';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { ANCHORS, CHECKPOINTS, PLANK, nearNet } from './course';
import { chainWorker, D_RING, poseChainWorker } from './avatar';
import { SITE, createSite, type SiteModel } from './models';
import {
  CHAIN_MAX,
  NO_SUPPORT,
  chainOrder,
  idleInput,
  type ChainAction,
  type ChainSnapshot,
  type ChainWorld,
  type Player,
  type PlayerInput,
} from './types';

export type SceneCallbacks = {
  input: (input: PlayerInput) => void;
  action: (action: ChainAction) => void;
};

export type CameraMode = 'crew' | 'close' | 'side';
const CAMERA_MODES: readonly CameraMode[] = ['crew', 'close', 'side'];

const LINK_SPACING = 0.17;
const MAX_LINKS = 140;
const SLACK_STEEL = new T.Color('#8b969a');
const TAUT_RED = new T.Color('#e0452c');
const UNIT = new T.Vector3(1, 1, 1);
const X_AXIS = new T.Vector3(1, 0, 0);
const Y_AXIS = new T.Vector3(0, 1, 0);

type Worker = {
  root: T.Group;
  color: number;
  tag: T.Sprite;
  lastX: number;
  lastZ: number;
};

type Particle = {
  mesh: T.Mesh;
  life: number;
  max: number;
  v: T.Vector3;
  gravity: number;
  spin: number;
};

export class ChainScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera: T.PerspectiveCamera;
  private site: SiteModel;
  private workers = new Map<string, Worker>();
  private links: T.InstancedMesh;
  private tethers: T.LineSegments;
  private marker: T.Mesh;
  private particles: Particle[] = [];
  private particleGeometry = new T.BoxGeometry(0.12, 0.12, 0.12);
  private particleMaterials = new Map<string, T.MeshBasicMaterial>();
  private sun: T.DirectionalLight;

  private world: ChainWorld | null = null;
  private localId = '';
  private mode: CameraMode = 'crew';
  private yaw = 0;
  private pitch = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private cameraTarget = new T.Vector3(2, 1, 0);
  private cameraPosition = new T.Vector3(-10, 8, 6);
  private trauma = 0;
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private holds = { brace: false, haul: false, jump: false };
  private lastEvent = 0;
  private animId = 0;
  private lastFrame = performance.now();
  private destroyed = false;
  private seq = 0;

  private readonly tmpA = new T.Vector3();
  private readonly tmpB = new T.Vector3();
  private readonly tmpQ = new T.Quaternion();
  private readonly tmpM = new T.Matrix4();
  private readonly tmpC = new T.Color();
  private readonly chainPoint = new T.Vector3();
  private readonly chainNext = new T.Vector3();
  private readonly chainTangent = new T.Vector3();
  private readonly chainTwist = new T.Quaternion();

  constructor(
    private container: HTMLElement,
    private cb: SceneCallbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new T.Color(SITE.sky);
    this.scene.fog = new T.Fog(SITE.fog, 28, 110);

    this.camera = new T.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.3,
      400,
    );

    this.scene.add(new T.HemisphereLight('#fdf3dc', '#6d5a44', 1.15));
    const sun = new T.DirectionalLight('#fff0d0', 1.9);
    sun.position.set(-30, 60, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 160;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    this.site = createSite();
    this.scene.add(this.site.root);

    // The safety line: real links, recoloured by how hard the line is pulling.
    const linkGeometry = new T.TorusGeometry(0.075, 0.024, 5, 10);
    linkGeometry.scale(1.45, 1, 1);
    this.links = new T.InstancedMesh(
      linkGeometry,
      new T.MeshStandardMaterial({
        color: '#ffffff',
        metalness: 0.6,
        roughness: 0.45,
      }),
      MAX_LINKS,
    );
    this.links.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.links.count = 0;
    this.links.castShadow = true;
    this.links.frustumCulled = false;
    this.scene.add(this.links);

    // Short straps from a clipped worker to the ring they are clipped to.
    this.tethers = new T.LineSegments(
      new T.BufferGeometry().setAttribute(
        'position',
        new T.BufferAttribute(new Float32Array(8 * 3), 3),
      ),
      new T.LineBasicMaterial({ color: SITE.hiVis }),
    );
    this.tethers.frustumCulled = false;
    this.scene.add(this.tethers);

    // "This one is you": a ring on the ground under the local worker.
    this.marker = new T.Mesh(
      new T.RingGeometry(0.5, 0.64, 28),
      new T.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.marker);

    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.resetInput);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.hidden);
    this.renderer.domElement.addEventListener('pointerdown', this.pointerDown);
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);

    this.loop();
  }

  setLocal(id: string) {
    this.localId = id;
  }

  /** Joystick vector from the touch controls: x right, z down the screen. */
  move(vector: { x: number; z: number }) {
    this.touch = vector;
  }

  /** Held touch buttons, mirrored onto the same input as their keys. */
  hold(kind: 'brace' | 'haul' | 'jump', on: boolean) {
    this.holds[kind] = on;
  }

  cycleCamera(): CameraMode {
    const next = (CAMERA_MODES.indexOf(this.mode) + 1) % CAMERA_MODES.length;
    this.mode = CAMERA_MODES[next];
    this.yaw = 0;
    this.pitch = 0;
    return this.mode;
  }

  get cameraMode() {
    return this.mode;
  }

  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.holds = { brace: false, haul: false, jump: false };
    this.cb.input(idleInput());
  };

  private hidden = () => {
    if (document.hidden) this.resetInput();
  };

  private keyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ShiftLeft',
        'ShiftRight',
      ].includes(e.code)
    )
      e.preventDefault();
    if (e.repeat) return;
    this.keys.add(e.code);
    if (e.code === 'KeyE') this.cb.action({ type: 'clip' });
    else if (e.code === 'KeyQ') this.cb.action({ type: 'ping' });
    else if (e.code === 'KeyV') this.cycleCamera();
  };

  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private pointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.dragging = true;
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private pointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    this.yaw += (e.clientX - this.lastPointer.x) * 0.005;
    this.pitch = Math.max(
      -0.35,
      Math.min(0.6, this.pitch + (e.clientY - this.lastPointer.y) * 0.004),
    );
    this.lastPointer = { x: e.clientX, y: e.clientY };
  };

  private pointerUp = () => {
    this.dragging = false;
  };

  private resize = () => {
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  /** Turns keys and stick into world-space movement relative to the camera. */
  private pollInput(): PlayerInput {
    const k = this.keys;
    let right =
      (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
      (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) +
      this.touch.x;
    let forward =
      (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) -
      (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) -
      this.touch.z;
    const length = Math.hypot(right, forward);
    if (length > 1) {
      right /= length;
      forward /= length;
    }

    let fx: number;
    let fz: number;
    if (this.mode === 'side') {
      // Side-on, the screen is the frame: right is along the course.
      this.camera.getWorldDirection(this.tmpA);
      this.tmpA.y = 0;
      if (this.tmpA.lengthSq() < 1e-6) this.tmpA.set(0, 0, -1);
      this.tmpA.normalize();
      fx = this.tmpA.x;
      fz = this.tmpA.z;
    } else {
      // Behind the crew, forward is along the course, turned by any orbiting.
      fx = Math.cos(this.yaw);
      fz = -Math.sin(this.yaw);
    }

    return {
      x: right * -fz + forward * fx,
      z: right * fx + forward * fz,
      jump: k.has('Space') || this.holds.jump,
      brace: k.has('ShiftLeft') || k.has('ShiftRight') || this.holds.brace,
      haul: k.has('KeyF') || this.holds.haul,
      seq: ++this.seq,
    };
  }

  /** Called every simulation tick with the latest world. */
  update(snapshot: ChainSnapshot) {
    const world = snapshot.world;
    this.world = world;
    this.cb.input(this.pollInput());

    this.syncWorkers(world);
    this.site.plank.rotation.z = world.plankTilt;
    this.site.pendulum.rotation.x = -world.pendulumAngle;

    CHECKPOINTS.slice(1).forEach((point, i) => {
      const banked = world.checkpoint >= point.index;
      this.site.checkpointFlags[i].material = material(
        banked ? '#5aa469' : '#d5d0c4',
      );
    });

    const clipped = new Set(
      world.players.map((p) => p.anchorId).filter(Boolean) as string[],
    );
    for (const [id, anchor] of this.site.anchors) {
      const ring = anchor.userData.ring as T.Mesh;
      ring.scale.setScalar(clipped.has(id) ? 1.35 : 1);
    }

    const me = world.players.find((p) => p.id === this.localId);
    const inside =
      !!me && me.x > 91.5 && me.x < 112.5 && me.y < 9.6 && Math.abs(me.z) < 1.5;
    const target = inside ? 0.18 : 1;
    this.site.pipeRoof.opacity += (target - this.site.pipeRoof.opacity) * 0.2;

    this.handleEvents(world);
  }

  private syncWorkers(world: ChainWorld) {
    const seen = new Set<string>();
    const time = performance.now() / 1000;

    for (const player of world.players) {
      seen.add(player.id);
      let worker = this.workers.get(player.id);
      if (!worker || worker.color !== player.color) {
        if (worker) this.scene.remove(worker.root);
        const root = chainWorker(
          player.color,
          player.id === this.localId ? getEquippedLook() : undefined,
        );
        const tag = label(
          player.id === this.localId ? 'You' : player.name,
          COLORS[player.color % 4],
          '#ffffff',
          1.5,
        );
        tag.position.y = 2.55;
        tag.material.fog = false;
        tag.material.toneMapped = false;
        root.add(tag);
        this.scene.add(root);
        worker = {
          root,
          color: player.color,
          tag,
          lastX: player.x,
          lastZ: player.z,
        };
        this.workers.set(player.id, worker);
      }

      const moving =
        Math.hypot(player.x - worker.lastX, player.z - worker.lastZ) > 0.01;
      worker.lastX = player.x;
      worker.lastZ = player.z;

      worker.root.position.set(player.x, player.y, player.z);
      if (player.state !== 'dangling' && player.state !== 'limp')
        worker.root.rotation.y = player.facing;

      const climbing =
        !player.grounded &&
        player.state !== 'dangling' &&
        nearNet(player.x, player.y, player.z);
      if (climbing) worker.root.rotation.y = Math.PI / 2;

      const riding = world.pendulumRider === player.id;
      poseChainWorker(worker.root, time, {
        state: riding ? 'dangling' : player.state,
        moving: moving && player.grounded,
        braced: player.braced,
        helping: player.input.haul && player.grounded,
        climbing,
        seed: player.link,
      });
      worker.tag.visible = player.state !== 'finished';
    }

    for (const [id, worker] of this.workers) {
      if (seen.has(id)) continue;
      this.scene.remove(worker.root);
      this.workers.delete(id);
    }
  }

  /** Where the line meets this worker's harness, in world space. */
  private dRing(player: Player, out: T.Vector3) {
    const worker = this.workers.get(player.id);
    if (!worker) return out.set(player.x, player.y + 1, player.z);
    const body = worker.root.userData.body as T.Object3D;
    worker.root.updateMatrixWorld(true);
    return body.localToWorld(out.copy(D_RING));
  }

  private drawChain(world: ChainWorld) {
    const order = chainOrder(world);
    let count = 0;
    const a = this.tmpA;
    const b = this.tmpB;
    const point = this.chainPoint;
    const next = this.chainNext;
    const tangent = this.chainTangent;
    const twist = this.chainTwist;

    for (let i = 0; i < order.length - 1; i++) {
      const pa = order[i];
      const pb = order[i + 1];
      this.dRing(pa, a);
      this.dRing(pb, b);
      const distance = a.distanceTo(b);

      // A parabola standing in for the catenary, straight when taut.
      let sag =
        0.5 *
        Math.sqrt(Math.max(0, CHAIN_MAX * CHAIN_MAX - distance * distance));
      const floorA = pa.supportY > NO_SUPPORT + 1 ? pa.supportY : -Infinity;
      const floorB = pb.supportY > NO_SUPPORT + 1 ? pb.supportY : -Infinity;
      const floor = Math.max(floorA, floorB);
      if (Number.isFinite(floor)) {
        sag = Math.min(sag, Math.max(0, Math.min(a.y, b.y) - floor - 0.06));
      }

      const link = world.links[i];
      const tension = link?.tension ?? 0;
      this.tmpC.copy(SLACK_STEEL).lerp(TAUT_RED, tension * tension);

      const n = Math.min(Math.ceil(distance / LINK_SPACING) + 4, 40);
      for (let j = 0; j < n && count < MAX_LINKS; j++) {
        const u = (j + 0.5) / n;
        const u2 = Math.min(1, u + 0.02);
        point.lerpVectors(a, b, u);
        point.y -= sag * 4 * u * (1 - u);
        next.lerpVectors(a, b, u2);
        next.y -= sag * 4 * u2 * (1 - u2);
        tangent.subVectors(next, point);
        if (tangent.lengthSq() < 1e-8) tangent.subVectors(b, a);
        tangent.normalize();

        this.tmpQ.setFromUnitVectors(X_AXIS, tangent);
        if (j % 2 === 1) {
          twist.setFromAxisAngle(tangent, Math.PI / 2);
          this.tmpQ.premultiply(twist);
        }
        this.tmpM.compose(point, this.tmpQ, UNIT);
        this.links.setMatrixAt(count, this.tmpM);
        this.links.setColorAt(count, this.tmpC);
        count++;
      }
    }

    this.links.count = count;
    this.links.instanceMatrix.needsUpdate = true;
    if (this.links.instanceColor) this.links.instanceColor.needsUpdate = true;

    // Clip straps.
    const positions = this.tethers.geometry.getAttribute(
      'position',
    ) as T.BufferAttribute;
    let segment = 0;
    for (const player of world.players) {
      if (!player.anchorId || segment >= 4) continue;
      const anchor = ANCHORS.find((r) => r.id === player.anchorId);
      if (!anchor) continue;
      this.dRing(player, a);
      positions.setXYZ(segment * 2, a.x, a.y, a.z);
      positions.setXYZ(
        segment * 2 + 1,
        anchor.x,
        anchor.y + 0.5,
        anchor.z - 0.7,
      );
      segment++;
    }
    for (let s = segment; s < 4; s++) {
      positions.setXYZ(s * 2, 0, -100, 0);
      positions.setXYZ(s * 2 + 1, 0, -100, 0);
    }
    positions.needsUpdate = true;
  }

  private handleEvents(world: ChainWorld) {
    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      const at = event.pos
        ? new T.Vector3(...event.pos)
        : (() => {
            const p = world.players.find((q) => q.id === event.playerId);
            return p ? new T.Vector3(p.x, p.y, p.z) : null;
          })();
      const mine = event.playerId === this.localId;

      switch (event.type) {
        case 'land':
          if (at) this.burst(at, SITE.dirt, 5, 1.6, 0.4);
          break;
        case 'chain_yank':
          if (at) this.burst(at.setY(at.y + 1), '#ffd36b', 10, 4, 0.35);
          this.trauma = Math.max(this.trauma, mine ? 0.35 : 0.15);
          break;
        case 'dangle':
          this.trauma = Math.max(this.trauma, mine ? 0.55 : 0.3);
          break;
        case 'limp':
          if (at) this.burst(at, SITE.dirt, 14, 3, 0.6);
          this.trauma = Math.max(this.trauma, 0.45);
          break;
        case 'pendulum_swing':
          if (at) this.burst(at.setY(at.y + 1.2), '#ffd36b', 16, 6, 0.4);
          this.trauma = Math.max(this.trauma, 0.6);
          break;
        case 'haul_done':
        case 'revive':
          if (at) this.burst(at.setY(at.y + 1), '#9fe0a8', 12, 2.5, 0.8);
          break;
        case 'checkpoint':
          if (!event.playerId) {
            const point = CHECKPOINTS[world.checkpoint];
            if (point) {
              const [x, y] = point.spawn;
              this.burst(
                new T.Vector3(x - 1.1, y + 2.1, -2.6),
                '#5aa469',
                16,
                3,
                1,
              );
            }
          }
          break;
        case 'wipe':
          this.trauma = Math.max(this.trauma, 0.5);
          break;
        case 'plank_tip':
          this.burst(
            new T.Vector3(PLANK.pivotX, PLANK.y, 0),
            SITE.timber,
            8,
            2,
            0.5,
          );
          break;
        case 'win':
          for (let i = 0; i < 4; i++) {
            const colour = COLORS[i];
            this.burst(new T.Vector3(146, 3, -3 + i * 2), colour, 20, 7, 1.8);
          }
          break;
      }
    }
  }

  private burst(
    at: T.Vector3,
    colour: string,
    count: number,
    speed: number,
    life: number,
  ) {
    let mat = this.particleMaterials.get(colour);
    if (!mat) {
      mat = new T.MeshBasicMaterial({ color: colour });
      this.particleMaterials.set(colour, mat);
    }
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 220) break;
      const mesh = new T.Mesh(this.particleGeometry, mat);
      mesh.position.copy(at);
      this.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const lift = 0.4 + Math.random();
      this.particles.push({
        mesh,
        life,
        max: life,
        v: new T.Vector3(
          Math.cos(angle) * speed * Math.random(),
          lift * speed * 0.8,
          Math.sin(angle) * speed * Math.random(),
        ),
        gravity: 12,
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  private stepParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.v.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.spin * dt;
      p.mesh.rotation.y += p.spin * dt;
      p.mesh.scale.setScalar(Math.max(0.1, p.life / p.max));
    }
  }

  private stepCamera(dt: number) {
    const world = this.world;
    if (!world || world.players.length === 0) return;

    const me = world.players.find((p) => p.id === this.localId);
    const crew = world.players.filter((p) => p.state !== 'finished');
    const group = crew.length ? crew : world.players;

    let cx = 0;
    let cy = 0;
    let cz = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const p of group) {
      cx += p.x;
      cy += p.y;
      cz += p.z;
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
    }
    cx /= group.length;
    cy /= group.length;
    cz /= group.length;
    const spread = maxX - minX;

    // Crew view leans towards the local worker; close view follows them only.
    const focus = this.mode === 'close' && me ? 1 : me ? 0.35 : 0;
    const tx = me ? cx + (me.x - cx) * focus : cx;
    const ty = me ? cy + (me.y - cy) * focus : cy;
    const tz = me ? cz + (me.z - cz) * focus : cz;
    this.cameraTarget.lerp(
      this.tmpA.set(tx + 2, ty + 1.1, tz),
      1 - Math.exp(-dt * 4),
    );

    let back: number;
    let up: number;
    let side: number;
    if (this.mode === 'side') {
      back = 2;
      up = 5.5 + spread * 0.15;
      side = 15 + spread * 0.55;
    } else if (this.mode === 'close') {
      back = 7.5;
      up = 4.2;
      side = 3.2;
    } else {
      back = 10 + spread * 0.35;
      up = 7 + spread * 0.18;
      side = 6 + spread * 0.25;
    }

    const yaw = this.yaw;
    const offset = this.tmpB.set(-back, up, side);
    offset.applyAxisAngle(Y_AXIS, yaw);
    offset.y += this.pitch * 10;
    const wanted = this.tmpA.copy(this.cameraTarget).add(offset);
    this.cameraPosition.lerp(wanted, 1 - Math.exp(-dt * 3.2));
    this.camera.position.copy(this.cameraPosition);

    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * shake;
      this.camera.position.y += (Math.random() - 0.5) * shake;
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
    }
    this.camera.lookAt(this.cameraTarget);

    // Shadows follow the crew along the course.
    this.sun.position.set(
      this.cameraTarget.x - 30,
      this.cameraTarget.y + 60,
      this.cameraTarget.z + 40,
    );
    this.sun.target.position.copy(this.cameraTarget);

    if (me) {
      const ground = me.supportY > NO_SUPPORT + 1 ? me.supportY : me.y;
      this.marker.visible = me.state !== 'finished' && me.grounded;
      this.marker.position.set(me.x, ground + 0.03, me.z);
    } else {
      this.marker.visible = false;
    }
  }

  private loop = () => {
    if (this.destroyed) return;
    this.animId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.frame(dt);
  };

  /** One drawn frame. Exposed so a paused tab can still be stepped by hand. */
  frame(dt = 1 / 60) {
    if (this.world) this.drawChain(this.world);
    this.stepCamera(dt);
    this.stepParticles(dt);
    const dust = this.site.dust.geometry.getAttribute(
      'position',
    ) as T.BufferAttribute;
    for (let i = 0; i < dust.count; i++) {
      let x = dust.getX(i) + dt * 0.35;
      if (x > 160) x = -10;
      dust.setX(i, x);
    }
    dust.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animId);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.resetInput);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.hidden);
    this.renderer.domElement.removeEventListener(
      'pointerdown',
      this.pointerDown,
    );
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    this.scene.traverse((object) => {
      const mesh = object as T.Mesh;
      if (mesh.geometry && !mesh.geometry.userData?.shared)
        mesh.geometry.dispose();
    });
    for (const mat of this.particleMaterials.values()) mat.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
