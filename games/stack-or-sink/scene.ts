import * as T from 'three';
import { label, disposeGeometry } from '../../shared/rendering/primitives';
import { island, junk } from './objects';
import { LoadCrane } from './load-crane';
import { FLOOR } from './geometry';
import { gameAvatar as worker } from '../../shared/rendering/game-avatar';
import { dressedGameAvatar as dressedWorker } from '../../shared/rendering/game-avatar';
import { getEquippedLook } from '../../shared/wardrobe/wardrobe-state';
import { poseStacker } from './avatar';
import { previewPieces } from './preview';
import { emptyInput, movePlayer, nearestPiece, placement } from './simulation';
import { orientation, topOf } from './physics';
import { YardGesture } from '../../shared/input/gestures';
import { IslandSea, disposeCoastalMaterials } from './coast';
import { FrameStats } from '../../shared/rendering/frame-stats';
import { PlayerCorrection, SnapshotMotion } from './motion';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import {
  ITEMS,
  dimensions,
  type Action,
  type Input,
  type Piece,
  type Player,
  type Snapshot,
} from './types';
import { clamp } from '../../shared/math/clamp';
import { createRenderer } from '../../shared/rendering/create-renderer';
import {
  addHouseLight,
  HOUSE_EXPOSURE,
} from '../../shared/rendering/house-light';
import {
  isTouchDevice,
  prefersReducedMotion,
} from '../../shared/browser/device';

