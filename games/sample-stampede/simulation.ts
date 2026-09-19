import {
  ITEM_DEFS,
  type BulkItemKind,
  type ExitGauntlet,
  type GroundItem,
  type HazardSlipPlate,
  type ItemKind,
  type NPCShopper,
  type PlayerInput,
  type SampleItemKind,
  type SampleKiosk,
  type SampleStampedeSnapshot,
  type SampleStampedeWorld,
  type ShelfRack,
  type ShoppingCart,
  type ShoppingManifest,
  type StampedeEvent,
  type StampedePlayer,
  type TeamId,
} from './types';
import { SampleStampedePhysics } from './physics';
import { updateSampleStampedeBots } from './bots';

export const MATCH_DURATION = 180; // 3 minute match
export const SAMPLE_INTERVAL = 40; // Every 40s a frenzy triggers

export function createDefaultManifest(): ShoppingManifest {
  return {
    targetItems: [
      { kind: 'paper_towels', required: 1, collected: 0 },
      { kind: 'kibble_50lb', required: 1, collected: 0 },
      { kind: 'mega_soda', required: 1, collected: 0 },
      { kind: 'sample_taquito', required: 1, collected: 0 },
    ],
    completed: false,
    rewardPoints: 600,
  };
}

/**
 * `sampleKinds`: the samples the store's kiosks serve. A list never asks for
 * one no kiosk hands out.
 */
export function createRandomManifest(
  round: number,
  sampleKinds: readonly SampleItemKind[] = [
    'sample_taquito',
    'sample_pizza_bagel',
  ],
): ShoppingManifest {
  const bulkKinds: BulkItemKind[] = [
    'paper_towels',
    'kibble_50lb',
    'mega_soda',
    'cereal_box',
  ];

  const pickedBulk1 = bulkKinds[round % bulkKinds.length];
  const pickedBulk2 = bulkKinds[(round + 1) % bulkKinds.length];
  const pickedSample = sampleKinds[round % sampleKinds.length];

  return {
    targetItems: [
      { kind: pickedBulk1, required: 1, collected: 0 },
      { kind: pickedBulk2, required: 1, collected: 0 },
      { kind: pickedSample, required: 1, collected: 0 },
    ],
    completed: false,
    rewardPoints: 750,
  };
}

export function newShoppingCart(
  id: string,
  team: TeamId,
  x: number,
  z: number,
): ShoppingCart {
  return {
    id,
    team,
    driverId: null,
    grabberId: null,
    x,
    y: 0.52,
    z,
    rotY: Math.PI / 2, // Facing North towards aisles
    vx: 0,
    vy: 0,
    vz: 0,
    angularVelocity: 0,
    wobblePhase: 0,
    wobbleIntensity: 0,
    driftSlip: 0,
    baseMass: 45,
    totalMass: 45,
    items: [],
    grabberAngle: 0,
    grabberReach: 0,
    grabberSwatting: false,
    grabberCooldown: 0,
    sugarRushTimer: 0,
    slipSpinTimer: 0,
    score: 0,
    manifest: createDefaultManifest(),
    rejectedUntil: 0,
  };
}

export function newStampedePlayer(
  id: string,
  name: string,
  color: number,
  team: TeamId,
  cartId: string,
  role: 'driver' | 'grabber',
  bot = false,
): StampedePlayer {
  return {
    id,
    name,
    color,
    team,
    cartId,
    role,
    bot,
    input: {
      x: 0,
      z: 0,
      steer: 0,
      throttle: 0,
      drift: false,
      grabberAction: false,
    },
    seen: 0,
  };
}

