import * as T from 'three';
import { ball, box, label, taper } from '../../shared/rendering/primitives';
import { buildStandaloneItem } from '../../shared/rendering/cosmetics/standalone-item';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH, seatKit } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { OBJECTS } from './types';

export function flipLabel(text: string, bg = '#fff4d6', width = 1.5) {
  const tag = label(text, bg, '#38433c', width);
  tag.material.toneMapped = false;
  if (tag.material.map) tag.material.map.colorSpace = T.SRGBColorSpace;
  return tag;
}
export function flipPlayer(seat: number, color: number, look?: Look) {
  return dressedGameAvatar(
    color,
    {
      shirt: seatKit(seat),
      overalls: CLOTH.cream,
      boots: CLOTH.brown,
      trousers: false,
    },
    look,
  ).model;
}
/** Hat, cone and boots share the exact wardrobe meshes. Only the three new props are authored here. */
export function flipObject(index: number, color = '#4d7ab0') {
  const item = OBJECTS[index],
    g = new T.Group();
  if (item.item) {
    const native = buildStandaloneItem(
      item.item,
      item.id === 'cone' ? CLOTH.hivis : color,
    );
    const size = new T.Box3().setFromObject(native).getSize(new T.Vector3());
    native.scale.setScalar(item.height / Math.max(0.01, size.y));
    g.add(native);
    if (item.id === 'cone')
      box(g, [0.74, 0.07, 0.74], [0, -item.height / 2, 0], CLOTH.hivis, true);
  } else if (item.id === 'bottle') {
    taper(g, 0.17, 0.19, 0.52, [0, -0.12, 0], '#c2dad6', 16);
    taper(g, 0.075, 0.17, 0.18, [0, 0.23, 0], '#c2dad6', 16);
    taper(g, 0.078, 0.078, 0.15, [0, 0.35, 0], color, 16);
    taper(g, 0.176, 0.184, 0.2, [0, -0.12, 0], CLOTH.cream, 16);
    box(g, [0.14, 0.11, 0.018], [0, -0.12, 0.186], color, true);
  } else if (item.id === 'pan') {
    taper(g, 0.46, 0.38, 0.18, [0, 0, 0], CLOTH.charcoal, 24);
    taper(g, 0.37, 0.37, 0.03, [0, 0.1, 0], CLOTH.silver, 24);
    box(g, [0.15, 0.1, 0.75], [0, 0.01, 0.68], CLOTH.brown, true);
    ball(g, [0.18, 0.03, 0.18], [0, 0.13, 0], CLOTH.cream, 16);
    ball(g, [0.075, 0.045, 0.075], [0, 0.16, 0], CLOTH.gold);
  } else {
    box(g, [1.16, 1.18, 1.08], [0, 0, 0], CLOTH.white, true);
    box(g, [1.2, 0.13, 1.12], [0, 0.6, 0], '#bed0cf', true);
    box(g, [0.99, 0.18, 0.035], [0, 0.4, 0.56], '#c3d0cc', true);
    ball(g, [0.085, 0.085, 0.035], [0.34, 0.4, 0.59], color);
    box(g, [0.29, 0.055, 0.03], [-0.25, 0.4, 0.6], CLOTH.charcoal);
    const door = taper(g, 0.38, 0.38, 0.08, [0, -0.08, 0.57], '#687d87', 32);
    door.rotation.x = Math.PI / 2;
    const glass = taper(g, 0.29, 0.29, 0.09, [0, -0.08, 0.62], '#304b5a', 32);
    glass.rotation.x = Math.PI / 2;
    ball(g, [0.17, 0.09, 0.03], [-0.06, -0.12, 0.68], '#b2cdd5');
  }
  return g;
}
