import {
  CRADLE_WIDTH,
  DEFAULT_ALTITUDE,
  ROOF_ALTITUDE,
  ROUND_TIME_MS,
  TARGET_CLEANED_WINDOWS,
  TILT_WARNING_DEG,
  WINCH_CRANK_SPEED,
  clamp,
  idleInput,
  type Player,
  type PlayerTool,
  type Role,
  type ScaffoldAction,
  type ScaffoldSnapshot,
  type ScaffoldScrambleWorld,
  type WindowTarget,
} from './types';
import {
  stepBucketPhysics,
  stepCradleKinematics,
  stepPigeonBehavior,
  stepPlayerPhysics,
  stepWind,
} from './physics';

export function newPlayer(
  id: string,
  name: string,
  color: number,
  role: Role,
  bot: boolean,
  spawnIndex = 0,
): Player {
  // Distribute spawn points along the cradle deck
  const spawnPositions = [-3.5, 3.5, -1.2, 1.2];
  const initialX = spawnPositions[spawnIndex % spawnPositions.length];
  const defaultTool: PlayerTool =
    role === 'cleaner'
      ? spawnIndex % 2 === 0
        ? 'sponge'
        : 'squeegee'
      : 'squeegee';

  return {
    id,
    name,
    color,
    role,
    bot,
    deckX: initialX,
    deckY: 0,
    vx: 0,
    state: 'standing',
    stateTimer: 0,
    dangleY: -2.2,
    tetherLength: 2.2,
    tool: defaultTool,
    facing: initialX < 0 ? 1 : -1,
    crankSide:
      role === 'left-winch' ? 'left' : role === 'right-winch' ? 'right' : null,
    cleaningTargetId: null,
    score: 0,
    windowsCleaned: 0,
    slips: 0,
    dangles: 0,
    input: idleInput(),
    seen: Date.now(),
  };
}

export function freshScaffoldWorld(
  now: number,
  seed = 42,
): ScaffoldScrambleWorld {
  // Generate skyscraper windows
  // 5 columns across facade: x = -3.6, -1.8, 0, 1.8, 3.6
  // 15 vertical floors: y = 22 to 82, step 4.0
  const cols = [-3.6, -1.8, 0, 1.8, 3.6];
  const windows: WindowTarget[] = [];
  let winId = 0;

  // Generate 75 window locations
  const allWindows: { col: number; row: number; x: number; y: number }[] = [];
  for (let r = 0; r < 15; r++) {
    const y = 22 + r * 4.0;
    for (let c = 0; c < 5; c++) {
      allWindows.push({
        col: c - 2,
        row: r,
        x: cols[c],
        y,
      });
    }
  }

  // Deterministically select 30 windows to be dirty based on pseudo-random sequence
  const shuffled = [...allWindows].sort((a, b) => {
    const hashA = Math.sin(a.col * 77 + a.row * 93 + seed) * 10000;
    const hashB = Math.sin(b.col * 77 + b.row * 93 + seed) * 10000;
    return hashA - Math.floor(hashA) - (hashB - Math.floor(hashB));
  });

  const dirtySet = new Set(
    shuffled.slice(0, TARGET_CLEANED_WINDOWS).map((w) => `${w.col},${w.row}`),
  );

  for (const w of allWindows) {
    const isDirty = dirtySet.has(`${w.col},${w.row}`);
    windows.push({
      id: `win-${winId++}`,
      col: w.col,
      row: w.row,
      x: w.x,
      y: w.y,
      status: isDirty ? 'dirty' : 'spotless',
      foamAmount: 0,
      sparkleTimer: 0,
    });
  }

  return {
    seed,
    clock: now,
    started: 0,
    phase: 'lobby',
    startedAt: 0,
    endsAt: 0,
    winner: null,
    cradle: {
      leftHeight: DEFAULT_ALTITUDE,
      rightHeight: DEFAULT_ALTITUDE,
      centerHeight: DEFAULT_ALTITUDE,
      tiltRad: 0,
      tiltDeg: 0,
      tiltVel: 0,
      swayX: 0,
      swayZ: 0,
      deckSuds: 0,
    },
    windows,
    buckets: [
      {
        id: 'bucket-1',
        x: -2.4,
        vx: 0,
        spilled: false,
        spillTimer: 0,
        sudsLevel: 1.0,
      },
      {
        id: 'bucket-2',
        x: 2.4,
        vx: 0,
        spilled: false,
        spillTimer: 0,
        sudsLevel: 1.0,
      },
    ],
    pigeons: [
      {
        id: 'pigeon-1',
        target: 'cable-left',
        x: -CRADLE_WIDTH / 2,
        y: DEFAULT_ALTITUDE + 1.2,
        perched: false,
        annoyance: 0.5,
        timeToLeave: 0,
        flapTimer: 0,
      },
      {
        id: 'pigeon-2',
        target: 'cable-right',
        x: CRADLE_WIDTH / 2,
        y: DEFAULT_ALTITUDE + 1.2,
        perched: false,
        annoyance: 0.5,
        timeToLeave: 0,
        flapTimer: 1.5,
      },
    ],
    wind: {
      active: false,
      strength: 0,
      timer: 10,
      duration: 5,
    },
    helicopter: {
      y: 120.0,
      targetY: ROOF_ALTITUDE + 1.5,
      rotorSpeed: 30.0,
      bladeAngle: 0,
      landed: false,
    },
    players: [],
    cleanedCount: 0,
    totalWindows: TARGET_CLEANED_WINDOWS,
    events: [],
  };
}