export type Hud = {
  target: string;
  carrying: string;
  placementError: string | null;
  height: number;
  crane: boolean;
  craneAngle: boolean;
};
type Callbacks = {
  input: (i: Input) => void;
  action: (a: Action) => void;
  hud: (h: Hud) => void;
  error: (s: string) => void;
  advance?: (i: Input) => void;
};
export class GameScene {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.OrthographicCamera();
  sea: IslandSea;
  resize: ResizeObserver;
  abort = new AbortController();
  frameId = 0;
  last = 0;
  time = 0;
  lastHud = 0;
  lastInput = 0;
  lastCrane = 0;
  pieces = new Map<string, T.Group>();
  actors = new Map<string, T.Group>();
  preview = new T.Group();
  world: Snapshot | null = null;
  localId = '';
  predicted: Player | null = null;
  keys = new Set<string>();
  touch = { x: 0, z: 0 };
  jumpSeq = 0;
  jumpHeld = false;
  paused = false;
  menu = true;
  overview = false;
  yaw = 0.65;
  zoom = 1;
  target = new T.Vector3();
  pointer = new T.Vector2(-20, -20);
  ray = new T.Raycaster();
  pointerActive = false;
  selected: string | null = null;
  gesture = new YardGesture();
  touchAim: { x: number; z: number } | null = null;
  ghost: T.Group | null = null;
  ghostKind = '';
  ghostSpot: {
    x: number;
    y: number;
    z: number;
    error: string | null;
    target: string;
    rotation: number;
    revision: number;
  } | null = null;
  scenery: T.Group;
  lastGhost = 0;
  ring = new T.Mesh(
    new T.RingGeometry(0.65, 0.73, 40),
    new T.MeshBasicMaterial({
      color: '#ffe181',
      side: T.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    }),
  );
  loadCrane = new LoadCrane();
  craneView = false;
  craneAngle = false;
  craneTarget = new T.Group();
  craneTargetRing = new T.Mesh(
    new T.RingGeometry(0.77, 0.88, 48),
    new T.MeshBasicMaterial({
      color: '#167b74',
      side: T.DoubleSide,
      depthTest: false,
    }),
  );
  craneTargetLine = new T.Line(
    new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
    new T.LineBasicMaterial({
      color: '#167b74',
      depthTest: false,
      transparent: true,
      opacity: 0.72,
    }),
  );
  craneRay = new T.Raycaster();
  craneSurfaces: T.Mesh[] = [];
  lastCraneTarget = 0;
  reduceMotion = prefersReducedMotion();
  projectionDirty = true;
  localSimulation = false;
  motion = new SnapshotMotion();
  correction = new PlayerCorrection();
  stats = new FrameStats();
  pose = { x: 0, y: 0, z: 0, quaternion: new T.Quaternion() };
  previousLocal = new Map<string, Piece>();
  localPieces = new Map<string, Piece>();
  localTick = 0;
  lastSent: Input = emptyInput();
  constructor(
    public host: HTMLElement,
    public callbacks: Callbacks,
  ) {
    const mobile = isTouchDevice();
    this.renderer = createRenderer(host, {
      shadows: mobile ? 'off' : 'hard',
      exposure: HOUSE_EXPOSURE,
      label:
        'Stack or Sink 3D island surrounded by rising water. Tap a surface to aim, drag to orbit, pinch to zoom. Use the movement, Jump and action buttons, or WASD, Space and E.',
    }).renderer;
    const { sun } = addHouseLight(this.scene);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
    });
    this.scenery = island();
    batchScenery(this.scenery);
    this.scenery.traverse((object) => {
      if (object instanceof T.Mesh && object.userData.surface)
        this.craneSurfaces.push(object);
    });
    this.scene.add(this.scenery);
    this.sea = new IslandSea();
    this.scene.add(this.sea);
    this.scene.add(this.preview);
    this.makePreview();
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.renderOrder = 10;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.scene.add(this.loadCrane);
    this.craneTargetRing.rotation.x = -Math.PI / 2;
    this.craneTargetRing.renderOrder = 12;
    this.craneTargetRing.frustumCulled = false;
    this.craneTargetLine.renderOrder = 12;
    this.craneTargetLine.frustumCulled = false;
    this.craneTarget.add(this.craneTargetRing, this.craneTargetLine);
    this.craneTarget.visible = false;
    this.scene.add(this.craneTarget);
    this.resize = new ResizeObserver(() => {
      this.projectionDirty = true;
    });
    this.resize.observe(host);
    const signal = this.abort.signal;
    window.addEventListener('keydown', this.keyDown, { signal });
    window.addEventListener('keyup', this.keyUp, { signal });
    window.addEventListener('blur', this.clearInput, { signal });
    document.addEventListener(
      'visibilitychange',
      () => {
        this.last = 0;
        if (document.hidden) this.clearInput();
      },
      { signal },
    );
    host.addEventListener('pointerdown', this.pointerDown, { signal });
    host.addEventListener('pointermove', this.pointerMove, { signal });
    host.addEventListener('pointerup', this.pointerUp, { signal });
    host.addEventListener('pointercancel', this.pointerCancel, { signal });
    host.addEventListener('lostpointercapture', this.pointerCancel, { signal });
    host.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
    host.addEventListener(
      'wheel',
      (e) => {
        if (this.menu) return;
        e.preventDefault();
        this.zoom = clamp(this.zoom + e.deltaY * 0.0007, 0.6, 1.7);
        this.projectionDirty = true;
      },
      { passive: false, signal },
    );
    host.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault();
        callbacks.error(
          'The 3D view was interrupted. Reload the page to reconnect.',
        );
      },
      { signal },
    );
    this.frameId = requestAnimationFrame(this.frame);
  }
  makePreview() {
    for (const p of previewPieces()) {
      const m = junk(p.kind);
      m.position.set(p.x, p.y + 0.13, p.z);
      m.rotation.y = (p.rotation * Math.PI) / 2;
      this.preview.add(m);
    }
    for (let i = 0; i < 4; i++) {
      const a = worker(i);
      a.position.set(
        [2, -2.2, 1.5, -4][i],
        [0.13, 0.13, 6.99, 0.13][i],
        [3, 2, 1, 4][i],
      );
      a.rotation.y = [-1.3, 0.8, 0.5, 0.4][i];
      this.preview.add(a);
    }
  }
  setSnapshot(snapshot: Snapshot, id: string, local = false) {
    const previous = this.world;
    this.world = snapshot;
    this.localId = id;
    this.localSimulation = local;
    this.menu = false;
    this.preview.visible = false;
    const reset =
      !previous ||
      previous.world.started !== snapshot.world.started ||
      previous.code !== snapshot.code;
    if (reset) {
      this.motion.clear();
      this.previousLocal.clear();
      this.localPieces.clear();
      this.localTick = 0;
      this.correction = new PlayerCorrection();
    }
    if (!local) this.motion.push(snapshot, performance.now());
    else {
      const tick =
        snapshot.world.clock - (snapshot.world.remainder || 0) * 1000;
      if (tick > this.localTick + 0.1 || reset) {
        this.previousLocal = this.localPieces;
        this.localPieces = new Map(
          snapshot.world.pieces.map((p) => [p.id, { ...p }]),
        );
        this.localTick = tick;
      }
    }
    const player = snapshot.world.players.find((p) => p.id === id);
    if (player) {
      if (local || !this.predicted || reset || player.down || player.rescued) {
        this.predicted = structuredClone(player);
        this.jumpSeq = Math.max(this.jumpSeq, player.lastJump);
      } else this.correction.receive(this.predicted, player);
    }
    if (!previous) this.projectionDirty = true;
    for (const [pid, m] of this.pieces)
      if (
        !snapshot.world.pieces.some(
          (p) => p.id === pid && p.kind === m.userData.kind,
        )
      ) {
        m.removeFromParent();
        this.disposeObject(m);
        this.pieces.delete(pid);
      }
    for (const p of snapshot.world.pieces)
      if (!this.pieces.has(p.id)) {
        const m = junk(p.kind);
        m.userData.kind = p.kind;
        m.userData.pieceId = p.id;
        m.traverse((o) => (o.userData.pieceId = p.id));
        this.pieces.set(p.id, m);
        m.position.set(p.x, p.y, p.z);
        this.scene.add(m);
      }
    for (const p of snapshot.world.pieces) {
      const mesh = this.pieces.get(p.id)!;
      if (
        mesh.userData.heldBy !== p.heldBy ||
        mesh.userData.revision !== p.revision
      ) {
        mesh.position.set(p.x, p.y, p.z);
        mesh.quaternion.copy(orientation(p));
      }
      mesh.userData.heldBy = p.heldBy;
      mesh.userData.revision = p.revision;
    }
    for (const [pid, m] of this.actors)
      if (!snapshot.world.players.some((p) => p.id === pid)) {
        this.scene.remove(m);
        this.disposeObject(m);
        this.actors.delete(pid);
      }
    for (const p of snapshot.world.players)
      if (!this.actors.has(p.id)) {
        // Your own wardrobe items show on your worker.
        const m = dressedWorker(
          p.color,
          {},
          p.id === id ? getEquippedLook() : undefined,
        ).model;
        const name = label(
          `${p.name}${p.id === id ? ' · YOU' : ''}`,
          p.id === id ? '#fff2b7' : '#edf1de',
          '#345449',
          2,
        );
        name.position.y = 2.35;
        m.add(name);
        m.userData.name = name;
        m.position.set(p.x, p.y, p.z);
        this.actors.set(p.id, m);
        this.scene.add(m);
      }
  }
  resetMenu() {
    this.world = null;
    this.predicted = null;
    this.menu = true;
    this.preview.visible = true;
    this.clearInput();
    this.ghost?.removeFromParent();
    this.ghost = null;
    this.ghostKind = '';
    for (const m of this.pieces.values()) {
      m.removeFromParent();
      this.disposeObject(m);
    }
    this.pieces.clear();
    for (const m of this.actors.values()) {
      m.removeFromParent();
      this.disposeObject(m);
    }
    this.actors.clear();
    this.ring.visible = false;
    this.loadCrane.update(null);
    this.craneTarget.visible = false;
    this.projectionDirty = true;
  }
  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.clearInput();
  }
  clearInput = () => {
    this.keys.clear();
    this.touch = { x: 0, z: 0 };
    this.jumpHeld = false;
    for (const id of this.gesture.contacts.keys())
      if (this.host.hasPointerCapture(id)) this.host.releasePointerCapture(id);
    this.gesture.clear();
    this.callbacks.input({ ...emptyInput(), seq: this.jumpSeq });
  };
  keyDown = (e: KeyboardEvent) => {
    if (
      this.menu ||
      this.paused ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    if (
      ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        e.code,
      )
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') {
      this.jumpSeq++;
      this.jumpHeld = true;
    }
    if (e.code === 'KeyE') this.interact();
    if (e.code === 'KeyR') this.callbacks.action({ type: 'rotate' });
    if (e.code === 'KeyC') this.crane();
    if (e.code === 'KeyF') this.callbacks.action({ type: 'rescue' });
    if (e.code === 'KeyV') {
      if (this.craneView) this.toggleCraneView();
      else this.toggleOverview();
    }
    if (e.code === 'KeyG') this.callbacks.action({ type: 'wave' });
  };
  keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space') this.jumpHeld = false;
    this.publishInput();
  };
  setTouch(vector: { x: number; z: number }) {
    this.touch = vector;
    this.publishInput();
  }
  publishInput() {
    const input = this.input();
    this.lastSent = input;
    this.callbacks.input(input);
  }
  usesTouchControls(e: PointerEvent) {
    return e.pointerType === 'touch' || isTouchDevice();
  }
  setPointer(e: PointerEvent) {
    const r = this.host.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
  }
  pointerDown = (e: PointerEvent) => {
    if (this.menu || this.paused || e.button !== 0) return;
    if (!this.usesTouchControls(e)) {
      this.setPointer(e);
      this.pointerActive = true;
      this.updateGhost();
    }
    this.host.setPointerCapture(e.pointerId);
    this.gesture.down(e.pointerId, e.clientX, e.clientY);
  };
  pointerMove = (e: PointerEvent) => {
    if (this.menu || this.paused) return;
    if (!this.usesTouchControls(e)) {
      this.setPointer(e);
      this.pointerActive = true;
      this.touchAim = null;
    }
    const change = this.gesture.move(e.pointerId, e.clientX, e.clientY);
    if (change.orbit || change.zoom !== 1) {
      if (!this.craneView) this.yaw -= change.orbit * 0.006;
      this.zoom = clamp(this.zoom * change.zoom, 0.6, 1.7);
      this.projectionDirty = true;
    }
  };
  pointerUp = (e: PointerEvent) => {
    const clicked = this.gesture.up(e.pointerId);
    if (clicked && !this.paused) {
      if (this.usesTouchControls(e)) {
        this.setPointer(e);
        this.pointerActive = false;
        this.scene.updateMatrixWorld(true);
        if (this.world?.world.pieces.some((p) => p.heldBy === this.localId)) {
          this.touchAim = this.aimAtPointer();
          this.updateGhost();
        } else this.selected = this.pick()?.id ?? null;
      } else if (
        this.world?.world.pieces.some((p) => p.heldBy === this.localId)
      )
        this.interact();
      else {
        this.setPointer(e);
        this.selected = this.pick()?.id ?? null;
      }
    }
    if (this.host.hasPointerCapture(e.pointerId))
      this.host.releasePointerCapture(e.pointerId);
  };
  pointerCancel = (e: PointerEvent) => {
    this.gesture.up(e.pointerId, true);
  };
  toggleOverview() {
    this.overview = !this.overview;
    this.projectionDirty = true;
  }
  toggleCraneView() {
    this.setCraneAngle(!this.craneAngle);
  }
  setCraneAngle(angle: boolean) {
    this.craneAngle = angle;
    this.projectionDirty = true;
  }
  zoomBy(amount: number) {
    this.zoom = clamp(this.zoom + amount, 0.6, 1.7);
    this.projectionDirty = true;
  }
  jump() {
    if (this.paused || this.menu) return;
    this.jumpSeq++;
    this.jumpHeld = true;
    this.publishInput();
    setTimeout(() => {
      this.jumpHeld = false;
      this.publishInput();
    }, 180);
  }
  input(): Input {
    if (this.paused) return { ...emptyInput(), seq: this.jumpSeq };
    const horizontal =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touch.x;
    const vertical =
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) +
      this.touch.z;
    const length = Math.max(1, Math.hypot(horizontal, vertical));
    const yaw = this.craneView ? 0 : this.yaw;
    return {
      x: (horizontal * Math.cos(yaw) + vertical * Math.sin(yaw)) / length,
      z: (-horizontal * Math.sin(yaw) + vertical * Math.cos(yaw)) / length,
      jump: this.jumpHeld,
      seq: this.jumpSeq,
    };
  }
  craneInput() {
    const x =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touch.x;
    const z =
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) +
      this.touch.z;
    const length = Math.max(1, Math.hypot(x, z));
    return { x: x / length, z: z / length };
  }
  pick() {
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects([...this.pieces.values()], true);
    const hit = hits.find((h) => {
      const p = this.world?.world.pieces.find(
        (p) => p.id === h.object.userData.pieceId,
      );
      return p && !p.heldBy;
    });
    if (hit) {
      return { id: hit.object.userData.pieceId as string, point: hit.point };
    }
    if (this.world && this.pieces.size > 0) {
      let closestId: string | null = null;
      let closestDist = 0.14;
      const v = new T.Vector3();
      for (const [id, mesh] of this.pieces) {
        const p = this.world.world.pieces.find((x) => x.id === id);
        if (!p || p.heldBy) continue;
        mesh.getWorldPosition(v);
        v.project(this.camera);
        const d = Math.hypot(v.x - this.pointer.x, v.y - this.pointer.y);
        if (d < closestDist) {
          closestDist = d;
          closestId = id;
        }
      }
      if (closestId) {
        const mesh = this.pieces.get(closestId);
        mesh?.getWorldPosition(v);
        return { id: closestId, point: v };
      }
    }
    return null;
  }
  currentTarget() {
    if (!this.world || !this.predicted) return;
    const hit = this.pointerActive ? this.pick() : null;
    const selected = this.world.world.pieces.find(
      (p) => p.id === (hit?.id || this.selected) && !p.heldBy,
    );
    if (selected) return selected;
    return nearestPiece(this.world.world, this.predicted);
  }
  interact() {
    if (!this.world || this.paused) return;
    if (this.world.world.crane.owner === this.localId) {
      this.callbacks.action({ type: 'crane-drop' });
      return;
    }
    if (this.world.world.pieces.some((p) => p.heldBy === this.localId)) {
      const spot = this.ghostSpot;
      if (spot) {
        if (spot.error) {
          this.callbacks.error(spot.error);
          return;
        }
        this.callbacks.action({
          type: 'place',
          x: spot.x,
          y: spot.y,
          z: spot.z,
          target: spot.target,
          rotation: spot.rotation,
          revision: spot.revision,
        });
      }
    } else
      this.callbacks.action({ type: 'grab', target: this.currentTarget()?.id });
  }
  crane() {
    if (!this.paused)
      this.callbacks.action({
        type: 'crane',
        target: this.currentTarget()?.id,
      });
  }
  aimAtPointer() {
    this.scene.updateMatrixWorld(true);
    this.ray.setFromCamera(this.pointer, this.camera);
    const hit = this.ray
      .intersectObjects([this.scenery, ...this.pieces.values()], true)
      .find(
        (hit) =>
          hit.object.userData.surface &&
          !this.world!.world.pieces.some(
            (p) => p.id === hit.object.userData.pieceId && p.heldBy,
          ),
      );
    if (hit) {
      const support = this.world!.world.pieces.find(
        (p) => p.id === hit.object.userData.pieceId,
      );
      return { x: support?.x ?? hit.point.x, z: support?.z ?? hit.point.z };
    }
    const point = new T.Vector3();
    return this.ray.ray.intersectPlane(
      new T.Plane(new T.Vector3(0, 1, 0), -(this.predicted?.y ?? 0.13)),
      point,
    )
      ? { x: point.x, z: point.z }
      : null;
  }
  updateGhost() {
    if (!this.world || !this.predicted) return;
    const held = this.world.world.pieces.find((p) => p.heldBy === this.localId);
    if (!held) {
      if (this.ghost) this.ghost.visible = false;
      this.ghostSpot = null;
      this.touchAim = null;
      return;
    }
    if (this.ghostKind !== held.kind) {
      if (this.ghost) {
        this.ghost.removeFromParent();
        this.disposeObject(this.ghost, true);
      }
      this.ghost = junk(held.kind);
      this.ghost.traverse((o) => {
        if (o instanceof T.Mesh) {
          o.material = (o.material as T.MeshStandardMaterial).clone();
          Object.assign(o.material, {
            transparent: true,
            opacity: 0.42,
            depthWrite: false,
          });
          o.castShadow = false;
          if (o.userData.surface)
            o.add(
              new T.LineSegments(
                new T.EdgesGeometry(o.geometry, 25),
                new T.LineBasicMaterial({
                  color: '#347844',
                  transparent: true,
                  opacity: 0.9,
                  depthTest: false,
                }),
              ),
            );
        }
      });
      this.scene.add(this.ghost);
      this.ghostKind = held.kind;
    }
    let x = this.predicted.x + Math.sin(this.predicted.angle) * 2.9,
      z = this.predicted.z + Math.cos(this.predicted.angle) * 2.9;
    if (this.gesture.contacts.size) return;
    const aim = this.pointerActive ? this.aimAtPointer() : this.touchAim;
    if (aim) {
      x = aim.x;
      z = aim.z;
    }
    const player = this.world.world.players.find((p) => p.id === this.localId)!;
    this.ghostSpot = {
      ...placement(this.world.world, player, held, x, z),
      target: held.id,
      rotation: held.rotation,
      revision: held.revision || 0,
    };
    const spot = this.ghostSpot;
    this.ghost!.visible = true;
    this.ghost!.position.set(spot.x, spot.y, spot.z);
    this.ghost!.rotation.y = (held.rotation * Math.PI) / 2;
    this.ghost!.traverse((o) => {
      if (o instanceof T.Mesh)
        (o.material as T.MeshStandardMaterial).color.set(
          spot.error ? '#de6b53' : '#91cf8a',
        );
      if (o instanceof T.LineSegments)
        (o.material as T.LineBasicMaterial).color.set(
          spot.error ? '#ba3623' : '#347844',
        );
    });
  }
  updateCraneTarget(piece: Piece, mesh: T.Group) {
    const x = mesh.position.x,
      z = mesh.position.z,
      bottom = mesh.position.y;
    this.scene.updateMatrixWorld(true);
    this.craneRay.set(
      new T.Vector3(x, bottom + 0.08, z),
      new T.Vector3(0, -1, 0),
    );
    const surfaces = [...this.craneSurfaces];
    for (const [id, group] of this.pieces) {
      if (id === piece.id) continue;
      group.traverse((object) => {
        if (object instanceof T.Mesh && object.userData.surface)
          surfaces.push(object);
      });
    }
    const hits = this.craneRay.intersectObjects(surfaces, false);
    const landing = hits.find(
      (hit) =>
        hit.object.userData.surface &&
        hit.face &&
        hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y >
          0.55,
    );
    const y = landing?.point.y ?? FLOOR;
    const footprint = dimensions(piece);
    this.craneTargetRing.position.set(x, y + 0.055, z);
    this.craneTargetRing.scale.setScalar(
      (Math.max(footprint.w, footprint.d) / 2 + 0.28) / 0.82,
    );
    const positions = this.craneTargetLine.geometry.attributes
      .position as T.BufferAttribute;
    positions.setXYZ(0, x, bottom + 0.1, z);
    positions.setXYZ(1, x, y + 0.07, z);
    positions.needsUpdate = true;
  }
  updateCamera(dt: number) {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const craneView =
      !!this.world && this.world.world.crane.owner === this.localId;
    if (craneView !== this.craneView) {
      this.craneView = craneView;
      this.craneAngle = false;
      this.projectionDirty = true;
    }
    if (this.projectionDirty) {
      this.renderer.setSize(w, h, false);
      const size =
        (this.menu
          ? aspect < 1
            ? 20
            : 17
          : this.craneView
            ? Math.max(14, 11 / aspect)
            : this.overview
              ? Math.max(22, 22 / aspect)
              : aspect < 1
                ? Math.max(14, 8.5 / aspect)
                : 10.5) * this.zoom;
      Object.assign(this.camera, {
        left: -size * aspect,
        right: size * aspect,
        top: size,
        bottom: -size,
        near: 0.1,
        far: 180,
      });
      this.camera.updateProjectionMatrix();
      this.projectionDirty = false;
    }
    const p = this.predicted;
    const desired = this.menu
      ? new T.Vector3(aspect > 1.1 ? -5 : 0, 4, 0)
      : this.craneView
        ? new T.Vector3(0, 7, 0)
        : this.overview
          ? new T.Vector3(0, 7, 0)
          : new T.Vector3(
              p?.x || 0,
              (p?.y || 0) + 2.2,
              (p?.z || 0) + (aspect < 1 ? -1.8 : 0),
            );
    if (this.menu || !p) this.target.copy(desired);
    else {
      this.target.x = desired.x;
      this.target.z = desired.z;
      this.target.y = T.MathUtils.lerp(
        this.target.y,
        desired.y,
        1 - Math.exp(-dt * 12),
      );
    }
    if (this.craneView) {
      this.camera.up.set(0, 0, -1);
      this.camera.position.set(
        this.target.x,
        this.target.y + (this.craneAngle ? 34 : 58),
        this.target.z + (this.craneAngle ? 42 : 0.01),
      );
      this.camera.lookAt(this.target);
      return;
    }
    this.camera.up.set(0, 1, 0);
    const distance = 42;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * distance,
      this.target.y + distance * 0.8,
      this.target.z + Math.cos(this.yaw) * distance,
    );
    this.camera.lookAt(this.target);
  }
  frame = (now: number) => {
    const begin = performance.now(),
      gap = now - (this.last || now),
      dt = Math.min(gap / 1000, 0.05);
    this.last = now;
    this.time += dt;
    this.callbacks.advance?.(this.input());
    if (this.world && this.predicted) {
      const world = this.world.world,
        input = this.input();
      if (
        !this.localSimulation &&
        !this.paused &&
        world.phase !== 'won' &&
        world.phase !== 'lost'
      ) {
        this.correction.apply(
          this.predicted,
          Math.hypot(input.x, input.z) > 0.001,
          dt,
        );
        movePlayer(world, this.predicted, dt, input, this);
      }
      if (
        now - this.lastInput > 70 ||
        input.x !== this.lastSent.x ||
        input.z !== this.lastSent.z ||
        input.jump !== this.lastSent.jump ||
        input.seq !== this.lastSent.seq
      ) {
        this.publishInput();
        this.lastInput = now;
      }
      if (!this.localSimulation) this.motion.advance(now);
      if (
        world.crane.owner === this.localId &&
        !this.paused &&
        now - this.lastCrane > 160
      ) {
        const y =
          (this.keys.has('KeyQ') ? 1 : 0) - (this.keys.has('KeyZ') ? 1 : 0);
        const crane = this.craneInput();
        if (Math.hypot(crane.x, crane.z) + Math.abs(y) > 0.1) {
          this.callbacks.action({
            type: 'crane-move',
            x: crane.x * 0.55,
            z: crane.z * 0.55,
            y: y * 0.6,
          });
          this.lastCrane = now;
        }
      }
      for (const p of world.pieces) {
        const m = this.pieces.get(p.id);
        if (!m) continue;
        if (!this.localSimulation) this.motion.piece(p, this.pose);
        else {
          const before = this.previousLocal.get(p.id),
            t = clamp((world.remainder || 0) * 60, 0, 1),
            blend =
              before &&
              before.kind === p.kind &&
              before.revision === p.revision &&
              before.heldBy === p.heldBy &&
              (!p.heldBy || p.heldBy === 'crane');
          this.pose.x = blend ? T.MathUtils.lerp(before.x, p.x, t) : p.x;
          this.pose.y = blend ? T.MathUtils.lerp(before.y, p.y, t) : p.y;
          this.pose.z = blend ? T.MathUtils.lerp(before.z, p.z, t) : p.z;
          const q = orientation(p);
          this.pose.quaternion.set(q.x, q.y, q.z, q.w);
          if (blend) {
            const a = orientation(before);
            this.pose.quaternion.slerp(
              new T.Quaternion(a.x, a.y, a.z, a.w),
              1 - t,
            );
          }
        }
        if (p.heldBy === this.localId) {
          this.pose.x = this.predicted.x;
          this.pose.y = this.predicted.y + 2.1;
          this.pose.z = this.predicted.z;
        }
        m.position.set(this.pose.x, this.pose.y, this.pose.z);
        m.quaternion.copy(this.pose.quaternion);
      }
      for (const p of world.players) {
        const m = this.actors.get(p.id);
        if (!m) continue;
        const shown =
          p.id === this.localId ? this.predicted : this.motion.player(p);
        const move =
          p.id === this.localId
            ? Math.hypot(input.x, input.z) > 0.01
            : Math.hypot(m.position.x - shown.x, m.position.z - shown.z) >
              0.015;
        m.position.set(shown.x, shown.y, shown.z);
        m.rotation.y = shown.angle;
        poseStacker(m, this.time, {
          moving: move,
          down: p.down,
          carrying: world.pieces.some((j) => j.heldBy === p.id),
          color: p.color,
          still: this.reduceMotion,
        });
      }
      this.updateCamera(dt);
      if (now - this.lastGhost > 45) {
        this.updateGhost();
        this.lastGhost = now;
      }
      const item = this.currentTarget();
      this.ring.visible =
        !!item &&
        world.crane.owner !== this.localId &&
        !world.pieces.some((p) => p.heldBy === this.localId);
      if (item) {
        const mesh = this.pieces.get(item.id);
        this.ring.position.set(
          mesh?.position.x ?? item.x,
          (mesh?.position.y ?? item.y) + topOf(item) - item.y + 0.03,
          mesh?.position.z ?? item.z,
        );
      }
      if (world.crane.owner) {
        const c = world.crane;
        const piece = world.pieces.find((p) => p.id === c.piece),
          mesh = piece ? this.pieces.get(piece.id) : undefined;
        this.loadCrane.update({
          x: mesh?.position.x ?? c.x,
          z: mesh?.position.z ?? c.z,
          top: (mesh?.position.y ?? c.y) + (piece ? dimensions(piece).h : 0),
        });
        if (world.crane.owner === this.localId && piece && mesh) {
          this.craneTarget.visible = true;
          if (now - this.lastCraneTarget > 45) {
            this.updateCraneTarget(piece, mesh);
            this.lastCraneTarget = now;
          }
        } else this.craneTarget.visible = false;
      } else {
        this.loadCrane.update(null);
        this.craneTarget.visible = false;
      }
      if (now - this.lastHud > 130) {
        this.callbacks.hud({
          target: item ? ITEMS[item.kind].name : '',
          carrying:
            world.pieces.find((p) => p.heldBy === this.localId)?.kind || '',
          placementError: this.ghostSpot?.error || null,
          height: this.predicted.y - 0.13,
          crane: world.crane.owner === this.localId,
          craneAngle: this.craneAngle,
        });
        this.lastHud = now;
      }
    }
    this.sea.update(
      this.world?.world.water ?? -0.4,
      this.time,
      this.reduceMotion,
    );
    if (!this.world || !this.predicted) this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.stats.record(gap, performance.now() - begin);
    this.frameId = requestAnimationFrame(this.frame);
  };
  diagnostics() {
    return {
      ...this.stats.read(),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      player: this.predicted
        ? { x: this.predicted.x, y: this.predicted.y, z: this.predicted.z }
        : null,
      camera: { x: this.target.x, y: this.target.y, z: this.target.z },
      pieces: [...this.pieces].map(([id, m]) => ({
        id,
        x: m.position.x,
        y: m.position.y,
        z: m.position.z,
      })),
    };
  }
  disposeObject(object: T.Object3D, materials = false) {
    object.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.LineSegments)
        disposeGeometry(o.geometry);
      if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
      if ((materials && o instanceof T.Mesh) || o instanceof T.LineSegments) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
      }
    });
  }
  dispose() {
    cancelAnimationFrame(this.frameId);
    this.abort.abort();
    this.resize.disconnect();
    this.clearInput();
    disposeCoastalMaterials(this.scene);
    this.disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
