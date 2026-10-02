import { type BungeeWorld, type Player } from './types';
import { bungeeAction } from './simulation';
export { reconcileBungeeBots } from './simulation';

export function stepBungeeBot(
  bot: Player,
  w: BungeeWorld,
  dt: number,
  now = Date.now(),
): void {
  bot.input.swing = false;
  bot.input.smash = false;
  bot.input.dive = false;
  bot.input.jump = false;

  if (bot.stunnedUntil > now || !['serving', 'rally'].includes(w.phase)) {
    bot.input.x = 0;
    bot.input.z = 0;
    return;
  }

  const ball = w.ball;
  const isServer = w.phase === 'serving' && w.servingPlayerId === bot.id;

  // 1. Serving logic
  if (isServer) {
    // Face the opponent side and hit the serve
    bot.input.x = 0;
    bot.input.z = 0;
    bot.facing = bot.team === 'red' ? 0 : Math.PI;
    if (Math.random() < 1 - Math.pow(0.92, dt * 60)) {
      bungeeAction(w, bot.id, { type: 'swing' }, now);
    }
    return;
  }

  // 2. Rally logic
  // Partner coordination:
  const partner = w.players.find((p) => p.team === bot.team && p.id !== bot.id);

  // Target default position (if ball is on the other side)
  const isRed = bot.team === 'red';
  const defaultZ = isRed ? -5.5 : 5.5;
  const slotOffset = bot.id.includes('1') ? -2.2 : 2.2;
  let targetX = slotOffset;
  let targetZ = defaultZ;

  const ballOnOurSide = (isRed && ball.z < 0) || (!isRed && ball.z > 0);

  if (
    ballOnOurSide &&
    ball.state === 'in_play' &&
    ball.lastHitTeam !== bot.team
  ) {
    // Intercept ball
    const distToBall = Math.hypot(ball.x - bot.x, ball.z - bot.z);
    const partnerDistToBall = partner
      ? Math.hypot(ball.x - partner.x, ball.z - partner.z)
      : 999;

    // Decide whether bot or partner should go for it
    const shouldGoForBall =
      distToBall < partnerDistToBall ||
      (distToBall === partnerDistToBall && bot.id < (partner?.id ?? ''));

    if (shouldGoForBall) {
      // Padel glass wall anticipation:
      // If ball has bounced once and is heading deep into the back glass, wait for the rebound
      const headingToBackGlass =
        (isRed && ball.z < -8.5 && ball.vz < -2) ||
        (!isRed && ball.z > 8.5 && ball.vz > 2);

      if (headingToBackGlass && ball.bouncesOnCurrentSide >= 1) {
        targetX = ball.x;
        targetZ = isRed ? -8.2 : 8.2;
      } else {
        targetX = ball.x;
        targetZ = ball.z;
      }

      // When ball is in range, swing or smash!
      if (distToBall <= 2.2 && ball.y <= 2.8) {
        bot.facing = Math.atan2(ball.x - bot.x, ball.z - bot.z);

        if (ball.y > 1.8 && bot.grounded) {
          // Jump for overhead smash
          bungeeAction(w, bot.id, { type: 'jump' }, now);
          bungeeAction(w, bot.id, { type: 'smash' }, now);
        } else if (
          distToBall > 1.7 &&
          Math.random() < 1 - Math.pow(0.7, dt * 60)
        ) {
          // Dive save
          bungeeAction(w, bot.id, { type: 'dive' }, now);
          bungeeAction(w, bot.id, { type: 'swing' }, now);
        } else {
          // Normal volley
          bungeeAction(w, bot.id, { type: 'swing' }, now);
        }
      }
    } else {
      // Partner is closer: stay balanced and avoid overstretching the tether!
      if (partner) {
        targetX = -partner.x * 0.6;
        targetZ = defaultZ;
      }
    }
  }

  // Steer towards target position
  const dx = targetX - bot.x;
  const dz = targetZ - bot.z;
  const dist = Math.hypot(dx, dz);

  if (dist > 0.3) {
    bot.input.x = dx / dist;
    bot.input.z = dz / dist;
  } else {
    bot.input.x = 0;
    bot.input.z = 0;
  }
}