export function advanceScaffoldScramble(
  world: ScaffoldScrambleWorld,
  now: number,
  dtParam?: number,
) {
  const dt =
    dtParam ??
    Math.max(
      0.001,
      Math.min(0.05, (now - (world.clock || now)) / 1000 || 0.016),
    );
  world.clock = now;

  // Prune events older than 4 seconds
  if (world.events.length > 50) {
    world.events = world.events.slice(-30);
  }

  const eventIdRef = {
    current:
      world.events.length > 0 ? world.events[world.events.length - 1].id : 0,
  };

  // Sparkle animation decay on cleaned windows
  for (const win of world.windows) {
    if (win.sparkleTimer > 0) {
      win.sparkleTimer = Math.max(0, win.sparkleTimer - dt);
    }
  }

  // Helicopter rotor spinning
  world.helicopter.bladeAngle += dt * world.helicopter.rotorSpeed;

  if (world.phase !== 'playing') return;

  // Check helicopter descent as timer advances
  const elapsed = Math.max(0, now - world.startedAt);
  const progress = clamp(elapsed / ROUND_TIME_MS, 0, 1);
  // Helicopter approaches from sky (120m) down to roof helipad (ROOF_ALTITUDE + 1.2m)
  world.helicopter.y = 120 - progress * (120 - (ROOF_ALTITUDE + 1.2));

  // Pigeon obstacle slowing down winches
  const leftPigeonJam = world.pigeons.some(
    (p) =>
      p.perched && (p.target === 'cable-left' || p.target === 'railing-left'),
  );
  const rightPigeonJam = world.pigeons.some(
    (p) =>
      p.perched && (p.target === 'cable-right' || p.target === 'railing-right'),
  );

  const leftSpeedMult = leftPigeonJam ? 0.45 : 1.0;
  const rightSpeedMult = rightPigeonJam ? 0.45 : 1.0;

  // Step Winch Inputs from Players
  for (const p of world.players) {
    if (p.state === 'dangling' || p.state === 'climbing') continue;

    // Left winch crank
    if (p.input.crankLeftUp) {
      world.cradle.leftHeight += WINCH_CRANK_SPEED * leftSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = -1;
      emitCrankEvent(world, p.id, 'left', eventIdRef);
    } else if (p.input.crankLeftDown) {
      world.cradle.leftHeight -= WINCH_CRANK_SPEED * leftSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = -1;
      emitCrankEvent(world, p.id, 'left', eventIdRef);
    }

    // Right winch crank
    if (p.input.crankRightUp) {
      world.cradle.rightHeight += WINCH_CRANK_SPEED * rightSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = 1;
      emitCrankEvent(world, p.id, 'right', eventIdRef);
    } else if (p.input.crankRightDown) {
      world.cradle.rightHeight -= WINCH_CRANK_SPEED * rightSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = 1;
      emitCrankEvent(world, p.id, 'right', eventIdRef);
    }

    // Contextual cranking when walking to the winch stations:
    // If near left winch and holding Action, crank up
    if (
      p.deckX <= -CRADLE_WIDTH / 2 + 1.2 &&
      p.input.action &&
      (p.role === 'left-winch' || p.role === 'all-rounder')
    ) {
      world.cradle.leftHeight += WINCH_CRANK_SPEED * leftSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = -1;
      emitCrankEvent(world, p.id, 'left', eventIdRef);
    }

    // If near right winch and holding Action, crank up
    if (
      p.deckX >= CRADLE_WIDTH / 2 - 1.2 &&
      p.input.action &&
      (p.role === 'right-winch' || p.role === 'all-rounder')
    ) {
      world.cradle.rightHeight += WINCH_CRANK_SPEED * rightSpeedMult * dt * 4.0;
      p.state = 'cranking';
      p.facing = 1;
      emitCrankEvent(world, p.id, 'right', eventIdRef);
    }

    // Switch tool toggle
    if (p.input.switchTool) {
      p.tool = p.tool === 'sponge' ? 'squeegee' : 'sponge';
      p.input.switchTool = false; // consume
    }

    // Handle cleaning interaction if action pressed away from winches
    if (p.input.action && p.state !== 'cranking' && p.state !== 'sliding') {
      interactCleaningOrShoo(world, p, eventIdRef);
    }

    // Decay cleaning/shooing/cranking state timer
    if (
      p.state === 'cleaning' ||
      p.state === 'shooing' ||
      p.state === 'cranking'
    ) {
      p.stateTimer -= dt;
      if (p.stateTimer <= 0) {
        p.state = 'standing';
      }
    }
  }

  // Step Cradle Kinematics
  const prevTilt = world.cradle.tiltDeg;
  stepCradleKinematics(world.cradle, dt);

  // Trigger tilt alarm event on threshold crossing
  if (
    Math.abs(world.cradle.tiltDeg) >= TILT_WARNING_DEG &&
    Math.abs(prevTilt) < TILT_WARNING_DEG
  ) {
    world.events.push({
      id: ++eventIdRef.current,
      type: 'tilt_warning',
      detail: `Extreme tilt warning! Angle reached ${world.cradle.tiltDeg.toFixed(1)}°!`,
    });
  }

  // Step Wind
  stepWind(world.wind, world.cradle, dt, world.events, eventIdRef);

  // Step Buckets
  for (const bucket of world.buckets) {
    stepBucketPhysics(bucket, world.cradle, dt, world.events, eventIdRef);
  }

  // Step Players
  for (const player of world.players) {
    stepPlayerPhysics(
      player,
      world.cradle,
      world.buckets,
      dt,
      world.events,
      eventIdRef,
    );
  }

  // Step Pigeons
  for (const pigeon of world.pigeons) {
    stepPigeonBehavior(pigeon, world.cradle, dt, world.events, eventIdRef);
  }

  // Check Round End Conditions
  if (world.cleanedCount >= TARGET_CLEANED_WINDOWS) {
    // All 30 windows spotless! Victory!
    world.phase = 'ended';
    world.winner = 'crew';
    world.events.push({
      id: ++eventIdRef.current,
      type: 'win',
      detail:
        'All 30 dirty windows are sparkling spotless! The CEO arrives impressed!',
    });
  } else if (now >= world.endsAt) {
    // Helicopter lands before job complete!
    world.phase = 'ended';
    world.winner = 'failed';
    world.helicopter.landed = true;
    world.events.push({
      id: ++eventIdRef.current,
      type: 'timeout',
      detail: `The CEO's helicopter landed on the roof! Only ${world.cleanedCount}/${TARGET_CLEANED_WINDOWS} windows cleaned!`,
    });
  }
}

