import * as T from 'three';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { disposeObject } from '../../shared/rendering/dispose-object';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { CLOTH } from '../../shared/rendering/palette';
import { poseWorker } from '../../shared/rendering/worker-pose';
import type { Look } from '../../shared/wardrobe/look';
import {
  SpectatorEventTracker,
  seatedSpectatorRootY,
  spectatorAnchors,
  spectatorDetail,
} from './spectator-presentation';
import type { CourseSnapshot } from './types';

type AnimatedFan = {
  model: T.Group;
  baseY: number;
  phase: number;
  style: 'wave' | 'hero';
  seated: boolean;
};

function poseSeated(model: T.Group) {
  const rig = model.userData as Record<string, T.Group>;
  rig.legL?.rotation.set(-1.3, 0, -0.08);
  rig.legR?.rotation.set(-1.3, 0, 0.08);
  rig.armL?.rotation.set(-0.7, 0, -0.12);
  rig.armR?.rotation.set(-0.7, 0, 0.12);
  if (rig.body) rig.body.rotation.x = -0.06;
}

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
    const anchors = spectatorAnchors(total);

    for (let index = 0; index < total; index++) {
      const { x, z, facing, seated } = anchors[index];
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
      const scale = 0.68 + (index % 3) * 0.025;
      model.scale.setScalar(scale);
      model.position.set(x, seated ? seatedSpectatorRootY(scale) : -0.25, z);
      model.rotation.y = facing;
      if (seated) poseSeated(model);
      this.root.add(model);
      if (this.animated.length < animatedCount) {
        this.animated.push({
          model,
          baseY: model.position.y,
          phase: index * 1.73,
          style: index % 2 ? 'wave' : 'hero',
          seated,
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
      if (fan.seated) poseSeated(fan.model);
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