export function freshSampleStampedeWorld(now: number): SampleStampedeWorld {
  // 1. Build Shelves into 5 Warehouse Aisles
  const shelves: ShelfRack[] = [];
  const aislePositions = [-18, -9, 0, 9, 18]; // X positions of 5 aisles

  aislePositions.forEach((ax, idx) => {
    // North and South racks for each aisle, leaving cross corridors
    shelves.push({
      id: `shelf-${idx + 1}-north`,
      aisle: idx + 1,
      x: ax,
      z: -12,
      width: 3.2,
      length: 16.0,
      height: 4.8,
      destroyed: false,
    });

    shelves.push({
      id: `shelf-${idx + 1}-south`,
      aisle: idx + 1,
      x: ax,
      z: 10,
      width: 3.2,
      length: 16.0,
      height: 4.8,
      destroyed: false,
    });
  });

  // 2. Spawn initial items on shelves and mystery center pallets
  const groundItems: GroundItem[] = [];
  let itemIdCounter = 1;

  const addItem = (
    kind: ItemKind,
    x: number,
    y: number,
    z: number,
    onShelf = true,
  ) => {
    groundItems.push({
      id: `item-${itemIdCounter++}`,
      kind,
      x,
      y,
      z,
      rotX: 0,
      rotY: Math.random() * Math.PI,
      rotZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onShelf,
    });
  };

  // Populate Aisle 1 (Paper Goods)
  for (let z = -18; z <= -6; z += 3.5) {
    addItem('paper_towels', -18, 1.2, z, true);
    addItem('paper_towels', -18, 2.8, z, true);
  }
  for (let z = 4; z <= 16; z += 3.5) {
    addItem('paper_towels', -18, 1.2, z, true);
  }

  // Populate Aisle 2 (Snack & Cereal Mountain - ready to tumble!)
  for (let z = -18; z <= -6; z += 2.2) {
    addItem('cereal_box', -9, 1.2, z, true);
    addItem('cereal_box', -9, 1.7, z, true);
    addItem('cereal_box', -9, 2.8, z, true);
  }
  for (let z = 4; z <= 16; z += 2.2) {
    addItem('cereal_box', -9, 1.2, z, true);
  }

  // Populate Aisle 3 (Pet 50lb Kibble Bags)
  for (let z = -18; z <= -6; z += 3.2) {
    addItem('kibble_50lb', 0, 1.1, z, true);
    addItem('kibble_50lb', 0, 2.7, z, true);
  }
  for (let z = 4; z <= 16; z += 3.2) {
    addItem('kibble_50lb', 0, 1.1, z, true);
  }

  // Populate Aisle 4 (80-Pack Mega Soda)
  for (let z = -18; z <= -6; z += 2.8) {
    addItem('mega_soda', 9, 1.1, z, true);
    addItem('mega_soda', 9, 2.7, z, true);
  }
  for (let z = 4; z <= 16; z += 2.8) {
    addItem('mega_soda', 9, 1.1, z, true);
  }

  // Populate Aisle 5 & Center (10-Foot Giant Teddy Bears - hilarious sabotage items!)
  for (let z = -16; z <= 14; z += 6.5) {
    addItem('giant_teddy', 18, 1.2, z, true);
  }
  // Loose giant teddy on ground pallet
  addItem('giant_teddy', 5, 0.5, 0, false);
  addItem('giant_teddy', -5, 0.5, 0, false);

  // 3. Free Sample Kiosks
  const kiosks: SampleKiosk[] = [
    {
      id: 'kiosk-taquito',
      aisle: 2,
      aisleName: 'Aisle 2: Snack Mountain',
      x: -13.5,
      y: 0,
      z: 0, // In central cross-aisle
      sampleKind: 'sample_taquito',
      samplesAvailable: 6,
      active: true, // First one starts ready
      bellDingTime: now,
      frenzyTimeRemaining: 25,
    },
    {
      id: 'kiosk-pizza-bagel',
      aisle: 4,
      aisleName: 'Aisle 4: Mega Beverage',
      x: 13.5,
      y: 0,
      z: 0,
      sampleKind: 'sample_pizza_bagel',
      samplesAvailable: 6,
      active: false,
      bellDingTime: 0,
      frenzyTimeRemaining: 0,
    },
  ];

  // Spawn initial sample treats on active kiosk
  for (let i = 0; i < 4; i++) {
    addItem('sample_taquito', -13.5 + (i - 1.5) * 0.4, 1.05, 0, false);
  }

  // 4. Initial Slippery Paper Plates around Kiosk
  const hazards: HazardSlipPlate[] = [
    {
      id: 'plate-1',
      x: -12.0,
      z: 1.8,
      kind: 'plate',
      rotation: 0.4,
      duration: 60,
    },
    {
      id: 'plate-2',
      x: -14.2,
      z: -1.5,
      kind: 'plate',
      rotation: 1.2,
      duration: 60,
    },
    {
      id: 'spill-1',
      x: -11.0,
      z: -0.5,
      kind: 'spill',
      rotation: 0,
      duration: 60,
    },
  ];

  // 5. NPC Shoppers
  const npcShoppers: NPCShopper[] = [
    {
      id: 'npc-1',
      x: -10,
      y: 0,
      z: -4,
      rotY: 0,
      vx: 0,
      vz: 0,
      state: 'stampeding',
      targetKioskId: 'kiosk-taquito',
      speed: 4.2,
    },
    {
      id: 'npc-2',
      x: -16,
      y: 0,
      z: 3,
      rotY: 0,
      vx: 0,
      vz: 0,
      state: 'stampeding',
      targetKioskId: 'kiosk-taquito',
      speed: 3.8,
    },
    {
      id: 'npc-3',
      x: 10,
      y: 0,
      z: 6,
      rotY: 0,
      vx: 0,
      vz: 0,
      state: 'wandering',
      targetKioskId: null,
      speed: 2.2,
    },
  ];

  // 6. Exit Receipt Gauntlet (Front entrance of store)
  const exitGauntlet: ExitGauntlet = {
    x: 0,
    z: 28,
    width: 9.0,
    depth: 5.0,
  };

  // 7. Initial Team Carts (Red Team and Blue Team)
  const carts: ShoppingCart[] = [
    newShoppingCart('cart-red', 'red', -4.0, 24.0),
    newShoppingCart('cart-blue', 'blue', 4.0, 24.0),
  ];

  return {
    clock: now,
    started: now,
    phase: 'active',
    status: 'active',
    timeRemaining: MATCH_DURATION,

    matchDuration: MATCH_DURATION,
    nextSampleFrenzyTime: now + SAMPLE_INTERVAL * 1000,
    activeAnnouncement: 'FRESH TAQUITOS IN AISLE 2!',
    announcementExpiry: now + 6000,
    players: [],
    carts,
    groundItems,
    kiosks,
    hazards,
    npcShoppers,
    shelves,
    exitGauntlet,
    events: [],
    teamScores: { red: 0, blue: 0, yellow: 0, green: 0 },
    winnerTeam: null,
  };
}

