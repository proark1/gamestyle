import {
  checkSizerFit,
  computeSuitcaseBulge,
  SIZER_X,
  SIZER_Z,
  stepPhysics,
  TSA_GATE_X,
} from './physics';
import {
  CONTRABAND_BONUS,
  ITEM_CONFIGS,
  PASSED_REWARD,
  REACH_DISTANCE,
  ROUND_MS,
  SIZER_FEE,
  idleInput,
  type CarryOnAction,
  type CarryOnSnapshot,
  type CarryOnWorld,
  type ItemKind,
  type LuggageItem,
  type Suitcase,
  type Traveler,
} from './types';

let nextItemId = 1;
function makeItem(
  kind: ItemKind,
  x: number,
  y: number,
  z: number,
): LuggageItem {
  return {
    id: `item-${nextItemId++}-${kind}`,
    kind,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    rotation: Math.random() * Math.PI * 2,
    heldBy: null,
    packedIn: null,
  };
}

export function newTraveler(
  id: string,
  name: string,
  color: number,
  now: number,
): Traveler {
  return {
    id,
    name,
    color,
    x: -4.5 + (color % 2) * 1.2,
    y: 0,
    z: -1.0 + Math.floor(color / 2) * 1.5,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: 0,
    grounded: true,
    sittingOn: null,
    zippingSuitcase: null,
    holdingItem: null,
    holdingSuitcase: null,
    wearingTinFoil: false,
    downUntil: 0,
    seen: now,
    input: idleInput(),
  };
}

export function freshCarryOnWorld(now: number): CarryOnWorld {
  // 4 Suitcases placed along packing benches
  const suitcases: Suitcase[] = [
    {
      id: 'sc-0',
      color: 0,
      x: -2.4,
      y: 0.1,
      z: -2.0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      open: true,
      items: [],
      bulge: 0,
      compression: 0,
      zipped: 0,
      strain: 0,
      burst: false,
      approved: false,
      rejected: false,
      heldBy: null,
      sittingCount: 0,
    },
    {
      id: 'sc-1',
      color: 1,
      x: -2.4,
      y: 0.1,
      z: -0.6,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      open: true,
      items: [],
      bulge: 0,
      compression: 0,
      zipped: 0,
      strain: 0,
      burst: false,
      approved: false,
      rejected: false,
      heldBy: null,
      sittingCount: 0,
    },
    {
      id: 'sc-2',
      color: 2,
      x: -2.4,
      y: 0.1,
      z: 0.8,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      open: true,
      items: [],
      bulge: 0,
      compression: 0,
      zipped: 0,
      strain: 0,
      burst: false,
      approved: false,
      rejected: false,
      heldBy: null,
      sittingCount: 0,
    },
    {
      id: 'sc-3',
      color: 3,
      x: -2.4,
      y: 0.1,
      z: 2.2,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      open: true,
      items: [],
      bulge: 0,
      compression: 0,
      zipped: 0,
      strain: 0,
      burst: false,
      approved: false,
      rejected: false,
      heldBy: null,
      sittingCount: 0,
    },
  ];

  // Mountain of vacation junk scattered around the packing lounge
  const items: LuggageItem[] = [
    // Standard clothes & beach gear
    makeItem('clothes', -6.5, 0.2, -2.2),
    makeItem('clothes', -5.8, 0.2, -2.8),
    makeItem('clothes', -6.2, 0.2, 1.4),
    makeItem('clothes', -5.2, 0.2, 2.6),
    makeItem('duck', -6.0, 0.2, -1.2),
    makeItem('duck', -5.4, 0.2, 0.4),
    makeItem('flamingo', -7.0, 0.2, 0.0),
    makeItem('flamingo', -6.6, 0.2, 2.0),
    makeItem('racket', -5.5, 0.2, -0.6),
    makeItem('racket', -6.8, 0.2, -2.6),
    makeItem('shoes', -4.8, 0.2, 1.8),
    makeItem('shoes', -5.9, 0.2, 3.2),

    // Contraband items!
    makeItem('lobster', -6.4, 0.2, 0.6),
    makeItem('shampoo', -5.0, 0.2, -1.8),
    makeItem('snowglobe', -7.2, 0.2, -1.0),
  ];

  return {
    phase: 'packing',
    clock: now,
    started: now,
    deadline: now + ROUND_MS,
    players: [],
    suitcases,
    items,
    tsa: {
      x: TSA_GATE_X,
      z: 0,
      distractedUntil: 0,
      alarmUntil: 0,
      confiscatedCount: 0,
    },
    sizer: {
      x: SIZER_X,
      y: 0,
      z: SIZER_Z,
      insertedSuitcase: null,
      status: 'idle',
      timer: 0,
    },
    events: [
      {
        id: 1,
        type: 'pack',
        text: 'Flight 707 to Ibiza is BOARDING! Pack and size carry-ons to avoid $150 fees!',
      },
    ],
    approvedCount: 0,
    contrabandCount: 0,
    feesPaid: 0,
    totalScore: 0,
    targetBags: 4,
  };
}

