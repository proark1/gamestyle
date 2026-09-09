import { disposeGeometry } from '../../shared/rendering/primitives';
import * as THREE from 'three';
import {
  blocked,
  clearSight,
  DEPTH,
  DISPLAYS,
  DOOR,
  HATCH,
  OBSTACLES,
  SWITCH,
  WIDTH,
} from './layout';
import {
  animateDoll,
  block,
  itemModel,
  mannequin,
  palette,
  sign,
  shelfPlant,
  type Doll,
} from './models';
import {
  type Action,
  type Input,
  type Point,
  type Snapshot,
  type SnapshotTiming,
} from './types';
import { ShelfMotion } from './motion';

export class ShelfScene {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 80);
  private dolls = new Map<string, Doll>();
  private items = new Map<string, THREE.Group>();
  private guard = mannequin(true);
  private snapshot?: Snapshot;
  private keys = new Set<string>();
  private joystick: Point = { x: 0, z: 0 };
  private frame = 0;
  private resize: ResizeObserver;
  private selected: string | undefined;
  private ring: THREE.Mesh;
  private field: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private disposed = false;
  private paused = false;
  private cameraTarget = new THREE.Vector3();
  private motion = new ShelfMotion();
  private fieldVertices = new Float32Array(128 * 9);
  private lastField = { x: Infinity, z: Infinity, angle: Infinity };
  constructor(
    private container: HTMLElement,
    private onMove: (point: Point) => Input | undefined,
    private onAction: (action: Action) => void,
    private preview = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(palette.background);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      preview
        ? 'Shelf Control showroom preview.'
        : 'Furniture showroom. Use the movement and action controls to play.',
    );
    this.scene.add(new THREE.HemisphereLight(0xfff2d4, 0x8fa282, 3));
    const sunlight = new THREE.DirectionalLight(0xfff1d2, 3.2);
    sunlight.position.set(-13, 24, 12);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.normalBias = 0.05;
    Object.assign(sunlight.shadow.camera, {
      left: -20,
      right: 20,
      top: 20,
      bottom: -20,
    });
    this.scene.add(sunlight);
    this.scene.fog = new THREE.Fog(palette.background, 65, 120);
    block(
      this.scene,
      [WIDTH * 2 + 0.7, 0.65, DEPTH * 2 + 0.7],
      [0, -0.5, 0],
      palette.oak,
    );
    block(this.scene, [WIDTH * 2, 0.25, DEPTH * 2], [0, -0.2, 0], 0xe4d7b7);
    for (let x = -WIDTH; x <= WIDTH; x += 2)
      block(this.scene, [0.02, 0.012, DEPTH * 2], [x, -0.068, 0], 0xd3c6a7);
    for (let z = -DEPTH; z <= DEPTH; z += 2)
      block(this.scene, [WIDTH * 2, 0.012, 0.02], [0, -0.067, z], 0xd3c6a7);
    block(
      this.scene,
      [WIDTH * 2, 3, 0.25],
      [0, 1.3, -DEPTH - 0.1],
      palette.ivory,
    );
    for (const x of [-WIDTH, WIDTH])
      block(this.scene, [0.25, 1.2, DEPTH * 2], [x, 0.4, 0], palette.sage);
    for (const shelf of OBSTACLES) {
      block(
        this.scene,
        [shelf.w, 0.25, shelf.d],
        [shelf.x, 0.05, shelf.z],
        palette.oak,
      );
      // Opaque backboards and posts match the server's collision rectangles.
      block(
        this.scene,
        [shelf.w, 1.95, shelf.d],
        [shelf.x, 1.05, shelf.z],
        palette.sage,
        false,
      );
      block(
        this.scene,
        [shelf.w + 0.1, 0.12, shelf.d + 0.1],
        [shelf.x, 2.07, shelf.z],
        palette.oak,
      );
      const long = shelf.d > shelf.w;
      shelfPlant(
        this.scene,
        shelf.x + (long ? 0 : -shelf.w / 2 + 0.5),
        2.14,
        shelf.z + (long ? -shelf.d / 2 + 0.5 : 0),
      );
      for (
        let offset = -(long ? shelf.d : shelf.w) / 2 + 0.7;
        offset < (long ? shelf.d : shelf.w) / 2;
        offset += 1.25
      ) {
        for (const y of [0.65, 1.4]) {
          const x = shelf.x + (long ? 0 : offset),
            z = shelf.z + (long ? offset : 0);
          block(
            this.scene,
            [long ? shelf.w + 0.06 : 0.65, 0.5, long ? 0.65 : shelf.d + 0.06],
            [x, y, z],
            Math.round(offset * 10) % 3 === 0 ? palette.ivory : palette.oak,
          );
        }
      }
      sign(
        this.scene,
        shelf.name.toUpperCase(),
        shelf.x,
        2.5,
        shelf.z,
        Math.min(3.8, Math.max(shelf.w, shelf.d)),
      );
    }
    block(this.scene, [2.7, 2.4, 0.15], [DOOR.x, 1.1, -10.7], palette.clay);
    sign(this.scene, 'LOADING · 2 KEYS', 0, 2.8, -10.5, 4.3);
    block(this.scene, [0.4, 1.2, 0.7], [SWITCH.x, 0.6, SWITCH.z], palette.ink);
    block(
      this.scene,
      [0.12, 0.4, 0.4],
      [SWITCH.x, 0.85, SWITCH.z + 0.4],
      palette.clay,
    );
    sign(this.scene, 'SECURITY', SWITCH.x, 2.1, SWITCH.z, 2.5);
    block(
      this.scene,
      [1.5, 0.1, 1.5],
      [HATCH.x, -0.015, HATCH.z],
      palette.clay,
    );
    sign(this.scene, 'HATCH · LADDER', HATCH.x, 1.8, HATCH.z, 3);
    sign(this.scene, 'STAFF ONLY', 0, 0.2, 10.5, 3.2).rotation.x = -Math.PI / 2;
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x527c5b,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.55, 32),
      ringMaterial,
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.field = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: 0xffefd0,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.scene.add(this.field);
    this.field.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.fieldVertices, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.field.frustumCulled = false;
    this.scene.add(this.guard.group);
    this.guard.group.visible = false;
    // Menu figures are fixed display props, independent of any room or player.
    // A separate scene is constructed for the round, using only private snapshots.
    if (preview) {
      DISPLAYS.forEach((point, i) => {
        const doll = mannequin();
        doll.group.position.set(point.x, 0, point.z);
        doll.group.rotation.y = ((i % 4) * Math.PI) / 2;
        animateDoll(doll, i % 3, false, 0, i === 10);
        if (i === 10) doll.carry.add(itemModel('ladder'));
        this.scene.add(doll.group);
      });
      this.guard.group.visible = true;
      this.guard.group.position.set(3, 0, 7.5);
      this.guard.group.rotation.y = -Math.PI / 2;
      animateDoll(this.guard, 0, false, 0, false);
    }
    this.resize = new ResizeObserver(() => this.size());
    this.resize.observe(container);
    this.size();
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.clearInput);
    document.addEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.addEventListener('pointerdown', this.pick);
    this.animate();
  }
  private size() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const half = this.preview
      ? w > 760
        ? Math.max(20, (17 * w) / h)
        : 15
      : Math.max(8, Math.min(12, (8.5 * w) / h));
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = (half * h) / w;
    this.camera.bottom = (-half * h) / w;
    this.camera.updateProjectionMatrix();
  }
  private visibility = () => {
    if (document.hidden) this.clearInput();
  };
  clearInput = () => {
    this.keys.clear();
    this.joystick = { x: 0, z: 0 };
    const input = this.onMove(this.joystick);
    if (input) this.motion.setInput(input, performance.now());
  };
  setPaused(value: boolean) {
    this.paused = value;
    if (value) this.clearInput();
  }
  joystickMove(point: Point) {
    if (this.paused) return;
    this.joystick = point;
    this.sendMove();
  }
  private sendMove() {
    const input = this.onMove({
      x:
        this.joystick.x +
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0),
      z:
        this.joystick.z +
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0),
    });
    if (input) this.motion.setInput(input, performance.now());
  }
  private keydown = (event: KeyboardEvent) => {
    if (
      this.paused ||
      (event.target as HTMLElement)?.closest('input,textarea,[role="dialog"]')
    )
      return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code)
    ) {
      event.preventDefault();
      this.keys.add(event.code);
      this.sendMove();
    }
    if (event.repeat) return;
    if (event.code === 'Space') {
      event.preventDefault();
      this.clearInput();
      this.onAction({ type: 'pose' });
    }
    if (event.code === 'KeyE') {
      event.preventDefault();
      this.clearInput();
      this.interact();
    }
    if (event.code === 'KeyQ') {
      event.preventDefault();
      this.onAction({ type: 'drop' });
    }
  };
  private keyup = (event: KeyboardEvent) => {
    if (this.keys.delete(event.code)) this.sendMove();
  };
  interact() {
    if (this.paused) return;
    this.onAction({
      type: this.snapshot?.you.role === 'guard' ? 'inspect' : 'interact',
      ...(this.selected ? { target: this.selected } : {}),
    });
  }
  private pick = (event: PointerEvent) => {
    if (this.snapshot?.you.role !== 'guard') return;
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.intersectObjects(
      [...this.dolls.values()].map((d) => d.group),
      true,
    )[0];
    let object: THREE.Object3D | undefined = hit?.object;
    while (object && !object.userData.figureId)
      object = object.parent ?? undefined;
    this.selected = object?.userData.figureId;
  };
  update(s: Snapshot, timing?: SnapshotTiming) {
    if (this.preview) return;
    const previous = this.snapshot;
    this.snapshot = s;
    // Crossing from hiding to playing must not release a held movement key.
    if (
      previous &&
      (previous.round !== s.round ||
        previous.you.role !== s.you.role ||
        previous.you.status !== s.you.status)
    )
      this.clearInput();
    this.motion.push(s, performance.now(), timing);
    const known = new Set(s.figures.map((f) => f.id));
    for (const [id, doll] of this.dolls)
      if (!known.has(id)) {
        this.remove(doll.group);
        this.dolls.delete(id);
      }
    if (this.selected && !known.has(this.selected)) this.selected = undefined;
    for (const figure of s.figures) {
      let doll = this.dolls.get(figure.id);
      if (!doll) {
        doll = mannequin();
        doll.group.userData.figureId = figure.id;
        doll.group.position.set(figure.x, 0, figure.z);
        this.scene.add(doll.group);
        this.dolls.set(figure.id, doll);
      }
    }
    const itemIds = new Set(s.items.map((i) => i.id));
    for (const [id, item] of this.items)
      if (!itemIds.has(id)) {
        this.remove(item);
        this.items.delete(id);
      }
    for (const item of s.items) {
      if (!this.items.has(item.id)) {
        const model = itemModel(item.kind);
        this.scene.add(model);
        this.items.set(item.id, model);
      }
    }
    this.guard.group.visible = !!s.guard;
    this.field.visible =
      !!s.you.body &&
      s.you.status === 'active' &&
      !(s.you.role === 'guard' && s.phase === 'hiding');
  }
  private visibilityField(
    s: Snapshot,
    body: NonNullable<Snapshot['you']['body']>,
  ) {
    if (
      Math.hypot(body.x - this.lastField.x, body.z - this.lastField.z) < 0.01 &&
      Math.abs(body.angle - this.lastField.angle) < 0.01
    )
      return;
    this.lastField = { ...body };
    const isGuard = s.you.role === 'guard';
    const edge = (angle: number) => {
      let near = 0,
        far = isGuard ? 7.5 : 9.5;
      if (isGuard && Math.cos(angle - body.angle) < 0.15) far = 1.59;
      for (let i = 0; i < 10; i++) {
        const mid = (near + far) / 2,
          p = {
            x: body.x + Math.sin(angle) * mid,
            z: body.z + Math.cos(angle) * mid,
          };
        if (blocked(p, 0) || !clearSight(body, p)) far = mid;
        else near = mid;
      }
      return [
        body.x + Math.sin(angle) * near,
        0.003,
        body.z + Math.cos(angle) * near,
      ];
    };
    for (let i = 0; i < 128; i++)
      this.fieldVertices.set(
        [
          body.x,
          0.003,
          body.z,
          ...edge((i * Math.PI) / 64),
          ...edge(((i + 1) * Math.PI) / 64),
        ],
        i * 9,
      );
    this.field.geometry.attributes.position.needsUpdate = true;
  }
  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    const s = this.snapshot,
      now = performance.now(),
      time = now / 1000;
    this.motion.advance(now, this.paused);
    const own = this.motion.own();
    if (s?.you.body && own) {
      this.cameraTarget.set(own.x, 0, own.z);
      this.camera.position
        .copy(this.cameraTarget)
        .add(new THREE.Vector3(0, 19, 14));
      this.camera.lookAt(this.cameraTarget);
      if (this.field.visible) this.visibilityField(s, own);
      for (const figure of s.figures) {
        const doll = this.dolls.get(figure.id)!;
        const body = this.motion.actor(figure.id);
        if (!body) continue;
        doll.group.position.set(body.x, 0, body.z);
        doll.group.rotation.y = body.angle;
        animateDoll(doll, figure.pose, body.moving, time, !!figure.carrying);
        if (figure.task)
          doll.limbs[1].rotation.x = -1.3 + Math.sin(time * 6) * 0.15;
      }
      if (s.guard) {
        const body = this.motion.actor('guard');
        if (body) {
          this.guard.group.position.set(body.x, 0, body.z);
          this.guard.group.rotation.y = body.angle;
          animateDoll(this.guard, 0, body.moving, time, false);
        }
      }
      for (const item of s.items) {
        const model = this.items.get(item.id)!;
        const holder = item.holder ? this.dolls.get(item.holder)?.group : null;
        model.position.set(
          holder ? holder.position.x + 0.45 : item.x,
          holder ? 0.8 : 0.06,
          holder ? holder.position.z + 0.2 : item.z,
        );
        model.rotation.set(
          0,
          holder?.rotation.y ?? 0,
          item.kind === 'ladder' ? (holder ? -0.45 : Math.PI / 2) : 0,
        );
      }
      const ringId = s.you.role === 'guard' ? this.selected : s.you.figureId;
      const doll = ringId ? this.dolls.get(ringId) : null;
      this.ring.visible = !!doll;
      if (doll)
        this.ring.position.set(
          doll.group.position.x,
          0.02,
          doll.group.position.z,
        );
    } else {
      const menuOffset =
        this.preview && this.container.clientWidth > 760 ? -8 : 0;
      this.camera.position.set(menuOffset - 16, 24, 25);
      this.camera.lookAt(menuOffset, 0, 0);
    }
    this.renderer.render(this.scene, this.camera);
  };
  private remove(object: THREE.Object3D) {
    object.removeFromParent();
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        disposeGeometry(child.geometry);
        for (const mat of Array.isArray(child.material)
          ? child.material
          : [child.material]) {
          if ('map' in mat) (mat as THREE.MeshBasicMaterial).map?.dispose();
          mat.dispose();
        }
      }
    });
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.clearInput();
    this.resize.disconnect();
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.clearInput);
    document.removeEventListener('visibilitychange', this.visibility);
    this.renderer.domElement.removeEventListener('pointerdown', this.pick);
    this.remove(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