export function advanceSampleStampedeWorld(
  world: SampleStampedeWorld,
  physics: SampleStampedePhysics,
  dt: number,
  events: StampedeEvent[],
) {
  if (world.status !== 'active') return;

  world.clock += dt * 1000;
  world.timeRemaining = Math.max(0, world.timeRemaining - dt);

  // Clear expired announcements
  if (world.activeAnnouncement && world.clock > world.announcementExpiry) {
    world.activeAnnouncement = null;
  }

  // 1. Update AI Bots
  const inputs = updateSampleStampedeBots(world, dt);

  // 2. Step Physics (Cart drift, wobbly wheel, collisions, grabber actions)
  physics.step(dt, inputs, events);

  // 3. Update Sample Frenzy Timers
  if (world.clock >= world.nextSampleFrenzyTime) {
    triggerSampleFrenzy(world, physics, events);
    world.nextSampleFrenzyTime = world.clock + SAMPLE_INTERVAL * 1000;
  }

  // Update active kiosks
  for (const kiosk of world.kiosks) {
    if (kiosk.active) {
      kiosk.frenzyTimeRemaining = Math.max(0, kiosk.frenzyTimeRemaining - dt);
      if (kiosk.frenzyTimeRemaining <= 0) {
        kiosk.active = false;
      }
    }
  }

  // 4. Update NPC Shoppers
  updateNPCShoppers(world, dt);

  // 5. Check Exit Receipt Gauntlet
  checkReceiptGauntlet(world, events);

  // 6. Match Completion Check
  if (world.timeRemaining <= 0) {
    world.status = 'finished';
    // Determine winner
    let topTeam: TeamId = 'red';
    let topScore = -1;
    for (const [team, score] of Object.entries(world.teamScores)) {
      if (score > topScore) {
        topScore = score;
        topTeam = team as TeamId;
      }
    }
    world.winnerTeam = topTeam;
  }
}

