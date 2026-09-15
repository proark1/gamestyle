import {
  PITCH_LENGTH,
  type PlayerInput,
  type ZorbClashWorld,
  type ZorbPlayer,
} from './types';

export function botInput(
  bot: ZorbPlayer,
  world: ZorbClashWorld,
  time: number,
): PlayerInput {
  // If bot is turtle'd, frantically wiggle!
  if (bot.turtle) {
    return {
      x: Math.sin(time * 15) > 0 ? 1 : -1,
      z: Math.cos(time * 15) > 0 ? 1 : -1,
      dash: false,
      brace: false,
      wiggle: true,
    };
  }

  const ball = world.ball;
  const opponents = world.players.filter(
    (p) => p.team !== bot.team && p.id !== bot.id,
  );
  const teammates = world.players.filter(
    (p) => p.team === bot.team && p.id !== bot.id,
  );

  // Check for turtle'd teammate needing rescue nearby (< 9m)
  const strandedTeammate = teammates.find(
    (p) => p.turtle && Math.hypot(p.x - bot.x, p.z - bot.z) < 12,
  );

  // Check for turtle'd opponent ready to be punted into the goal
  const turtleOpponent = opponents.find(
    (p) => p.turtle && Math.hypot(p.x - bot.x, p.z - bot.z) < 10,
  );

  let targetX = ball.x;
  let targetZ = ball.z;
  let shouldDash = false;
  let shouldBrace = false;

  const enemyGoalZ = bot.team === 'red' ? PITCH_LENGTH / 2 : -PITCH_LENGTH / 2;

  if (strandedTeammate) {
    // Ram teammate to right them up!
    targetX = strandedTeammate.x;
    targetZ = strandedTeammate.z;
    const dist = Math.hypot(targetX - bot.x, targetZ - bot.z);
    if (dist < 5) shouldDash = true;
  } else if (turtleOpponent) {
    // Punt enemy turtle toward enemy goal!
    targetX = turtleOpponent.x;
    targetZ = turtleOpponent.z;
    const dist = Math.hypot(targetX - bot.x, targetZ - bot.z);
    if (dist < 6) shouldDash = true;
  } else {
    // Standard tactical play:
    // Decide between going for the ball or bulldozing an opponent
    const distToBall = Math.hypot(ball.x - bot.x, ball.z - bot.z);
    const closestOpponent = opponents.reduce<{
      p: ZorbPlayer | null;
      dist: number;
    }>(
      (acc, opp) => {
        const d = Math.hypot(opp.x - bot.x, opp.z - bot.z);
        return d < acc.dist ? { p: opp, dist: d } : acc;
      },
      { p: null, dist: Infinity },
    );

    // If opponent is super close and charging at us, brace!
    if (closestOpponent.p && closestOpponent.dist < 3.5) {
      const oppSpeed = Math.hypot(closestOpponent.p.vx, closestOpponent.p.vz);
      if (oppSpeed > 6.0 || closestOpponent.p.dashCharge > 0.4) {
        shouldBrace = true;
      }
    }

    // 40% of the time, aggressively hunt players; 60% of the time, hunt ball
    const isSumoEnforcer = bot.id.charCodeAt(bot.id.length - 1) % 2 === 1;

    if (isSumoEnforcer && closestOpponent.p && closestOpponent.dist < 14) {
      targetX = closestOpponent.p.x;
      targetZ = closestOpponent.p.z;
      if (closestOpponent.dist < 7 && closestOpponent.dist > 2.5) {
        shouldDash = true;
      }
    } else {
      // Approach ball from behind to kick it towards opponent's goal
      const behindOffset = bot.team === 'red' ? -1.8 : 1.8;
      targetX = ball.x;
      targetZ = ball.z + behindOffset;

      if (
        distToBall < 6.5 &&
        Math.sign(enemyGoalZ - bot.z) === Math.sign(ball.z - bot.z)
      ) {
        shouldDash = true;
      }
    }
  }

  // Calculate normalized steering vector
  const dx = targetX - bot.x;
  const dz = targetZ - bot.z;
  const len = Math.hypot(dx, dz);

  let steerX = 0;
  let steerZ = 0;
  if (len > 0.3) {
    steerX = Math.max(-1, Math.min(1, dx / len));
    steerZ = Math.max(-1, Math.min(1, dz / len));
  }

  return {
    x: steerX,
    z: steerZ,
    dash: shouldDash,
    brace: shouldBrace,
    wiggle: false,
  };
}

export function updateBots(world: ZorbClashWorld, time: number) {
  for (const player of world.players) {
    if (player.bot) {
      player.input = botInput(player, world, time);
      player.seen = world.clock;
    }
  }
}
