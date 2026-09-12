import { disposeGeometry } from '../../shared/rendering/primitives';
import { actorLevel, levelOf, pieceBase, STOREY_HEIGHT } from './levels';
import { mapBounds, mapConfig } from './maps';
import * as T from 'three';
import {
  cranePose,
  craneReach,
  craneBase,
  parkedCranePose,
  roofBase,
} from './crane';
import { prepareRoof, fadeRoof, underRoof } from './roof-view';
import { fadeStorey, onOtherStorey } from './storey-view';
import { TOUCH_QUERY, TouchGesture, cameraMovement } from './touch';
import { carryPlacement } from './carry-placement';
import {
  findPath,
  buildReach,
  inReach,
  pieceShape,
  REACH,
  surfaceHeight,
} from './colliders';
import {
  footprint,
  joinsAt,
  playerBlocksPlacement,
  snapPlacement,
  type BuildTarget,
} from './placement';
import { SitePhysics } from './physics';
import { PartyView } from './party-view';
import { SwapView } from './swap-view';
import { InspectionView } from './inspection-view';
import { roleAnchor } from './party';
import { PROP_USES } from './house-props';
import {
  animateWorker,
  disposePiece,
  environment,
  label,
  makePiece,
  worker,
} from './objects';
import { appearanceKey, type Appearance } from './appearance';
import { animateHomeModel } from './home-models';
import {
  clamp,
  distance,
  placementError,
  type ItemKind,
  type Piece,
  type Player,
  type Snapshot,
} from './model';

