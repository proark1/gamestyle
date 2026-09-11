import * as T from 'three';
import type {
  AvatarLook,
  AvatarPreview,
} from '../../../shared/rendering/avatar-preview';
import { disposeGeometry } from '../../../shared/rendering/primitives';

export type Measure = { height: number; width: number; meshes: number };
export type ScaleMode = 'game' | 'height';

/** In same-height mode every avatar is scaled to this many metres. */
const SAME_HEIGHT = 1.8;
const TILT = T.MathUtils.degToRad(9);
const RULER_Z = -1.4;
const SPIN_SPEED = 0.45;
const DRAG_TURN = 0.012;

type Placed = { preview: AvatarPreview; holder: T.Group; measure: Measure };
type Slot = {
  look: AvatarLook;
  element: HTMLElement;
  scene: T.Scene;
  turn: T.Group;
  ruler: T.Group;
  labels: T.Sprite[];
  main: Placed;
  release: () => void;
};

/** Builds a look, rests it on the floor and measures it without name tags. */
function place(look: AvatarLook): Placed {
  const preview = look.create();
  preview.pose?.(0, false);
  const { root } = preview;
  root.traverse((object) => {
    if ((object as T.Sprite).isSprite) object.visible = false;
  });
  root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  const part = new T.Box3();
  let meshes = 0;
  root.traverseVisible((object) => {
    const mesh = object as T.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
    bounds.union(part);
    meshes++;
  });
  // An offset group keeps the feet on the floor even when a pose moves the
  // root. Models turn about their own origin, the point the game turns them
  // about, so a long prop such as a fishing rod does not swing the body wide.
  const offset = new T.Group();
  if (!bounds.isEmpty()) offset.position.y = -bounds.min.y;
  offset.add(root);
  const holder = new T.Group();
  holder.add(offset);
  return {
    preview,
    holder,
    measure: bounds.isEmpty()
      ? { height: 0, width: 0, meshes }
      : {
          height: bounds.max.y - bounds.min.y,
          width: bounds.max.x - bounds.min.x,
          meshes,
        },
  };
}
export { place as placeAvatar };

/** Frees the buffers a removed avatar owns; shared box buffers stay cached. */
function discard(placed: Placed) {
  placed.holder.removeFromParent();
  placed.holder.traverse((object) => {
    const mesh = object as T.Mesh;
    if (mesh.isMesh) disposeGeometry(mesh.geometry);
  });
}

/**
 * Draws every avatar card from one fixed, click-through canvas: each frame it
 * renders each visible card's scene into that card's rectangle, so thirteen
 * previews share a single WebGL context.
 */
