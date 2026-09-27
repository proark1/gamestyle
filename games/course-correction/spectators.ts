import * as T from 'three';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';
import {
  SpectatorEventTracker,
  spectatorDetail,
} from './spectator-presentation';
import type { CourseSnapshot } from './types';

type AnimatedFan = {
  model: T.Group;
  baseY: number;
  phase: number;
  style: 'wave' | 'hero';
};

const LOOKS: Look[] = [
  {},
  { hat: 'bobble-beanie' },
  { top: 'striped-tee' },
  {},
  { hat: 'skipper-cap' },
  { top: 'bow-tie' },
];

const SHIRTS = [
  '#d97863',
  '#e2b43c',
  '#5a9a55',
  '#4d7ab0',
  '#679e99',
  '#8b81af',
];

export class CourseSpectators {
  readonly root = new T.Group();
  private animated: AnimatedFan[] = [];
  private events = new SpectatorEventTracker();
  private excitement = 0;
  private excitedUntil = 0;

  constructor(reducedMotion: boolean, mobile: boolean) {
    this.root.name = 'course-spectators';
    const detail = spectatorDetail(reducedMotion, mobile);
    this.build(detail.total, detail.animated);
  }

  private build(total: number, animatedCount: number) {
    const animatedRoots: T.Group[] = [];
    const positions = [
      [-6.25, 3.4, 1.48],
      [-6.25, 4.35, 1.48],
      [6.25, 3.45, -1.48],
      [6.25, 4.4, -1.48],
      [-6.25, 9.15, 1.48],
      [-6.25, 10.1, 1.48],
      [6.25, 9.2, -1.48],
      [6.25, 10.15, -1.48],
      [-6.25, 14.75, 1.48],
      [-6.25, 15.7, 1.48],
      [6.25, 14.8, -1.48],
      [6.25, 15.75, -1.48],
    ] as const;

    for (let index = 0; index < total; index++) {
      const [x, z, facing] = positions[index];
      const model = dressedGameAvatar(
        index,
        {
          shirt: SHIRTS[index % SHIRTS.length],
          overalls: index % 3 === 0 ? CLOTH.denim : CLOTH.slate,
          boots: index % 2 ? CLOTH.cream : CLOTH.brown,
          trousers: true,
        },
        LOOKS[index % LOOKS.length],
      ).model;
      const seated = index % 3 !== 1;
      model.scale.setScalar(0.68 + (index % 3) * 0.025);
      model.position.set(
        x + (index % 2 ? 0.52 : -0.52),
        seated ? 0.2 : -0.25,
        z,
      );
      model.rotation.y = facing;
      const rig = model.userData as Record<string, T.Group>;
      if (seated) {
        rig.legL.rotation.x = rig.legR.rotation.x = -1.22;
        rig.armL.rotation.set(-0.7, 0, -0.12);
        rig.armR.rotation.set(-0.7, 0, 0.12);
      }
      this.root.add(model);
      if (this.animated.length < animatedCount) {
        this.animated.push({
          model,
          baseY: model.position.y,
          phase: index * 1.73,
          style: index % 2 ? 'wave' : 'hero',
        });
        animatedRoots.push(model);
      }
    }
    batchScenery(this.root, animatedRoots, true);
  }

  update(snapshot: CourseSnapshot, now: number, dt: number) {
    const reaction = this.events.ingest(snapshot.world.events);
    if (reaction) {
      this.excitement = Math.max(this.excitement, reaction.intensity);
      this.excitedUntil = Math.max(this.excitedUntil, now + reaction.duration);
    }
    if (now > this.excitedUntil)
      this.excitement *= Math.exp(-Math.max(0, dt) * 2.6);
    const seconds = now / 1_000;
    for (const fan of this.animated) {
      const active = this.excitement > 0.12;
      poseWorker(fan.model, seconds + fan.phase, active ? fan.style : 'still');
      fan.model.position.y =
        fan.baseY +
        Math.sin(seconds * 1.7 + fan.phase) * 0.012 +
        this.excitement * Math.max(0, Math.sin(seconds * 7 + fan.phase)) * 0.07;
    }
  }

  dispose() {
    this.events.reset();
    disposeObject(this.root);
    this.root.clear();
    this.animated = [];
  }
}
