import { HOOP, TEAMS, type BasketballWorld, type Player } from './types';
import { distanceToHoop } from './physics';
import { newPlayer } from './simulation';

const BOT_NAMES_ORANGE = ['SlamDunk-Bot', 'Hoop-Bot'];
const BOT_NAMES_TEAL = ['Swish-Bot', 'AlleyOop-Bot'];

export function reconcileBasketballBots(w: BasketballWorld): void {
  for (const team of TEAMS) {
    const humansOnTeam = w.players.filter(
      (p) => !p.bot && p.team === team,
    ).length;
    const botsOnTeam = w.players.filter((p) => p.bot && p.team === team);
    const neededBots = Math.max(0, 2 - humansOnTeam);

    if (botsOnTeam.length < neededBots) {
      // Add missing bots
      for (let i = botsOnTeam.length; i < neededBots; i++) {
        const botNames = team === 'orange' ? BOT_NAMES_ORANGE : BOT_NAMES_TEAL;
        const name = botNames[i % botNames.length];
        const botId = `bot-${team}-${i + 1}`;
        w.players.push(
          newPlayer(botId, name, team === 'orange' ? 0 : 1, team, true, i),
        );
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

  const distToBasket = distanceToHoop(bot.x, bot.z);

  // 1. Bot has the ball (Offense)
  if (bot.hasBall) {
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

    // Drive towards hoop or open space
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
    // Position on opposite wing for spacing
    const wingX = ballHolder.x > 0 ? -4.5 : 4.5;
    const wingZ = -4.0;
    const dx = wingX - bot.x;
    const dz = wingZ - bot.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.8) {
      bot.input.x = dx / dist;
      bot.input.z = dz / dist;
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

    // Try steal if close enough
    const distToHolder = Math.hypot(bot.x - ballHolder.x, bot.z - ballHolder.z);
    if (distToHolder < 1.4 && Math.random() < 0.05) {
      bot.input.steal = true;
    }
  }
}
