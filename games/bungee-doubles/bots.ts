import { TEAMS, type BungeeWorld, type Player } from './types';
import { bungeeAction, newPlayer } from './simulation';

const BOT_NAMES_ORANGE = ['Ace-Bot', 'Lob-Bot'];
const BOT_NAMES_TEAL = ['Smash-Bot', 'Volley-Bot'];

export function reconcileBungeeBots(w: BungeeWorld): void {
  for (const team of TEAMS) {
    const humansOnTeam = w.players.filter(
      (p) => !p.bot && p.team === team,
    ).length;
    const botsOnTeam = w.players.filter((p) => p.bot && p.team === team);
    const neededBots = Math.max(0, 2 - humansOnTeam);

    if (botsOnTeam.length < neededBots) {
      for (let i = botsOnTeam.length; i < neededBots; i++) {
        const botNames = team === 'orange' ? BOT_NAMES_ORANGE : BOT_NAMES_TEAL;
        const name = botNames[i % botNames.length];
        const botId = `bot-${team}-${i + 1}`;
        w.players.push(
          newPlayer(botId, name, team === 'orange' ? 0 : 1, team, true, i),
        );
      }
    } else if (botsOnTeam.length > neededBots) {
      const toRemove = botsOnTeam.length - neededBots;
      let removed = 0;
      w.players = w.players.filter((p) => {
        if (p.bot && p.team === team && removed < toRemove) {
          removed++;
          return false;
        }
        return true;
      });
    }
  }
}

export function stepBungeeBot(
  bot: Player,
  w: BungeeWorld,
  _dt: number,
  now = Date.now(),
): void {
  bot.input.swing = false;
  bot.input.smash = false;
  bot.input.dive = false;
  bot.input.jump = false;

  if (bot.stunnedUntil > now) {
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
    bot.facing = bot.team === 'orange' ? 0 : Math.PI;
    if (Math.random() < 0.08) {
      bungeeAction(w, bot.id, { type: 'swing' }, now);
    }
    return;
  }

  // 2. Rally logic
  // Partner coordination:
  const partner = w.players.find((p) => p.team === bot.team && p.id !== bot.id);

  // Target default position (if ball is on the other side)
  const isOrange = bot.team === 'orange';
  const defaultZ = isOrange ? -5.5 : 5.5;
  const slotOffset = bot.id.includes('1') ? -2.2 : 2.2;
  let targetX = slotOffset;
  let targetZ = defaultZ;

  const ballOnOurSide = (isOrange && ball.z < 0) || (!isOrange && ball.z > 0);

  if (ballOnOurSide && ball.state === 'in_play') {
    // Intercept ball
    const distToBall = Math.hypot(ball.x - bot.x, ball.z - bot.z);
    const partnerDistToBall = partner
      ? Math.hypot(ball.x - partner.x, ball.z - partner.z)
      : 999;

    // Decide whether bot or partner should go for it
    const shouldGoForBall = distToBall <= partnerDistToBall + 0.8;

    if (shouldGoForBall) {
      // Padel glass wall anticipation:
      // If ball has bounced once and is heading deep into the back glass, wait for the rebound
      const headingToBackGlass =
        (isOrange && ball.z < -8.5 && ball.vz < -2) ||
        (!isOrange && ball.z > 8.5 && ball.vz > 2);

      if (headingToBackGlass && ball.bouncesOnCurrentSide >= 1) {
        targetX = ball.x;
        targetZ = isOrange ? -8.2 : 8.2;
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
        } else if (distToBall > 1.7 && Math.random() < 0.3) {
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