function emitCrankEvent(
  world: ScaffoldScrambleWorld,
  playerId: string,
  winch: 'left' | 'right',
  eventIdRef: { current: number },
) {
  // Rate-limit crank events to avoid spamming
  const lastCrank = world.events.find(
    (e) => e.type === 'crank' && e.playerId === playerId,
  );
  if (!lastCrank || Math.random() < 0.15) {
    world.events.push({
      id: ++eventIdRef.current,
      type: 'crank',
      playerId,
      detail: `Winch ${winch} cranked`,
    });
  }
}

function interactCleaningOrShoo(
  world: ScaffoldScrambleWorld,
  player: Player,
  eventIdRef: { current: number },
) {
  // First check if any pigeon is within shooing reach
  for (const pigeon of world.pigeons) {
    if (pigeon.perched && Math.abs(player.deckX - pigeon.x) < 2.0) {
      pigeon.perched = false;
      player.state = 'shooing';
      player.stateTimer = 0.5;
      world.events.push({
        id: ++eventIdRef.current,
        type: 'pigeon_shoo',
        playerId: player.id,
        detail: `${player.name} shooed away a pesky pigeon!`,
      });
      return;
    }
  }

  // Calculate player's world coordinates
  const tiltRad = world.cradle.tiltRad;
  const worldX = player.deckX * Math.cos(tiltRad);
  const worldY =
    world.cradle.centerHeight + player.deckX * Math.sin(tiltRad) + 1.2;

  // Find nearest window that is in reach
  let bestDist = 2.4;
  let targetWindow: WindowTarget | null = null;

  for (const win of world.windows) {
    const dx = Math.abs(win.x - worldX);
    const dy = Math.abs(win.y - worldY);
    if (dx < 1.3 && dy < 1.8) {
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        targetWindow = win;
      }
    }
  }

  if (!targetWindow) return;

  if (player.tool === 'sponge') {
    if (targetWindow.status === 'dirty') {
      targetWindow.status = 'foamed';
      targetWindow.foamAmount = 1.0;
      player.state = 'cleaning';
      player.stateTimer = 0.45;

      world.events.push({
        id: ++eventIdRef.current,
        type: 'soap_apply',
        playerId: player.id,
        detail: `${player.name} slapped thick soapy foam on window ${targetWindow.col},${targetWindow.row}!`,
      });
    }
  } else if (player.tool === 'squeegee') {
    if (targetWindow.status === 'foamed') {
      targetWindow.status = 'spotless';
      targetWindow.foamAmount = 0;
      targetWindow.sparkleTimer = 2.5;
      world.cleanedCount++;
      player.windowsCleaned++;
      player.score += 100;
      player.state = 'cleaning';
      player.stateTimer = 0.45;

      world.events.push({
        id: ++eventIdRef.current,
        type: 'window_clean',
        playerId: player.id,
        detail: `${player.name} wiped window ${targetWindow.col},${targetWindow.row} spotless! (${world.cleanedCount}/${TARGET_CLEANED_WINDOWS})`,
      });
    }
  }
}