export class AvatarStage {
  private readonly renderer: T.WebGLRenderer;
  private readonly camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  private readonly slots = new Map<string, Slot>();
  private readonly size = new T.Vector2();
  private readonly ghostMaterial = new T.MeshBasicMaterial({
    color: '#1f63c7',
    transparent: true,
    opacity: 0.22,
    depthTest: false,
    depthWrite: false,
  });
  private readonly floorGeometry = new T.CircleGeometry(0.95, 48);
  private readonly floorMaterial = new T.MeshStandardMaterial({
    color: '#dfe3d3',
    roughness: 1,
  });
  private readonly shadowGeometry = new T.CircleGeometry(0.42, 32);
  private readonly shadowMaterial = new T.MeshBasicMaterial({
    color: '#294a43',
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  });
  private readonly rulerGeometry: T.BufferGeometry;
  private readonly rulerMaterial = new T.LineBasicMaterial({
    color: '#c4c8b6',
  });
  private readonly labelMaterials: T.SpriteMaterial[] = [];
  private template?: AvatarLook;
  /** One translucent copy of the template, moved into each card as it draws. */
  private ghost?: Placed;
  private scaleMode: ScaleMode = 'game';
  private walking = true;
  private spinning = true;
  private dragging = false;
  private yaw = 0.6;
  private time = 0;
  private last = 0;
  private frameId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onMeasure: (key: string, measure: Measure) => void,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    // Ruler lines behind the models, lowered so they read true at the models'
    // depth despite the slight downward camera tilt.
    const points: number[] = [];
    for (let step = 1; step <= 14; step++) {
      const y = step * 0.5 + RULER_Z * Math.tan(TILT);
      points.push(-4, y, RULER_Z, 4, y, RULER_Z);
    }
    this.rulerGeometry = new T.BufferGeometry().setAttribute(
      'position',
      new T.Float32BufferAttribute(points, 3),
    );
    for (let metre = 1; metre <= 7; metre++)
      this.labelMaterials.push(this.labelMaterial(`${metre} m`));
    this.frameId = requestAnimationFrame(this.frame);
  }

  attach(key: string, look: AvatarLook, element: HTMLElement) {
    this.detach(key);
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight('#fffaf0', '#7d8a78', 1.5));
    const sun = new T.DirectionalLight('#ffffff', 2.4);
    sun.position.set(2.5, 5, 4);
    const fill = new T.DirectionalLight('#dbe8ff', 0.7);
    fill.position.set(-4, 2.5, -3);
    scene.add(sun, fill);
    const floor = new T.Mesh(this.floorGeometry, this.floorMaterial);
    const shadow = new T.Mesh(this.shadowGeometry, this.shadowMaterial);
    floor.rotation.x = shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.003;
    scene.add(floor, shadow);
    const ruler = new T.Group();
    ruler.visible = this.scaleMode === 'game';
    ruler.add(new T.LineSegments(this.rulerGeometry, this.rulerMaterial));
    const labels = this.labelMaterials.map((material, index) => {
      const label = new T.Sprite(material);
      label.scale.set(0.34, 0.17, 1);
      label.position.set(
        0,
        index + 1 + RULER_Z * Math.tan(TILT) + 0.1,
        RULER_Z,
      );
      ruler.add(label);
      return label;
    });
    scene.add(ruler);
    const turn = new T.Group();
    scene.add(turn);
    const main = place(look);
    this.fit(main);
    turn.add(main.holder);

    let from: number | null = null;
    const down = (event: PointerEvent) => {
      from = event.clientX;
      this.dragging = true;
      element.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (from === null) return;
      this.yaw += (event.clientX - from) * DRAG_TURN;
      from = event.clientX;
    };
    const up = () => {
      from = null;
      this.dragging = false;
    };
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    const release = () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };

    this.slots.set(key, {
      look,
      element,
      scene,
      turn,
      ruler,
      labels,
      main,
      release,
    });
    this.onMeasure(key, main.measure);
  }

  detach(key: string) {
    const slot = this.slots.get(key);
    if (!slot) return;
    slot.release();
    discard(slot.main);
    this.slots.delete(key);
  }

  /** Overlays a translucent copy of the look under `key` on every other card. */
  setTemplate(key: string, look: AvatarLook | undefined) {
    if (look === this.template) return;
    if (this.ghost) discard(this.ghost);
    this.template = look;
    this.ghost = undefined;
    if (!look) return;
    const ghost = place(look);
    ghost.holder.traverse((object) => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = this.ghostMaterial;
      mesh.renderOrder = 10;
    });
    this.fit(ghost);
    this.ghost = ghost;
    // No card may be showing this look, so report its size here as well.
    this.onMeasure(key, ghost.measure);
  }

  setScaleMode(mode: ScaleMode) {
    this.scaleMode = mode;
    for (const slot of this.slots.values()) {
      this.fit(slot.main);
      slot.ruler.visible = mode === 'game';
    }
    if (this.ghost) this.fit(this.ghost);
  }

  setWalking(walking: boolean) {
    this.walking = walking;
  }

  setSpinning(spinning: boolean) {
    this.spinning = spinning;
  }

  turnBy(radians: number) {
    this.yaw += radians;
  }

  faceFront() {
    this.yaw = 0;
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    for (const key of this.slots.keys()) this.detach(key);
    if (this.ghost) discard(this.ghost);
    for (const material of this.labelMaterials) {
      material.map?.dispose();
      material.dispose();
    }
    for (const resource of [
      this.ghostMaterial,
      this.floorGeometry,
      this.floorMaterial,
      this.shadowGeometry,
      this.shadowMaterial,
      this.rulerGeometry,
      this.rulerMaterial,
    ])
      resource.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  private fit(placed: Placed) {
    placed.holder.scale.setScalar(
      this.scaleMode === 'height' && placed.measure.height > 0
        ? SAME_HEIGHT / placed.measure.height
        : 1,
    );
  }

  private labelMaterial(text: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#56655f';
    context.font = '600 34px "DM Sans", system-ui, sans-serif';
    context.textBaseline = 'middle';
    context.fillText(text, 6, 34);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return new T.SpriteMaterial({ map, depthTest: false, transparent: true });
  }

  /** The same frame height in every card is what keeps sizes comparable. */
  private frameHeight() {
    if (this.scaleMode === 'height') return SAME_HEIGHT * 1.25;
    let tallest = Math.max(1.6, this.ghost?.measure.height ?? 0);
    for (const slot of this.slots.values())
      tallest = Math.max(tallest, slot.main.measure.height);
    return tallest * 1.25;
  }

  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const delta = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.time += delta;
    if (this.spinning && !this.dragging) this.yaw += delta * SPIN_SPEED;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.renderer.getSize(this.size);
    if (this.size.x !== width || this.size.y !== height)
      this.renderer.setSize(width, height, false);
    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.setScissorTest(true);

    const frame = this.frameHeight();
    const centre = frame * 0.4;
    const ghost = this.ghost;
    ghost?.preview.pose?.(this.time, this.walking);
    for (const slot of this.slots.values()) {
      const rect = slot.element.getBoundingClientRect();
      if (
        !rect.width ||
        rect.bottom < 0 ||
        rect.top > height ||
        rect.right < 0 ||
        rect.left > width
      )
        continue;
      const bottom = height - rect.bottom;
      this.renderer.setViewport(rect.left, bottom, rect.width, rect.height);
      this.renderer.setScissor(rect.left, bottom, rect.width, rect.height);
      const halfWidth = (frame * rect.width) / rect.height / 2;
      const camera = this.camera;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = frame / 2;
      camera.bottom = -frame / 2;
      camera.position.set(0, centre + 20 * Math.sin(TILT), 20 * Math.cos(TILT));
      camera.lookAt(0, centre, 0);
      camera.updateProjectionMatrix();
      for (const label of slot.labels) label.position.x = -halfWidth + 0.24;
      if (ghost && slot.look !== this.template) slot.turn.add(ghost.holder);
      else ghost?.holder.removeFromParent();
      slot.turn.rotation.y = this.yaw;
      slot.main.preview.pose?.(this.time, this.walking);
      this.renderer.render(slot.scene, camera);
    }
  };
}