/** Execute a game action */
export function carryOnAction(
  world: CarryOnWorld,
  playerId: string,
  action: CarryOnAction,
  eventIdRef: { current: number },
) {
  if (action.type === 'start') {
    world.phase = 'packing';
    world.deadline = world.clock + ROUND_MS;
    return;
  }

  if (action.type === 'restart') {
    const players = world.players;
    const fresh = freshCarryOnWorld(world.clock);
    fresh.players = players;
    Object.assign(world, fresh);
    return;
  }

  const player = world.players.find((p) => p.id === playerId);
  if (!player) return;

  if (action.type === 'input') {
    player.input = action.input;
    return;
  }

  if (action.type === 'interact') {
    const now = world.clock;

    switch (action.action) {
      case 'grab': {
        // 1. If holding an item, check if near an open suitcase to pack it
        if (player.holdingItem) {
          const item = world.items.find((it) => it.id === player.holdingItem);
          const nearbySuitcase = world.suitcases.find(
            (sc) =>
              sc.open &&
              !sc.burst &&
              Math.hypot(sc.x - player.x, sc.z - player.z) < REACH_DISTANCE,
          );

          if (item && nearbySuitcase) {
            // Pack item into suitcase
            item.packedIn = nearbySuitcase.id;
            item.heldBy = null;
            nearbySuitcase.items.push(item.id);
            player.holdingItem = null;

            const cfg = ITEM_CONFIGS[item.kind];
            world.events.push({
              id: ++eventIdRef.current,
              type: 'pack',
              text: `Packed ${cfg.name} into luggage!`,
              pos: [nearbySuitcase.x, nearbySuitcase.y + 0.6, nearbySuitcase.z],
              color: cfg.color,
            });
            return;
          }

          // Otherwise drop the item on the floor
          if (item) {
            item.heldBy = null;
            player.holdingItem = null;
          }
          return;
        }

        // 2. If holding a suitcase, check if near the sizer box to insert it
        if (player.holdingSuitcase) {
          const sc = world.suitcases.find(
            (s) => s.id === player.holdingSuitcase,
          );
          const distToSizer = Math.hypot(
            player.x - SIZER_X,
            player.z - SIZER_Z,
          );

          if (
            sc &&
            distToSizer < REACH_DISTANCE &&
            world.sizer.status === 'idle'
          ) {
            // Insert bag into sizer cage
            sc.heldBy = null;
            sc.x = SIZER_X;
            sc.y = 0.24;
            sc.z = SIZER_Z;
            player.holdingSuitcase = null;
            world.sizer.insertedSuitcase = sc.id;
            world.sizer.status = 'testing';
            world.sizer.timer = now + 1200; // 1.2s scan

            world.events.push({
              id: ++eventIdRef.current,
              type: 'pack',
              text: 'Inserted bag into Sizer Box! Measuring dimensions...',
              pos: [SIZER_X, 1.2, SIZER_Z],
              color: '#38bdf8',
            });
            return;
          }

          // Otherwise drop suitcase on floor
          if (sc) {
            sc.heldBy = null;
            player.holdingSuitcase = null;
          }
          return;
        }

        // 3. Hands are empty: pick up suitcase or item
        // Check sizer box to retrieve tested bag
        if (world.sizer.insertedSuitcase) {
          const distToSizer = Math.hypot(
            player.x - SIZER_X,
            player.z - SIZER_Z,
          );
          if (distToSizer < REACH_DISTANCE) {
            const sc = world.suitcases.find(
              (s) => s.id === world.sizer.insertedSuitcase,
            );
            if (sc) {
              sc.heldBy = player.id;
              player.holdingSuitcase = sc.id;
              world.sizer.insertedSuitcase = null;
              world.sizer.status = 'idle';
              return;
            }
          }
        }

        // Check if sitting on a suitcase to unpack top item
        if (player.sittingOn) {
          const sc = world.suitcases.find((s) => s.id === player.sittingOn);
          if (sc && sc.items.length > 0 && sc.zipped < 0.95) {
            const removedItemId = sc.items.pop()!;
            const item = world.items.find((it) => it.id === removedItemId);
            if (item) {
              item.packedIn = null;
              item.heldBy = player.id;
              item.x = player.x;
              item.y = 0.5;
              item.z = player.z;
              player.holdingItem = item.id;
              if (item.kind === 'shoes') {
                player.wearingTinFoil = true;
              }
              const cfg = ITEM_CONFIGS[item.kind];
              world.events.push({
                id: ++eventIdRef.current,
                type: 'pack',
                text: `Removed ${cfg.name} from luggage!`,
                pos: [sc.x, sc.y + 0.6, sc.z],
                color: '#f59e0b',
              });
            }
          }
          return;
        }

        // Check nearby loose item first
        const nearbyItem = world.items.find(
          (it) =>
            !it.packedIn &&
            !it.heldBy &&
            Math.hypot(it.x - player.x, it.z - player.z) < REACH_DISTANCE,
        );

        if (nearbyItem) {
          nearbyItem.heldBy = player.id;
          player.holdingItem = nearbyItem.id;
          if (nearbyItem.kind === 'shoes') {
            player.wearingTinFoil = true;
          }
          return;
        }

        // Check nearby suitcase (pick up if zipped, or unpack item if open with items)
        const nearbySc = world.suitcases.find(
          (sc) =>
            !sc.heldBy &&
            Math.hypot(sc.x - player.x, sc.z - player.z) < REACH_DISTANCE,
        );

        if (nearbySc) {
          if (nearbySc.zipped >= 0.95) {
            // Zipped suitcase can be picked up and carried
            nearbySc.heldBy = player.id;
            player.holdingSuitcase = nearbySc.id;
          } else if (nearbySc.items.length > 0) {
            // Unpack the last packed item
            const removedItemId = nearbySc.items.pop()!;
            const item = world.items.find((it) => it.id === removedItemId);
            if (item) {
              item.packedIn = null;
              item.heldBy = player.id;
              item.x = player.x;
              item.y = 0.5;
              item.z = player.z;
              player.holdingItem = item.id;
              if (item.kind === 'shoes') {
                player.wearingTinFoil = true;
              }
              const cfg = ITEM_CONFIGS[item.kind];
              world.events.push({
                id: ++eventIdRef.current,
                type: 'pack',
                text: `Removed ${cfg.name} from luggage!`,
                pos: [nearbySc.x, nearbySc.y + 0.6, nearbySc.z],
                color: '#f59e0b',
              });
            }
          }
          return;
        }
        break;
      }

      case 'compress': {
        // Toggle sitting/dogpiling on the nearest suitcase to compress it
        if (player.sittingOn) {
          player.sittingOn = null;
          return;
        }

        const sc = world.suitcases.find(
          (s) =>
            !s.burst &&
            Math.hypot(s.x - player.x, s.z - player.z) < REACH_DISTANCE,
        );

        if (sc) {
          player.sittingOn = sc.id;
          world.events.push({
            id: ++eventIdRef.current,
            type: 'compress',
            text: `${player.name} sat on luggage to squash it down!`,
            pos: [sc.x, sc.y + 0.8, sc.z],
            color: '#f59e0b',
          });
        }
        break;
      }

      case 'zip': {
        // Zip up the nearest suitcase or the suitcase the player is sitting on
        let sc = world.suitcases.find(
          (s) =>
            !s.burst &&
            Math.hypot(s.x - player.x, s.z - player.z) < REACH_DISTANCE,
        );
        if (!sc && player.sittingOn) {
          sc = world.suitcases.find((s) => s.id === player.sittingOn);
        }

        if (sc) {
          player.zippingSuitcase = sc.id;
          const stats = computeSuitcaseBulge(sc, world.items);

          if (stats.canZip) {
            sc.zipped = Math.min(1.0, sc.zipped + 0.34);
            if (sc.zipped >= 0.98) {
              sc.zipped = 1.0;
              sc.open = false;
              world.events.push({
                id: ++eventIdRef.current,
                type: 'zip',
                text: 'ZIPPER CLOSED! Carry-on secured!',
                pos: [sc.x, sc.y + 0.6, sc.z],
                color: '#10b981',
              });
            } else {
              world.events.push({
                id: ++eventIdRef.current,
                type: 'zip',
                text: `Zipping... ${Math.round(sc.zipped * 100)}% closed!`,
                pos: [sc.x, sc.y + 0.6, sc.z],
                color: '#38bdf8',
              });
            }
          } else {
            const isComp = sc.sittingCount > 0 || player.sittingOn === sc.id;
            world.events.push({
              id: ++eventIdRef.current,
              type: 'zip',
              text: isComp
                ? '⚠️ Zipper jammed! Bag is overflowing—press [E] to remove an item or stomp harder!'
                : '⚠️ Zipper jammed! Bulging too much—someone must SIT on it [R]!',
              pos: [sc.x, sc.y + 0.6, sc.z],
              color: '#f97316',
            });
          }
        }
        break;
      }

      case 'drop': {
        if (player.holdingItem) {
          const it = world.items.find((i) => i.id === player.holdingItem);
          if (it) it.heldBy = null;
          player.holdingItem = null;
        }
        if (player.holdingSuitcase) {
          const sc = world.suitcases.find(
            (s) => s.id === player.holdingSuitcase,
          );
          if (sc) sc.heldBy = null;
          player.holdingSuitcase = null;
        }
        if (player.sittingOn) {
          player.sittingOn = null;
        }
        player.zippingSuitcase = null;
        break;
      }
    }
  }
}

