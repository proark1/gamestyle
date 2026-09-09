import type { Action, Piece, Player, Vec, World } from './model';
import { footprint } from './placement';
import type { CrewTask, PartyAction } from './party';
export type SwapStage =
  | 'design'
  | 'prove-a'
  | 'prove-b'
  | 'run-a'
  | 'run-b'
  | 'finished';
export type SwapRound = {
  version: 1;
  retry?: boolean;
  stage: SwapStage;
  teams: string[][];
  owners: Record<string, number>;
  puzzle: Piece[];
  times: (number | null)[];
  stageAt: number;
  pausedAt?: number;
  verified: boolean[];
};
export const teamCenter = (team: number): Vec => ({ x: team ? 3 : -3, z: -1 });
export function activeSwapTeam(s: SwapRound) {
  return s.stage === 'prove-a' || s.stage === 'run-a' ? 0 : 1;
}
export function swapPuzzle(s: SwapRound) {
  const team = activeSwapTeam(s);
  return s.stage.startsWith('run') ? 1 - team : team;
}
function taskFor(t: CrewTask, site: number, now: number): CrewTask {
  const target = teamCenter(site),
    origin = { x: target.x, z: 6 };
  return {
    ...t,
    kind: 'sofa',
    ...origin,
    y: 0.43,
    angle: Math.PI / 2,
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
export function startSwap(world: World, players: Player[], now: number) {
  if (players.length !== 4)
    throw new Error('Build & Swap needs four builders: two pairs.');
  const p = world.party!;
  const replay = p.swap?.retry ? structuredClone(p.swap) : undefined;
  delete p.inspection;
  delete p.daily;
  p.job = 'sofa';
  world.pieces = world.pieces.filter((v) => v.supply);
  p.swap = {
    version: 1,
    stage: 'design',
    teams: [
      [players[0].id, players[1].id],
      [players[2].id, players[3].id],
    ],
    owners: {},
    puzzle: [],
    times: [null, null],
    stageAt: now,
    verified: [false, false],
  };
  p.deadline = now + 90000;
  p.task = taskFor(p.task, 0, now);
  if (replay) {
    p.swap.puzzle = replay.puzzle;
    p.swap.owners = replay.owners;
    nextStage(world, 'prove-a', now);
  }
  if (world.partyPrivate) world.partyPrivate.missions = {};
}
function nextStage(world: World, stage: SwapStage, now: number) {
  const p = world.party!,
    s = p.swap!;
  s.stage = stage;
  s.stageAt = now;
  p.phaseAt = now;
  p.deadline = now + 60000;
  world.pieces = structuredClone(s.puzzle);
  p.task = taskFor(p.task, swapPuzzle(s), now);
}
function finish(world: World, now: number, unproven = false) {
  const p = world.party!,
    s = p.swap!;
  s.stage = 'finished';
  p.phase = 'inspection';
  p.phaseAt = now;
  p.task.roles = ['', ''];
  p.task.inputs = {};
  const [a, b] = s.times,
    winner = a === b ? -1 : a === null ? 1 : b === null ? 0 : a < b ? 0 : 1;
  p.result = {
    passed: !unproven && s.times.some((v) => v !== null),
    title: unproven
      ? 'Prove your puzzle before challenging your friends.'
      : winner < 0
        ? 'A perfectly questionable tie.'
        : `${winner ? 'Turquoise' : 'Yellow'} crew wins!`,
    comments: unproven
      ? [
          'Each pair must complete its own delivery first.',
          'Leave enough space to turn the sofa.',
          'Start a new shift to build another puzzle.',
        ]
      : [
          'Both puzzles were proven by their builders.',
          `Yellow crew: ${a === null ? 'delivery unfinished' : (a / 1000).toFixed(1) + ' seconds'}.`,
          `Turquoise crew: ${b === null ? 'delivery unfinished' : (b / 1000).toFixed(1) + ' seconds'}.`,
        ],
    awards: unproven
      ? []
      : [
          {
            title: winner < 0 ? 'Shared bragging rights' : 'Delivery champions',
            text:
              winner < 0
                ? 'Rematch?'
                : s.teams[winner]
                    .map((id) => world.partyPrivate?.names[id] || 'Builder')
                    .join(' & '),
          },
        ],
    stations: [teamCenter(0), teamCenter(1), { x: 0, z: 5 }],
    cards: [],
    at: now,
  };
}
export function tickSwap(world: World, players: Player[], now: number) {
  const p = world.party!,
    s = p.swap!;
  if (s.stage === 'finished') return;
  const active = new Set(
    players.filter((v) => now - v.seen < 10000).map((v) => v.id),
  );
  if (s.teams.flat().some((id) => !active.has(id))) {
    s.pausedAt ??= now;
    p.task.inputs = {};
    p.task.roles = ['', ''];
    if (p.task.phase === 'working') p.task.phase = 'waiting';
    return;
  }
  if (s.pausedAt !== undefined) {
    const delay = now - s.pausedAt;
    p.deadline += delay;
    s.stageAt += delay;
    delete s.pausedAt;
  }
  if (s.stage === 'design') {
    if (now >= p.deadline) {
      s.puzzle = structuredClone(world.pieces);
      nextStage(world, 'prove-a', now);
    }
    return;
  }
  if (p.task.phase !== 'done' && now < p.deadline) return;
  const done = p.task.phase === 'done',
    team = activeSwapTeam(s);
  if (s.stage.startsWith('prove')) {
    if (!done) {
      finish(world, now, true);
      return;
    }
    s.verified[team] = true;
  } else s.times[team] = done ? Math.max(0, now - s.stageAt) : null;
  const stage =
    s.stage === 'prove-a'
      ? 'prove-b'
      : s.stage === 'prove-b'
        ? 'run-a'
        : s.stage === 'run-a'
          ? 'run-b'
          : 'finished';
  if (stage === 'finished') finish(world, now);
  else nextStage(world, stage, now);
}
export function swapPartyAction(
  world: World,
  action: PartyAction,
  player: Player,
  players: Player[],
  host: string,
  now: number,
) {
  const s = world.party?.swap;
  if (!s) return;
  if (['configure', 'start', 'skip', 'ready'].includes(action.op)) return;
  if (action.op === 'swap-reseat') {
    if (player.id !== host || !s.pausedAt || players.length !== 4)
      throw new Error(
        'The site manager can replace missing builders when four people are present.',
      );
    const active = new Set(
      players.filter((v) => now - v.seen < 10000).map((v) => v.id),
    );
    const replacements = players.filter(
      (v) => active.has(v.id) && !s.teams.flat().includes(v.id),
    );
    for (const team of s.teams)
      for (let n = 0; n < team.length; n++)
        if (!active.has(team[n]) && replacements.length)
          team[n] = replacements.shift()!.id;
    return;
  }
  if (s.pausedAt !== undefined)
    throw new Error('Waiting for all four builders to return.');
  if (s.stage === 'design')
    throw new Error(
      'Build your puzzle first. Deliveries start after the design clock.',
    );
  if (!s.teams[activeSwapTeam(s)].includes(player.id))
    throw new Error('It is the other pair’s delivery turn.');
}
export function swapEditError(
  world: World,
  action: Action,
  player: Player,
): string | null {
  const s = world.party?.swap;
  if (
    !s ||
    action.type === 'reset' ||
    action.type === 'party' ||
    action.type === 'emote'
  )
    return null;
  if (s.pausedAt !== undefined)
    return 'The challenge is paused while a builder reconnects.';
  if (s.stage !== 'design')
    return 'Puzzles are locked during proof runs and the race. Use the delivery handles.';
  const team = s.teams.findIndex((ids) => ids.includes(player.id));
  if (team < 0) return 'Wait for the next Build & Swap shift.';
  if (action.type === 'remove' || action.type === 'paint')
    return s.owners[action.id || ''] === team
      ? null
      : 'Only change your own team’s puzzle pieces.';
  if (action.type !== 'build')
    return 'Build walls and furniture in your team’s plot. Loose props and roof cranes are not used in this challenge.';
  if (action.kind === 'roof')
    return 'Build a delivery puzzle with walls and furniture.';
  const bounds = footprint(action.kind, action, action.rotation),
    left = team ? 0 : -6,
    right = team ? 6 : 0;
  if (
    bounds.minX < left ||
    bounds.maxX > right ||
    bounds.minZ < -4 ||
    bounds.maxZ > 3.8
  )
    return `Build inside the ${team ? 'turquoise' : 'yellow'} plot. Keep the collection lane clear.`;
  return null;
}
