import type { CourseWorld } from './types';

export type GestureKind = 'shot' | 'orbit';

type ScreenPoint = { x: number; y: number };

export function classifyPointerGesture({
  pointer,
  ball,
  canShoot,
  pointerType,
  pointerCount,
}: {
  pointer: ScreenPoint;
  ball: ScreenPoint | null;
  canShoot: boolean;
  pointerType: string;
  pointerCount: number;
}): GestureKind {
  if (!canShoot || !ball || pointerCount !== 1) return 'orbit';
  const radius = pointerType === 'touch' ? 64 : 48;
  return Math.hypot(pointer.x - ball.x, pointer.y - ball.y) <= radius
    ? 'shot'
    : 'orbit';
}

export function aimPreviewRevision(world: CourseWorld, playerId: string) {
  const player = world.players.find((candidate) => candidate.id === playerId);
  const ball = world.balls.find((candidate) => candidate.owner === playerId);
  if (!player || !ball) return null;
  return [
    playerId,
    world.hole,
    world.phase,
    player.holeStrokes,
    Number(player.openingReady),
    Number(ball.holed),
  ].join(':');
}
