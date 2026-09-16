import { REACH_DISTANCE, type CarryOnWorld } from './types';
import { carryOnAction, newTraveler } from './simulation';
import { SIZER_X, SIZER_Z } from './physics';

const BOT_NAMES = ['Desperate Dave', 'Panic Penny', 'Sprint Sam'];

/** Synchronize NPC bot companions for solo practice and empty seats */
export function reconcileCarryOnBots(world: CarryOnWorld, now: number) {
  // Keep 3 players total in solo practice
  const targetTotal = 3;
  const currentHumans = world.players.filter((p) => !p.bot).length;
  const neededBots = Math.max(0, targetTotal - currentHumans);

  // Remove excess bots
  const currentBots = world.players.filter((p) => p.bot);
  if (currentBots.length > neededBots) {
    const toRemove = currentBots.slice(neededBots);
    world.players = world.players.filter((p) => !toRemove.includes(p));
  }

  // Add missing bots
  while (world.players.filter((p) => p.bot).length < neededBots) {
    const idx = world.players.filter((p) => p.bot).length;
    const color = (world.players.length + 1) % 4;
    const bot = newTraveler(
      `bot-${idx + 1}`,
      BOT_NAMES[idx % BOT_NAMES.length],
      color,
      now,
    );
    bot.bot = true;
    world.players.push(bot);
  }
}

/** Update autonomous AI behavior for bots */
export function updateCarryOnBots(
  world: CarryOnWorld,
  now: number,
  eventIdRef: { current: number },
) {
  for (const bot of world.players) {
    if (!bot.bot) continue;

    // Reset inputs
    let ix = 0;
    let iz = 0;
    const jump = false;

    // 1. If bot is carrying a zipped suitcase, head to the Sizer Box!
    if (bot.holdingSuitcase) {
      const dx = SIZER_X - bot.x;
      const dz = SIZER_Z - bot.z;
      const dist = Math.hypot(dx, dz);

      if (dist > REACH_DISTANCE * 0.7) {
        ix = dx / dist;
        iz = dz / dist;
      } else {
        // Near sizer box: insert bag!
        carryOnAction(
          world,
          bot.id,
          { type: 'interact', action: 'grab' },
          eventIdRef,
        );
      }
      bot.input = {
        x: ix,
        z: iz,
        jump,
        grab: false,
        compress: false,
        zip: false,
        drop: false,
        seq: bot.input.seq + 1,
      };
      continue;
    }

    // 2. If bot is carrying an item, head towards an open suitcase
    if (bot.holdingItem) {
      const openSc = world.suitcases.find(
        (s) => s.open && !s.burst && !s.approved,
      );
      if (openSc) {
        const dx = openSc.x - bot.x;
        const dz = openSc.z - bot.z;
        const dist = Math.hypot(dx, dz);

        if (dist > REACH_DISTANCE * 0.7) {
          ix = dx / dist;
          iz = dz / dist;
        } else {
          // Pack into suitcase
          carryOnAction(
            world,
            bot.id,
            { type: 'interact', action: 'grab' },
            eventIdRef,
          );
        }
      }
      bot.input = {
        x: ix,
        z: iz,
        jump,
        grab: false,
        compress: false,
        zip: false,
        drop: false,
        seq: bot.input.seq + 1,
      };
      continue;
    }

    // 3. Check if an overstuffed suitcase needs compression
    const bulgingSc = world.suitcases.find(
      (s) => s.items.length >= 2 && s.zipped < 0.95 && !s.burst,
    );
    if (bulgingSc) {
      const someoneSitting = world.players.some(
        (p) => p.sittingOn === bulgingSc.id,
      );
      const dist = Math.hypot(bulgingSc.x - bot.x, bulgingSc.z - bot.z);

      if (!someoneSitting) {
        // Go sit on it to compress it!
        if (dist > REACH_DISTANCE * 0.6) {
          ix = (bulgingSc.x - bot.x) / dist;
          iz = (bulgingSc.z - bot.z) / dist;
        } else if (!bot.sittingOn) {
          carryOnAction(
            world,
            bot.id,
            { type: 'interact', action: 'compress' },
            eventIdRef,
          );
        }
      } else {
        // Someone is compressing: come zip it up!
        if (dist > REACH_DISTANCE * 0.7) {
          ix = (bulgingSc.x - bot.x) / dist;
          iz = (bulgingSc.z - bot.z) / dist;
        } else {
          carryOnAction(
            world,
            bot.id,
            { type: 'interact', action: 'zip' },
            eventIdRef,
          );
        }
      }
      bot.input = {
        x: ix,
        z: iz,
        jump,
        grab: false,
        compress: false,
        zip: false,
        drop: false,
        seq: bot.input.seq + 1,
      };
      continue;
    }

    // 4. Check for completed zipped suitcases ready to go to sizer
    const zippedSc = world.suitcases.find(
      (s) => s.zipped >= 0.95 && !s.approved && !s.heldBy,
    );
    if (zippedSc) {
      const dist = Math.hypot(zippedSc.x - bot.x, zippedSc.z - bot.z);
      if (dist > REACH_DISTANCE * 0.7) {
        ix = (zippedSc.x - bot.x) / dist;
        iz = (zippedSc.z - bot.z) / dist;
      } else {
        carryOnAction(
          world,
          bot.id,
          { type: 'interact', action: 'grab' },
          eventIdRef,
        );
      }
      bot.input = {
        x: ix,
        z: iz,
        jump,
        grab: false,
        compress: false,
        zip: false,
        drop: false,
        seq: bot.input.seq + 1,
      };
      continue;
    }

    // 5. Otherwise, find an unpacked item in the terminal to pack
    const freeItem = world.items.find((it) => !it.packedIn && !it.heldBy);
    if (freeItem) {
      const dist = Math.hypot(freeItem.x - bot.x, freeItem.z - bot.z);
      if (dist > REACH_DISTANCE * 0.7) {
        ix = (freeItem.x - bot.x) / dist;
        iz = (freeItem.z - bot.z) / dist;
      } else {
        carryOnAction(
          world,
          bot.id,
          { type: 'interact', action: 'grab' },
          eventIdRef,
        );
      }
    }

    bot.input = {
      x: ix,
      z: iz,
      jump,
      grab: false,
      compress: false,
      zip: false,
      drop: false,
      seq: bot.input.seq + 1,
    };
  }
}