export function scaffoldScrambleAction(
  world: ScaffoldScrambleWorld,
  playerId: string,
  act: ScaffoldAction,
) {
  const eventIdRef = {
    current:
      world.events.length > 0 ? world.events[world.events.length - 1].id : 0,
  };

  switch (act.type) {
    case 'start': {
      if (world.phase === 'lobby') {
        world.phase = 'playing';
        world.started = Date.now();
        world.startedAt = world.started;
        world.endsAt = world.startedAt + ROUND_TIME_MS;
      }
      break;
    }

    case 'restart': {
      const existingPlayers = world.players.map((p, idx) =>
        newPlayer(p.id, p.name, p.color, p.role, p.bot, idx),
      );
      const newSeed = world.seed + 1;
      const fresh = freshScaffoldWorld(Date.now(), newSeed);
      fresh.players = existingPlayers;
      fresh.phase = 'playing';
      fresh.started = Date.now();
      fresh.startedAt = fresh.started;
      fresh.endsAt = fresh.startedAt + ROUND_TIME_MS;
      Object.assign(world, fresh);
      break;
    }

    case 'crank': {
      const pigeonJam = world.pigeons.some(
        (p) =>
          p.perched &&
          ((act.winch === 'left' && p.target.includes('left')) ||
            (act.winch === 'right' && p.target.includes('right'))),
      );
      const mult = pigeonJam ? 0.45 : 1.0;
      const delta = WINCH_CRANK_SPEED * mult * (act.dir === 'up' ? 1 : -1);

      if (act.winch === 'left') {
        world.cradle.leftHeight += delta;
      } else {
        world.cradle.rightHeight += delta;
      }
      stepCradleKinematics(world.cradle, 0.016);
      emitCrankEvent(world, playerId, act.winch, eventIdRef);
      break;
    }

    case 'useTool': {
      const p = world.players.find((pl) => pl.id === playerId);
      if (p) interactCleaningOrShoo(world, p, eventIdRef);
      break;
    }

    case 'switchTool': {
      const p = world.players.find((pl) => pl.id === playerId);
      if (p) {
        p.tool = p.tool === 'sponge' ? 'squeegee' : 'sponge';
      }
      break;
    }

    case 'shoo': {
      const p = world.players.find((pl) => pl.id === playerId);
      if (p) {
        for (const pig of world.pigeons) {
          if (pig.perched && Math.abs(p.deckX - pig.x) < 2.5) {
            pig.perched = false;
            p.state = 'shooing';
            p.stateTimer = 0.5;
            world.events.push({
              id: ++eventIdRef.current,
              type: 'pigeon_shoo',
              playerId,
              detail: 'Shooed pigeon away!',
            });
            break;
          }
        }
      }
      break;
    }

    case 'climb': {
      const p = world.players.find((pl) => pl.id === playerId);
      if (p && p.state === 'dangling') {
        p.state = 'climbing';
      }
      break;
    }

    case 'switchRole': {
      const p = world.players.find((pl) => pl.id === playerId);
      if (p) {
        p.role = act.role;
        p.crankSide =
          act.role === 'left-winch'
            ? 'left'
            : act.role === 'right-winch'
              ? 'right'
              : null;
      }
      break;
    }
  }
}

export function scaffoldScrambleSnapshot(
  world: ScaffoldScrambleWorld,
  code: string,
  host: string,
  me: string,
  version: number,
): ScaffoldSnapshot {
  return {
    code,
    host,
    me,
    version,
    world: {
      ...world,
      cradle: { ...world.cradle },
      windows: world.windows.map((w) => ({ ...w })),
      buckets: world.buckets.map((b) => ({ ...b })),
      pigeons: world.pigeons.map((p) => ({ ...p })),
      wind: { ...world.wind },
      helicopter: { ...world.helicopter },
      players: world.players.map((p) => ({
        ...p,
        input: { ...p.input },
      })),
      events: [...world.events],
    },
  };
}
