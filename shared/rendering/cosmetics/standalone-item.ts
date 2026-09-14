import * as T from 'three';
import { COLORS } from '../palette';
import { ball, box, taper, disposeGeometry } from '../primitives';
import { ITEM_MODELS, PLAYER } from './items';

/**
 * Builds an isolated 3D model of a wardrobe item for showcase / inspection,
 * centered at the origin (0, 0, 0).
 */
export function buildStandaloneItem(
  id: string,
  playerColor: string = COLORS[0],
): T.Group {
  const modelDef = ITEM_MODELS[id];
  const group = new T.Group();
  if (!modelDef) return group;

  // Mount garments / outfits on appropriate display forms
  if (modelDef.slot === 'top') {
    // Torso mannequin bust
    box(group, [0.65, 0.64, 0.41], [0, 0.87, 0], '#ddd3bf', true);
  } else if (modelDef.slot === 'legs') {
    // Trousers mannequin form with bib & hips
    const col = modelDef.overalls ?? '#385d63';
    box(group, [0.59, 0.25, 0.45], [0, 0.54, 0], col, true);
    box(group, [0.34, 0.44, 0.06], [0, 0.81, 0.25], col);
    for (const x of [-0.23, 0.23]) {
      box(group, [0.09, 0.5, 0.06], [x, 0.94, 0.24], col);
    }
    box(group, [0.24, 0.38, 0.28], [-0.19, 0.32, 0], col, true);
    box(group, [0.24, 0.38, 0.28], [0.19, 0.32, 0], col, true);
  } else if (modelDef.slot === 'shoes') {
    // Pair of display boots
    const col = modelDef.boots ?? '#4c4840';
    box(group, [0.3, 0.18, 0.43], [-0.19, 0.09, 0.065], col, true);
    box(group, [0.3, 0.18, 0.43], [0.19, 0.09, 0.065], col, true);
  }

  for (const part of modelDef.parts) {
    const colour = part.colour === PLAYER ? playerColor : part.colour;
    if (part.on === 'legs' || part.on === 'arms') {
      for (const side of [-1, 1]) {
        const at = [
          side * 0.19 + part.at[0] * side,
          0.5 + part.at[1],
          part.at[2],
        ];
        const mesh =
          part.shape === 'box'
            ? box(group, part.size, at, colour, part.rounded)
            : part.shape === 'ball'
              ? ball(group, part.size, at, colour)
              : taper(
                  group,
                  part.top,
                  part.bottom,
                  part.height,
                  at,
                  colour,
                  part.sides,
                );
        if (part.turn)
          mesh.rotation.set(
            part.turn[0],
            part.turn[1] * side,
            part.turn[2] * side,
          );
      }
    } else {
      const at = [...part.at];
      const mesh =
        part.shape === 'box'
          ? box(group, part.size, at, colour, part.rounded)
          : part.shape === 'ball'
            ? ball(group, part.size, at, colour)
            : taper(
                group,
                part.top,
                part.bottom,
                part.height,
                at,
                colour,
                part.sides,
              );
      if (part.turn)
        mesh.rotation.set(part.turn[0], part.turn[1], part.turn[2]);
    }
  }

  // Center bounding box around (0, 0, 0)
  const bbox = new T.Box3().setFromObject(group);
  const center = bbox.getCenter(new T.Vector3());
  group.position.sub(center);

  const wrapper = new T.Group();
  wrapper.add(group);
  return wrapper;
}

/** Global memory cache for pre-rendered item thumbnails. */
const THUMBNAIL_CACHE = new Map<string, string>();

/**
 * Generates crisp 3D thumbnail image data URLs for items using an offscreen canvas.
 * Subsequent requests return cached data URLs instantly.
 */
export function getItemThumbnails(
  itemIds: readonly string[],
  playerColor: string = COLORS[0],
): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return result;
  }

  const missing = itemIds.filter((id) => !THUMBNAIL_CACHE.has(id));
  if (missing.length === 0) {
    for (const id of itemIds) {
      const cached = THUMBNAIL_CACHE.get(id);
      if (cached) result[id] = cached;
    }
    return result;
  }

  try {
    const width = 140;
    const height = 140;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = T.SRGBColorSpace;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, 1, 0.1, 20);

    const ambient = new T.AmbientLight(0xfff5ea, 2.2);
    scene.add(ambient);
    const sun = new T.DirectionalLight(0xffffff, 2.4);
    sun.position.set(2, 3.5, 3);
    scene.add(sun);
    const fill = new T.DirectionalLight(0xdbe6ff, 1.2);
    fill.position.set(-2, 1.5, -2);
    scene.add(fill);

    const holder = new T.Group();
    scene.add(holder);

    for (const id of missing) {
      if (!ITEM_MODELS[id]) continue;
      const model = buildStandaloneItem(id, playerColor);
      holder.add(model);

      // Angle to showcase 3D depth
      holder.rotation.set(0.12, 0.42, 0);

      const bbox = new T.Box3().setFromObject(holder);
      const size = bbox.getSize(new T.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z, 0.35);
      const halfFov = (camera.fov * Math.PI) / 360;
      const dist = (maxDim / (2 * Math.tan(halfFov))) * 1.35;

      camera.position.set(0, 0.05, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

      renderer.render(scene, camera);
      const url = canvas.toDataURL('image/png');
      THUMBNAIL_CACHE.set(id, url);

      holder.remove(model);
      model.traverse((child) => {
        if (child instanceof T.Mesh) {
          disposeGeometry(child.geometry);
        }
      });
    }

    renderer.dispose();
  } catch (err) {
    console.error('Failed to generate item thumbnails:', err);
  }

  for (const id of itemIds) {
    const cached = THUMBNAIL_CACHE.get(id);
    if (cached) result[id] = cached;
  }
  return result;
}