function triggerSampleFrenzy(
  world: SampleStampedeWorld,
  physics: SampleStampedePhysics,
  events: StampedeEvent[],
) {
  // Kiosks take turns: the idle one that rang longest ago serves next.
  const targetKiosk =
    world.kiosks
      .filter((k) => !k.active)
      .sort((a, b) => a.bellDingTime - b.bellDingTime)[0] ?? world.kiosks[0];

  targetKiosk.active = true;
  targetKiosk.frenzyTimeRemaining = 30;
  targetKiosk.bellDingTime = world.clock;

  const sampleNames: Record<SampleItemKind, string> = {
    sample_taquito: 'TAQUITOS',
    sample_pizza_bagel: 'PIZZA BAGELS',
    sample_churro: 'CINNAMON CHURROS',
    sample_cheese: 'AGED GOUDA',
  };

  const text = `DING-DONG! FRESH ${sampleNames[targetKiosk.sampleKind]} IN ${targetKiosk.aisleName.toUpperCase()}!`;
  world.activeAnnouncement = text;
  world.announcementExpiry = world.clock + 7000;

  events.push({
    id: Date.now() + Math.random(),
    type: 'sample_announcement',
    x: targetKiosk.x,
    y: 1.5,
    z: targetKiosk.z,
    text,
  });

  // Spawn fresh samples around the counter
  for (let i = 0; i < 5; i++) {
    const rx = targetKiosk.x + (Math.random() - 0.5) * 1.6;
    const rz = targetKiosk.z + (Math.random() - 0.5) * 1.6;
    physics.spawnGroundItem(targetKiosk.sampleKind, rx, 1.1, rz, false);
  }

  // Spawn discarded plates & spills as hazards
  for (let i = 0; i < 3; i++) {
    const px = targetKiosk.x + (Math.random() - 0.5) * 4.0;
    const pz = targetKiosk.z + (Math.random() - 0.5) * 4.0;
    world.hazards.push({
      id: `plate-${Date.now()}-${i}`,
      x: px,
      z: pz,
      kind: Math.random() < 0.7 ? 'plate' : 'spill',
      rotation: Math.random() * Math.PI * 2,
      duration: 45,
    });
  }

  // Send all NPC shoppers stampeding to the kiosk
  for (const shopper of world.npcShoppers) {
    shopper.state = 'stampeding';
    shopper.targetKioskId = targetKiosk.id;
  }
}

function updateNPCShoppers(world: SampleStampedeWorld, dt: number) {
  for (const shopper of world.npcShoppers) {
    let targetX = shopper.x;
    let targetZ = shopper.z;

    if (shopper.state === 'stampeding' && shopper.targetKioskId) {
      const kiosk = world.kiosks.find((k) => k.id === shopper.targetKioskId);
      if (kiosk && kiosk.active) {
        targetX = kiosk.x;
        targetZ = kiosk.z;
      } else {
        shopper.state = 'wandering';
      }
    } else {
      // Random wandering in aisles
      if (Math.random() < 0.02) {
        shopper.vx = (Math.random() - 0.5) * shopper.speed;
        shopper.vz = (Math.random() - 0.5) * shopper.speed;
      }
    }

    if (shopper.state === 'stampeding') {
      const dx = targetX - shopper.x;
      const dz = targetZ - shopper.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1.2) {
        shopper.vx = (dx / dist) * shopper.speed;
        shopper.vz = (dz / dist) * shopper.speed;
        shopper.rotY = Math.atan2(-dz, dx);
      } else {
        shopper.vx = 0;
        shopper.vz = 0;
      }
    }

    shopper.x += shopper.vx * dt;
    shopper.z += shopper.vz * dt;
  }
}

/**
 * Exit Receipt Gauntlet: Checks cart contents vs required manifest
 */
function checkReceiptGauntlet(
  world: SampleStampedeWorld,
  events: StampedeEvent[],
) {
  const { x: gx, z: gz, width: gw, depth: gd } = world.exitGauntlet;

  for (const cart of world.carts) {
    // Check if cart is within exit gauntlet inspection zone
    const inZone =
      Math.abs(cart.x - gx) < gw / 2 && Math.abs(cart.z - gz) < gd / 2;

    if (!inZone) continue;
    if (world.clock < cart.rejectedUntil) continue; // In penalty timeout

    // 1. Inspect for unauthorized contraband (e.g. 10-foot giant teddy bear!)
    const contraband = cart.items.find(
      (it) => ITEM_DEFS[it.kind].isContraband === true,
    );

    if (contraband) {
      // REJECTED! Unauthorized sabotage item in cart!
      cart.rejectedUntil = world.clock + 4500;
      cart.vz = -8.0; // Shove cart back from the exit!

      events.push({
        id: Date.now() + Math.random(),
        type: 'receipt_rejected',
        x: cart.x,
        y: 1.5,
        z: cart.z,
        text: 'REJECTED! UNAUTHORIZED TEDDY BEAR!',
        team: cart.team,
      });
      continue;
    }

    // 2. Match cart items against manifest checklist
    const counts: Partial<Record<ItemKind, number>> = {};
    for (const it of cart.items) {
      counts[it.kind] = (counts[it.kind] || 0) + 1;
    }

    let allComplete = true;
    for (const req of cart.manifest.targetItems) {
      req.collected = counts[req.kind] || 0;
      if (req.collected < req.required) {
        allComplete = false;
      }
    }

    if (allComplete && cart.items.length > 0) {
      // APPROVED!
      cart.manifest.completed = true;

      // Calculate score
      let runScore = cart.manifest.rewardPoints;
      for (const it of cart.items) {
        runScore += ITEM_DEFS[it.kind].scoreValue;
      }
      cart.score += runScore;
      world.teamScores[cart.team] += runScore;

      events.push({
        id: Date.now() + Math.random(),
        type: 'receipt_approved',
        x: cart.x,
        y: 1.8,
        z: cart.z,
        text: `RECEIPT APPROVED! +${runScore} PTS`,
        team: cart.team,
      });

      // Clear checked out items and assign next manifest
      cart.items = [];
      cart.manifest = createRandomManifest(
        Math.floor(cart.score / 500) + 1,
        world.kiosks.map((k) => k.sampleKind),
      );
      cart.rejectedUntil = world.clock + 2000;
    }
  }
}

