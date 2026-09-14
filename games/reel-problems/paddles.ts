import {
  BOAT_HALF,
  PADDLE_REACH,
  PADDLE_THRUST,
  PADDLE_TURN,
  type Angler,
  type ReelWorld,
} from './types';

export const paddleSide = (side: number) => (side < 0 ? 'port' : 'starboard');

/** Takes up, or puts down, the paddle on the rail an angler is standing at. */
export function togglePaddle(w: ReelWorld, p: Angler) {
  if (p.paddle) {
    p.paddle = 0;
    return;
  }
  if (p.swimming) throw new Error('Climb aboard before you paddle.');
  if (p.line) throw new Error('Cut or finish your line before you paddle.');
  if (Math.abs(p.x) < BOAT_HALF.x - PADDLE_REACH)
    throw new Error('Walk to the rail to take a paddle.');
  const side = p.x < 0 ? -1 : 1;
  const holder = w.players.find((o) => o !== p && o.paddle === side);
  if (holder)
    throw new Error(`${holder.name} has the ${paddleSide(side)} paddle.`);
  p.paddle = side;
  p.x = side * BOAT_HALF.x;
  // Paddlers kneel facing the bow.
  p.facing = Math.PI;
}

/**
 * One paddler's push this frame, in lake newtons. Up strokes forward and down
 * strokes back. The push comes from the rail, so a lone paddler also swings
 * the bow away from their side, as in a canoe: going straight takes a friend
 * on the other rail, or switching sides.
 */
export function paddleStroke(w: ReelWorld, p: Angler) {
  const raw = Math.max(-1, Math.min(1, -p.input.z)),
    thrust = (Math.abs(raw) < 0.2 ? 0 : raw) * PADDLE_THRUST,
    c = Math.cos(w.boat.yaw),
    s = Math.sin(w.boat.yaw);
  return {
    x: -s * thrust,
    z: -c * thrust,
    torque: p.paddle * BOAT_HALF.x * thrust * PADDLE_TURN,
  };
}
