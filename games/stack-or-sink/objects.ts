import { box, beam, label } from '../../shared/rendering/primitives';
import * as T from 'three';
import { GOAL, ITEMS, type Kind } from './types';
import { RESCUE_ENTRY_WIDTH, SCENERY, salvageShapes } from './geometry';
import { islandCoast } from './coast';
export function junk(kind: Kind) {
  const g = new T.Group();
  const { w, h, d } = ITEMS[kind];
  for (const shape of salvageShapes(kind)) {
    const mesh = box(g, shape.size, shape.pos, shape.color, shape.rounded);
    mesh.userData.surface = true;
  }
  if (kind === 'crate') {
    for (const y of [0.17, h - 0.17])
      for (const x of [-w / 2, w / 2])
        box(g, [0.04, 0.16, d - 0.08], [x, y, 0], '#86643f');
    // Give the wrapping bands a real raised surface on top, bottom and ends.
    // Coplanar tops (and near-flush ends) fought the wood in the depth buffer.
    for (const x of [-0.55, 0.55])
      box(g, [0.15, h + 0.04, d + 0.04], [x, h / 2, 0], '#d3b07b');
  }
  if (kind === 'fridge') {
    box(
      g,
      [w - 0.12, 0.57, 0.02],
      [0, h - 0.34, d / 2 + 0.005],
      '#bfcec1',
      true,
    );
    for (const y of [0.67, 1.45])
      box(g, [0.07, 0.31, 0.045], [0.46, y, d / 2 + 0.015], '#536f68');
  }

  return g;
}
export function island() {
  const g = islandCoast();
  for (const shape of SCENERY) {
    if (shape.id === 'ground') continue;
    const mesh = box(g, shape.size, shape.pos, shape.color, shape.rounded);
    mesh.rotation.y = shape.rotationY || 0;
    mesh.userData.surface = true;
    mesh.userData.scenery = shape.id;
  }
  box(g, [1, 1.9, 0.08], [-7, 0.97, -5.56], '#e7ca83');
  box(g, [1.1, 0.8, 0.07], [-8.25, 1.75, -5.55], '#b4d5ce');
  const sign = label('SALVAGE CO.', '#f3d783', '#395347', 3);
  sign.position.set(-7, 3.25, -6);
  g.add(sign);

  // Contrasting thresholds and inward chevrons make the landable deck and
  // the openings legible when approaching from the isometric camera.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const entry = new T.Group();
    entry.rotation.y = angle;
    entry.position.y = GOAL;
    box(entry, [RESCUE_ENTRY_WIDTH, 0.025, 0.12], [0, 0.0125, 2.2], '#426357');
    for (const x of [-0.28, 0.28])
      beam(entry, [x, 0.025, 1.92], [0, 0.025, 1.64], 0.045, '#426357');
    g.add(entry);
  }

  const rescue = label(`RESCUE · ${GOAL} m`, '#ffe5a0', '#426357', 4.1);
  rescue.position.set(0, GOAL + 1.2, 0);
  g.add(rescue);
  return g;
}