const physicsCache = new WeakMap<SampleStampedeWorld, SampleStampedePhysics>();

export function getOrCreatePhysics(
  w: SampleStampedeWorld,
): SampleStampedePhysics {
  let physics = physicsCache.get(w);
  if (!physics) {
    physics = new SampleStampedePhysics(w);
    physicsCache.set(w, physics);
  }
  return physics;
}

// A room's snapshots repeat its recent events; viewers skip ids they have
// already played.
const ROOM_EVENT_LIMIT = 24;

export function advanceSampleStampedeTick(w: SampleStampedeWorld, now: number) {
  const lastTime = w.clock > 0 ? w.clock : now;
  const dt = Math.min(Math.max((now - lastTime) / 1000, 1 / 60), 0.1);
  const physics = getOrCreatePhysics(w);
  // Trim before advancing, so this tick's events all reach the next snapshot.
  if (w.events.length > ROOM_EVENT_LIMIT)
    w.events = w.events.slice(-ROOM_EVENT_LIMIT);
  advanceSampleStampedeWorld(w, physics, dt, w.events);
}

export function sampleStampedeAction(
  world: SampleStampedeWorld,
  playerId: string,
  action: { type: string; [k: string]: unknown },
  isHost: boolean,
) {
  const player = world.players.find((p) => p.id === playerId);
  if (!player) return;

  if (action.type === 'input') {
    player.input = action.input as PlayerInput;
  } else if (action.type === 'switch_role') {
    player.role = player.role === 'driver' ? 'grabber' : 'driver';
  } else if (action.type === 'switch_team') {
    const teams: TeamId[] = ['red', 'blue', 'yellow', 'green'];
    const curIdx = teams.indexOf(player.team);
    player.team = teams[(curIdx + 1) % teams.length];
  } else if (action.type === 'reset' && isHost) {
    world.timeRemaining = MATCH_DURATION;
    world.status = 'active';
    world.teamScores = { red: 0, blue: 0, yellow: 0, green: 0 };
    for (const c of world.carts) {
      c.score = 0;
      c.items = [];
    }
  }
}

export function sampleStampedeSnapshot(
  world: SampleStampedeWorld,
  code: string,
  host: string,
  localPlayerId: string,
  version: number,
): SampleStampedeSnapshot {
  const localPlayer = world.players.find((p) => p.id === localPlayerId);
  const myRole = localPlayer?.role || 'driver';
  const myTeam = localPlayer?.team || 'red';
  const localCartId = localPlayer?.cartId || world.carts[0]?.id || 'cart-red';

  return {
    world: {
      ...world,
      players: world.players.map((p) => ({ ...p, input: { ...p.input } })),
      carts: world.carts.map((c) => ({
        ...c,
        items: [...c.items],
        manifest: {
          ...c.manifest,
          targetItems: c.manifest.targetItems.map((ti) => ({ ...ti })),
        },
      })),
      groundItems: [...world.groundItems],
      kiosks: [...world.kiosks],
      hazards: [...world.hazards],
      npcShoppers: [...world.npcShoppers],
      shelves: [...world.shelves],
      exitGauntlet: { ...world.exitGauntlet },
      events: [...world.events],
      teamScores: { ...world.teamScores },
    },
    mode: world.players.length > 2 ? 'DERBY' : 'SOLO',
    code,
    host,
    version,
    localPlayerId,
    localCartId,
    myRole,
    myTeam,
  };
}