type SceneCallbacks = {
  input?: (touch: boolean) => void;
  move: (x: number, z: number, angle: number, jump: number, y: number) => void;
  click: (x: number, z: number, id?: string) => void;
  positionBuild?: (x: number, z: number) => void;
  action: (type: string) => void;
  ready: () => void;
  feedback: (message: string) => void;
};
export type BuildPreview = BuildTarget & {
  error: string | null;
  reachable: boolean;
  distance: number;
};
type BuildPart = { kind: ItemKind; rotation: number };
export function eyeMovement(strafe: number, backward: number, yaw: number) {
  return {
    x: -strafe * Math.cos(yaw) - backward * Math.sin(yaw),
    z: strafe * Math.sin(yaw) - backward * Math.cos(yaw),
  };
}
export class GameScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  overviewCamera = new T.OrthographicCamera();
  eyeCamera = new T.PerspectiveCamera(75, 1, 0.06, 200);
  camera: T.OrthographicCamera | T.PerspectiveCamera = this.overviewCamera;
  firstPerson = false;
  eyeYaw = Math.PI;
  pitch = -0.12;
  lookDrag: { id: number; x: number; y: number; moved: number } | null = null;
  get eyeView() {
    return this.firstPerson && !this.menu && !this.craneMode;
  }
  get focusedLevel() {
    if (this.menu) return null;
    return this.buildKind || this.craneMode || this.paintMode
      ? this.buildLevel
      : actorLevel(this.local ?? { x: 0, z: 0 });
  }
  root: T.Group;
  pieces = new Map<string, T.Group>();
  workers = new Map<string, T.Group>();
  snapshot: Snapshot | null = null;
  local: Player | null = null;
  keys = new Set<string>();
  menu = true;
  paused = false;
  partyView: PartyView;
  inspectionView: InspectionView;
  swapView: SwapView;
  crewInput = { x: 0, z: 0, turn: 0 };
  exportNames = false;
  inspectionFollow = true;
  setInspectionFollow(enabled: boolean) {
    this.inspectionFollow = enabled;
    this.updateCamera();
  }
  setSpeaking(ids: string[]) {
    this.speaking = new Set(ids);
  }
  private exportAt = 0;
  private frameDurations: number[] = [];
  frameP95() {
    if (this.frameDurations.length < 60) return 0;
    const sorted = [...this.frameDurations].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  }
  speaking = new Set<string>();
  frameConsumers = new Set<(canvas: HTMLCanvasElement) => void>();
  buildKind: ItemKind | null = null;
  rotation = 0;
  buildLevel = 0;
  demolish = false;
  paintMode = false;
  paintRoofs = false;
  buildAppearance: Appearance = {};
  craneMode = false;
  ghost: T.Group | null = null;
  hovering = false;
  buildPreview: BuildPreview | null = null;
  pointer = new T.Vector2(-20, -20);
  target = new T.Vector3();
  ray = new T.Raycaster();
  plane = new T.Plane(new T.Vector3(0, 1, 0), -0.43);
  yaw = 0.53;
  zoom = 1;
  width = 1;
  height = 1;
  time = 0;
  clockOffset = 0;
  raf = 0;
  last = 0;
  sendAt = 0;
  jumpAt = 0;
  bonkAt = 0;
  moveTarget: T.Vector3 | null = null;
  drag: { x: number; y: number; yaw: number } | null = null;
  resize: ResizeObserver;
  resizePending = true;
  pixelRatio = 1;
  abort = new AbortController();
  seenEvents = new Set<string>();
  effects: {
    mesh: T.Object3D;
    at: number;
    type: string;
    velocity?: T.Vector3;
  }[] = [];
  touch = { x: 0, z: 0 };
  sprint = false;
  carryAim: number | null = null;
  dropPreview: ReturnType<typeof carryPlacement> | null = null;
  touchMode = window.matchMedia(TOUCH_QUERY).matches;
  targetChoices: string[] = [];
  buildHandle: HTMLDivElement | null = null;
  buildDrag: {
    id: number;
    x: number;
    z: number;
    aimX: number;
    aimZ: number;
  } | null = null;
  selectionIds: string[] = [];
  previewAppearance: Appearance | null = null;
  selectionColor = '#ffc83d';
  selectionOutline = new T.BoxHelper(new T.Object3D(), '#ffc83d');
  dropBase = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: '#36bd86',
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  gestures = new TouchGesture();
  touchBuildReady = false;
  get touchBuilding() {
    return (
      this.touchMode && !!this.buildKind && !this.craneMode && !this.demolish
    );
  }
  resetTouchBuild() {
    this.aim = null;
    this.touchBuildReady = false;
    this.gestures.clear();
    this.buildDrag = null;
  }
  setTouchInput(touch: boolean) {
    if (this.touchMode === touch) return;
    this.touchMode = touch;
    if (!touch) this.carryAim = null;
    this.callbacks.input?.(touch);
  }
  buildHandlePoint() {
    if (!this.aim || !this.ghost?.visible) return null;
    const p = this.ghost.position.clone().project(this.camera);
    const r = this.host.getBoundingClientRect();
    return {
      x: r.left + ((p.x + 1) * r.width) / 2,
      y: r.top + ((1 - p.y) * r.height) / 2 + 40,
    };
  }
  beginBuildDrag(event: PointerEvent) {
    if (!this.touchBuilding || !this.aim) return;
    this.ray.setFromCamera(this.pointer, this.camera);
    const handle = this.buildHandlePoint();
    const onHandle =
      handle &&
      Math.abs(handle.x - event.clientX) <= 28 &&
      Math.abs(handle.y - event.clientY) <= 28;
    const onGhost =
      this.ghost?.visible &&
      this.ray.intersectObject(this.ghost, true).length > 0;
    if (!onHandle && !onGhost) return;
    const hit = this.ray.ray.intersectPlane(this.plane, this.target);
    if (hit)
      this.buildDrag = {
        id: event.pointerId,
        x: hit.x,
        z: hit.z,
        aimX: this.aim.x,
        aimZ: this.aim.z,
      };
  }
  dragBuildPreview() {
    if (!this.snapshot || !this.buildKind) return;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.target);
    if (!hit) return;
    const target = snapPlacement(
      this.snapshot.world,
      this.buildKind,
      {
        x: this.buildDrag
          ? this.buildDrag.aimX + hit.x - this.buildDrag.x
          : hit.x,
        z: this.buildDrag
          ? this.buildDrag.aimZ + hit.z - this.buildDrag.z
          : hit.z,
        level: this.buildLevel,
      },
      this.rotation,
    );
    this.cancelWork();
    this.aim = { x: target.x, z: target.z, level: this.buildLevel };
    this.touchBuildReady = true;
    this.callbacks.positionBuild?.(target.x, target.z);
  }
  pan = { x: 0, z: 0 };
  aim: { x: number; z: number; level?: number } | null = null;
  physics = new SitePhysics();
  route: { x: number; z: number; y?: number }[] = [];
  work: {
    target: { x: number; z: number; level?: number; y?: number };
    run: () => void;
    ignoreId?: string;
    label: string;
    started: number;
    part?: BuildPart;
  } | null = null;
  workLabel = '';
  toolAt = 0;
  targetId: string | null = null;
  focus = new T.Mesh(
    new T.RingGeometry(0.7, 0.8, 40),
    new T.MeshBasicMaterial({
      color: '#ffe06b',
      side: T.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }),
  );
  throwGuide = new T.Line(
    new T.BufferGeometry(),
    new T.LineDashedMaterial({
      color: '#f5bd3e',
      dashSize: 0.3,
      gapSize: 0.18,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  );
  buildBase = new T.Mesh(
    new T.PlaneGeometry(1, 1),
    new T.MeshBasicMaterial({
      color: '#48b67b',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  buildReach = new T.Mesh(
    new T.RingGeometry(REACH - 0.035, REACH, 64),
    new T.MeshBasicMaterial({
      color: '#f4ce65',
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  buildLink = new T.Line(
    new T.BufferGeometry(),
    new T.LineDashedMaterial({
      color: '#e5b047',
      dashSize: 0.16,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    }),
  );
  buildJoints = [-1, 1].map(
    () =>
      new T.Mesh(
        new T.SphereGeometry(0.11, 8, 6),
        new T.MeshBasicMaterial({ color: '#72f4aa', depthTest: false }),
      ),
  );
  constructor(
    public host: HTMLElement,
    public callbacks: SceneCallbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: !this.touchMode,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    this.pixelRatio = Math.min(
      window.devicePixelRatio,
      this.touchMode ? 1.15 : 1.6,
    );
    this.renderer.shadowMap.enabled = !this.touchMode;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Three-dimensional building site. Tap to select, drag to rotate, use two fingers to zoom and pan.',
    );
    host.appendChild(this.renderer.domElement);
    this.buildHandle = document.createElement('div');
    this.buildHandle.className = 'touch-build-handle';
    this.buildHandle.setAttribute('aria-hidden', 'true');
    this.buildHandle.textContent = '✥';
    this.buildHandle.hidden = true;
    host.appendChild(this.buildHandle);
    this.scene.background = new T.Color('#b9cfbd');
    this.scene.add(new T.HemisphereLight('#fff5d8', '#719887', 2.5));
    const sun = new T.DirectionalLight('#fff0ce', 3.5);
    sun.position.set(-10, 20, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.normalBias = 0.05;
    sun.shadow.bias = -0.00015;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.root = environment();
    this.scene.add(this.root);
    this.partyView = new PartyView(this.scene);
    this.inspectionView = new InspectionView(this.scene);
    this.swapView = new SwapView(this.scene);
    this.focus.rotation.x = -Math.PI / 2;
    this.focus.renderOrder = 4;
    this.focus.visible = false;
    this.scene.add(this.focus);
    this.throwGuide.renderOrder = 4;
    this.throwGuide.visible = false;
    this.scene.add(this.throwGuide);
    this.dropBase.rotation.x = -Math.PI / 2;
    this.dropBase.visible = false;
    this.dropBase.renderOrder = 5;
    this.selectionOutline.visible = false;
    this.selectionOutline.material.depthTest = false;
    this.selectionOutline.material.transparent = true;
    this.selectionOutline.material.opacity = 0.9;
    this.selectionOutline.renderOrder = 10;
    this.scene.add(this.dropBase, this.selectionOutline);
    this.buildBase.rotation.x = this.buildReach.rotation.x = -Math.PI / 2;
    for (const obj of [
      this.buildBase,
      this.buildReach,
      this.buildLink,
      ...this.buildJoints,
    ]) {
      obj.visible = false;
      obj.renderOrder = 12;
      this.scene.add(obj);
    }
    this.resize = new ResizeObserver(() => this.onResize());
    this.resize.observe(host);
    const signal = this.abort.signal;
    host.addEventListener('pointermove', this.onPointerMove, { signal });
    host.addEventListener('pointerdown', this.onPointerDown, { signal });
    window.addEventListener('pointerup', this.onPointerUp, { signal });
    window.addEventListener('pointercancel', this.onPointerCancel, { signal });
    host.addEventListener('lostpointercapture', this.onPointerCancel, {
      signal,
    });
    host.addEventListener(
      'pointerleave',
      () => {
        if (this.eyeView) return;
        this.pointer.set(-20, -20);
        this.hovering = false;
      },
      { signal },
    );
    host.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    host.addEventListener('wheel', this.onWheel, { passive: false, signal });
    window.addEventListener('keydown', this.onKeyDown, { signal });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), {
      signal,
    });
    window.addEventListener('blur', this.clearInput, { signal });
    window.addEventListener('pagehide', this.clearInput, { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.clearInput();
      },
      { signal },
    );
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (
          document.pointerLockElement !== this.renderer.domElement &&
          this.eyeView
        )
          this.clearInput();
      },
      { signal },
    );
    this.onResize();
    this.raf = requestAnimationFrame(this.frame);
    callbacks.ready();
  }
  onResize() {
    this.resizePending = true;
  }
  applyResize() {
    if (!this.resizePending) return;
    this.resizePending = false;
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (width < 1 || height < 1) return;
    if (
      width === this.width &&
      height === this.height &&
      this.pixelRatio === this.renderer.getPixelRatio()
    )
      return;
    this.width = width;
    this.height = height;
    // A buffer resize clears its pixels. Do it in the render frame, never in ResizeObserver.
    // CSS owns the displayed size; do not write pixel dimensions to the canvas style.
    this.renderer.setDrawingBufferSize(width, height, this.pixelRatio);
    this.updateCamera();
  }
  updateCamera() {
    const aspect = this.width / Math.max(1, this.height);
    const inspection =
      this.inspectionFollow &&
      this.snapshot?.world.party?.phase === 'inspection';
    if (this.eyeView && this.local && !inspection) {
      this.camera = this.eyeCamera;
      this.eyeCamera.aspect = aspect;
      this.eyeCamera.position.set(
        this.local.x,
        (this.local.y ?? 0.43) + 1.82,
        this.local.z,
      );
      this.eyeCamera.lookAt(
        this.local.x + Math.sin(this.eyeYaw) * Math.cos(this.pitch),
        this.eyeCamera.position.y + Math.sin(this.pitch),
        this.local.z + Math.cos(this.eyeYaw) * Math.cos(this.pitch),
      );
      this.eyeCamera.updateProjectionMatrix();
      return;
    }
    const camera = this.overviewCamera;
    this.camera = camera;
    const size =
      (Math.max(
        this.touchMode && !this.menu ? 10.5 : 14.8,
        12.8 / Math.max(aspect, 0.2),
      ) *
        mapConfig(this.snapshot?.world.map).scale) /
      this.zoom;
    camera.left = -size * aspect;
    camera.right = size * aspect;
    camera.top = size;
    camera.bottom = -size;
    camera.near = 0.1;
    camera.far = 200;
    const offset = this.menu && aspect > 1.25 ? -6 : 0;
    const visibleLevel = this.menu
      ? Math.max(
          0,
          ...(this.snapshot?.world.pieces.map((p) => levelOf(p)) ?? []),
        ) / 2
      : this.buildKind || this.craneMode
        ? this.buildLevel
        : actorLevel(this.local ?? { x: 0, z: 0 });
    const center = new T.Vector3(
      Math.cos(this.yaw) * offset + this.pan.x,
      1.1 + visibleLevel * STOREY_HEIGHT,
      -Math.sin(this.yaw) * offset + this.pan.z,
    );
    if (inspection)
      center.set(
        this.partyView.inspector.position.x,
        1.1,
        this.partyView.inspector.position.z,
      );
    camera.position.set(
      center.x + Math.sin(this.yaw) * 29,
      29,
      center.z + Math.cos(this.yaw) * 29,
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }
  releaseLook() {
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock?.();
  }
  requestLook() {
    if (
      !this.eyeView ||
      this.touchMode ||
      this.paused ||
      !this.renderer.domElement.requestPointerLock
    )
      return;
    try {
      void Promise.resolve(this.renderer.domElement.requestPointerLock()).catch(
        () => this.callbacks.feedback('Drag on the site to look around.'),
      );
    } catch {}
  }
  setFirstPerson(enabled: boolean) {
    this.firstPerson = enabled;
    this.carryAim = null;
    this.eyeYaw = this.local?.angle ?? Math.PI;
    this.pitch = -0.12;
    this.clearInput();
    this.aim = null;
    this.pointer.set(0, 0);
    this.hovering = enabled;
    if (!enabled) this.releaseLook();
    this.updateCamera();
  }
  look(dx: number, dy: number) {
    this.eyeYaw -= dx * 0.003;
    this.pitch = clamp(this.pitch - dy * 0.003, -1.3, 1.3);
    if (this.local) this.local.angle = this.eyeYaw;
    this.pointer.set(0, 0);
    this.hovering = true;
    this.updateCamera();
  }
  aimOnGround() {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray.ray.intersectPlane(this.plane, this.target);
    if (!this.eyeView || !this.local) return hit;
    if (hit && distance(hit, this.local) <= REACH) return hit;
    return this.target.set(
      this.local.x + Math.sin(this.eyeYaw) * 2.1,
      surfaceHeight(this.local, this.snapshot?.world.map),
      this.local.z + Math.cos(this.eyeYaw) * 2.1,
    );
  }

  clearInput = () => {
    this.crewInput = { x: 0, z: 0, turn: 0 };
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.sprint = false;
    this.buildDrag = null;
    this.moveTarget = null;
    this.drag = null;
    this.lookDrag = null;
    this.gestures.clear();
    this.touchBuildReady = false;
    this.cancelWork();
    if (this.local) this.physics.move(this.local.id, 0, 0);
    if (typeof window !== 'undefined')
      window.dispatchEvent?.(new Event('permit-input-cancel'));
  };
  cancelWork() {
    this.route = [];
    this.work = null;
    this.workLabel = '';
  }
  canWork(
    target: { x: number; z: number; level?: number; y?: number },
    ignoreId?: string,
    part?: BuildPart,
  ) {
    return (
      !!this.local &&
      !!this.snapshot &&
      (part
        ? buildReach(this.snapshot.world, this.local, target, part.kind)
        : inReach(this.snapshot.world, this.local, target, ignoreId)) &&
      (!part ||
        !playerBlocksPlacement(part.kind, target, part.rotation, this.local))
    );
  }
  goTo(
    target: { x: number; z: number; level?: number; y?: number },
    run?: () => void,
    label = 'On the way',
    ignoreId?: string,
    part?: BuildPart,
  ) {
    if (!this.local || !this.snapshot) return;
    this.cancelWork();
    this.targetId = ignoreId || null;
    if (run && this.canWork(target, ignoreId, part)) {
      this.local.angle = Math.atan2(
        target.x - this.local.x,
        target.z - this.local.z,
      );
      this.toolAt = performance.now();
      run();
      return;
    }
    const floorWork = !!run && part?.kind === 'floor';
    // A slab being built cannot support the route used to build it.
    const navWorld =
      part && !floorWork
        ? {
            ...this.snapshot.world,
            pieces: [
              ...this.snapshot.world.pieces,
              { id: 'build-destination', ...part, ...target, placed: true },
            ],
          }
        : this.snapshot.world;
    let path = findPath(
      navWorld,
      this.local,
      target,
      run ? REACH - 0.3 : 0.45,
      ignoreId,
      floorWork
        ? (position) => buildReach(navWorld, position, target, 'floor')
        : undefined,
    );
    if (
      part &&
      playerBlocksPlacement(part.kind, target, part.rotation, this.local)
    ) {
      const candidates = Array.from({ length: 8 }, (_, i) => ({
        x: target.x + Math.sin((i * Math.PI) / 4) * 2.3,
        z: target.z + Math.cos((i * Math.PI) / 4) * 2.3,
        level: target.level,
        y: surfaceHeight(target, this.snapshot?.world.map),
      }));
      const paths = candidates
        .filter(
          (p) =>
            !playerBlocksPlacement(part.kind, target, part.rotation, p) &&
            inReach(this.snapshot!.world, p, target),
        )
        .map((p) =>
          findPath(this.snapshot!.world, this.local!, p, 0.3, ignoreId),
        )
        .filter((p): p is { x: number; z: number }[] => !!p);
      paths.sort((a, b) => a.length - b.length);
      path = paths[0] || null;
    }
    if (!path) {
      this.callbacks.feedback(
        'No clear path. Walk around the obstacle or make room.',
      );
      return;
    }
    this.route = path;
    this.workLabel = label;
    if (run)
      this.work = {
        target,
        run,
        ignoreId,
        label,
        started: performance.now(),
        part,
      };
  }
  setMenu(value: boolean) {
    this.menu = value;
    if (value) this.releaseLook();
    this.clearInput();
    this.aim = null;
    this.pan = { x: 0, z: 0 };
    this.zoom = 1;
    this.updateCamera();
  }
  setPaused(value: boolean) {
    this.paused = value;
    if (value) {
      this.clearInput();
      this.releaseLook();
    }
  }
  setQuality(low: boolean) {
    this.pixelRatio = Math.min(devicePixelRatio, low ? 1.15 : 1.6);
    this.resizePending = true;
    this.renderer.shadowMap.enabled = !low;
  }
  cameraAction(
    action:
      | 'left'
      | 'right'
      | 'in'
      | 'out'
      | 'reset'
      | 'pan-left'
      | 'pan-right'
      | 'pan-up'
      | 'pan-down',
  ) {
    if (this.eyeView) {
      this.look(
        action === 'left' ? -100 : action === 'right' ? 100 : 0,
        action === 'in' ? -80 : action === 'out' ? 80 : 0,
      );
      if (action === 'reset') {
        this.pitch = -0.12;
        this.updateCamera();
      }
      return;
    }
    if (action === 'reset') {
      this.yaw = 0.53;
      this.zoom = 1;
      this.pan = { x: 0, z: 0 };
    }
    if (action === 'left' || action === 'right')
      this.yaw += action === 'left' ? -0.3 : 0.3;
    if (action === 'in' || action === 'out')
      this.zoom = clamp(
        this.zoom * (action === 'in' ? 1.2 : 1 / 1.2),
        0.65,
        2.5,
      );
    if (action.startsWith('pan-')) {
      const d = cameraMovement(
        action === 'pan-left' ? -1 : action === 'pan-right' ? 1 : 0,
        action === 'pan-up' ? -1 : action === 'pan-down' ? 1 : 0,
        this.yaw,
      );
      this.pan.x = clamp(this.pan.x + d.x * 1.5, -12, 12);
      this.pan.z = clamp(this.pan.z + d.z * 1.5, -10, 10);
    }
    this.updateCamera();
  }
  setTool(
    kind: ItemKind | null,
    rotation: number,
    demolish = false,
    level = 0,
    appearance: Appearance = {},
    painting = false,
    paintRoofs = false,
  ) {
    if (
      kind !== this.buildKind ||
      demolish !== this.demolish ||
      level !== this.buildLevel
    )
      this.resetTouchBuild();
    this.rotation = rotation;
    this.demolish = demolish;
    this.buildLevel = level;
    this.plane.constant = -surfaceHeight(
      { x: 0, z: 0, level },
      this.snapshot?.world.map,
    );
    this.paintMode = painting;
    this.paintRoofs = paintRoofs;
    if (
      kind !== this.buildKind ||
      appearanceKey(appearance) !== appearanceKey(this.buildAppearance)
    ) {
      this.buildAppearance = appearance;
      if (this.ghost) {
        this.scene.remove(this.ghost);
        disposePiece(this.ghost, true);
      }
      this.buildKind = kind;
      this.ghost = kind ? makePiece(kind, appearance) : null;
      if (this.ghost) {
        const objects: (T.Mesh | T.Line)[] = [];
        this.ghost.traverse((o) => {
          if (o instanceof T.Mesh || o instanceof T.Line) objects.push(o);
        });
        for (const object of objects) {
          const clone = (source: T.Material) => {
            const material = source.clone();
            material.transparent = true;
            material.opacity = 0.72;
            material.depthWrite = false;
            // A floor behind a wall must not look like a slab on top of it.
            material.depthTest = kind === 'floor';
            return material;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(clone)
            : clone(object.material);
          object.castShadow = false;
          object.renderOrder = 20;
          if (object instanceof T.Mesh) {
            const outline = new T.LineSegments(
              new T.EdgesGeometry(object.geometry, 30),
              new T.LineBasicMaterial({
                color: '#2e8460',
                transparent: true,
                opacity: 0.95,
                depthTest: kind === 'floor',
              }),
            );
            outline.renderOrder = 21;
            object.add(outline);
          }
        }
        this.scene.add(this.ghost);
      }
    }
    if (this.ghost) this.ghost.rotation.y = (rotation * Math.PI) / 2;
    this.host.style.cursor =
      kind || demolish || painting ? 'crosshair' : 'default';
  }
  setState(state: Snapshot, id?: string) {
    const oldHeld = this.snapshot?.world.pieces.find(
      (p) => p.heldBy === this.local?.id,
    )?.id;
    if (
      (this.snapshot?.world.map ?? 'small') !== (state.world.map ?? 'small')
    ) {
      this.scene.remove(this.root);
      disposePiece(this.root);
      this.disposeLabel(this.root);
      this.root = environment(state.world.map);
      this.scene.add(this.root);
      this.physics = new SitePhysics(state.world.map);
      this.clearInput();
    }
    this.snapshot = state;
    if (
      oldHeld !==
      state.world.pieces.find((p) => p.heldBy === this.local?.id)?.id
    )
      this.carryAim = null;
    if (this.work?.ignoreId) {
      const target = state.world.pieces.find(
        (p) => p.id === this.work?.ignoreId,
      );
      if (
        !target ||
        target.heldBy ||
        target.hoisted ||
        distance(target, this.work.target) > 0.4
      ) {
        this.cancelWork();
        this.callbacks.feedback(
          'That part moved or was taken. Choose it again.',
        );
      }
    }
    this.clockOffset = state.now - Date.now();
    if (id && this.local?.id !== id) {
      const player = state.players.find((p) => p.id === id);
      if (player) {
        this.local = { ...player };
        this.moveTarget = null;
        this.keys.clear();
      }
    }
    this.updateCamera();
    this.physics.sync(state.world.pieces, state.players, this.local?.id);
    const wanted = new Set(state.world.pieces.map((p) => p.id));
    for (const [key, obj] of this.pieces)
      if (!wanted.has(key)) {
        this.scene.remove(obj);
        disposePiece(obj);
        this.pieces.delete(key);
      }
    for (const p of state.world.pieces) {
      const appearance =
        this.touchMode &&
        this.previewAppearance &&
        this.selectionIds.includes(p.id) &&
        p.placed &&
        !p.heldBy &&
        !p.hoisted
          ? this.previewAppearance
          : p;
      const previous = this.pieces.get(p.id),
        key = `${p.kind}:${appearanceKey(appearance)}`;
      if (previous?.userData.appearance === key) continue;
      if (previous) {
        this.scene.remove(previous);
        disposePiece(previous);
      }
      const obj = makePiece(p.kind, appearance);
      if (p.kind === 'roof') prepareRoof(obj);
      obj.userData.appearance = key;
      obj.userData.id = p.id;
      obj.position.set(p.x, 0.43, p.z);
      this.pieces.set(p.id, obj);
      this.scene.add(obj);
    }
    const ids = new Set(state.players.map((p) => p.id));
    for (const [key, obj] of this.workers)
      if (!ids.has(key)) {
        this.disposeLabel(obj);
        this.scene.remove(obj);
        this.workers.delete(key);
      }
    for (const p of state.players)
      if (!this.workers.has(p.id)) {
        const obj = worker(p.color);
        obj.position.set(p.x, 0.43, p.z);
        const tag = label(
          p.id === id ? `${p.name} · YOU` : p.name,
          '#293c3b',
          p.id === id ? '#fff5cf' : '#ffffff',
          2,
        );
        tag.position.y = 2.57;
        obj.add(tag);
        obj.userData.tag = tag;
        this.workers.set(p.id, obj);
        this.scene.add(obj);
      }
    for (const e of state.world.events)
      if (!this.seenEvents.has(e.id)) {
        this.seenEvents.add(e.id);
        if (state.now - e.at > 1500) continue;
        if (e.at > state.now) {
          this.seenEvents.delete(e.id);
          continue;
        }
        if (e.type === 'bonk' && this.local && e.target === this.local.id) {
          this.bonkAt = performance.now();
          this.cancelWork();
          const body = this.physics.players.get(this.local.id);
          if (body) {
            body.velocity.y = 4;
            body.velocity.x = 2;
            body.velocity.z = 1;
          }
        }
        if (['emote', 'bonk', 'wind'].includes(e.type)) {
          const s = label(
            e.type === 'bonk'
              ? 'BONK!'
              : e.type === 'emote'
                ? e.speech || e.text
                : 'WHOOSH!',
            '#293c3b',
            e.type === 'bonk' ? '#ffc83d' : '#ffffff',
            e.type === 'emote' ? 5 : 3,
          );
          s.position.set(e.x, 3.8, e.z);
          this.scene.add(s);
          this.effects.push({ mesh: s, at: performance.now(), type: 'label' });
        }
        if (e.type === 'build' || e.type === 'bonk')
          this.burst(e.x, e.z, e.type === 'bonk' ? '#ffc83d' : '#eacba1');
      }
    if (this.seenEvents.size > 150)
      this.seenEvents = new Set(state.world.events.map((e) => e.id));
  }
  disposeLabel(obj: T.Object3D) {
    obj.traverse((o) => {
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
  }
  burst(x: number, z: number, color: string) {
    for (let i = 0; i < 9; i++) {
      const p = new T.Mesh(
        new T.BoxGeometry(0.13, 0.13, 0.13),
        new T.MeshBasicMaterial({ color }),
      );
      p.position.set(x, 0.7, z);
      this.scene.add(p);
      this.effects.push({
        mesh: p,
        at: performance.now(),
        type: 'particle',
        velocity: new T.Vector3(
          Math.sin(i * 2.4) * 2,
          2 + i * 0.2,
          Math.cos(i * 2.4) * 2,
        ),
      });
    }
  }
  onPointerMove = (e: PointerEvent) => this.updatePointer(e);
  updatePointer(e: PointerEvent) {
    if (this.paused) return;
    if (this.eyeView && !this.touchBuilding) {
      if (document.pointerLockElement === this.renderer.domElement)
        this.look(e.movementX, e.movementY);
      else if (this.lookDrag?.id === e.pointerId) {
        const dx = e.clientX - this.lookDrag.x,
          dy = e.clientY - this.lookDrag.y;
        this.lookDrag.moved += Math.abs(dx) + Math.abs(dy);
        this.lookDrag.x = e.clientX;
        this.lookDrag.y = e.clientY;
        this.look(dx, dy);
      }
      return;
    }
    this.hovering =
      e.pointerType !== 'touch' && !(this.touchBuilding && this.aim);
    const r = this.host.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    if (
      e.pointerType === 'mouse' &&
      !this.touchMode &&
      this.local &&
      this.snapshot?.world.pieces.some((p) => p.heldBy === this.local?.id)
    ) {
      this.ray.setFromCamera(this.pointer, this.camera);
      const hit = this.ray.ray.intersectPlane(this.plane, this.target);
      if (hit)
        this.local.angle = Math.atan2(
          hit.x - this.local.x,
          hit.z - this.local.z,
        );
    }
    const previous = this.gestures.contacts.get(e.pointerId);
    const lookDelta = previous
      ? { x: e.clientX - previous.x, y: e.clientY - previous.y }
      : { x: 0, y: 0 };
    const gesture = this.gestures.move(e.pointerId, e.clientX, e.clientY);
    if (this.gestures.multi) this.buildDrag = null;
    if (
      gesture &&
      this.buildDrag?.id === e.pointerId &&
      this.touchBuilding &&
      this.aim &&
      !this.gestures.multi
    ) {
      this.dragBuildPreview();
      return;
    }
    if (gesture) {
      if (this.eyeView) {
        this.look(lookDelta.x, lookDelta.y);
        return;
      }
      this.yaw += gesture.orbit;
      this.zoom = clamp(this.zoom * gesture.zoom, 0.65, 2.5);
      const scale =
        (this.overviewCamera.right - this.overviewCamera.left) /
        Math.max(1, this.width);
      this.pan.x = clamp(
        this.pan.x -
          gesture.panX * scale * Math.cos(this.yaw) -
          gesture.panY * scale * Math.sin(this.yaw) * 1.4,
        -12,
        12,
      );
      this.pan.z = clamp(
        this.pan.z +
          gesture.panX * scale * Math.sin(this.yaw) -
          gesture.panY * scale * Math.cos(this.yaw) * 1.4,
        -10,
        10,
      );
      this.updateCamera();
    } else if (this.drag) {
      this.yaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.006;
      this.updateCamera();
    }
  }
  onPointerDown = (e: PointerEvent) => {
    if (this.paused) return;
    if (e.pointerType === 'touch' || e.pointerType === 'mouse')
      this.setTouchInput(e.pointerType === 'touch');
    if (this.eyeView && !this.touchBuilding) {
      this.pointer.set(0, 0);
      this.hovering = true;
      if (document.pointerLockElement === this.renderer.domElement) {
        if (e.button === 0) this.tap();
        return;
      }
      if (this.lookDrag) {
        this.lookDrag.moved = Infinity;
        return;
      }
      this.lookDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      this.host.setPointerCapture(e.pointerId);
      if (e.pointerType !== 'touch' && e.button === 0) this.requestLook();
      return;
    }
    this.onPointerMove(e);
    if (e.button === 2 || e.button === 1) {
      this.drag = { x: e.clientX, y: e.clientY, yaw: this.yaw };
      return;
    }
    if (e.pointerType === 'touch') {
      this.host.setPointerCapture(e.pointerId);
      this.gestures.down(e.pointerId, e.clientX, e.clientY, e.timeStamp);
      if (!this.gestures.multi) this.beginBuildDrag(e);
      else this.buildDrag = null;
      return;
    }
    this.tap();
  };
  tap() {
    if (this.menu || this.paused || !this.local) return;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.touchBuilding
      ? this.ray.ray.intersectPlane(this.plane, this.target)
      : this.aimOnGround();
    if (!hit) return;
    if (this.snapshot?.world.pieces.some((p) => p.heldBy === this.local?.id)) {
      this.cancelWork();
      if (!this.eyeView) {
        this.local.angle = Math.atan2(
          hit.x - this.local.x,
          hit.z - this.local.z,
        );
        if (this.touchMode) this.carryAim = this.local.angle;
      }
      return;
    }
    let pieceId: string | undefined;
    // Roofs never intercept indoor picking; crane/removal tools explicitly target them.
    const selectable = [...this.pieces.values()].filter((obj) => {
      const p = this.snapshot?.world.pieces.find(
        (p) => p.id === obj.userData.id,
      );
      return (
        obj.visible &&
        p &&
        !onOtherStorey(p, this.focusedLevel) &&
        !p.hoisted &&
        (this.craneMode
          ? p.kind === 'roof'
          : this.demolish
            ? !p.supply
            : this.paintMode
              ? !p.supply &&
                (this.paintRoofs ? p.kind === 'roof' : p.kind !== 'roof')
              : p.kind !== 'roof')
      );
    });
    // In first person, scenery and walls occlude interaction targets.
    const hits = this.ray.intersectObjects(
      this.eyeView ? [...selectable, this.root] : selectable,
      true,
    );
    if (hits[0]) {
      let obj: T.Object3D | null = hits[0].object;
      while (obj && !obj.userData.id) obj = obj.parent;
      pieceId = obj?.userData.id;
    }
    if (
      this.touchMode &&
      !this.eyeView &&
      !this.buildKind &&
      !this.demolish &&
      !this.paintMode &&
      !this.craneMode
    ) {
      const choices: string[] = [];
      for (const hit of hits) {
        let obj: T.Object3D | null = hit.object;
        while (obj && !obj.userData.id) obj = obj.parent;
        if (obj?.userData.id && !choices.includes(obj.userData.id))
          choices.push(obj.userData.id);
      }
      if (!choices.length) {
        const r = this.host.getBoundingClientRect();
        const nearby = selectable
          .map((obj) => {
            const screen = obj.position.clone().project(this.camera);
            return {
              id: obj.userData.id as string,
              distance: Math.hypot(
                ((screen.x - this.pointer.x) * r.width) / 2,
                ((screen.y - this.pointer.y) * r.height) / 2,
              ),
              visible: screen.z >= -1 && screen.z <= 1,
            };
          })
          .filter((p) => p.visible && p.distance <= 24)
          .sort((a, b) => a.distance - b.distance);
        choices.push(...nearby.map((p) => p.id));
      }
      this.targetChoices = choices;
      pieceId = choices[0];
    }
    if (this.craneMode) {
      const target = this.snapshot
        ? snapPlacement(
            this.snapshot.world,
            'roof',
            { x: hit.x, z: hit.z, level: this.buildLevel },
            this.rotation,
          )
        : hit;
      this.aim = { x: target.x, z: target.z, level: this.buildLevel };
      this.callbacks.click(target.x, target.z, pieceId);
      return;
    }
    if (this.buildKind || this.demolish) {
      if (this.buildKind && this.snapshot) {
        const target = snapPlacement(
          this.snapshot.world,
          this.buildKind,
          { x: hit.x, z: hit.z, level: this.buildLevel },
          this.rotation,
        );
        if (this.touchBuilding) {
          this.aim = { x: target.x, z: target.z, level: this.buildLevel };
          this.touchBuildReady = false;
        }
        this.callbacks.click(target.x, target.z, pieceId);
      } else if (
        Math.abs(hit.x) <= mapBounds(this.snapshot?.world.map).buildX + 0.5 &&
        Math.abs(hit.z) <= mapBounds(this.snapshot?.world.map).buildZ + 0.5
      )
        this.callbacks.click(Math.round(hit.x), Math.round(hit.z), pieceId);
    } else if (pieceId) {
      this.targetId = pieceId;
      this.callbacks.click(Math.round(hit.x), Math.round(hit.z), pieceId);
    } else if (!this.eyeView) {
      const bounds = mapBounds(this.snapshot?.world.map);
      this.goTo({
        x: clamp(hit.x, -bounds.x, bounds.x),
        z: clamp(hit.z, bounds.back, bounds.front),
      });
    }
  }
  onPointerUp = (e: PointerEvent) => {
    if (this.eyeView && !this.touchBuilding) {
      if (this.lookDrag?.id === e.pointerId) {
        const contact = this.lookDrag;
        this.lookDrag = null;
        // A stationary touch selects at the reticle. Dragging only looks around.
        if (e.pointerType === 'touch' && contact.moved <= 8) this.tap();
      }
      return;
    }
    this.releaseTouch(e);
    if (this.buildDrag?.id === e.pointerId) this.buildDrag = null;
    this.drag = null;
  };
  releaseTouch(e: PointerEvent, cancelled = false) {
    if (cancelled && this.gestures.contacts.has(e.pointerId))
      this.touchBuildReady = false;
    if (
      this.gestures.up(
        e.pointerId,
        e.clientX,
        e.clientY,
        e.timeStamp,
        cancelled,
      )
    ) {
      this.updatePointer(e);
      this.tap();
    }
  }
  onPointerCancel = (e: PointerEvent) => {
    this.releaseTouch(e, true);
    if (this.buildDrag?.id === e.pointerId) this.buildDrag = null;
    this.drag = null;
    if (this.lookDrag?.id === e.pointerId) this.lookDrag = null;
  };
  onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.eyeView) return;
    this.zoom = clamp(this.zoom - e.deltaY * 0.0008, 0.65, 2.5);
    this.updateCamera();
  };
  onKeyDown = (e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target as HTMLElement)?.isContentEditable
    )
      return;
    if (this.menu || this.paused) return;
    this.setTouchInput(false);
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyE',
        'KeyF',
        'KeyX',
        'KeyB',
        'KeyR',
        'KeyQ',
        'Enter',
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (
      this.local &&
      this.snapshot?.world.party?.task.roles.includes(this.local.id) &&
      ['KeyQ', 'KeyR', 'Space', 'KeyE', 'KeyF', 'KeyX', 'KeyB'].includes(e.code)
    ) {
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'Space') this.jump();
    const actions: Record<string, string> = {
      KeyX: 'use',
      KeyE: 'grab',
      KeyF: 'throw',
      KeyB: 'build',
      KeyR: 'rotate',
      KeyQ: 'emote',
      KeyC: 'crane',
      KeyV: 'view',
      Enter: 'confirm',
      Escape: 'escape',
      Delete: 'demolish',
    };
    if (actions[e.code]) this.callbacks.action(actions[e.code]);
    const slot = Number(e.key);
    if (slot >= 1 && slot <= 9) this.callbacks.action(`slot-${slot}`);
  };
  jump() {
    if (
      this.menu ||
      this.paused ||
      this.craneMode ||
      this.snapshot?.world.party?.task.roles.includes(this.local?.id || '')
    )
      return;
    if (this.local && this.physics.jump(this.local.id)) {
      this.jumpAt = performance.now();
      this.local.jump = Date.now() + this.clockOffset;
    }
  }
  nearest(): Piece | undefined {
    if (!this.local || !this.snapshot) return;
    const candidates = this.snapshot.world.pieces.filter(
      (p) =>
        p.kind !== 'roof' &&
        !p.hoisted &&
        !p.supply &&
        !p.heldBy &&
        (!p.physics || Math.hypot(...p.physics.v) < 4) &&
        inReach(this.snapshot!.world, this.local!, p, p.id),
    );
    if (this.eyeView) {
      this.ray.setFromCamera(new T.Vector2(0, 0), this.camera);
      const selectable = [...this.pieces.values()].filter(
        (obj) =>
          !this.snapshot!.world.pieces.find((p) => p.id === obj.userData.id)
            ?.heldBy,
      );
      const hit = this.ray.intersectObjects(
        [...selectable, this.root],
        true,
      )[0];
      let object: T.Object3D | null = hit?.object ?? null;
      while (object && !object.userData.id) object = object.parent;
      return candidates.find((p) => p.id === object?.userData.id);
    }
    return candidates.sort((a, b) =>
      a.id === this.targetId
        ? -1
        : b.id === this.targetId
          ? 1
          : distance(a, this.local!) - distance(b, this.local!),
    )[0];
  }
  interactionTarget() {
    if (this.touchMode && !this.eyeView && this.targetId)
      return this.snapshot?.world.pieces.find((p) => p.id === this.targetId);
    return this.nearest();
  }
  faceMovement(x: number, z: number) {
    if (!this.local || this.eyeView) return;
    const held = this.snapshot?.world.pieces.some(
      (p) => p.heldBy === this.local?.id,
    );
    this.local.angle =
      held && this.carryAim != null ? this.carryAim : Math.atan2(x, z);
  }
  nextTarget() {
    const ids = this.targetChoices.filter((id) =>
      this.snapshot?.world.pieces.some((p) => p.id === id),
    );
    if (!ids.length) return;
    this.targetId = ids[(ids.indexOf(this.targetId || '') + 1) % ids.length];
    this.cancelWork();
  }
  updateBuildPreview() {
    if (this.buildHandle) this.buildHandle.hidden = true;
    for (const obj of [
      this.buildBase,
      this.buildReach,
      this.buildLink,
      ...this.buildJoints,
    ])
      obj.visible = false;
    this.buildPreview = null;
    if (!this.ghost) return;
    this.ghost.visible = false;
    const workTarget = this.work?.part ? this.work.target : null;
    if (
      this.menu ||
      this.paused ||
      !this.snapshot ||
      !this.local ||
      !this.buildKind ||
      (!this.eyeView && !this.hovering && !this.aim && !workTarget)
    )
      return;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit =
      workTarget ||
      (this.touchBuilding && this.aim
        ? this.aim
        : this.eyeView || this.hovering
          ? this.aimOnGround()
          : this.aim);
    if (!hit) return;
    const target = snapPlacement(
      this.snapshot.world,
      this.buildKind,
      { x: hit.x, z: hit.z, level: this.buildLevel },
      this.rotation,
    );
    const error =
      placementError(
        this.snapshot.world,
        this.buildKind,
        target,
        undefined,
        target.rotation,
      ) ||
      (this.snapshot.players.some(
        (p) =>
          p.id !== this.local!.id &&
          playerBlocksPlacement(this.buildKind!, target, target.rotation, p),
      )
        ? 'Another player is standing here. Please leave room.'
        : null);
    const reachable = this.craneMode
      ? craneReach(target, this.snapshot.world.map)
      : this.canWork(target, undefined, {
          kind: this.buildKind,
          rotation: target.rotation,
        });
    this.buildPreview = {
      ...target,
      error:
        error || (this.craneMode && !reachable ? 'Outside crane reach.' : null),
      reachable,
      distance: distance(this.local, target),
    };
    if (this.craneMode && this.hovering)
      this.aim = { x: target.x, z: target.z, level: this.buildLevel };
    const color = this.buildPreview.error
      ? '#e3695b'
      : reachable
        ? '#36bd86'
        : '#f0b83f';
    this.ghost.visible = true;
    this.ghost.position.set(
      target.x,
      pieceBase(
        { id: 'preview', kind: this.buildKind, ...target, placed: true },
        this.snapshot.world.map,
      ) + 0.02,
      target.z,
    );
    this.ghost.rotation.y = (target.rotation * Math.PI) / 2;
    const handle = this.touchBuilding ? this.buildHandlePoint() : null;
    if (handle && this.buildHandle) {
      const r = this.host.getBoundingClientRect();
      this.buildHandle.hidden = false;
      this.buildHandle.style.transform = `translate(${handle.x - r.left}px, ${handle.y - r.top}px) translate(-50%, -50%)`;
    }
    this.ghost.traverse((o) => {
      if (!(o instanceof T.Mesh || o instanceof T.Line)) return;
      for (const material of Array.isArray(o.material)
        ? o.material
        : [o.material]) {
        // Stair direction arrows use unlit materials without an emissive color.
        if (material instanceof T.MeshStandardMaterial) {
          material.emissive.set(color);
          material.emissiveIntensity = 0.38;
        } else if (
          material instanceof T.MeshBasicMaterial ||
          material instanceof T.LineBasicMaterial
        )
          material.color.set(color);
      }
    });
    const bounds = footprint(this.buildKind, target, target.rotation);
    this.buildBase.visible = true;
    this.buildBase.material.color.set(color);
    this.buildBase.position.set(
      (bounds.minX + bounds.maxX) / 2,
      surfaceHeight(target, this.snapshot.world.map) + 0.025,
      (bounds.minZ + bounds.maxZ) / 2,
    );
    this.buildBase.scale.set(
      bounds.maxX - bounds.minX + 0.14,
      bounds.maxZ - bounds.minZ + 0.14,
      1,
    );
    this.buildReach.visible = true;
    this.buildReach.position.set(
      this.local.x,
      (this.local.y ?? 0.43) + 0.025,
      this.local.z,
    );
    this.buildLink.visible = true;
    this.buildLink.material.color.set(color);
    this.buildLink.geometry.setFromPoints([
      new T.Vector3(this.local.x, (this.local.y ?? 0.43) + 0.12, this.local.z),
      new T.Vector3(
        target.x,
        surfaceHeight(target, this.snapshot.world.map) + 0.12,
        target.z,
      ),
    ]);
    this.buildLink.computeLineDistances();
    joinsAt(this.snapshot.world, this.buildKind, target).forEach((pos, i) => {
      const marker = this.buildJoints[i];
      if (marker) {
        marker.visible = true;
        marker.position.set(
          pos.x,
          surfaceHeight(target, this.snapshot?.world.map) + 0.18,
          pos.z,
        );
      }
    });
  }
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    if (document.hidden) {
      this.last = now;
      return;
    }
    this.applyResize();
    if (this.last && now - this.last < 1000) {
      this.frameDurations.push(now - this.last);
      if (this.frameDurations.length > 180) this.frameDurations.shift();
    }
    const dt = Math.min((now - (this.last || now)) / 1000, 0.05);
    this.last = now;
    this.time = now / 1000;
    const serverNow = Date.now() + this.clockOffset;
    const task = this.snapshot?.world.party?.task;
    const crewRole =
      this.local && task ? task.roles.indexOf(this.local.id) : -1;
    const crewTouch = this.eyeView
      ? eyeMovement(this.touch.x, this.touch.z, this.eyeYaw)
      : cameraMovement(this.touch.x, this.touch.z, this.yaw);
    this.crewInput =
      crewRole >= 0 && !this.paused
        ? {
            x:
              Number(this.keys.has('KeyD')) -
              Number(this.keys.has('KeyA')) +
              crewTouch.x,
            z:
              Number(this.keys.has('KeyS')) -
              Number(this.keys.has('KeyW')) +
              crewTouch.z,
            turn: Number(this.keys.has('KeyR')) - Number(this.keys.has('KeyQ')),
          }
        : { x: 0, z: 0, turn: 0 };
    if (crewRole >= 0 && this.local && task) {
      const point = roleAnchor(task, crewRole),
        body = this.physics.players.get(this.local.id);
      if (body) {
        body.position.set(point.x, 0.43 + 0.9, point.z);
        body.velocity.setZero();
      }
      Object.assign(this.local, point);
    }
    if (
      this.local &&
      !this.menu &&
      !this.paused &&
      !this.craneMode &&
      crewRole < 0
    ) {
      const sx =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
        this.touch.x;
      const sz =
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) +
        this.touch.z;
      let dx = sx * Math.cos(this.yaw) + sz * Math.sin(this.yaw),
        dz = -sx * Math.sin(this.yaw) + sz * Math.cos(this.yaw);
      if (this.eyeView) {
        const direction = eyeMovement(sx, sz, this.eyeYaw);
        dx = direction.x;
        dz = direction.z;
        this.local.angle = this.eyeYaw;
      }
      if (sx || sz) this.cancelWork();
      while (
        this.route[0] &&
        distance(this.route[0], this.local) < 0.2 &&
        Math.abs(
          (this.route[0].y ?? this.local.y ?? 0.43) - (this.local.y ?? 0.43),
        ) < 0.55
      )
        this.route.shift();
      if (this.route[0]) {
        dx = this.route[0].x - this.local.x;
        dz = this.route[0].z - this.local.z;
      }
      const carrying = this.snapshot?.world.pieces.find(
        (p) => p.heldBy === this.local!.id,
      );
      const weight = carrying ? pieceShape(carrying.kind).mass : 0;
      const len = Math.hypot(dx, dz),
        speed =
          (this.sprint ||
          this.keys.has('ShiftLeft') ||
          this.keys.has('ShiftRight')
            ? 6.4
            : 4.3) * (weight ? Math.max(0.55, 1 - weight / 140) : 1);
      if (now - this.bonkAt > 650) {
        const amount = this.route.length ? 1 : Math.min(1, len);
        this.physics.move(
          this.local.id,
          len > 0.02 ? (dx / len) * speed * amount : 0,
          len > 0.02 ? (dz / len) * speed * amount : 0,
        );
        if (len > 0.02) this.faceMovement(dx, dz);
        this.physics.players
          .get(this.local.id)
          ?.quaternion.setFromEuler(0, this.local.angle, 0);
      }
      if (
        this.work &&
        (!this.route.length ||
          this.canWork(this.work.target, this.work.ignoreId, this.work.part))
      ) {
        const work = this.work;
        this.cancelWork();
        this.physics.move(this.local.id, 0, 0);
        if (this.canWork(work.target, work.ignoreId, work.part)) {
          this.local.angle = Math.atan2(
            work.target.x - this.local.x,
            work.target.z - this.local.z,
          );
          this.toolAt = now;
          work.run();
        } else
          this.callbacks.feedback(
            'The destination is blocked. Move a little closer.',
          );
      }
      if (this.work && now - this.work.started > 18000) {
        this.cancelWork();
        this.callbacks.feedback(
          'The path is blocked. Make room or walk closer yourself.',
        );
      }
      if (!this.route.length && !this.work) this.workLabel = '';
    }
    if (!this.buildKind && !this.craneMode && this.local) {
      const activeLevel = actorLevel(this.local);
      if (Math.abs(-this.plane.constant - (0.43 + activeLevel * 3)) > 0.2) {
        this.plane.constant = -(0.43 + activeLevel * 3);
        this.updateCamera();
      }
    }
    if (
      !this.snapshot?.world.party ||
      !['lobby', 'inspection', 'results'].includes(
        this.snapshot.world.party.phase,
      )
    )
      this.physics.step(dt);
    if (this.local && !this.menu) {
      const p = this.physics.playerPosition(this.local.id);
      if (p) Object.assign(this.local, p);
      if (now - this.sendAt > 100) {
        this.sendAt = now;
        this.callbacks.move(
          this.local.x,
          this.local.z,
          this.local.angle,
          this.local.jump || 0,
          this.local.y ?? 0.43,
        );
      }
    }
    if (this.snapshot) {
      for (const p of this.snapshot.players) {
        const obj = this.workers.get(p.id)!;
        obj.visible = !(this.eyeView && p.id === this.local?.id);
        let data = p.id === this.local?.id ? this.local : p;
        const displayRole = task?.roles.indexOf(p.id) ?? -1;
        if (task && displayRole >= 0)
          data = {
            ...data,
            ...roleAnchor(task, displayRole),
            y:
              task.kind === 'ladder' && (displayRole === 1 || task.solo)
                ? task.y
                : 0.43,
          };
        if (!obj.userData.voiceMouth) {
          const mouth = new T.Mesh(
            new T.SphereGeometry(0.07, 8, 6),
            new T.MeshBasicMaterial({ color: '#534034' }),
          );
          mouth.position.set(0, 1.27, 0.26);
          obj.userData.body.add(mouth);
          obj.userData.voiceMouth = mouth;
        }
        obj.userData.voiceMouth.scale.y = this.speaking.has(p.id)
          ? 1.1 + Math.sin(now / 65) * 0.6
          : 0.22;
        const delta = Math.hypot(
          obj.position.x - data.x,
          obj.position.z - data.z,
        );
        obj.position.x = T.MathUtils.damp(obj.position.x, data.x, 17, dt);
        obj.position.z = T.MathUtils.damp(obj.position.z, data.z, 17, dt);
        const angleDelta = Math.atan2(
          Math.sin(data.angle - obj.rotation.y),
          Math.cos(data.angle - obj.rotation.y),
        );
        obj.rotation.y += angleDelta * Math.min(1, dt * 15);
        obj.position.y = T.MathUtils.damp(
          obj.position.y,
          data.y ?? 0.43,
          22,
          dt,
        );
        const bonk = [...this.snapshot.world.events]
          .reverse()
          .find(
            (e) =>
              e.type === 'bonk' &&
              e.target === p.id &&
              serverNow >= e.at &&
              serverNow - e.at < 1100,
          );
        animateWorker(obj, this.time, {
          lag: delta,
          bonked: bonk ? clamp((serverNow - bonk.at) / 1000, 0, 1) : null,
          holding:
            displayRole >= 0 ||
            this.snapshot.world.pieces.some((piece) => piece.heldBy === p.id),
          hammering: p.id === this.local?.id && now - this.toolAt < 650,
        });
      }
      for (const p of this.snapshot.world.pieces) {
        const obj = this.pieces.get(p.id)!;
        obj.rotation.set(0, (p.rotation * Math.PI) / 2, 0);
        const holder = p.heldBy ? this.workers.get(p.heldBy) : null;
        if (p.hoisted && this.snapshot.world.crane) {
          const crane = this.snapshot.world.crane;
          const pose = cranePose(crane, serverNow);
          obj.position.set(pose.x, pose.y, pose.z);
          obj.rotation.y = pose.rotation;
        } else if (p.supply) {
          obj.position.set(p.x, roofBase(p, this.snapshot.world.map), p.z);
        } else if (holder) {
          obj.position.copy(holder.position);
          obj.position.y += 2.35 - pieceShape(p.kind).center;
          obj.rotation.y = holder.rotation.y;
          obj.scale.setScalar(1);
        } else {
          obj.scale.setScalar(1);
          const pose = this.physics.pose(p.id);
          if (pose) {
            obj.position.set(pose.x, pose.y, pose.z);
            obj.quaternion.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
          }
        }
        const use = PROP_USES[p.kind];
        if (use)
          animateHomeModel(
            obj,
            p.kind,
            p.usedAt === undefined ? -1 : serverNow - p.usedAt,
            use.duration,
          );
        if (use && p.usedAt !== undefined && !p.heldBy && !p.hoisted) {
          const age = serverNow - p.usedAt,
            duration = use.duration;
          if (age >= 0 && age < duration) {
            const envelope = Math.sin((Math.PI * age) / duration);
            if (p.kind === 'washer')
              obj.rotation.z += Math.sin(age / 45) * 0.035 * envelope;
            else if (p.kind === 'duck')
              obj.scale.set(
                1 + 0.12 * envelope,
                1 - 0.2 * envelope,
                1 + 0.08 * envelope,
              );
            else obj.rotation.z += Math.sin(age / 110) * 0.018 * envelope;
          }
        }
      }
    }
    if (this.firstPerson) this.updateCamera();
    this.updateBuildPreview();
    this.updateStoreys(dt);
    this.updateCrane(serverNow);
    const nearest =
      !this.menu && !this.paused ? this.interactionTarget() : undefined;
    this.focus.visible = !!nearest && !this.buildKind && !this.demolish;
    if (nearest) {
      const pose = this.physics.pose(nearest.id);
      this.focus.position.set(
        pose?.x ?? nearest.x,
        (pose?.y ?? 0.43) + 0.06,
        pose?.z ?? nearest.z,
      );
    }
    const outlined = this.pieces.get(this.selectionIds[0] || nearest?.id || '');
    this.selectionOutline.visible =
      !!outlined &&
      this.touchMode &&
      !this.menu &&
      !this.paused &&
      !this.buildKind;
    if (outlined && this.selectionOutline.visible) {
      this.selectionOutline.setFromObject(outlined);
      this.selectionOutline.material.color.set(
        this.selectionIds.length ? this.selectionColor : '#ffc83d',
      );
    }
    const held = this.snapshot?.world.pieces.find(
      (p) => p.heldBy === this.local?.id,
    );
    this.throwGuide.visible = !!held && !this.menu && !this.paused;
    this.dropPreview =
      held && this.local && !this.menu && !this.paused
        ? carryPlacement(
            this.snapshot!.world,
            this.local,
            held,
            this.snapshot!.players.map((p) =>
              p.id === this.local?.id ? this.local : p,
            ),
          )
        : null;
    this.dropBase.visible = !!this.dropPreview && this.touchMode;
    if (this.dropPreview && held) {
      const target = this.dropPreview;
      const bounds = footprint(held.kind, target, target.rotation);
      this.dropBase.material.color.set(target.error ? '#a32925' : '#36bd86');
      this.dropBase.position.set(
        (bounds.minX + bounds.maxX) / 2,
        pieceBase(
          { ...held, ...target, placed: true },
          this.snapshot!.world.map,
        ) + 0.04,
        (bounds.minZ + bounds.maxZ) / 2,
      );
      this.dropBase.scale.set(
        bounds.maxX - bounds.minX + 0.12,
        bounds.maxZ - bounds.minZ + 0.12,
        1,
      );
    }
    if (held && this.local) {
      const p = this.local,
        points = [];
      for (let i = 0; i <= 18; i++) {
        const t = i * 0.045;
        const y = Math.max(0.2, (p.y ?? 0.43) + 2.35 + 5.2 * t - 10 * t * t);
        points.push(
          new T.Vector3(
            p.x + Math.sin(p.angle) * (1 + 8.4 * t),
            y,
            p.z + Math.cos(p.angle) * (1 + 8.4 * t),
          ),
        );
      }
      this.throwGuide.geometry.setFromPoints(points);
      this.throwGuide.computeLineDistances();
    }

    this.effects = this.effects.filter((effect) => {
      const age = (now - effect.at) / 1000;
      if (age > (effect.type === 'label' ? 2.2 : 1)) {
        this.scene.remove(effect.mesh);
        this.disposeLabel(effect.mesh);
        if (effect.mesh instanceof T.Mesh) {
          disposeGeometry(effect.mesh.geometry);
          (effect.mesh.material as T.Material).dispose();
        }
        return false;
      }
      if (effect.velocity) {
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.velocity.y -= dt * 6;
        effect.mesh.rotation.x += dt * 3;
      } else effect.mesh.position.y += dt * 0.32;
      return true;
    });
    if (this.snapshot) {
      this.partyView.update(this.snapshot, serverNow, this.local?.id);
      this.inspectionView.update(this.snapshot, serverNow);
      this.swapView.update(this.snapshot);
    }
    if (this.snapshot?.world.party?.phase === 'inspection') this.updateCamera();
    if (this.frameConsumers.size && now - this.exportAt >= 1000 / 30) {
      this.exportAt = now;
      this.publicFrame((canvas) => {
        for (const consumer of this.frameConsumers) consumer(canvas);
      }, this.exportNames);
    }
    this.renderer.render(this.scene, this.camera);
  };
  publicFrame(consumer: (canvas: HTMLCanvasElement) => void, names = true) {
    const hidden: { object: T.Object3D; visible: boolean }[] = [];
    const hide = (object: T.Object3D) => {
      hidden.push({ object, visible: object.visible });
      object.visible = false;
    };
    hide(this.partyView.mission);
    if (!names)
      for (const worker of this.workers.values())
        worker.traverse((object) => {
          if (object.type === 'Sprite') hide(object);
        });
    try {
      this.renderer.render(this.scene, this.camera);
      consumer(this.renderer.domElement);
    } finally {
      for (const entry of hidden) entry.object.visible = entry.visible;
    }
  }
  captureFocus() {
    const p = this.snapshot?.world.party,
      moment = p?.inspection?.moments.at(-1);
    const point =
      moment && Date.now() + this.clockOffset - moment.at < 7000
        ? moment
        : p?.task || this.local || { x: 0, z: 0 };
    const screen = new T.Vector3(point.x, 1.3, point.z).project(this.camera);
    return {
      x: Math.max(0, Math.min(1, (screen.x + 1) / 2)),
      y: Math.max(0, Math.min(1, (1 - screen.y) / 2)),
    };
  }
  updateStoreys(dt: number) {
    if (!this.snapshot) return;
    for (const piece of this.snapshot.world.pieces) {
      const object = this.pieces.get(piece.id);
      if (!object) continue;
      object.visible = true;
      if (piece.kind !== 'roof')
        fadeStorey(object, onOtherStorey(piece, this.focusedLevel));
    }
    const roofs = this.snapshot.world.pieces.filter(
      (p) => p.kind === 'roof' && p.placed,
    );
    const points: { x: number; z: number }[] = [];
    if (!this.menu && !this.paused) {
      if (this.local) points.push(this.local);
      if (this.work) points.push(this.work.target);
      if (this.aim) points.push(this.aim);
      if (this.buildPreview) points.push(this.buildPreview);
      if (this.hovering) {
        this.ray.setFromCamera(this.pointer, this.camera);
        const hit = this.ray.ray.intersectPlane(this.plane, this.target);
        if (hit) points.push(hit);
      }
    }
    const roofHovered =
      this.hovering &&
      !this.menu &&
      !this.paused &&
      this.ray.intersectObjects(
        roofs.map((p) => this.pieces.get(p.id)!).filter(Boolean),
        true,
      ).length > 0;
    const fade =
      !this.craneMode &&
      !this.demolish &&
      (roofHovered ||
        roofs.some((roof) =>
          points.some((point) =>
            underRoof(roof, point, this.buildKind ? 1 : 0.3),
          ),
        ));
    for (const p of this.snapshot.world.pieces)
      if (p.kind === 'roof') {
        const obj = this.pieces.get(p.id);
        if (obj)
          fadeRoof(
            obj,
            onOtherStorey(p, this.focusedLevel) ||
              (!this.menu &&
                !this.buildKind &&
                !this.craneMode &&
                !this.paintMode &&
                fade &&
                p.placed &&
                !this.eyeView),
            dt,
          );
      }
  }
  updateCrane(now: number) {
    const rig = this.root.userData.craneRig as T.Group | undefined;
    if (!rig) return;
    const crane = this.snapshot?.world.crane;
    const active = crane ? cranePose(crane, now) : null;
    const pose = active
      ? { x: active.hookX, z: active.hookZ, hookY: active.hookY }
      : parkedCranePose(this.snapshot?.world ?? {}, now);
    const base = craneBase(this.snapshot?.world.map);
    const dx = pose.x - base.x,
      dz = pose.z - base.z;
    rig.rotation.y = Math.atan2(dz, -dx);
    const hook = this.root.userData.hook as T.Group;
    hook.position.x = -Math.hypot(dx, dz);
    const cable = hook.userData.cable as T.Mesh,
      block = hook.userData.block as T.Group;
    const length = Math.max(0.25, 11.9 - pose.hookY);
    cable.scale.y = length;
    cable.position.y = -length / 2;
    block.position.y = -length;
    block.rotation.z = crane ? 0 : Math.sin(this.time * 0.8) * 0.025;
  }
  photo() {
    this.applyResize();
    this.renderer.render(this.scene, this.camera);
    const canvas = document.createElement('canvas');
    canvas.width = this.renderer.domElement.width;
    canvas.height = this.renderer.domElement.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(this.renderer.domElement, 0, 0);
    const size = Math.round(canvas.width * 0.032);
    ctx.font = `900 ${size}px Arial`;
    ctx.fillStyle = '#293c3b';
    ctx.fillText('PERMIT PENDING', size, canvas.height - size * 1.8);
    ctx.font = `bold ${Math.round(size * 0.47)}px Arial`;
    ctx.fillText(
      'Fits. Wobbles. Plenty of ventilation.',
      size,
      canvas.height - size * 0.85,
    );
    const a = document.createElement('a');
    a.download = 'permit-pending-site.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
  thumbnails(kinds: readonly ItemKind[]) {
    const result: Record<string, string> = {};
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight('#fff7e8', '#8e9e89', 3));
    const light = new T.DirectionalLight('#ffffff', 4);
    light.position.set(-3, 6, 4);
    scene.add(light);
    const camera = new T.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 30);
    camera.position.set(4, 3.5, 5);
    camera.lookAt(0, 1.3, 0);
    const target = new T.WebGLRenderTarget(144, 144);
    for (const kind of kinds) {
      const piece = makePiece(kind);
      if (kind === 'roof') piece.position.y = -2;
      scene.add(piece);
      this.renderer.setRenderTarget(target);
      this.renderer.setClearColor('#eaf0e4', 0);
      this.renderer.render(scene, camera);
      const buffer = new Uint8Array(144 * 144 * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, 144, 144, buffer);
      const canvas = document.createElement('canvas');
      canvas.width = 144;
      canvas.height = 144;
      const ctx = canvas.getContext('2d')!;
      const data = ctx.createImageData(144, 144);
      for (let y = 0; y < 144; y++)
        data.data.set(
          buffer.subarray((143 - y) * 144 * 4, (144 - y) * 144 * 4),
          y * 144 * 4,
        );
      ctx.putImageData(data, 0, 0);
      result[kind] = canvas.toDataURL();
      scene.remove(piece);
      disposePiece(piece);
    }
    this.renderer.setRenderTarget(null);
    target.dispose();
    return result;
  }
  dispose() {
    this.releaseLook();
    cancelAnimationFrame(this.raf);
    this.abort.abort();
    this.resize.disconnect();
    const geometries = new Set<T.BufferGeometry>(),
      mats = new Set<T.Material>();
    this.scene.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Line) {
        geometries.add(o.geometry);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          mats.add(m),
        );
      }
    });
    geometries.forEach((g) => disposeGeometry(g));
    mats.forEach((m) => m.dispose());
    this.disposeLabel(this.scene);
    this.partyView.dispose();
    this.inspectionView.dispose();
    this.swapView.dispose();
    this.frameConsumers.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.buildHandle?.remove();
  }
}
