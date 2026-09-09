import { JOBS } from './model';
import {
  DISASTER_RULES,
  beginChallengeRun,
  checkChallengeCrew,
  finishChallengeRun,
  type ChallengeBenchmark,
  type ChallengeRun,
} from './disaster-challenge';
import { dailyJob, setDaily, type DailyJob } from './daily';
import {
  startSwap,
  tickSwap,
  swapPartyAction,
  swapPuzzle,
  activeSwapTeam,
  type SwapRound,
} from './swap';
import type { Action, Player, Vec, World } from './model';
import { horizontalSolids } from './colliders';
import { mapBounds, validMap } from './maps';
import {
  configureInspection,
  inspectRound,
  inspectionAction,
  checkComments,
  markMoment,
  type Inspection,
  type RoundFormat,
} from './inspection';

export type CrewJob = 'sofa' | 'glass' | 'crane' | 'ladder' | 'barrow';
export type Phase =
  | 'lobby'
  | 'building'
  | 'lastCall'
  | 'rescue'
  | 'inspection'
  | 'results';
export type Mission = {
  id: number;
  title: string;
  text: string;
  owner: string;
  objectId: string;
  target: Vec;
  progress: number;
  done: boolean;
  paused: boolean;
  touched?: boolean;
  firstActor?: string;
  replaced?: boolean;
};
export type CrewTask = {
  kind: CrewJob;
  pieceId: string;
  x: number;
  z: number;
  y: number;
  angle: number;
  origin: Vec;
  target: Vec;
  roles: string[];
  inputs: Record<string, { x: number; z: number; turn: number; at: number }>;
  phase: 'waiting' | 'working' | 'spilled' | 'done';
  damage: number;
  progress: number;
  solo: boolean;
  lastTick: number;
  missingSince?: number;
  tilt: number;
  dropVotes: string[];
  deliveries: number;
  cargo: Vec[];
};
export type InspectionResult = {
  passed: boolean;
  title: string;
  comments: string[];
  stations?: Vec[];
  awards: { title: string; text: string }[];
  cards: { name: string; text: string; done: boolean; paused: boolean }[];
  at: number;
};
export type Party = {
  challenge?: ChallengeBenchmark & { buildId: string };
  run?: ChallengeRun;
  format?: RoundFormat;
  daily?: DailyJob;
  crewName?: string;
  swap?: SwapRound;
  inspection?: Inspection;
  version: 1;
  roomId: string;
  roundId: string;
  seed: number;
  phase: Phase;
  phaseAt: number;
  deadline: number;
  ready: string[];
  voiceMode: 'global' | 'proximity';
  audioConsent: string[];
  recording: string[];
  radio: Record<string, number>;
  job: CrewJob;
  task: CrewTask;
  stats: { spills: number; rescues: number; turns: number; helpers: string[] };
  result?: InspectionResult;
};
export type PartyPrivate = {
  runCrew?: string[];
  missions: Record<string, Mission>;
  receipts: Record<string, { seq: number; id: string }>;
  names: Record<string, string>;
};
export type PartyAction = {
  type: 'party';
  op:
    | 'ready'
    | 'start'
    | 'configure'
    | 'role'
    | 'release'
    | 'drive'
    | 'work'
    | 'place'
    | 'recover'
    | 'collect'
    | 'skip'
    | 'consent'
    | 'recording'
    | 'radio'
    | 'repair'
    | 'steady'
    | 'inspect'
    | 'swap-reseat';
  format?: RoundFormat;
  daily?: string;
  crewName?: string;
  enabled?: boolean;
  job?: CrewJob;
  voiceMode?: 'global' | 'proximity';
  role?: number;
  x?: number;
  z?: number;
  turn?: number;
};
export const CREW_JOBS: { id: CrewJob; name: string; brief: string }[] = [
  {
    id: 'sofa',
    name: 'Sofa shuffle',
    brief:
      'Take one handle each. Carry the sofa into the striped delivery bay.',
  },
  {
    id: 'glass',
    name: 'Handle with panic',
    brief:
      'Carry the glass together. Tight turns and hard knocks leave cracks.',
  },
  {
    id: 'crane',
    name: 'Your other left',
    brief:
      'The operator moves the load. The spotter guides it into the marked bay.',
  },
  {
    id: 'ladder',
    name: 'Hold it steady',
    brief:
      'One builder steadies the ladder. The other climbs and fits the sign.',
  },
  {
    id: 'barrow',
    name: 'Express cement',
    brief: 'Push and steady the loaded wheelbarrow. Take the ramp slowly.',
  },
];
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
function sound(
  world: World,
  cue: string,
  now: number,
  pos: Vec = world.party!.task,
) {
  world.events.push({
    id: crypto.randomUUID(),
    type: 'build',
    text: '',
    at: now,
    x: pos.x,
    z: pos.z,
    audioCue: cue,
  });
  world.events = world.events.slice(-12);
}
export function makeTask(kind: CrewJob, now: number): CrewTask {
  const origin = { x: 3.1, z: 7.15 },
    target = { x: -2.8, z: 7.15 };
  return {
    kind,
    pieceId: 'crew-delivery',
    ...origin,
    y: 0.43,
    angle: 0,
    origin,
    target,
    roles: ['', ''],
    inputs: {},
    phase: 'waiting',
    damage: 0,
    progress: 0,
    solo: false,
    lastTick: now,
    tilt: 0,
    dropVotes: [],
    deliveries: 0,
    cargo: [],
  };
}
export function enableParty(
  world: World,
  now: number,
  seed = crypto.getRandomValues(new Uint32Array(1))[0],
  kind: CrewJob = 'sofa',
  roomId = crypto.randomUUID(),
): World {
  world.party = {
    version: 1,
    roomId,
    roundId: crypto.randomUUID(),
    seed,
    phase: world.mode === 'job' ? 'lobby' : 'building',
    phaseAt: now,
    deadline: 0,
    ready: [],
    voiceMode: 'global',
    audioConsent: [],
    recording: [],
    radio: {},
    job: kind,
    task: makeTask(kind, now),
    stats: { spills: 0, rescues: 0, turns: 0, helpers: [] },
  };
  world.partyPrivate = { missions: {}, receipts: {}, names: {} };
  world.started = now;
  return world;
}
export function publicWorld(world: World): World {
  // Explicit public contract: never serialize the stored world wholesale.
  return {
    sharedFrom: world.sharedFrom,
    map: world.map,
    cranePark: world.cranePark,
    crane: world.crane,
    roofSupplyVersion: world.roofSupplyVersion,
    pieces: world.pieces,
    events: world.events,
    started: world.started,
    mode: world.mode,
    throws: world.throws,
    bonks: world.bonks,
    builds: world.builds,
    round: world.round,
    wind: world.wind,
    physicsAt: world.physicsAt,
    physicalVersion: world.physicalVersion,
    actors: world.actors,
    sayings: world.sayings,
    party: world.party,
  };
}
export function privateCard(world: World, id?: string): Mission | undefined {
  return id ? world.partyPrivate?.missions[id] : undefined;
}
export function missionCard(
  owner: string,
  index: number,
  world: World,
): Mission {
  const requested = index % 8,
    type =
      world.party?.job === 'ladder' && requested >= 4 && requested < 6
        ? requested - 4
        : requested,
    objectId = type % 2 ? 'starter-plant' : 'starter-sofa';
  const object = objectId === 'starter-plant' ? 'plant' : 'sofa';
  const target = { x: type % 2 ? 2 : -2, z: 2 };
  const titles = [
    'A change of scenery',
    'Indoor jungle',
    'Return to sender',
    'Borrowed greenery',
    'Full turnaround',
    'The other way round',
    'Close neighbours',
    'Bathroom garden',
  ];
  const text =
    type < 2
      ? `Persuade another builder to put the original ${object} inside the pink circle.`
      : type < 4
        ? `Pick up the original ${object}, put it down, then get someone else to bring it into the pink circle.`
        : type < 6
          ? `With a partner, turn the delivery half a rotation ${type === 4 ? 'clockwise' : 'counterclockwise'} before delivering it.`
          : `Have another builder put the original ${object} beside the toilet (within 2 metres).`;
  return {
    id: type,
    title: titles[type],
    text,
    owner,
    objectId,
    target,
    progress: 0,
    done: false,
    paused: false,
  };
}
function allocate(world: World, players: Player[]) {
  const p = world.party!,
    state = world.partyPrivate!;
  state.names = Object.fromEntries(players.map((v) => [v.id, v.name]));
  state.missions =
    players.length > 1
      ? Object.fromEntries(
          players.map((v, index) => [
            v.id,
            missionCard(
              v.id,
              p.challenge
                ? (world.challengeSetup?.startRules?.missions[index] ?? 0)
                : crypto.getRandomValues(new Uint32Array(1))[0] % 8,
              world,
            ),
          ]),
        )
      : {};
  p.task.solo = players.length === 1;
}
export function missionAction(
  world: World,
  action: Action,
  player: Player,
  affectedObject?: string,
) {
  if (
    !world.partyPrivate ||
    !world.party ||
    !['building', 'lastCall', 'rescue'].includes(world.party.phase)
  )
    return;
  for (const m of Object.values(world.partyPrivate.missions)) {
    if (m.done || m.paused) continue;
    const piece = world.pieces.find((v) => v.id === m.objectId);
    if (
      action.type === 'grab' &&
      action.id === m.objectId &&
      player.id === m.owner
    )
      m.touched = true;
    if (
      action.type === 'drop' &&
      affectedObject === m.objectId &&
      piece &&
      !piece.heldBy &&
      piece.placed &&
      player.id !== m.owner
    ) {
      if (
        m.id < 4 &&
        (m.id < 2 || m.touched) &&
        distance(piece, m.target) < 1.5
      )
        m.done = true;
      if (m.id >= 6) {
        const toilet = world.pieces.find(
          (v) => v.kind === 'toilet' && v.placed,
        );
        if (toilet && distance(piece, toilet) < 2) m.done = true;
      }
    }
    if (
      m.id >= 4 &&
      m.id < 6 &&
      world.party.task.phase === 'done' &&
      (m.id === 4
        ? world.party.task.angle >= Math.PI
        : world.party.task.angle <= -Math.PI) &&
      world.party.stats.helpers.includes(m.owner) &&
      world.party.stats.helpers.length > 1
    )
      m.done = true;
    if (m.done) m.progress = 1;
  }
}
export function roleAnchor(t: CrewTask, role: number): Vec {
  if (t.kind === 'crane') return role === 0 ? { x: 5, z: 7 } : { x: -4, z: 7 };
  if (t.kind === 'ladder') return { x: t.x + (role ? -0.9 : 0.9), z: t.z };
  const offset = t.kind === 'barrow' ? 0.95 : 1.5;
  return {
    x: t.x + Math.cos(t.angle) * offset * (role ? -1 : 1),
    z: t.z - Math.sin(t.angle) * offset * (role ? -1 : 1),
  };
}
export function partyAction(
  world: World,
  action: PartyAction,
  player: Player,
  players: Player[],
  host: string,
  now: number,
) {
  if (action.enabled !== undefined && typeof action.enabled !== 'boolean')
    throw new Error('Invalid toggle value.');
  const p = world.party;
  if (!p) throw new Error('Start a new site to use crew jobs.');
  const t = p.task;
  const toggle = (values: string[]) =>
    action.enabled
      ? [...new Set([...values, player.id])]
      : values.filter((v) => v !== player.id);
  if (action.op === 'consent') {
    p.audioConsent = toggle(p.audioConsent);
    return;
  }
  if (action.op === 'recording') {
    p.recording = toggle(p.recording);
    return;
  }
  if (action.op === 'radio') {
    if (action.enabled) p.radio[player.id] = now + 1500;
    else delete p.radio[player.id];
    return;
  }
  swapPartyAction(world, action, player, players, host, now);
  if (action.op === 'swap-reseat') return;
  if (action.op === 'ready' && p.phase === 'lobby') {
    if (action.enabled && !p.ready.includes(player.id))
      sound(world, 'party.ready', now, player);
    p.ready = toggle(p.ready);
    return;
  }
  if (action.op === 'configure') {
    if (host !== player.id || p.phase !== 'lobby')
      throw new Error('The site manager chooses the job in the lobby.');
    if (
      p.challenge &&
      (action.job !== undefined ||
        action.format !== undefined ||
        action.daily !== undefined)
    )
      throw new Error(
        'This challenge keeps its original job and rules. Start a new job to change them.',
      );
    if (action.job && !CREW_JOBS.some((v) => v.id === action.job))
      throw new Error('Unknown crew job.');
    if (action.voiceMode && !['global', 'proximity'].includes(action.voiceMode))
      throw new Error('Unknown voice mode.');
    if (
      action.format &&
      !['classic', 'inspection', 'swap'].includes(action.format)
    )
      throw new Error('Unknown round format.');
    if (action.format) {
      p.format = action.format;
      delete p.daily;
      delete p.swap;
    }
    if (action.crewName !== undefined) {
      if (typeof action.crewName !== 'string')
        throw new Error('Invalid crew name.');
      p.crewName = action.crewName
        .replace(/[<>\p{C}]/gu, '')
        .trim()
        .slice(0, 32);
    }
    if (action.daily !== undefined) setDaily(world, action.daily, now);
    if (action.job) {
      p.job = action.job;
      p.task = makeTask(action.job, now);
    }
    if (action.voiceMode) p.voiceMode = action.voiceMode;
    if (!p.challenge) {
      configureInspection(world);
      if (p.daily) setDaily(world, p.daily.date, now);
    }
    return;
  }
  if (action.op === 'start') {
    if (host !== player.id || p.phase !== 'lobby')
      throw new Error('Only the site manager can start the waiting crew.');
    if (
      p.challenge &&
      (p.challenge.rulesVersion !== DISASTER_RULES ||
        players.length !== p.challenge.crewSize)
    )
      throw new Error(
        `This challenge needs ${p.challenge.crewSize} builders and matching game rules.`,
      );
    if (p.format === 'swap' && players.length !== 4)
      throw new Error('Build & Swap needs four builders.');
    p.phase = 'building';
    p.phaseAt = now;
    p.deadline = now + 240000;
    world.started = now;
    configureInspection(world);
    if (p.inspection) {
      p.inspection.rainAt = now + 60000;
      p.inspection.rainUntil = now + 150000;
    }
    if (p.daily) setDaily(world, p.daily.date, now);
    if (p.challenge && world.challengeSetup?.startRules) {
      const rules = world.challengeSetup.startRules;
      Object.assign(p.task, {
        ...rules.origin,
        origin: { ...rules.origin },
        target: { ...rules.target },
        angle: rules.angle,
      });
      if (p.inspection && rules.rainAfter !== undefined) {
        p.inspection.rainAt = now + rules.rainAfter;
        p.inspection.rainUntil =
          p.inspection.rainAt + (rules.rainDuration ?? 90000);
      }
    }
    allocate(world, players);
    beginChallengeRun(world, players);
    if (p.format === 'swap') startSwap(world, players, now);
    world.roundStart = structuredClone(world.pieces);
    sound(world, 'party.start', now, player);
    return;
  }
  if (action.op === 'skip') {
    if (host !== player.id || p.phase !== 'inspection')
      throw new Error('Only the site manager can skip the inspection.');
    p.phase = 'results';
    p.phaseAt = now;
    return;
  }
  if (!['building', 'lastCall', 'rescue'].includes(p.phase))
    throw new Error('The crew job is not running.');
  if (action.op === 'repair' || action.op === 'steady') {
    inspectionAction(world, action.op, player, now);
    return;
  }
  if (action.op === 'inspect') {
    if (host !== player.id || !p.inspection || p.phase === 'rescue')
      throw new Error('Only the site manager can call the first inspection.');
    p.phase = 'lastCall';
    p.phaseAt = now;
    p.deadline = now;
    return;
  }
  const role = t.roles.indexOf(player.id);
  if (action.op === 'release') {
    if (role >= 0) {
      if (t.kind === 'ladder' && t.progress > 0 && t.phase !== 'done') {
        const climber = t.roles[1] || t.roles[0];
        world.events.push({
          id: crypto.randomUUID(),
          at: now,
          type: 'bonk',
          x: t.x,
          z: t.z,
          target: climber,
          text: 'The ladder had other plans.',
          audioCue: 'party.ladder.fall',
        });
        world.events = world.events.slice(-12);
        world.bonks++;
        p.stats.spills++;
        t.roles = ['', ''];
        t.inputs = {};
        t.progress = Math.max(0, t.progress - 0.25);
        t.y = 0.43;
      } else {
        t.roles[role] = '';
        delete t.inputs[player.id];
      }
      t.phase = 'waiting';
      t.dropVotes = [];
      sound(world, 'party.release', now);
    }
    return;
  }
  if (action.op === 'collect') {
    const index = (t.cargo || []).findIndex(
      (bag) => distance(player, bag) < 2.8,
    );
    if (index < 0) throw new Error('Walk to a spilled bag first.');
    t.cargo.splice(index, 1);
    sound(world, 'party.collect', now, player);
    return;
  }
  if (action.op === 'recover') {
    if (distance(player, t) > 3.8 && distance(player, t.origin) > 3.8)
      throw new Error('Walk to the delivery or its collection bay.');
    if (t.roles.some(Boolean))
      throw new Error('Everyone must release the load first.');
    p.task = {
      ...makeTask(t.kind, now),
      target: { ...t.target },
      origin: { ...t.origin },
      ...t.origin,
      angle: p.swap ? Math.PI / 2 : 0,
      solo: !p.swap && players.filter((v) => now - v.seen < 3000).length < 2,
    };
    p.stats.rescues++;
    sound(world, 'party.recover', now, player);
    return;
  }
  if (action.op === 'role') {
    const slot = action.role;
    if (slot !== 0 && slot !== 1) throw new Error('Choose a free role.');
    if (t.cargo?.length)
      throw new Error(
        'Collect the spilled bags before taking the wheelbarrow.',
      );
    if (t.phase === 'done' || t.phase === 'spilled')
      throw new Error('Recover the delivery before taking a handle.');
    if (
      t.roles[slot] ||
      role >= 0 ||
      world.pieces.some((v) => v.heldBy === player.id) ||
      world.crane?.operatorId === player.id
    )
      throw new Error('Put down your tools or choose a free handle.');
    if (distance(player, roleAnchor(t, slot)) > 2.8)
      throw new Error('Walk to the marked handle first.');
    t.roles[slot] = player.id;
    t.solo = !p.swap && players.filter((v) => now - v.seen < 3000).length < 2;
    p.stats.helpers = [...new Set([...p.stats.helpers, player.id])];
    t.phase = t.solo || t.roles.every(Boolean) ? 'working' : 'waiting';
    t.lastTick = now;
    sound(world, 'party.handle', now, player);
    if (t.phase === 'working') sound(world, 'party.lift', now);
    return;
  }
  if (role < 0) throw new Error('Take a handle or a role first.');
  if (action.op === 'drive') {
    if (
      ![action.x, action.z, action.turn].every(
        (v) => typeof v === 'number' && Number.isFinite(v),
      )
    )
      throw new Error('Invalid movement.');
    if (action.x || action.z || action.turn) t.dropVotes = [];
    t.inputs[player.id] = {
      x: clamp(action.x!, -1, 1),
      z: clamp(action.z!, -1, 1),
      turn: clamp(action.turn!, -1, 1),
      at: now,
    };
    return;
  }
  if (action.op === 'work') {
    if (t.kind !== 'ladder' || (role !== 1 && !t.solo) || t.phase !== 'working')
      throw new Error(
        'Take the climbing role while a partner steadies the ladder.',
      );
    t.inputs[player.id] = { x: 0, z: 1, turn: 0, at: now };
    return;
  }
  if (action.op === 'place') {
    if (t.phase !== 'working')
      throw new Error('Your partner needs to take a handle.');
    if (t.kind === 'ladder') throw new Error('Hold Work to finish the sign.');
    if (distance(t, t.target) > 1.25)
      throw new Error('Move the load into the striped delivery bay.');
    if (
      collision(world, t, t.angle, t) ||
      players.some(
        (v) =>
          !t.roles.includes(v.id) &&
          (!p.swap || p.swap.teams[activeSwapTeam(p.swap)].includes(v.id)) &&
          distance(v, t) < 1.4,
      )
    )
      throw new Error('Clear the delivery bay before putting the load down.');
    if (t.kind === 'crane' && role !== 1 && !t.solo)
      throw new Error('The spotter confirms the landing.');
    t.dropVotes = [...new Set([...t.dropVotes, player.id])];
    if (t.solo || t.kind === 'crane' || t.dropVotes.length === 2)
      completeTask(world, now);
    return;
  }
  throw new Error('Unknown crew action.');
}
function completeTask(world: World, now: number) {
  const t = world.party!.task;
  t.phase = 'done';
  t.roles = ['', ''];
  t.inputs = {};
  t.progress = 1;
  t.y = 0.43;
  t.deliveries++;
  t.tilt = 0;
  sound(world, 'party.delivered', now);
}
function collision(world: World, pos: Vec, angle: number, task: CrewTask) {
  const bounds = mapBounds(world.map);
  const halfWidth =
    task.kind === 'barrow' ? 0.6 : task.kind === 'glass' ? 1.35 : 1.15;
  const halfDepth =
    task.kind === 'barrow' ? 1.2 : task.kind === 'glass' ? 0.16 : 0.65;
  const axes = [
    { x: Math.cos(angle), z: -Math.sin(angle) },
    { x: Math.sin(angle), z: Math.cos(angle) },
  ];
  const extentX =
      halfWidth * Math.abs(axes[0].x) + halfDepth * Math.abs(axes[1].x),
    extentZ = halfWidth * Math.abs(axes[0].z) + halfDepth * Math.abs(axes[1].z);
  if (
    Math.abs(pos.x) > bounds.x - extentX ||
    pos.z < bounds.back + extentZ ||
    pos.z > bounds.front - extentZ
  )
    return true;
  if (world.party?.swap) {
    const center = swapPuzzle(world.party.swap) ? 3 : -3;
    if (
      pos.x - extentX < center - 3 ||
      pos.x + extentX > center + 3 ||
      pos.z - extentZ < -4.8 ||
      pos.z + extentZ > 7.5
    )
      return true;
  }
  return horizontalSolids(world).some((s) => {
    const a = ('angle' in s ? Number(s.angle) : 0) || 0,
      other = [
        { x: Math.cos(a), z: -Math.sin(a) },
        { x: Math.sin(a), z: Math.cos(a) },
      ];
    const dot = (a: Vec, b: Vec) => a.x * b.x + a.z * b.z;
    // Separating axes cover the complete rotated load, including its corners.
    return [...axes, ...other].every(
      (axis) =>
        Math.abs(dot({ x: pos.x - s.x, z: pos.z - s.z }, axis)) <
        halfWidth * Math.abs(dot(axes[0], axis)) +
          halfDepth * Math.abs(dot(axes[1], axis)) +
          (s.w / 2) * Math.abs(dot(other[0], axis)) +
          (s.d / 2) * Math.abs(dot(other[1], axis)) +
          0.025,
    );
  });
}
export function tickTask(world: World, players: Player[], now: number) {
  const p = world.party!,
    t = p.task,
    dt = Math.min(0.15, Math.max(0, (now - t.lastTick) / 1000));
  t.lastTick = now;
  const stale = t.roles.some(
    (id) => id && !players.some((v) => v.id === id && now - v.seen < 3000),
  );
  if (stale) {
    t.roles = ['', ''];
    t.inputs = {};
    t.phase = 'waiting';
    t.dropVotes = [];
    t.solo = !p.swap && players.filter((v) => now - v.seen < 3000).length < 2;
    return;
  }
  delete t.missingSince;
  if (t.phase !== 'working') return;
  const active = t.roles.map((id) =>
    t.inputs[id]?.at > now - 500 ? t.inputs[id] : { x: 0, z: 0, turn: 0 },
  );
  if (t.kind === 'ladder') {
    const working = t.solo ? active.find((v) => v.z > 0) : active[1].z > 0;
    if (working) t.progress = Math.min(1, t.progress + dt / 8);
    t.y = 0.43 + t.progress * 2.3;
    if (t.progress >= 1) completeTask(world, now);
    return;
  }
  const values = t.solo ? active.filter((_, i) => !!t.roles[i]) : active;
  const x = values.reduce((s, v) => s + v.x, 0) / values.length,
    z = values.reduce((s, v) => s + v.z, 0) / values.length;
  const turn = values.reduce((s, v) => s + v.turn, 0) / values.length;
  const inspection = p.inspection;
  const wet =
    !!inspection &&
    !inspection.leakFixed &&
    now >= inspection.rainAt &&
    now <= inspection.rainUntil &&
    Math.hypot(t.x - inspection.target.x, t.z - inspection.target.z - 2) < 2;
  const protectedLoad = !!inspection && now < inspection.steadyUntil;
  const mismatch = t.solo
    ? 0
    : Math.hypot(active[0].x - active[1].x, active[0].z - active[1].z);
  const speed = t.kind === 'crane' ? 1.8 : t.kind === 'barrow' ? 2.3 : 1.65;
  const dir = t.kind === 'crane' && !t.solo ? active[0] : { x, z, turn };
  const norm = Math.max(1, Math.hypot(dir.x, dir.z));
  const candidate = {
    x:
      t.x +
      (dir.x / norm) * speed * dt +
      (wet && !protectedLoad ? 0.4 * dt : 0),
    z: t.z + (dir.z / norm) * speed * dt,
  };
  const angle = t.angle + dir.turn * dt;
  const blocked = t.kind !== 'crane' && collision(world, candidate, angle, t);
  if (!blocked) {
    t.x = clamp(candidate.x, -8.5, 8.5);
    t.z = clamp(candidate.z, -7, 8);
    t.angle = angle;
    p.stats.turns += Math.abs(dir.turn * dt);
  }
  t.tilt = clamp(
    t.tilt +
      ((blocked ? 1.8 : mismatch > 1.5 ? 1.1 : -0.9) +
        (t.kind === 'barrow' ? Math.abs(turn) * 0.4 : 0) +
        (wet && !protectedLoad ? 1.2 : 0)) *
        dt,
    0,
    1,
  );
  t.y =
    t.kind === 'crane'
      ? 2.5 + Math.sin(now / 250) * t.tilt * 0.2
      : t.kind === 'barrow'
        ? 0.43 + Math.max(0, 1 - Math.abs(t.x) / 1.5) * 0.7
        : 0.75;
  if (t.tilt >= 1 && t.kind !== 'crane') {
    p.stats.spills++;
    markMoment(
      world,
      wet
        ? 'The leaking pipe sent the sofa sliding.'
        : 'The delivery team disagreed with gravity.',
      now,
      t,
    );
    t.damage++;
    sound(
      world,
      t.kind === 'glass'
        ? t.damage >= 2
          ? 'party.glass.break'
          : 'party.glass.crack'
        : `party.${t.kind}.spill`,
      now,
    );
    if (t.kind === 'barrow')
      t.cargo = [-1, 1].flatMap((x) =>
        [-1, 1].map((z) => ({
          x: t.x + x * 0.8,
          z: clamp(t.z + z * 0.6, -7.5, 8.2),
        })),
      );
    t.phase = t.kind === 'glass' && t.damage >= 2 ? 'spilled' : 'waiting';
    t.roles = ['', ''];
    t.inputs = {};
    t.dropVotes = [];
    t.tilt = 0.2;
    t.y = 0.43;
  }
}
function result(world: World, ratio: number, now: number): InspectionResult {
  const p = world.party!,
    done = p.task.phase === 'done',
    passed = p.inspection
      ? !!p.inspection.check?.passed && ratio >= 1
      : ratio >= 1 && done;
  const comments = [
    ratio >= 1
      ? 'All the building parts are here. An encouraging start.'
      : 'A few building parts appear to be on an extended lunch break.',
    done
      ? 'The special delivery arrived. Against several predictions.'
      : 'Your special delivery has not reached its final destination.',
    p.stats.spills
      ? `${p.stats.spills} spill${p.stats.spills === 1 ? '' : 's'}. The ground has been thoroughly tested.`
      : 'No spilled deliveries. Suspiciously professional.',
  ];
  if (p.inspection?.check)
    comments.splice(0, 3, ...checkComments(p.inspection.check));
  if (p.inspection && ratio < 1)
    comments[2] += ' Finish the building checklist too.';
  const awards: InspectionResult['awards'] = [];
  if (p.inspection?.firstCheck && passed)
    awards.push({
      title: 'Last-second legends',
      text: 'Saved the customer inspection during overtime.',
    });
  if (p.inspection?.repairers.length)
    awards.push({
      title: 'Disaster response',
      text: p.inspection.repairers
        .map((id) => world.partyPrivate?.names[id] || 'Builder')
        .join(' & '),
    });
  if (done && p.stats.helpers.length > 1)
    awards.push({
      title: 'Most helpful pair',
      text: p.stats.helpers
        .map((id) => world.partyPrivate?.names[id] || 'Builder')
        .join(' & '),
    });
  if (p.stats.spills)
    awards.push({
      title: 'Biggest spill',
      text: `${p.stats.spills} gravity demonstrations`,
    });
  if (p.stats.rescues)
    awards.push({
      title: 'Rescue crew',
      text: `${p.stats.rescues} delivery recoveries`,
    });
  if (world.throws)
    awards.push({
      title: 'Air freight department',
      text: `${world.throws} express throws`,
    });
  return {
    passed,
    title: passed
      ? 'Approved. With a raised eyebrow.'
      : 'Built with excellent intentions.',
    comments,
    stations: [
      { x: 0, z: 3 },
      { x: p.task.x, z: p.task.z },
      { x: 3, z: 5 },
    ],
    awards: awards.slice(0, 3),
    at: now,
    cards: Object.values(world.partyPrivate?.missions || {}).map((m) => ({
      name: world.partyPrivate?.names[m.owner] || 'Builder',
      text: m.text,
      done: m.done,
      paused: m.paused,
    })),
  };
}
export function tickParty(
  world: World,
  players: Player[],
  now: number,
  ratio: number,
) {
  const p = world.party;
  if (!p) return;
  const ids = new Set(
    players.filter((v) => now - v.seen < 60000).map((v) => v.id),
  );
  p.ready = p.ready.filter((id) => ids.has(id));
  p.audioConsent = p.audioConsent.filter((id) => ids.has(id));
  p.recording = p.recording.filter((id) => ids.has(id));
  for (const id of Object.keys(p.radio))
    if (!ids.has(id) || p.radio[id] < now) delete p.radio[id];
  for (const m of Object.values(world.partyPrivate?.missions || {})) {
    const missing =
      (m.id < 4 || m.id >= 6) && !world.pieces.some((v) => v.id === m.objectId);
    if (!m.done && missing && !m.replaced) {
      const fallback = world.pieces.some((v) => v.id === 'starter-plant')
        ? 1
        : world.pieces.some((v) => v.id === 'starter-sofa')
          ? 0
          : p.job !== 'ladder'
            ? 4
            : -1;
      if (fallback >= 0)
        Object.assign(m, missionCard(m.owner, fallback, world), {
          replaced: true,
        });
    }
    m.paused =
      !m.done &&
      (players.length < 2 ||
        !ids.has(m.owner) ||
        ((m.id < 4 || m.id >= 6) &&
          !world.pieces.some((v) => v.id === m.objectId)));
  }
  checkChallengeCrew(world, players, now);
  if (p.phase === 'lobby' || p.phase === 'results') return;
  if (p.phase === 'inspection') {
    if (now - p.phaseAt >= 30000) {
      p.phase = 'results';
      p.phaseAt = now;
    }
    return;
  }
  if (p.swap) {
    tickSwap(world, players, now);
    if (!p.swap.pausedAt && p.phase === 'building' && p.swap.stage !== 'design')
      tickTask(world, players, now);
    return;
  }
  tickTask(world, players, now);
  if (world.mode === 'sandbox') return;
  if (
    p.phase === 'building' &&
    (now >= world.started + 210000 ||
      (!p.inspection && ratio >= 1 && p.task.phase === 'done'))
  ) {
    p.phase = 'lastCall';
    p.phaseAt = now;
    p.deadline = Math.min(world.started + 240000, now + 30000);
  }
  if (now >= p.deadline) {
    if (p.inspection && !inspectRound(world, now, ratio >= 1)) return;
    p.result = result(world, ratio, now);
    finishChallengeRun(world, now);
    p.task.roles = ['', ''];
    p.task.inputs = {};
    p.phase = 'inspection';
    p.phaseAt = now;
  }
}
export function partyLocked(world: World) {
  return (
    !!world.party &&
    ['lobby', 'inspection', 'results'].includes(world.party.phase)
  );
}
export function challengeLink(origin: string, world: World) {
  const p = world.party!;
  return `${origin}/chaos?challenge=1&seed=${p.seed}&job=${p.job}&map=${world.map || 'small'}&brief=${world.round % JOBS.length}${p.format && p.format !== 'classic' ? `&format=${p.format}` : ''}${p.daily ? `&daily=${p.daily.date}` : ''}`;
}
export function parseChallenge(params: URLSearchParams) {
  if (!params.has('challenge')) return null;
  const seed = Number(params.get('seed')),
    job = params.get('job'),
    map = params.get('map'),
    brief = Number(params.get('brief') || 0);
  if (
    params.get('challenge') !== '1' ||
    !/^\d+$/.test(params.get('seed') || '') ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !CREW_JOBS.some((v) => v.id === job) ||
    !validMap(map)
  )
    throw new Error(
      'This challenge link is invalid or uses an unsupported version.',
    );
  if (!Number.isInteger(brief) || brief < 0 || brief >= JOBS.length)
    throw new Error('This challenge has an invalid customer brief.');
  const format = params.get('format'),
    daily = params.get('daily');
  if (format && !['classic', 'inspection', 'swap'].includes(format))
    throw new Error('Unknown challenge format.');
  if (daily) dailyJob(daily);
  return {
    seed,
    job: job as CrewJob,
    map,
    brief,
    ...(format ? { format: format as RoundFormat } : {}),
    ...(daily ? { daily } : {}),
  };
}
