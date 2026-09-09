import * as T from 'three';
import { label } from '../../shared/rendering/primitives';
import {
  STATIONS,
  idleInput,
  type Input,
  type HotelAction,
  type HotelSnapshot,
} from './types';
import { buildHotel, guest } from './models';
import { hotelHorror } from './horror';
import {
  DEFAULT_CAMERA,
  EYE_HEIGHT,
  HotelLook,
  HotelCameraBoom,
  type HotelCameraMode,
} from './camera';

type Callbacks = {
  input: (input: Input) => void;
  action: (a: HotelAction) => void;
  tick: () => void;
  failure: () => void;
  camera: (mode: HotelCameraMode) => void;
  listen: (position: { x: number; z: number }, yaw: number) => void;
};
export class HotelScene {
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(65, 1, 0.08, 90);
  private renderer: T.WebGLRenderer;
  private hotel = buildHotel();
  private people = new Map<string, T.Group>();
  private ghost = guest(0, true);
  private ambient = new T.HemisphereLight('#809d9e', '#241e2c', 0.72);
  private lamps: T.PointLight[] = [];
  private emergency = new T.PointLight('#e5553e', 0, 30, 2);
  private gentle = false;
  private marker = new T.Mesh(
    new T.RingGeometry(0.7, 0.79, 32),
    new T.MeshBasicMaterial({
      color: '#efc771',
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.85,
    }),
  );
  private snapshot: HotelSnapshot | null = null;
  private id = '';
  private gaze = new HotelLook();
  private mode: HotelCameraMode = DEFAULT_CAMERA;
  private boom = new HotelCameraBoom();
  private eye = new T.Vector3();
  private snapCamera = true;
  private keys = new Set<string>();
  private touch = { x: 0, z: 0 };
  private blocked = false;
  private abort = new AbortController();
  private observer: ResizeObserver;
  private frame = 0;
  private last = 0;
  private sent = 0;
  private stopped = false;
  private drag: { id: number; x: number; y: number } | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private target = new T.Vector3();
  private look = new T.Vector3();
  constructor(
    private container: HTMLDivElement,
    private cb: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setClearColor('#10191d');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'First-person hotel corridor. WASD or arrows move, E inspects, drag to look up, down and around. V switches camera.',
    );
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new T.Fog('#10191d', 9, 33);
    this.scene.add(this.hotel.root, this.ambient);
    const light = new T.DirectionalLight('#ffe0a7', 0.65);
    light.position.set(0, 9, 2);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -8;
    light.shadow.camera.right = 8;
    light.shadow.camera.top = 28;
    light.shadow.camera.bottom = -8;
    light.shadow.normalBias = 0.05;
    this.scene.add(light);
    for (const z of [-3, -12, -21, 3]) {
      const lamp = new T.PointLight('#ffd292', 16, 14, 2);
      lamp.position.set(0, 3.4, z);
      this.lamps.push(lamp);
      this.scene.add(lamp);
    }
    this.emergency.position.set(0, 3.5, -14);
    this.scene.add(this.emergency);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.08;
    this.scene.add(this.marker);
    this.camera.position.set(0, EYE_HEIGHT, 3.2);
    this.camera.lookAt(0, EYE_HEIGHT, -10);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.resize();
    const opts = { signal: this.abort.signal };
    window.addEventListener('keydown', this.keyDown, opts);
    window.addEventListener('keyup', this.keyUp, opts);
    window.addEventListener('blur', this.resetInput, opts);
    document.addEventListener('visibilitychange', this.hidden, opts);
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.pointerDown, opts);
    canvas.addEventListener('pointermove', this.pointerMove, opts);
    canvas.addEventListener('pointerup', this.pointerUp, opts);
    canvas.addEventListener('pointercancel', this.pointerUp, opts);
    canvas.addEventListener('lostpointercapture', this.pointerUp, opts);
    canvas.addEventListener('webglcontextlost', this.contextLost, opts);
    this.frame = requestAnimationFrame(this.render);
  }
  setSession(id: string) {
    this.id = id;
    this.gaze.reset();
    this.mode = DEFAULT_CAMERA;
    this.snapCamera = true;
    this.cb.camera(this.mode);
  }
  setSnapshot(next: HotelSnapshot | null) {
    if (next && next.world.stopAt !== this.snapshot?.world.stopAt) {
      this.gaze.reset();
      this.snapCamera = true;
    }
    if (
      next?.world.phase === 'escape' &&
      this.snapshot?.world.phase !== 'escape'
    ) {
      this.gaze.reset(true);
      this.snapCamera = true;
    }
    this.snapshot = next;
  }
  move(v: { x: number; z: number }) {
    this.touch = v;
  }
  changeCamera() {
    this.mode = this.mode === 'first-person' ? 'follow' : 'first-person';
    this.snapCamera = true;
    this.cb.camera(this.mode);
  }
  setGentle(value: boolean) {
    this.gentle = value;
  }
  setBlocked(value: boolean) {
    this.blocked = value;
    if (value) this.resetInput();
  }
  resetInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.drag = null;
    this.cb.input(idleInput());
  };
  private hidden = () => {
    if (document.hidden) this.resetInput();
  };
  private contextLost = (e: Event) => {
    e.preventDefault();
    this.cb.failure();
  };
  private keyDown = (e: KeyboardEvent) => {
    if (
      this.blocked ||
      !this.snapshot ||
      (e.target as HTMLElement)?.closest(
        'input,textarea,[role="dialog"],[contenteditable="true"]',
      )
    )
      return;
    const key = e.key.toLowerCase();
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
        'shift',
        'e',
        'r',
        'v',
        '1',
        '2',
        ' ',
      ].includes(key)
    )
      e.preventDefault();
    this.keys.add(key);
    if (e.repeat) return;
    if (key === 'e') this.cb.action({ type: 'inspect' });
    if (key === 'r') this.cb.action({ type: 'report' });
    if (key === 'v') this.changeCamera();
    if (key === '1' || key === '2')
      this.cb.action({
        type: 'vote',
        choice: key === '1' ? 'advance' : 'retreat',
      });
  };
  private keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private pointerDown = (e: PointerEvent) => {
    if (this.blocked || e.button !== 0) return;
    if (this.drag || !this.snapshot) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  private pointerMove = (e: PointerEvent) => {
    if (this.drag?.id !== e.pointerId || this.blocked) return;
    this.gaze.turn(e.clientX - this.drag.x, e.clientY - this.drag.y);
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  };
  private pointerUp = (e: PointerEvent) => {
    if (this.drag?.id !== e.pointerId) return;
    this.drag = null;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId))
      this.renderer.domElement.releasePointerCapture(e.pointerId);
  };
  private resize = () => {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setSize(Math.max(width, 1), Math.max(height, 1));
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };
  private animateGuest(model: T.Group, now: number, moving: boolean) {
    const step = moving ? Math.sin(now / 95) * 0.5 : 0;
    model.userData.legR.rotation.x = step;
    model.userData.legL.rotation.x = -step;
    model.userData.armR.rotation.x = -step;
    model.userData.armL.rotation.x = step;
  }
  private render = (now: number) => {
    if (this.stopped) return;
    this.frame = requestAnimationFrame(this.render);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (document.hidden) return;
    const x =
      this.touch.x +
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    const z =
      this.touch.z +
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'));
    if (now - this.sent > 40) {
      this.sent = now;
      const movement = this.gaze.walk(x, z);
      this.cb.input(
        this.blocked
          ? idleInput()
          : {
              x: movement.x,
              z: movement.z,
              sprint: this.keys.has('shift'),
              seq: Math.floor(now),
            },
      );
    }
    this.cb.tick();
    const snapshot = this.snapshot,
      w = snapshot?.world;
    const horror = snapshot ? hotelHorror(snapshot) : null;
    const gentle = this.reduced || this.gentle;
    const escaping = w?.phase === 'escape';
    const dip = gentle ? 0 : (horror?.lightDip ?? 0);
    this.ambient.intensity = escaping ? 0.38 : 0.72 - dip * 0.2;
    this.emergency.intensity = escaping ? 22 : 0;
    this.lamps.forEach((lamp, i) => {
      const affected = i < 3 && horror?.lamp === i;
      const target =
        i === 3
          ? 19
          : (escaping ? 4 : 16) * (1 - (affected ? dip : dip * 0.28));
      lamp.intensity += (target - lamp.intensity) * (1 - Math.exp(-12 * dt));
    });
    for (const lamp of this.hotel.lamps) {
      const zone = Math.max(
        0,
        Math.min(2, Math.round((-lamp.position.z - 3) / 9)),
      );
      lamp.material.emissiveIntensity =
        (escaping ? 0.28 : 1.1) * (1 - (horror?.lamp === zone ? dip : 0));
    }
    const me = w?.players.find((p) => p.id === this.id);
    const firstPerson = this.mode === 'first-person';
    const smooth = 1 - Math.exp(-16 * dt);
    for (const [id, model] of this.people)
      if (!w?.players.some((p) => p.id === id)) {
        model.removeFromParent();
        this.disposeObject(model);
        this.people.delete(id);
      }
    for (const p of w?.players ?? []) {
      let model = this.people.get(p.id);
      if (!model) {
        model = guest(p.color);
        model.position.set(p.x, 0.035, p.z);
        const name = label(
          `${p.name}${p.bot ? ' / NPC' : ''}`,
          '#253d48',
          '#fff0cb',
          1.6,
        );
        name.position.y = 2.35;
        name.material.depthTest = true;
        model.add(name);
        this.people.set(p.id, model);
        this.scene.add(model);
      }
      model.visible = !p.caught && !(p.id === this.id && firstPerson);
      const moving =
        Math.hypot(model.position.x - p.x, model.position.z - p.z) > 0.025;
      const oldX = model.position.x,
        oldZ = model.position.z;
      this.target.set(p.x, 0.035, p.z);
      if (this.snapCamera) model.position.copy(this.target);
      else model.position.lerp(this.target, smooth);
      model.rotation.y = p.facing;
      const distance = Math.hypot(
        model.position.x - oldX,
        model.position.z - oldZ,
      );
      model.userData.stride =
        (model.userData.stride ?? 0) +
        (this.snapCamera
          ? 0
          : (distance * Math.PI) /
            (distance / Math.max(dt, 0.001) > 4.6 ? 1.65 : 1.45));
      this.animateGuest(model, model.userData.stride * 95, moving);
    }
    const anomaly = snapshot?.you.anomaly,
      station = snapshot?.you.station;
    this.hotel.prints.visible = !!anomaly && station === 0 && !!horror?.active;
    for (let i = 0; i < this.hotel.prints.children.length; i++)
      this.hotel.prints.children[i].visible = (horror?.wetStep ?? -1) >= i;
    this.hotel.mouth.visible = !(anomaly && station === 1);
    this.hotel.smile.visible = !!anomaly && station === 1;
    this.hotel.eyes.forEach((eye, i) => {
      eye.position.x =
        (i ? 0.13 : -0.13) +
        (anomaly && station === 1 && me
          ? Math.max(-0.05, Math.min(0.05, (-11 - me.z) * 0.015))
          : 0);
    });
    this.hotel.hands.rotation.z =
      anomaly && station === 3 ? ((horror?.clockStep ?? 0) * Math.PI) / 6 : 0;
    this.hotel.handle.rotation.x = horror?.handle ?? 0;
    this.hotel.roomDoor.position.x = 4.67 + (horror?.doorShake ?? 0);
    this.hotel.portrait.rotation.z =
      horror?.portrait && !gentle
        ? Math.sin(horror.encounterTime / 900) * 0.045
        : 0;
    const inspect = w?.phase === 'playing' && w.stage === 'inspect';
    const cue = STATIONS[station ?? 0];
    this.marker.visible = !!inspect;
    this.marker.position.set(
      snapshot?.you.inspected ? 0 : cue.x,
      0.09,
      snapshot?.you.inspected ? -23.5 : cue.z,
    );
    this.marker.rotation.z = gentle ? 0 : now / 1600;
    this.ghost.visible = !!horror?.ghost;
    if (this.ghost.visible && w && horror) {
      this.ghost.position.set(
        horror.ghostPosition.x,
        0.04,
        horror.ghostPosition.z,
      );
      if (me)
        this.ghost.rotation.y = Math.atan2(
          me.x - this.ghost.position.x,
          me.z - this.ghost.position.z,
        );
      this.animateGuest(
        this.ghost,
        ((w.clock - w.escapeAt) / 470) * Math.PI * 95,
        escaping && w.clock - w.escapeAt > 1800,
      );
      this.ghost.userData.head.rotation.z =
        -0.3 + (gentle ? 0 : Math.sin(w.clock / 700) * 0.12);
    }
    this.hotel.doors.forEach((door, i) => {
      const target =
        (i ? 1 : -1) *
        (w?.stage === 'travel' && w.phase === 'playing' ? 0.85 : 2.6);
      door.position.x += (target - door.position.x) * smooth;
    });
    if (me) {
      this.eye.copy(this.people.get(me.id)!.position);
      this.eye.y += EYE_HEIGHT;
      if (firstPerson) this.camera.position.copy(this.eye);
      else {
        this.hotel.root.updateMatrixWorld(true);
        this.boom.position(
          this.eye,
          this.gaze.yaw,
          this.hotel.root,
          this.target,
        );
        // Smoothing through the previous position can cross a wall at elevator corners.
        this.camera.position.copy(this.target);
      }
      this.gaze.direction(this.look).multiplyScalar(6).add(this.eye);
      this.camera.lookAt(this.look);
      this.cb.listen(me, this.gaze.yaw);
    } else {
      this.camera.position.set(0, EYE_HEIGHT, 3.2);
      this.camera.lookAt(0, EYE_HEIGHT, -14);
    }
    this.snapCamera = false;
    this.renderer.render(this.scene, this.camera);
  };
  private disposeObject(root: T.Object3D) {
    root.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Sprite) {
        if ('geometry' in o) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('map' in m) (m.map as T.Texture | null)?.dispose();
          m.dispose();
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