/** Advance simulation frame */
export function advanceCarryOn(
  world: CarryOnWorld,
  dt: number,
  eventIdRef: { current: number },
) {
  const now = world.clock + dt * 1000;
  world.clock = now;

  if (world.phase !== 'packing') return;

  // 1. Advance physics
  stepPhysics(world, dt, eventIdRef);

  // 2. TSA Checkpoint monitoring
  for (const p of world.players) {
    // If player crosses TSA gate line
    if (Math.abs(p.x - TSA_GATE_X) < 0.6 && Math.abs(p.z) < 1.4) {
      // Tin foil shoes trigger metal detector alarm
      if (p.wearingTinFoil && now >= world.tsa.distractedUntil) {
        world.tsa.distractedUntil = now + 8000; // 8 seconds distraction!
        world.tsa.alarmUntil = now + 4000;
        world.events.push({
          id: ++eventIdRef.current,
          type: 'tsa_distracted',
          text: '🚨 BEEP BEEP! Tin foil shoes set off TSA alarm! Guards distracted!',
          pos: [TSA_GATE_X, 2.2, 0],
          color: '#eab308',
        });
      }

      // Check for contraband smuggling
      let carryingContraband = false;
      if (p.holdingItem) {
        const it = world.items.find((i) => i.id === p.holdingItem);
        if (it && ITEM_CONFIGS[it.kind].contraband) carryingContraband = true;
      }
      if (p.holdingSuitcase) {
        const sc = world.suitcases.find((s) => s.id === p.holdingSuitcase);
        if (sc) {
          const packed = world.items.filter((it) => it.packedIn === sc.id);
          if (packed.some((it) => ITEM_CONFIGS[it.kind].contraband)) {
            carryingContraband = true;
          }
        }
      }

      if (carryingContraband) {
        if (now < world.tsa.distractedUntil) {
          // Sneaked past!
          if (Math.random() < 0.02) {
            world.events.push({
              id: ++eventIdRef.current,
              type: 'tsa_distracted',
              text: '🤫 SNEAKED PAST TSA while guard was distracted with tin foil shoes!',
              pos: [p.x, p.y + 1.2, p.z],
              color: '#38bdf8',
            });
          }
        } else {
          // Caught by TSA!
          if (p.holdingItem) {
            const it = world.items.find((i) => i.id === playerHoldingItem(p));
            if (it && ITEM_CONFIGS[it.kind].contraband) {
              it.heldBy = null;
              it.x = TSA_GATE_X;
              it.z = 2.2;
              p.holdingItem = null;
              world.tsa.confiscatedCount++;
              world.events.push({
                id: ++eventIdRef.current,
                type: 'tsa_caught',
                text: '👮 TSA ALERT! Contraband seized by airport security!',
                pos: [TSA_GATE_X, 1.5, 0],
                color: '#ef4444',
              });
            }
          }
        }
      }
    }
  }

  // Helper
  function playerHoldingItem(p: Traveler) {
    return p.holdingItem;
  }

  // 3. Sizer Box test resolution
  if (world.sizer.status === 'testing' && now >= world.sizer.timer) {
    const sc = world.suitcases.find(
      (s) => s.id === world.sizer.insertedSuitcase,
    );
    if (sc) {
      const fit = checkSizerFit(sc, world.items);
      if (fit.pass) {
        sc.approved = true;
        sc.rejected = false;
        world.sizer.status = 'approved';
        world.approvedCount++;
        world.totalScore += PASSED_REWARD;

        // Check if contraband was inside for bonus
        const packed = world.items.filter((it) => it.packedIn === sc.id);
        const contrabandCount = packed.filter(
          (it) => ITEM_CONFIGS[it.kind].contraband,
        ).length;
        if (contrabandCount > 0) {
          world.contrabandCount += contrabandCount;
          world.totalScore += contrabandCount * CONTRABAND_BONUS;
        }

        world.events.push({
          id: ++eventIdRef.current,
          type: 'sizer_passed',
          text: `✅ BAGGAGE APPROVED! Passed metal sizer box (+${PASSED_REWARD} pts)!`,
          pos: [SIZER_X, 1.4, SIZER_Z],
          color: '#22c55e',
        });
      } else {
        sc.rejected = true;
        sc.approved = false;
        world.sizer.status = 'rejected';
        world.feesPaid += SIZER_FEE;
        world.totalScore -= SIZER_FEE;

        world.events.push({
          id: ++eventIdRef.current,
          type: 'sizer_rejected',
          text: `❌ REJECTED! ${fit.reason ?? 'Too big!'} Gate fee charged: $${SIZER_FEE}!`,
          pos: [SIZER_X, 1.4, SIZER_Z],
          color: '#ef4444',
        });
      }
    }
  }

  // 4. Flight departure countdown
  if (now >= world.deadline) {
    world.phase = 'flight_departed';
    world.events.push({
      id: ++eventIdRef.current,
      type: 'flight_departed',
      text: '✈️ FLIGHT DEPARTED! Gate closed!',
      pos: [SIZER_X + 2.0, 2.0, SIZER_Z],
      color: '#fbbf24',
    });
  }
}

export function carryOnSnapshot(
  world: CarryOnWorld,
  code: string,
  host: string,
  _localPlayerId: string,
  version = 1,
): CarryOnSnapshot {
  return {
    code,
    host,
    version,
    world: JSON.parse(JSON.stringify(world)),
    session: {
      id: _localPlayerId,
      code,
      host,
    },
  };
}
