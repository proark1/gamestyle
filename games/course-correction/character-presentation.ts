import { clamp } from '../../shared/math/clamp';
import { cupPosition } from './courses';
import type {
  CourseEvent,
  CourseSnapshot,
  CourseState,
  CourseWorld,
  GolfBall,
} from './types';

export type CharacterMode = 'ready' | 'swing' | 'watch' | 'walk' | 'celebrate';

export type CharacterPoint = { x: number; z: number };

export function stagingPosition(
  course: CourseState,
  ball: Pick<GolfBall, 'x' | 'z'>,
  aim: number,
): CharacterPoint {
  const distance = 0.92;
  return {
    x: clamp(
      ball.x - Math.sin(aim) * distance,
      -course.width / 2 + 0.42,
      course.width / 2 - 0.42,
    ),
    z: clamp(ball.z - Math.cos(aim) * distance, -0.62, course.length - 0.42),
  };
}

export function celebrationPosition(
  course: CourseState,
  seat: number,
): CharacterPoint {
  const cup = cupPosition(course);
  const angles = [-2.25, 2.25, -1.25, 1.25];
  const angle = angles[seat % angles.length];
  return {
    x: clamp(
      cup.x + Math.sin(angle) * 1.05,
      -course.width / 2 + 0.42,
      course.width / 2 - 0.42,
    ),
    z: clamp(cup.z + Math.cos(angle) * 1.05, -0.2, course.length - 0.42),
  };
}

export function characterMode(
  world: CourseWorld,
  playerId: string,
  distanceToTarget: number,
  swinging = false,
): CharacterMode {
  if (swinging) return 'swing';
  const ball = world.balls.find((candidate) => candidate.owner === playerId);
  if (!ball) return 'ready';
  if (ball.holed) return 'celebrate';
  if (ball.moving) return 'watch';
  return distanceToTarget > 0.12 ? 'walk' : 'ready';
}

export type CharacterReaction = {
  eventId: number;
  player: string;
  kind: 'swing' | 'cup' | 'assist' | 'celebrate';
};

export class CharacterEventTracker {
  private seen = new Set<number>();

  ingest(snapshot: CourseSnapshot): CharacterReaction[] {
    const reactions: CharacterReaction[] = [];
    for (const event of snapshot.world.events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      if (event.kind === 'multi-cup') {
        for (const player of snapshot.world.players)
          reactions.push({
            eventId: event.id,
            player: player.id,
            kind: 'celebrate',
          });
      } else if (
        event.player &&
        (event.kind === 'shot' ||
          event.kind === 'cup' ||
          event.kind === 'assist')
      ) {
        reactions.push({
          eventId: event.id,
          player: event.player,
          kind: event.kind === 'shot' ? 'swing' : event.kind,
        });
      }
    }
    return reactions;
  }

  reset() {
    this.seen.clear();
  }
}

export function facingAngle(from: CharacterPoint, to: CharacterPoint) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function recentPlayerEvent(
  events: readonly CourseEvent[],
  playerId: string,
  kind: CourseEvent['kind'],
) {
  return [...events]
    .reverse()
    .find((event) => event.player === playerId && event.kind === kind);
}
