import { disposeGeometry } from '../../shared/rendering/primitives';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  bedKey,
  clamp,
  dimensions,
  emptyInventory,
  FLOOR,
  freshWorld,
  inReach,
  placementError,
  raceActive,
  recipeStatus,
  START,
  STATIONS,
  type Action,
  type Part,
  type Placement,
  type Position,
  type Snapshot,
  type Tool,
} from './model';
import {
  box,
  createMaterials,
  createSite,
  makeBuilder,
  makePart,
  stepBuilder,
} from './world-view';
import { placementAtSurface, previewShape } from './placement';
import { blocksWalker, insideSolid } from './site-layout';
import { makeHeldRig } from './detailed-props';

export type Aim = {
  label: string;
  detail: string;
  valid: boolean;
  station: string | null;
  status?: 'ready' | 'blocked' | 'idle';
  orientation?: string;
  action?: string;
};
type Callbacks = {
  action: (a: Action) => void;
  aim: (a: Aim) => void;
  lock: (locked: boolean) => void;
  tool: (t: Tool) => void;
  error: (s: string) => void;
};
const TOOLS: Tool[] = ['brick', 'mortar', 'beam', 'roof', 'remove'];
const INGREDIENTS = { cement: 'Cement', sand: 'Sand', water: 'Water' };
export class FirstPersonScene {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(70, 1, 0.04, 200);
  private viewScene = new T.Scene();
  private viewCamera = new T.PerspectiveCamera(70, 1, 0.04, 10);
  private viewSun = new T.DirectionalLight(0xffe1ab, 3.4);
  private viewRotation = new T.Quaternion();
  private mats = createMaterials();
  private site: ReturnType<typeof createSite>;
  private environment: T.WebGLRenderTarget;
  private sunlight: T.DirectionalLight;
  private resize: ResizeObserver;
  private events = new AbortController();
  private raf = 0;
  private last = 0;
  private stopped = false;
  private playing = false;
  private entered = false;
  private fallback = false;
  private keys = new Set<string>();
  private snapshot: Snapshot = {
    world: freshWorld(),
    players: [],
    code: '',
    host: '',
    now: Date.now(),
    version: 0,
  };
  private playerId = '';
  private serverOffset = 0;
  private position: Position = { ...START };
  private vy = 0;
  private tool: Tool = 'brick';
  private rotation = 0;
  private joystick = { x: 0, y: 0 };
  private partMeshes = new Map<string, T.Mesh>();
  private bedMeshes = new Map<string, T.Mesh>();
  private avatars = new Map<string, ReturnType<typeof makeBuilder>>();
  private hand = new T.Group();
  private handItem = new T.Group();
  private handKey = '';
  private swing = 0;
  private ghost: T.Mesh;
  private ghostEdges: T.LineSegments;
  private ghostKind = '';
  private ray = new T.Raycaster();
  private placement: Placement | null = null;
  private targetPart: Part | null = null;
  private station: string | null = null;
  private aimKey = '';
  private canUse = false;
  private actionError = '';
  private siteAction: 'race' | 'horn' | null = null;
  private pointer: {
    id: number;
    x: number;
    y: number;
    distance: number;
    dragged: boolean;
    usable: boolean;
  } | null = null;
  private revision = -1;
  private resizePending = true;
  private renderedSize = { width: 0, height: 0, ratio: 0 };
  constructor(
    private mount: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Three-dimensional Brick by Hand building site',
    );
    this.renderer.domElement.tabIndex = 0;
    this.mount.appendChild(this.renderer.domElement);
    this.scene.background = new T.Color(0xaccbd1);
    this.scene.fog = new T.FogExp2(0xc7d0be, 0.012);
    const sky = new T.Mesh(
      new T.SphereGeometry(140, 24, 16),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          topColor: { value: new T.Color(0x77adcb) },
          bottomColor: { value: new T.Color(0xe5dbc0) },
        },
        vertexShader:
          'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:
          'uniform vec3 topColor;uniform vec3 bottomColor;varying vec3 vP;void main(){float h=clamp(normalize(vP).y*.9+.08,0.,1.);gl_FragColor=vec4(mix(bottomColor,topColor,pow(h,.6)),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
      }),
    );
    this.scene.add(sky);
    const pmrem = new T.PMREMGenerator(this.renderer),
      roomEnvironment = new RoomEnvironment();
    this.environment = pmrem.fromScene(roomEnvironment, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.35;
    roomEnvironment.dispose();
    pmrem.dispose();
    this.viewScene.environment = this.environment.texture;
    this.viewScene.environmentIntensity = 0.35;
    this.viewScene.add(
      new T.HemisphereLight(0xc4dfe6, 0x7b7350, 1.7),
      this.viewSun,
    );
    this.scene.add(new T.HemisphereLight(0xc4dfe6, 0x7b7350, 1.7));
    this.sunlight = new T.DirectionalLight(0xffe1ab, 3.4);
    this.sunlight.position.set(-13, 17, 8);
    this.sunlight.castShadow = true;
    this.sunlight.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sunlight.shadow.camera, {
      left: -18,
      right: 18,
      top: 18,
      bottom: -18,
      near: 1,
      far: 60,
    });
    this.sunlight.shadow.bias = -0.00015;
    this.sunlight.shadow.normalBias = 0.025;
    this.scene.add(this.sunlight);
    this.site = createSite(this.scene, this.mats);
    this.camera.position.set(11, 8, 12);
    this.camera.lookAt(-1.2, 0.15, -1);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.ghost = new T.Mesh(
      new T.BoxGeometry(0.5, 0.25, 0.25),
      new T.MeshBasicMaterial({
        color: 0xa9d28c,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    this.ghostEdges = new T.LineSegments(
      new T.EdgesGeometry(this.ghost.geometry),
      new T.LineBasicMaterial({
        color: 0x28664b,
        transparent: true,
        opacity: 0.95,
        toneMapped: false,
      }),
    );
    this.ghost.add(this.ghostEdges);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.viewScene.add(this.hand);
    this.hand.add(this.handItem);
    this.hand.visible = false;
    const signal = this.events.signal,
      canvas = this.renderer.domElement;
    window.addEventListener('keydown', this.keydown, { signal });
    window.addEventListener('keyup', this.keyup, { signal });
    window.addEventListener('blur', this.clearInput, { signal });
    document.addEventListener('visibilitychange', this.clearInput, { signal });
    document.addEventListener('pointerlockchange', this.lockchange, { signal });
    document.addEventListener('pointerlockerror', this.lockerror, { signal });
    document.addEventListener('mousemove', this.mousemove, { signal });
    canvas.addEventListener('pointerdown', this.pointerdown, { signal });
    window.addEventListener('pointermove', this.pointermove, { signal });
    window.addEventListener('pointerup', this.pointerup, { signal });
    window.addEventListener('pointercancel', this.pointercancel, { signal });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), {
      signal,
    });
    this.resize = new ResizeObserver(() => {
      this.resizePending = true;
    });
    this.resize.observe(mount);
    this.raf = requestAnimationFrame(this.frame);
  }
  get pose(): Position {
    return { ...this.position };
  }
  inspect() {
    return {
      playing: this.playing,
      pose: this.pose,
      tool: this.tool,
      rotation: this.rotation,
      station: this.station,
      placement: this.placement,
      targetPart: this.targetPart?.id ?? null,
      canUse: this.canUse,
      feedback: this.actionError,
      render: {
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      },
      ghost: {
        visible: this.ghost.visible,
        kind: this.ghostKind,
        y: this.ghost.position.y,
        size: (this.ghost.geometry as T.BoxGeometry).parameters,
      },
    };
  }
  get locked() {
    return document.pointerLockElement === this.renderer.domElement;
  }
  private resizeCanvas = () => {
    const { width, height } = this.mount.getBoundingClientRect(),
      ratio = this.renderer.getPixelRatio();
    this.resizePending = false;
    if (
      !width ||
      !height ||
      (width === this.renderedSize.width &&
        height === this.renderedSize.height &&
        ratio === this.renderedSize.ratio)
    )
      return;
    this.renderer.setSize(width, height);
    this.renderedSize = { width, height, ratio };
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = width / height;
    this.viewCamera.updateProjectionMatrix();
    this.handKey = '';
    this.updateHand();
  };
  private clearInput = () => {
    this.keys.clear();
    this.joystick = { x: 0, y: 0 };
    this.pointer = null;
  };
  private keydown = (e: KeyboardEvent) => {
    if (
      !this.playing ||
      /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName)
    )
      return;
    if (
      [
        'Space',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE') this.interact();
    if (e.code === 'KeyF') this.use();
    if (e.code === 'KeyX') this.emptyMixer();
    if (e.code === 'KeyR') this.rotate();
    if (e.code === 'Space') this.jump();
    if (e.code === 'KeyQ') this.shout();
    const slot = Number(e.key) - 1;
    if (slot >= 0 && slot < 5) this.callbacks.tool(TOOLS[slot]);
  };
  private keyup = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private lockchange = () => {
    this.clearInput();
    this.callbacks.lock(this.locked);
  };
  private lockerror = () => {
    this.fallback = true;
    this.callbacks.error(
      'Mouse capture unavailable: drag to look around, F to build.',
    );
  };
  private mousemove = (e: MouseEvent) => {
    if (this.playing && this.locked) this.look(e.movementX, e.movementY);
  };
  private pointerdown = (e: PointerEvent) => {
    if (!this.playing || e.button !== 0 || this.pointer) return;
    if (this.locked) {
      this.use();
      return;
    }
    const usable = this.fallback && e.pointerType === 'mouse';
    this.pointer = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      distance: 0,
      dragged: false,
      usable,
    };
    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      /* Window listeners retain the owned contact. */
    }
    if (e.pointerType === 'mouse' && !this.fallback) this.captureMouse();
  };
  private pointermove = (e: PointerEvent) => {
    if (!this.playing || this.locked || this.pointer?.id !== e.pointerId)
      return;
    const dx = e.clientX - this.pointer.x,
      dy = e.clientY - this.pointer.y;
    this.pointer.distance += Math.hypot(dx, dy);
    if (this.pointer.distance > 3) this.pointer.dragged = true;
    this.look(dx, dy);
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };
  private pointerup = (e: PointerEvent) => {
    if (this.pointer?.id === e.pointerId) {
      if (!this.pointer.dragged && this.pointer.usable && !this.locked)
        this.use();
      this.pointer = null;
    }
  };
  private pointercancel = (e: PointerEvent) => {
    if (this.pointer?.id === e.pointerId) this.pointer = null;
  };
  captureMouse() {
    if (
      !this.playing ||
      matchMedia('(pointer: coarse), (max-width: 900px)').matches
    )
      return;
    try {
      const result = this.renderer.domElement.requestPointerLock?.();
      result?.catch(() => this.lockerror());
    } catch {
      this.lockerror();
    }
  }
  setPlaying(value: boolean) {
    this.playing = value;
    this.clearInput();
    this.hand.visible = value;
    if (!value) {
      this.ghost.visible = false;
      if (this.locked) document.exitPointerLock();
    }
    if (value) {
      this.entered = true;
      this.updateCamera();
    }
  }
  setSnapshot(snapshot: Snapshot, id: string) {
    const first = !this.playerId;
    this.playerId = id;
    this.snapshot = snapshot;
    this.serverOffset = snapshot.now - Date.now();
    if (first) {
      const self = snapshot.players.find((p) => p.id === id);
      if (self)
        this.position = {
          x: self.x,
          y: self.y,
          z: self.z,
          yaw: self.yaw,
          pitch: self.pitch,
        };
    }
    if (this.revision !== snapshot.world.revision) {
      this.revision = snapshot.world.revision;
      this.updateConstruction();
    }
    for (const p of snapshot.players)
      if (p.id !== id && !this.avatars.has(p.id)) {
        const avatar = makeBuilder(p.name, p.color, this.mats);
        avatar.group.position.set(p.x, p.y - 1.68, p.z);
        this.avatars.set(p.id, avatar);
        this.scene.add(avatar.group);
      }
    for (const [pid, avatar] of this.avatars)
      if (!snapshot.players.some((p) => p.id === pid)) {
        this.scene.remove(avatar.group);
        this.disposeObject(avatar.group, false);
        this.avatars.delete(pid);
      }
    this.updateHand();
  }
  selectTool(tool: Tool) {
    this.tool = tool;
    if (tool !== 'beam' && this.rotation === 2) this.rotation = 0;
    this.updateHand();
    this.aimKey = '';
    if (this.playing) this.updateAim();
  }
  rotate() {
    this.rotation = (this.rotation + 1) % (this.tool === 'beam' ? 3 : 2);
    this.aimKey = '';
    if (this.playing) this.updateAim();
  }
  shout() {
    if (this.playing) this.callbacks.action({ type: 'shout' });
  }
  moveStick(x: number, y: number) {
    this.joystick = { x, y };
  }
  look(dx: number, dy: number) {
    if (!this.playing) return;
    this.position.yaw -= dx * 0.0025;
    this.position.pitch = clamp(this.position.pitch - dy * 0.0025, -1.42, 1.42);
  }
  jump() {
    if (
      this.playing &&
      Math.abs(
        this.position.y - this.floorAt(this.position.x, this.position.z) - 1.68,
      ) < 0.08
    )
      this.vy = 5.4;
  }
  interact() {
    if (!this.playing) return;
    this.updateCamera();
    this.updateAim();
    if (this.siteAction && this.canUse)
      this.callbacks.action({ type: this.siteAction });
    else if (this.station) {
      this.callbacks.action(
        this.station === 'mixer'
          ? { type: 'mixer' }
          : { type: 'supply', station: this.station },
      );
      this.swing = 1;
    } else
      this.callbacks.error(
        this.actionError || 'Look at a supply station and move closer.',
      );
  }
  emptyMixer() {
    if (this.playing && this.station === 'mixer')
      this.callbacks.action({ type: 'empty-mixer' });
  }
  use() {
    if (!this.playing) return;
    this.updateCamera();
    this.updateAim();
    if (this.station || this.siteAction) {
      this.interact();
      return;
    }
    if (this.tool === 'remove' && this.targetPart && this.canUse)
      this.callbacks.action({ type: 'remove', id: this.targetPart.id });
    else if (this.placement && this.canUse && this.tool !== 'remove')
      this.callbacks.action(
        this.tool === 'mortar'
          ? { type: 'mortar', placement: this.placement }
          : { type: 'place', kind: this.tool, placement: this.placement },
      );
    else {
      this.callbacks.error(
        this.actionError || 'Look at the foundation or a nearby building part.',
      );
      return;
    }
    this.swing = 1;
  }
  quality(low: boolean) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.75));
    this.renderer.shadowMap.enabled = !low;
    this.resizePending = true;
  }
  private updateHand() {
    const inv =
        this.snapshot.world.inventories[this.playerId] ?? emptyInventory(),
      key = `${this.tool}:${inv.carrying}:${this.tool === 'mortar' && !inv.carrying ? inv.mortar : ''}`;
    if (key === this.handKey) return;
    this.handKey = key;
    this.disposeObject(this.handItem, false);
    this.handItem.clear();
    this.handItem.add(
      makeHeldRig(this.tool, inv, this.mats, this.camera.aspect),
    );
  }
  private updateConstruction() {
    const world = this.snapshot.world;
    for (const [id, mesh] of this.partMeshes)
      if (!world.parts.some((p) => p.id === id)) {
        this.scene.remove(mesh);
        this.disposeObject(mesh, false);
        this.partMeshes.delete(id);
      }
    for (const p of world.parts) {
      let mesh = this.partMeshes.get(p.id);
      if (!mesh) {
        mesh = makePart(p.kind, this.mats, p.rotation);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.y = p.rotation === 2 ? 0 : (p.rotation * Math.PI) / 2;
        mesh.userData.partId = p.id;
        this.scene.add(mesh);
        this.partMeshes.set(p.id, mesh);
      }
      const seam = mesh.getObjectByName('joint');
      if (p.bonded && p.kind === 'brick' && !seam) {
        const joint = box(
          mesh,
          [0.5, 0.027, 0.25],
          [0, -0.113, 0],
          this.mats.mortar,
          false,
        );
        joint.name = 'joint';
        for (const x of [-0.248, 0.248])
          box(mesh, [0.009, 0.224, 0.248], [x, 0, 0], this.mats.mortar, false);
      }
      if (p.mortaredTop && !mesh.getObjectByName('mortar-top')) {
        const top = box(
          mesh,
          [0.496, 0.02, 0.246],
          [0, 0.124, 0],
          this.mats.mortar,
          false,
        );
        top.name = 'mortar-top';
        for (const z of [-0.06, 0.035])
          box(
            top,
            [0.46, 0.004, 0.017],
            [0, 0.011, z],
            this.mats.mortar,
            false,
          );
      }
    }
    for (const [key, mesh] of this.bedMeshes)
      if (!world.beds.some((b) => b.key === key)) {
        this.scene.remove(mesh);
        disposeGeometry(mesh.geometry);
        this.bedMeshes.delete(key);
      }
    for (const b of world.beds)
      if (!this.bedMeshes.has(b.key)) {
        const mesh = box(
          this.scene,
          [0.49, 0.024, 0.245],
          [b.x, b.y - 0.114, b.z],
          this.mats.mortar,
          false,
        );
        mesh.rotation.y = (b.rotation * Math.PI) / 2;
        mesh.userData.bed = b;
        this.bedMeshes.set(b.key, mesh);
      }
  }
  private floorAt(x: number, z: number) {
    let floor = Math.abs(x) < 4.2 && Math.abs(z) < 3.2 ? FLOOR : 0;
    const feet = this.position.y - 1.68;
    for (const s of this.site.solids)
      if (s.h <= feet + 0.31 && insideSolid(s, x, z, 0.19))
        floor = Math.max(floor, s.h);
    for (const p of this.snapshot.world.parts) {
      const d = dimensions(p.kind, p.rotation),
        top = p.y + d.h / 2;
      if (
        top <= feet + 0.31 &&
        Math.abs(x - p.x) < d.w / 2 + 0.17 &&
        Math.abs(z - p.z) < d.d / 2 + 0.17
      )
        floor = Math.max(floor, top);
    }
    return floor;
  }
  private walkable(x: number, z: number) {
    const feet = this.position.y - 1.68;
    for (const s of this.site.solids)
      if (blocksWalker(s, x, z, feet)) return false;
    for (const p of this.snapshot.world.parts) {
      const d = dimensions(p.kind, p.rotation);
      if (
        p.y + d.h / 2 > feet + 0.31 &&
        p.y - d.h / 2 < feet + 1.55 &&
        Math.abs(x - p.x) < d.w / 2 + 0.2 &&
        Math.abs(z - p.z) < d.d / 2 + 0.2
      )
        return false;
    }
    return Math.abs(x) < 10 && Math.abs(z) < 9;
  }
  private updateCamera() {
    this.camera.position.set(this.position.x, this.position.y, this.position.z);
    this.camera.rotation.set(this.position.pitch, this.position.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }
  private updateAim() {
    const world = this.snapshot.world,
      inv = world.inventories[this.playerId] ?? emptyInventory();
    this.ray.setFromCamera(new T.Vector2(0, 0), this.camera);
    this.ray.far = 7;
    const hits = this.ray.intersectObjects(
      [
        ...this.site.targets,
        ...this.partMeshes.values(),
        ...this.bedMeshes.values(),
      ],
      false,
    );
    const hit = hits[0];
    this.station = null;
    this.placement = null;
    this.targetPart = null;
    this.canUse = false;
    this.ghost.visible = false;
    this.siteAction = null;
    let label = 'Your building site. Brick by brick.',
      detail = 'Look at the foundation · Supplies are around the edge',
      valid = false;
    if (hit) {
      const stationId = hit.object.userData.station;
      if (hit.object.userData.solidLabel) {
        label = hit.object.userData.solidLabel;
        detail = 'This obstacle is fixed. Walk around it.';
        const interaction = hit.object.userData.interaction as
          | 'race'
          | 'horn'
          | undefined;
        if (interaction) {
          this.siteAction = interaction;
          valid = hit.distance <= 3.2;
          label =
            interaction === 'race'
              ? raceActive(world, Date.now() + this.serverOffset)
                ? 'Roof-raising race in progress!'
                : 'Start roof-raising race'
              : 'Honk the horn';
          detail = valid
            ? interaction === 'race'
              ? 'E / Click · 5 minutes · Build 12 bricks, 2 posts and 2 roof panels together'
              : 'E / Click · BEEP BEEP! The whole site can hear it.'
            : 'Move closer · E to interact';
          if (
            interaction === 'race' &&
            raceActive(world, Date.now() + this.serverOffset)
          )
            valid = false;
        }
      } else if (stationId) {
        const station = STATIONS.find((s) => s.id === stationId)!;
        label = station.name;
        if (inReach(this.position, station)) {
          this.station = stationId;
          valid = true;
          if (stationId === 'mixer') {
            label = inv.carrying
              ? `${INGREDIENTS[inv.carrying]} pour in`
              : recipeStatus(world.mixer, Date.now() + this.serverOffset);
            detail = 'E / Click · X to empty';
          } else {
            label =
              inv.carrying === stationId
                ? `${station.name}: return material`
                : `${station.name}: take material`;
            detail = 'E / Click · Shared supply station';
          }
        } else detail = 'Move closer';
      } else {
        const part = world.parts.find(
          (p) => p.id === hit.object.userData.partId,
        );
        this.targetPart = part ?? null;
        if (this.tool === 'remove') {
          if (part) {
            valid = inReach(this.position, part);
            label = 'Take back building part';
            detail = 'Click / F · Remove from the top down';
          } else {
            label = 'Aim at a building part';
            detail = 'You get the material back';
          }
        } else {
          const kind = this.tool === 'mortar' ? 'brick' : this.tool;
          let p: Placement;
          const bed = hit.object.userData.bed;
          if (bed && kind === 'brick') p = { ...bed };
          else if (
            part &&
            this.tool === 'mortar' &&
            !part.bonded &&
            part.kind === 'brick'
          )
            p = { ...part };
          else {
            const normal =
              hit.face?.normal
                .clone()
                .transformDirection(hit.object.matrixWorld) ??
              new T.Vector3(0, 1, 0);
            p = placementAtSurface(
              hit.point,
              normal,
              kind,
              this.rotation,
              part,
            );
          }
          this.placement = p;
          let error =
            this.tool === 'mortar' &&
            part &&
            !part.bonded &&
            part.kind === 'brick' &&
            bedKey(part) === bedKey(p)
              ? !inReach(this.position, p)
                ? 'Move closer.'
                : null
              : placementError(world, p, kind, this.position);
          if (!error && this.tool === 'mortar' && !inv.mortar)
            error = 'MORTAR EMPTY · Refill at the mixer';
          if (
            !error &&
            this.tool !== 'mortar' &&
            inv[
              kind === 'brick' ? 'bricks' : kind === 'beam' ? 'beams' : 'roofs'
            ] < 1
          )
            error =
              kind === 'brick'
                ? 'BRICKS EMPTY · Go to the brick pallet'
                : kind === 'beam'
                  ? 'BEAMS EMPTY · Go to timber supplies'
                  : 'ROOF PANELS EMPTY · Go to roof supplies';
          if (
            !error &&
            this.tool === 'mortar' &&
            world.beds.some((b) => b.key === bedKey(p))
          )
            error = 'Mortar is ready. Switch to bricks [1].';
          valid = !error;
          label =
            error ||
            (this.tool === 'mortar'
              ? part && !part.bonded
                ? 'Spread mortar on the brick'
                : 'Spread a mortar bed'
              : kind === 'brick'
                ? world.beds.some((b) => b.key === bedKey(p))
                  ? 'Set brick in mortar bed'
                  : 'Place dry brick'
                : kind === 'beam'
                  ? p.rotation === 2
                    ? 'Place upright post · 2 m'
                    : 'Lay beam · 2 m'
                  : 'Lay roof panel');
          detail = valid
            ? this.tool === 'mortar'
              ? 'Thin light layer · Spread it, then switch to bricks'
              : 'Click / F · Snapping grid · R to change orientation'
            : error?.includes('EMPTY')
              ? this.tool === 'mortar'
                ? 'Mix 1 cement + 2 sand + 1 water · Collect finished mortar with E'
                : 'Look at a supply station and press E · Then keep building here'
              : kind === 'roof' && !part
                ? 'Place posts first, lay beams across them, then aim at the top edge.'
                : error?.includes('closer')
                  ? 'Walk to the marked location · Reach: 3.2 m'
                  : 'R / Rotate changes orientation · Aim at a clear edge';
          const actual = previewShape(
            this.tool,
            p,
            this.tool === 'mortar' &&
              part &&
              !part.bonded &&
              bedKey(part) === bedKey(p)
              ? part
              : undefined,
          );
          const ghostKey = `${this.tool}:${p.rotation}`;
          if (this.ghostKind !== ghostKey) {
            this.ghostKind = ghostKey;
            disposeGeometry(this.ghost.geometry);
            this.ghost.geometry = new T.BoxGeometry(
              actual.w,
              actual.h,
              actual.d,
            );
            disposeGeometry(this.ghostEdges.geometry);
            this.ghostEdges.geometry = new T.EdgesGeometry(this.ghost.geometry);
          }
          this.ghost.position.set(p.x, actual.y, p.z);
          this.ghost.visible = kind !== 'roof' || !!part;
          (this.ghost.material as T.MeshBasicMaterial).color.set(
            valid ? 0x71b985 : 0xea785b,
          );
          (this.ghostEdges.material as T.LineBasicMaterial).color.set(
            valid ? 0x28664b : 0xb23e25,
          );
        }
      }
    }
    this.canUse = valid;
    this.actionError = valid ? '' : label;
    const aim: Aim = {
        label,
        detail,
        valid,
        station: this.station,
        status: valid ? 'ready' : hit ? 'blocked' : 'idle',
        orientation:
          this.tool === 'beam'
            ? ['Lengthwise', 'Crosswise', 'Upright · 2 m'][this.rotation]
            : undefined,
        action:
          this.siteAction === 'horn'
            ? 'Honk'
            : this.siteAction === 'race'
              ? 'Start'
              : this.station
                ? 'Interact'
                : this.tool === 'mortar'
                  ? 'Spread'
                  : this.tool === 'remove'
                    ? 'Remove'
                    : 'Build',
      },
      key = JSON.stringify(aim);
    if (key !== this.aimKey) {
      this.aimKey = key;
      this.callbacks.aim(aim);
    }
  }
  private frame = (time: number) => {
    if (this.stopped) return;
    // Resize and paint in one animation frame, so mobile viewport changes never expose a cleared canvas.
    if (this.resizePending) this.resizeCanvas();
    const dt = Math.min((time - (this.last || time)) / 1000, 0.04);
    this.last = time;
    if (this.playing) {
      let forward =
        Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
        Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) -
        this.joystick.y;
      let right =
        Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) +
        this.joystick.x;
      const length = Math.max(1, Math.hypot(forward, right));
      forward /= length;
      right /= length;
      const speed = this.keys.has('ShiftLeft') ? 4.2 : 2.8,
        a = this.position.yaw;
      const dx = (right * Math.cos(a) - forward * Math.sin(a)) * dt * speed,
        dz = (-forward * Math.cos(a) - right * Math.sin(a)) * dt * speed;
      if (this.walkable(this.position.x + dx, this.position.z))
        this.position.x += dx;
      if (this.walkable(this.position.x, this.position.z + dz))
        this.position.z += dz;
      this.vy -= 17 * dt;
      let proposedY = this.position.y + this.vy * dt;
      if (this.vy > 0)
        for (const p of this.snapshot.world.parts) {
          const d = dimensions(p.kind, p.rotation),
            underside = p.y - d.h / 2;
          if (
            Math.abs(this.position.x - p.x) < d.w / 2 + 0.18 &&
            Math.abs(this.position.z - p.z) < d.d / 2 + 0.18 &&
            underside >= this.position.y + 0.07 &&
            underside < proposedY + 0.13
          ) {
            proposedY = underside - 0.13;
            this.vy = 0;
          }
        }
      this.position.y = proposedY;
      const floor = this.floorAt(this.position.x, this.position.z) + 1.68;
      if (this.position.y <= floor) {
        this.position.y = floor;
        this.vy = 0;
      }
      this.updateCamera();
      this.updateAim();
      this.swing = Math.max(0, this.swing - dt * 3.5);
      const sw = Math.sin(this.swing * Math.PI);
      this.hand.position.y =
        Math.sin(time * 0.009) *
        0.006 *
        Math.min(1, Math.hypot(forward, right));
      this.hand.position.z = -sw * 0.12;
      this.hand.rotation.x = -sw * 0.13;
    } else if (!this.entered) {
      this.camera.position.x = 11 + Math.sin(time * 0.00009) * 0.45;
      this.camera.lookAt(-1.2, 0.15, -1);
    }
    // One shared small ripple texture animates both water containers without extra render passes.
    this.mats.liquid.bumpMap!.offset.set(
      (time * 0.000016) % 1,
      (time * 0.000009) % 1,
    );
    if (this.snapshot.world.mixer.jammed)
      this.site.drum.rotation.y = Math.sin(time * 0.025) * 0.04;
    else if (this.snapshot.world.mixer.readyAt > Date.now() + this.serverOffset)
      this.site.drum.rotation.y += dt * 4;
    for (const p of this.snapshot.players) {
      const avatar = this.avatars.get(p.id);
      if (!avatar) continue;
      const distance = Math.hypot(
        p.x - avatar.group.position.x,
        p.z - avatar.group.position.z,
      );
      avatar.group.position.lerp(
        new T.Vector3(p.x, p.y - 1.68, p.z),
        Math.min(1, dt * 12),
      );
      avatar.group.rotation.y = p.yaw;
      stepBuilder(avatar.legs, time, distance > 0.02);
      avatar.tag.quaternion.copy(this.camera.quaternion);
      avatar.tag.rotateY(-p.yaw);
    }
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (this.playing) {
      // A separate foreground pass keeps the held tools readable next to walls and vehicles.
      // It has no shadows or screen-sized render targets; the world still owns all collisions.
      this.viewRotation.copy(this.camera.quaternion).invert();
      this.viewSun.position.set(-13, 17, 8).applyQuaternion(this.viewRotation);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCamera);
      this.renderer.autoClear = true;
    }
    this.raf = requestAnimationFrame(this.frame);
  };
  private disposeObject(object: T.Object3D, materials: boolean) {
    object.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments) {
        disposeGeometry(o.geometry);
        if (materials)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      }
    });
  }
  dispose() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.events.abort();
    this.resize.disconnect();
    if (this.locked) document.exitPointerLock();
    const textures = new Set<T.Texture>();
    const collect = (material: T.Material) => {
      for (const value of Object.values(material))
        if (value instanceof T.Texture) textures.add(value);
    };
    for (const scene of [this.scene, this.viewScene])
      scene.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.LineSegments)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            collect(m);
      });
    for (const m of Object.values(this.mats)) {
      collect(m);
      m.dispose();
    }
    this.disposeObject(this.scene, true);
    this.disposeObject(this.viewScene, true);
    for (const t of textures) t.dispose();
    this.environment.dispose();
    this.sunlight.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
