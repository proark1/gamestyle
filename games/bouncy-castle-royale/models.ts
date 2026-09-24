import * as T from 'three';
import { ball, box, label, taper } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { poseWorker } from '../../shared/rendering/worker-pose';
import { CLOTH, TEAM } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import type { Player, Team } from './types';

export function castleLabel(text: string, bg: string, width: number) {
  const tag = label(text, bg, '#29402c', width);
  tag.material.toneMapped = false;
  if (tag.material.map) tag.material.map.colorSpace = T.SRGBColorSpace;
  return tag;
}

export function castlePlayer(team: Team, color: number, look?: Look) {
  return dressedGameAvatar(
    color,
    {
      shirt: TEAM[team],
      overalls: CLOTH.white,
      boots: TEAM[team],
      trousers: false,
    },
    look,
  ).model;
}
export function posePlayer(model: T.Group, p: Player, time: number) {
  poseWorker(
    model,
    time,
    !p.grounded ? 'hero' : Math.hypot(p.vx, p.vz) > 0.3 ? 'walk' : 'still',
  );
  const rig = model.userData;
  if (p.swingUntil > time * 1000) {
    rig.armL.rotation.x = -2.5;
    rig.armR.rotation.x = -2.5;
  } else if (p.input.pump) {
    rig.armL.rotation.x = rig.armR.rotation.x =
      -0.8 + Math.sin(time * 16) * 0.4;
  }
  if (p.input.brace) rig.body.rotation.x = 0.22;
}
export function tower(x: number, z: number, color: string) {
  const g = new T.Group();
  g.position.set(x, 0, z);
  taper(g, 0.72, 0.88, 3.8, [0, 1.9, 0], color, 16);
  ball(g, [0.85, 0.25, 0.85], [0, 3.7, 0], CLOTH.gold);
  taper(g, 0, 1.05, 1.5, [0, 4.6, 0], '#a399bd', 12);
  ball(g, [0.18, 0.18, 0.18], [0, 5.4, 0], CLOTH.gold);
  box(g, [0.12, 1.3, 0.12], [0, 5.9, 0], CLOTH.cream, true);
  box(g, [0.85, 0.38, 0.08], [0.4, 6.3, 0], color, true);
  return g;
}
