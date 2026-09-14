import { CraneClashPhysics, STEP } from './physics';
import {
  CRANE_CONFIG,
  CRATE_CONFIGS,
  ROUND_MS,
  TEAMS,
  WIN_HEIGHT,
  idleInput,
  type Crate,
  type CrateKind,
  type CraneClashAction,
  type CraneClashSnapshot,
  type CraneClashWorld,
  type CraneState,
  type GameEvent,
  type Player,
  type Role,
  type TeamId,
} from './types';
import { driveBots, reconcileClashBots } from './bots';

const CRATE_KINDS: CrateKind[] = [
  'crate',
  'crate',
  'block',
  'crate',
  'beam',
  'barrel',
  'block',
  'crate',
  'barrel',
  'beam',
  'golden',
];

export function buildYardCrates(seed = 1): Crate[] {
  const crates: Crate[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  let id = 1;
  // Distribute 26 crates across the central supply yard
  for (let row = -5; row <= 2; row += 1.4) {
    for (let col = -5.5; col <= 5.5; col += 1.8) {
      if (rand() > 0.35 && crates.length < 26) {
        const kind =
          CRATE_KINDS[Math.floor(rand() * CRATE_KINDS.length)] || 'crate';
        const cfg = CRATE_CONFIGS[kind];
        crates.push({
          id: `crate-${id++}`,
          kind,
          x: col + (rand() - 0.5) * 0.8,
          y: cfg.h / 2,
          z: row + (rand() - 0.5) * 0.8,
          vx: 0,
          vy: 0,
          vz: 0,
          heldBy: null,
          teamPad: null,
        });
      }
    }
  }

  // Ensure at least two golden crates in the center
  crates.push({
    id: `crate-${id++}`,
    kind: 'golden',
    x: 0,
    y: CRATE_CONFIGS.golden.h / 2,
    z: -1.5,
    vx: 0,
    vy: 0,
    vz: 0,
  });
  crates.push({
    id: `crate-${id++}`,
    kind: 'golden',
    x: (rand() - 0.5) * 2,
    y: CRATE_CONFIGS.golden.h / 2,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
  });

  return crates;
}

export function initialCrane(team: TeamId): CraneState {
  const cfg = CRANE_CONFIG[team];
  const angle = team === 'orange' ? 0.45 : Math.PI - 0.45;
  const trolleyDist = 5.8;
  const trolleyX = cfg.mast.x + Math.cos(angle) * trolleyDist;
  const trolleyZ = cfg.mast.z + Math.sin(angle) * trolleyDist;
  const cableLength = 8.5;

  return {
    team,
    angle,
    trolleyDist,
    trolleyX,
    trolleyZ,
    cableLength,
    hookX: trolleyX,
    hookY: cfg.boomY - 0.4 - cableLength,
    hookZ: trolleyZ,
    hookVx: 0,
    hookVy: 0,
    hookVz: 0,
  };
}

export function freshClashWorld(now: number, seed = 1): CraneClashWorld {
  return {
    phase: 'lobby',
    mode: 'normal',
    clock: now,
    started: 0,
    remainder: 0,
    players: [],
    cranes: {
      orange: initialCrane('orange'),
      teal: initialCrane('teal'),
    },
    crates: buildYardCrates(seed),
    scores: {
      orange: { height: 0, crates: 0, recordHeight: 0 },
      teal: { height: 0, crates: 0, recordHeight: 0 },
    },
    winner: null,
    events: [],
    eventId: 0,
    seed,
  };
}

export function newPlayer(
  id: string,
  name: string,
  color: number,
  team: TeamId,
  role: Role,
  bot = false,
): Player {
  const cfg = CRANE_CONFIG[team];
  const x = role === 'operator' ? cfg.mast.x : cfg.mast.x + 4;
  const y = role === 'operator' ? cfg.cabinY : 4;
  const z = role === 'operator' ? cfg.mast.z : 2;

  return {
    id,
    name: name.slice(0, 18),
    color,
    team,
    role,
    bot,
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: role === 'operator' ? 0 : Math.PI,
    holdingCrateId: null,
    dazedUntil: 0,
    input: idleInput(),
    lastAction: 0,
    seen: Date.now(),
  };
}

export function emitEvent(
  w: CraneClashWorld,
  type: GameEvent['type'],
  text: string,
  team?: TeamId,
) {
  w.eventId += 1;
  w.events.push({
    id: w.eventId,
    type,
    text,
    team,
    at: w.clock,
  });
  if (w.events.length > 20) w.events.shift();
}

export function advanceCraneClash(w: CraneClashWorld, now: number) {
  if (now <= w.clock) return;
  const elapsed = Math.min((now - w.clock) / 1000, 0.5);
  w.clock = now;

  if (w.phase !== 'playing') return;

  // Check match time limit
  const playedMs = w.clock - w.started;
  if (playedMs >= ROUND_MS) {
    w.phase = 'ended';
    const orangeH = w.scores.orange.height;
    const tealH = w.scores.teal.height;
    if (orangeH > tealH) {
      w.winner = 'orange';
      emitEvent(
        w,
        'siren',
        `Zeit abgelaufen! Team Orange gewinnt mit ${orangeH.toFixed(1)}m!`,
        'orange',
      );
    } else if (tealH > orangeH) {
      w.winner = 'teal';
      emitEvent(
        w,
        'siren',
        `Zeit abgelaufen! Team Teal gewinnt mit ${tealH.toFixed(1)}m!`,
        'teal',
      );
    } else {
      w.winner = 'draw';
      emitEvent(
        w,
        'siren',
        `Unentschieden! Beide Teams bauten ${orangeH.toFixed(1)}m hoch.`,
      );
    }
    return;
  }

  // Drive AI Bots
  driveBots(w);

  // Step physics
  const total = elapsed + w.remainder;
  const steps = Math.floor((total + 1e-9) / STEP);
  w.remainder = total - steps * STEP;

  if (steps > 0) {
    const physics = new CraneClashPhysics(w);

    for (let step = 0; step < steps; step++) {
      // Apply operator controls
      for (const team of TEAMS) {
        const op = w.players.find(
          (p) => p.team === team && p.role === 'operator',
        );
        if (op) {
          const inp = w.clock - op.seen > 1200 ? idleInput() : op.input;
          physics.driveOperator(team, inp, STEP);
        }
      }

      // Apply swinger controls
      for (const team of TEAMS) {
        const sw = w.players.find(
          (p) => p.team === team && p.role === 'swinger',
        );
        if (sw) {
          const inp = w.clock - sw.seen > 1200 ? idleInput() : sw.input;
          if (!sw.dazedUntil || w.clock >= sw.dazedUntil) {
            physics.driveSwinger(team, inp);
          }
        }
      }

      physics.step(STEP);
    }

    // Process collisions
    for (const col of physics.collisions) {
      if (col.type === 'bonk') {
        emitEvent(
          w,
          'bonk',
          'RUMMS! Die beiden Seilspringer sind zusammengekracht!',
        );
        // Both drop crates and get dazed
        for (const p of w.players) {
          if (p.role === 'swinger') {
            if (p.holdingCrateId) {
              physics.releaseCrate(p);
            }
            p.dazedUntil = w.clock + 1800;
          }
        }
      }
    }

    // Update tower heights & check records / topples
    const newScores = physics.calculateHeights();
    for (const team of TEAMS) {
      const prev = w.scores[team];
      const next = newScores[team];

      if (next.height > prev.recordHeight) {
        prev.recordHeight = next.height;
        if (
          next.height >= 4 &&
          Math.floor(next.height) > Math.floor(prev.height)
        ) {
          emitEvent(
            w,
            'height',
            `${team === 'orange' ? 'Team Orange' : 'Team Teal'} erreicht ${next.height.toFixed(1)}m!`,
            team,
          );
        }
      } else if (prev.height > 2.5 && next.height < prev.height - 1.6) {
        emitEvent(
          w,
          'topple',
          `ACHTUNG! Der Turm von ${team === 'orange' ? 'Team Orange' : 'Team Teal'} ist eingestürzt!`,
          team,
        );
      }

      prev.height = next.height;
      prev.crates = next.crates;

      // Check instant win ceiling
      if (next.height >= WIN_HEIGHT) {
        w.phase = 'ended';
        w.winner = team;
        emitEvent(
          w,
          'siren',
          `${team === 'orange' ? 'Team Orange' : 'Team Teal'} erreicht ${WIN_HEIGHT}m und gewinnt sofort!`,
          team,
        );
      }
    }
  }
}

export function craneClashAction(
  w: CraneClashWorld,
  playerId: string,
  action: CraneClashAction,
  isHost = false,
) {
  const player = w.players.find((p) => p.id === playerId);

  if (action.type === 'start') {
    if (w.phase !== 'playing') {
      w.phase = 'playing';
      w.started = w.clock;
      reconcileClashBots(w);
      emitEvent(w, 'siren', 'Das Kran-Match hat begonnen! Baut um die Wette!');
    }
    return;
  }

  if (action.type === 'restart') {
    if (isHost || w.phase === 'ended') {
      const savedPlayers = [...w.players];
      const fresh = freshClashWorld(w.clock, (w.seed + 1) % 10000);
      Object.assign(w, fresh);
      w.players = savedPlayers;
      reconcileClashBots(w);
      emitEvent(w, 'siren', 'Neues Match gestartet!');
    }
    return;
  }

  if (!player) return;

  if (action.type === 'switchTeam') {
    if (w.phase === 'lobby' || w.mode === 'practice') {
      player.team = action.team;
      reconcileClashBots(w);
    }
    return;
  }

  if (action.type === 'switchRole') {
    if (w.phase === 'lobby' || w.mode === 'practice') {
      player.role = action.role;
      reconcileClashBots(w);
    }
    return;
  }

  if (action.type === 'grab' && player.role === 'swinger') {
    const physics = new CraneClashPhysics(w);
    const grabbedId = physics.grabCrate(player);
    if (grabbedId) {
      const crate = w.crates.find((c) => c.id === grabbedId);
      emitEvent(
        w,
        'grab',
        `${player.name} hat eine ${crate?.kind || 'Kiste'} gepackt!`,
        player.team,
      );
    }
    return;
  }

  if (action.type === 'release' && player.role === 'swinger') {
    const physics = new CraneClashPhysics(w);
    const releasedId = physics.releaseCrate(player);
    if (releasedId) {
      emitEvent(
        w,
        'place',
        `${player.name} hat die Kiste abgeworfen!`,
        player.team,
      );
    }
    return;
  }
}

export function craneClashSnapshot(
  w: CraneClashWorld,
  code: string,
  host: string,
  id = '',
  version = 0,
): CraneClashSnapshot {
  return {
    code,
    host,
    world: w,
    version,
  };
}
