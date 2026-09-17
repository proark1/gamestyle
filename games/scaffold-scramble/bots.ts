import {
  CRADLE_WIDTH,
  clamp,
  idleInput,
  type Player,
  type Role,
  type ScaffoldScrambleWorld,
  type WindowTarget,
} from './types';
import { newPlayer } from './simulation';

const BOT_NAMES = ['Winch-Willy', 'Sudsy-Sam', 'Squeegee-Sally', 'Bucket-Bob'];

export function reconcileScaffoldBots(world: ScaffoldScrambleWorld) {
  const humans = world.players.filter((p) => !p.bot);
  const targetTotal = 4; // 4 crew members on the cradle
  const neededBots = Math.max(0, targetTotal - humans.length);

  // Filter out excess bots
  const currentBots = world.players.filter((p) => p.bot);
  if (currentBots.length > neededBots) {
    const keepBots = currentBots.slice(0, neededBots);
    world.players = [...humans, ...keepBots];
  } else if (currentBots.length < neededBots) {
    const missing = neededBots - currentBots.length;
    for (let i = 0; i < missing; i++) {
      const botIdx = currentBots.length + i;
      const id = `bot-${botIdx + 1}`;
      const name = BOT_NAMES[botIdx % BOT_NAMES.length];
      const color = (humans.length + botIdx + 1) % 4;

      // Assign roles to ensure winches and cleaning are covered
      let role: Role = 'cleaner';
      const hasLeftWinch = world.players.some((p) => p.role === 'left-winch');
      const hasRightWinch = world.players.some((p) => p.role === 'right-winch');

      if (!hasLeftWinch) {
        role = 'left-winch';
      } else if (!hasRightWinch) {
        role = 'right-winch';
      } else {
        role = 'cleaner';
      }

      world.players.push(
        newPlayer(id, name, color, role, true, world.players.length),
      );
    }
  }
}

export function stepScaffoldBot(
  bot: Player,
  world: ScaffoldScrambleWorld,
  _dt: number,
) {
  bot.input = idleInput();

  // If dangling, always attempt to climb back onto the cradle deck
  if (bot.state === 'dangling') {
    bot.input.jump = true;
    bot.input.action = true;
    return;
  }

  // If sliding violently down the deck, try to push against the slope
  if (bot.state === 'sliding') {
    bot.input.x = world.cradle.tiltDeg > 0 ? 1 : -1;
    return;
  }

  // Check if a pigeon is perched nearby and needs shooing
  for (const pigeon of world.pigeons) {
    if (pigeon.perched && Math.abs(bot.deckX - pigeon.x) < 2.0) {
      bot.input.action = true;
      return;
    }
  }

  const absTilt = Math.abs(world.cradle.tiltDeg);

  // Winch operator bot logic
  if (bot.role === 'left-winch' || bot.role === 'right-winch') {
    const targetX =
      bot.role === 'left-winch'
        ? -CRADLE_WIDTH / 2 + 0.8
        : CRADLE_WIDTH / 2 - 0.8;

    // Walk to designated winch station if not already there
    if (Math.abs(bot.deckX - targetX) > 0.4) {
      bot.input.x = targetX > bot.deckX ? 1 : -1;
      return;
    }

    // PRIORITY 1: Balance cradle if tilted!
    if (absTilt > 4.5) {
      if (bot.role === 'right-winch') {
        // If tiltDeg > 0, right is higher than left -> lower right winch
        if (world.cradle.tiltDeg > 0) {
          bot.input.crankRightDown = true;
        } else {
          // Right is lower than left -> raise right winch
          bot.input.crankRightUp = true;
        }
      } else {
        // Left winch operator
        if (world.cradle.tiltDeg > 0) {
          // Right is higher than left -> raise left winch to balance
          bot.input.crankLeftUp = true;
        } else {
          // Left is higher than right -> lower left winch
          bot.input.crankLeftDown = true;
        }
      }
      return;
    }

    // PRIORITY 2: Move cradle vertically towards nearest dirty/foamed window row
    const targetWindow = findTargetWindow(world);
    if (targetWindow) {
      const dy = targetWindow.y - world.cradle.centerHeight;
      if (Math.abs(dy) > 1.2) {
        if (dy > 0) {
          if (bot.role === 'left-winch') bot.input.crankLeftUp = true;
          else bot.input.crankRightUp = true;
        } else {
          if (bot.role === 'left-winch') bot.input.crankLeftDown = true;
          else bot.input.crankRightDown = true;
        }
      }
    }
    return;
  }

  // Cleaner bot logic
  if (bot.role === 'cleaner' || bot.role === 'all-rounder') {
    const targetWindow = findCleanerTargetWindow(world, bot);
    if (!targetWindow) return;

    // Calculate world X and map to deck X
    const targetDeckX = clamp(
      targetWindow.x,
      -CRADLE_WIDTH / 2 + 1.2,
      CRADLE_WIDTH / 2 - 1.2,
    );

    const distToTarget = Math.abs(bot.deckX - targetDeckX);

    if (distToTarget > 0.5) {
      // Walk towards target window
      bot.input.x = targetDeckX > bot.deckX ? 0.9 : -0.9;
    } else {
      // In reach! Check tool requirement
      if (targetWindow.status === 'dirty') {
        if (bot.tool === 'sponge') {
          bot.input.action = true;
        } else {
          bot.input.switchTool = true;
        }
      } else if (targetWindow.status === 'foamed') {
        if (bot.tool === 'squeegee') {
          bot.input.action = true;
        } else {
          bot.input.switchTool = true;
        }
      }
    }
  }
}

function findTargetWindow(world: ScaffoldScrambleWorld): WindowTarget | null {
  // Find dirty or foamed window closest to current cradle height
  let bestDist = 999;
  let bestWin: WindowTarget | null = null;

  for (const win of world.windows) {
    if (win.status === 'spotless') continue;
    const dist = Math.abs(win.y - world.cradle.centerHeight);
    if (dist < bestDist) {
      bestDist = dist;
      bestWin = win;
    }
  }

  return bestWin;
}

function findCleanerTargetWindow(
  world: ScaffoldScrambleWorld,
  bot: Player,
): WindowTarget | null {
  const cradleY = world.cradle.centerHeight;
  let bestScore = 9999;
  let bestWin: WindowTarget | null = null;

  for (const win of world.windows) {
    if (win.status === 'spotless') continue;

    // Window must be within reach of current cradle elevation
    const dy = Math.abs(win.y - (cradleY + 1.0));
    if (dy > 2.2) continue;

    const dx = Math.abs(win.x - bot.deckX);
    // Prioritize foamed windows if holding squeegee, dirty windows if holding sponge
    const toolBonus =
      (bot.tool === 'squeegee' && win.status === 'foamed') ||
      (bot.tool === 'sponge' && win.status === 'dirty')
        ? -1.5
        : 0;

    const score = dx + dy * 2.0 + toolBonus;
    if (score < bestScore) {
      bestScore = score;
      bestWin = win;
    }
  }

  return bestWin;
}
