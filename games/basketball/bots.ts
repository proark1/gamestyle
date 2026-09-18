import { HOOP, TEAMS, type BasketballWorld, type Player } from './types';
import { distanceToHoop } from './physics';
import { newPlayer, openSlot } from './simulation';

const BOT_NAMES_RED = ['SlamDunk-Bot', 'Hoop-Bot'];
const BOT_NAMES_BLUE = ['Swish-Bot', 'AlleyOop-Bot'];

export function reconcileBasketballBots(w: BasketballWorld): void {
  for (const team of TEAMS) {
    const humansOnTeam = w.players.filter(
      (p) => !p.bot && p.team === team,
    ).length;
    const botsOnTeam = w.players.filter((p) => p.bot && p.team === team);
    const neededBots = Math.max(0, 2 - humansOnTeam);

    if (botsOnTeam.length < neededBots) {
      // Add missing bots. A human who takes a bot's place leaves a gap in the
      // numbering, so counting up from the bots left would reuse a live id.
      const botNames = team === 'red' ? BOT_NAMES_RED : BOT_NAMES_BLUE;
      let missing = neededBots - botsOnTeam.length;
      for (let i = 0; missing > 0; i++) {
        const botId = `bot-${team}-${i + 1}`;
        if (w.players.some((p) => p.id === botId)) continue;
        const name = botNames[i % botNames.length];
        w.players.push(
          newPlayer(
            botId,
            name,
            team === 'red' ? 0 : 1,
            team,
            true,
            openSlot(w, team),
          ),
        );
        missing--;
      }
    } else if (botsOnTeam.length > neededBots) {
      // Remove excess bots
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

export function stepBasketballBot(
  bot: Player,
  w: BasketballWorld,
  _dt: number,
): void {
  bot.input.shoot = false;
  bot.input.pass = false;
  bot.input.steal = false;
  bot.input.sprint = false;
  bot.input.crossover = false;
  bot.input.spin = false;

  if (bot.stunnedUntil > w.clock) {
    bot.input.x = 0;
    bot.input.z = 0;
    return;
  }

  const distToBasket = distanceToHoop(bot.x, bot.z);

  // 1. Bot has the ball (Offense)
  if (bot.hasBall) {
    // Check Super Jump
    if (bot.combo >= 60 && distToBasket < 5.5 && bot.grounded) {
      bot.superJump = true;
      bot.grounded = false;
      bot.jumping = true;
      bot.vy = 10.5;
      bot.specialMove = 'dunk';
      bot.dunkType = 'windmill360';
      return;
    }

    // If charging shot, hold until sweet spot (0.72..0.80)
    if (bot.chargingShot) {
      if (bot.shotCharge >= 0.74) {
        bot.input.shoot = false; // Release shot!
      } else {
        bot.input.shoot = true; // Keep charging
      }
      return;
    }

    // Check if close to hoop for dunk
    if (distToBasket < 3.2) {
      bot.input.sprint = true;
      bot.input.shoot = true; // Start dunk
      return;
    }

    // Check for crossover if defender is right in front
    const defenders = w.players.filter((p) => p.team !== bot.team);
    const nearbyDef = defenders.find(
      (p) => Math.hypot(p.x - bot.x, p.z - bot.z) < 2.0,
    );
    if (nearbyDef && bot.moveTimer <= 0 && Math.random() < 0.08) {
      // Bot initiates crossover juke!
      bot.specialMove = 'crossover';
      bot.moveTimer = 0.35;
      const cutSide = bot.x > 0 ? -1 : 1;
      bot.vx += cutSide * 5.5;
      bot.combo = Math.min(100, bot.combo + 10);
      return;
    }

    // Drive towards hoop
    const targetX = 0;
    const targetZ = HOOP.z + 2.5;
    const dx = targetX - bot.x;
    const dz = targetZ - bot.z;
    const dist = Math.hypot(dx, dz);

    bot.input.x = dist > 0.2 ? dx / dist : 0;
    bot.input.z = dist > 0.2 ? dz / dist : 0;
    bot.input.sprint = true;

    // Decide whether to shoot from mid-range or 3-pt line
    if (distToBasket < 6.5 && Math.random() < 0.04) {
      bot.input.shoot = true; // Start shooting
    }
    return;
  }

  // 2. Ball is loose in the air or on the floor (Rebound / Loose Ball)
  if (!w.ball.heldBy) {
    const dx = w.ball.x - bot.x;
    const dz = w.ball.z - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.3) {
      bot.input.x = dx / dist;
      bot.input.z = dz / dist;
      bot.input.sprint = true;
    }
    return;
  }

  // 3. Teammate has the ball (Off-ball Offense)
  const ballHolder = w.players.find((p) => p.id === w.ball.heldBy);
  if (ballHolder && ballHolder.team === bot.team) {
    // Cut towards the basket to be open for a pass or alley-oop!
    const cutX = ballHolder.x > 0 ? -2.2 : 2.2;
    const cutZ = HOOP.z + 2.2;
    const dx = cutX - bot.x;
    const dz = cutZ - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.8) {
      bot.input.x = dx / dist;
      bot.input.z = dz / dist;
      bot.input.sprint = true;
    } else {
      bot.input.x = 0;
      bot.input.z = 0;
    }
    return;
  }

  // 4. Opponent has the ball (Defense)
  if (ballHolder && ballHolder.team !== bot.team) {
    // Guard ball handler: stay between ball handler and hoop
    const guardTargetX = ballHolder.x * 0.75 + HOOP.x * 0.25;
    const guardTargetZ = ballHolder.z * 0.75 + HOOP.z * 0.25;

    const dx = guardTargetX - bot.x;
    const dz = guardTargetZ - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.4) {
      bot.input.x = dx / dist;
      bot.input.z = dz / dist;
      bot.input.sprint = true;
    }

    // Try steal if close enough (cannot steal if ballHolder is spinning)
    const distToHolder = Math.hypot(bot.x - ballHolder.x, bot.z - ballHolder.z);
    if (
      distToHolder < 1.4 &&
      ballHolder.specialMove !== 'spin' &&
      Math.random() < 0.05
    ) {
      bot.input.steal = true;
    }
  }
}
