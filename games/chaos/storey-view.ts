import * as T from 'three';
import type { Piece } from './model';
import { levelOf } from './levels';

export const OTHER_STOREY_OPACITY = 0.17;

export function onOtherStorey(piece: Piece, selectedLevel: number | null) {
  return (
    selectedLevel !== null &&
    piece.placed &&
    !piece.heldBy &&
    !piece.hoisted &&
    !piece.supply &&
    levelOf(piece) !== selectedLevel
  );
}

type Surface = {
  object: T.Mesh | T.Line;
  castShadow: boolean;
  receiveShadow: boolean;
  materials: {
    material: T.Material;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
  }[];
};
type StoreyView = { faded: boolean; surfaces: Surface[] };

/** Keep other storeys visible without hiding the active floor behind their depth or shadows. */
export function fadeStorey(group: T.Group, faded: boolean) {
  let view = group.userData.storeyView as StoreyView | undefined;
  if (!view && !faded) return;
  if (view?.faded === faded) return;
  if (!view) {
    view = { faded: false, surfaces: [] };
    const surfaces = view.surfaces;
    group.traverse((object) => {
      if (!(object instanceof T.Mesh || object instanceof T.Line)) return;
      // Mesh colours are shared across pieces. Each faded object owns its variants.
      const original = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const materials = original.map((material) => ({
        material:
          object.userData.ownedMaterial || object instanceof T.Line
            ? material
            : material.clone(),
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      }));
      object.material = Array.isArray(object.material)
        ? materials.map((m) => m.material)
        : materials[0].material;
      object.userData.ownedMaterial = true;
      surfaces.push({
        object,
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
        materials,
      });
    });
    group.userData.storeyView = view;
  }
  view.faded = faded;
  for (const surface of view.surfaces) {
    surface.object.castShadow = !faded && surface.castShadow;
    surface.object.receiveShadow = !faded && surface.receiveShadow;
    for (const original of surface.materials) {
      const { material } = original;
      const transparent = faded || original.transparent;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = original.opacity * (faded ? OTHER_STOREY_OPACITY : 1);
      material.depthWrite = !faded && original.depthWrite;
    }
  }
}
