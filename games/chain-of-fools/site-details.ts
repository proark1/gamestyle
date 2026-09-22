import * as T from 'three';
import {
  box,
  beam,
  ball,
  label,
  material,
} from '../../shared/rendering/primitives';
import { machineryAt, courseSeconds } from './course';
import type { ChainWorld } from './types';

const YELLOW = '#f4bd32';
const DARK = '#34454a';
const TEAL = '#377f87';

export type SiteDetails = {
  machines: Map<string, T.Group>;
  cranes: T.Group[];
  lamps: T.Mesh[];
};

/** The colliding machinery and its visible body share a single box definition.
 * Cables and overhead guides are decoration outside worker headroom. */
export function createSiteDetails(root: T.Group): SiteDetails {
  const machines = new Map<string, T.Group>();
  const lamps: T.Mesh[] = [];
  for (const bounds of machineryAt(0)) {
    const g = new T.Group();
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const d = bounds.maxZ - bounds.minZ;
    const deck = bounds.id === 'cargo-shuttle';
    box(g, [w, h, d], [0, 0, 0], deck ? TEAL : YELLOW);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.55) {
      box(g, [0.14, 0.014, d - 0.08], [x, h / 2 + 0.008, 0], DARK);
    }
    for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) {
      for (const z of [-d / 2 + 0.16, d / 2 - 0.16]) {
        beam(g, [x, h / 2, z], [x, h / 2 + 5, z], 0.035, DARK);
        box(g, [0.22, 0.04, 0.22], [x, h / 2 + 0.025, z], YELLOW);
      }
    }
    if (!deck) {
      for (let y = -h / 2 + 0.3; y < h / 2; y += 0.65)
        box(g, [w + 0.015, 0.18, d + 0.015], [0, y, 0], DARK);
    }
    root.add(g);
    machines.set(bounds.id, g);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const top = bounds.maxY + 5;
    for (const z of [-6.2, 6.2]) {
      beam(root, [cx, -8, z], [cx, top, z], 0.32, TEAL);
      beam(root, [cx - 1.5, -8, z], [cx, top - 2, z], 0.13, DARK);
      const lamp = ball(root, [0.18, 0.18, 0.18], [cx, top + 0.2, z], YELLOW);
      lamps.push(lamp);
    }
    beam(root, [cx, top, -6.2], [cx, top, 6.2], 0.3, TEAL);
  }

  // Three visual districts: rusted steel, teal freight equipment and a busy
  // amber office yard. All scenery stays outside the traversable strip.
  for (const [x, y, z, text] of [
    [12, 2.1, -7, '01 / STEELWORKS'],
    [47, 3, -6.8, '02 / DEMOLITION'],
    [120, 2.6, -6.2, '03 / FREIGHT YARD'],
    [163, 3, -7, '04 / CLOCK IN'],
  ] as const) {
    beam(root, [x, -2, z], [x, y, z], 0.12, DARK);
    const plaque = label(text, DARK, '#fff4d2', 4.5);
    plaque.position.set(x, y, z);
    root.add(plaque);
  }
  for (let i = 0; i < 18; i++) {
    const x = 8 + i * 9;
    const z = i % 2 ? -10.5 : 11.5;
    const y = -5 - (i % 3) * 2;
    box(root, [7, 0.4, 4.5], [x, y, z], '#948d79');
    beam(root, [x - 2.5, -29, z], [x - 2.5, y, z], 0.4, DARK);
    beam(root, [x + 2.5, -29, z], [x + 2.5, y, z], 0.4, DARK);
    // Corrugated freight containers, stacked pallets and service equipment.
    if (i % 3 === 0) {
      box(root, [5.4, 2.8, 2.7], [x, y + 1.6, z], i % 2 ? TEAL : '#b85c3b');
      for (let rib = -2.5; rib <= 2.5; rib += 0.4)
        box(root, [0.06, 2.6, 2.78], [x + rib, y + 1.6, z], DARK);
      box(root, [0.07, 2.5, 0.07], [x + 2.75, y + 1.6, z + 0.6], YELLOW);
    } else {
      for (let layer = 0; layer < 3; layer++)
        for (let slat = 0; slat < 5; slat++)
          box(
            root,
            [2.8, 0.13, 0.27],
            [x, y + 0.3 + layer * 0.28, z - 0.7 + slat * 0.35],
            '#ad7e47',
          );
      box(root, [0.8, 1.2, 0.65], [x + 2, y + 0.8, z], TEAL);
      const lamp = ball(root, [0.12, 0.12, 0.12], [x + 2, y + 1.52, z], YELLOW);
      lamps.push(lamp);
    }
    // Perimeter handrails stay on the service platforms, clear of the course.
    beam(root, [x - 3, y + 1.1, z + 2], [x + 3, y + 1.1, z + 2], 0.08, YELLOW);
    for (const dx of [-3, 0, 3])
      beam(root, [x + dx, y, z + 2], [x + dx, y + 1.1, z + 2], 0.06, DARK);
  }

  const cranes: T.Group[] = [];
  for (const [x, z, height] of [
    [32, 18, 15],
    [100, -19, 21],
    [150, 20, 16],
  ]) {
    beam(root, [x, -30, z], [x, height, z], 0.5, YELLOW);
    const jib = new T.Group();
    jib.position.set(x, height, z);
    root.add(jib);
    beam(jib, [-4, 0, 0], [12, 0, 0], 0.3, YELLOW);
    beam(jib, [-4, 0, 0], [0, 3, 0], 0.075, DARK);
    beam(jib, [0, 3, 0], [12, 0, 0], 0.075, DARK);
    beam(jib, [9, 0, 0], [9, -6, 0], 0.04, DARK);
    box(jib, [2, 1.4, 1.6], [9, -6.7, 0], '#c87841');
    box(jib, [1.5, 1.3, 1.2], [-3, -0.4, 0], DARK);
    cranes.push(jib);
  }
  // Hazard-zone paint sits on solid staging platforms only.
  for (const [x, y, width] of [
    [64.8, 7.21, 2.2],
    [123.2, 0.015, 4],
    [155, 0.015, 1.8],
  ])
    for (let stripe = 0; stripe < 4; stripe++)
      box(
        root,
        [0.14, 0.014, width],
        [x - stripe * 0.25, y, 0],
        stripe % 2 ? DARK : YELLOW,
      );
  return { machines, cranes, lamps };
}

export function animateSiteDetails(
  details: SiteDetails,
  world: ChainWorld,
  calm: boolean,
) {
  const seconds = world.phase === 'lobby' ? 0 : courseSeconds(world);
  for (const b of machineryAt(seconds)) {
    details.machines
      .get(b.id)
      ?.position.set(
        (b.minX + b.maxX) / 2,
        (b.minY + b.maxY) / 2,
        (b.minZ + b.maxZ) / 2,
      );
  }
  details.cranes.forEach((crane, i) => {
    crane.rotation.y = calm ? i : Math.sin(seconds * 0.12 + i * 2) * 0.3 + i;
  });
  details.lamps.forEach((lamp, i) => {
    lamp.material = material(
      calm || Math.sin(seconds * 2 + i) > -0.3 ? YELLOW : '#ac7730',
    );
  });
}
