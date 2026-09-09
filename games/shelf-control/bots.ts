import {
  clearSight,
  DISPLAYS,
  DOOR,
  EQUIPMENT,
  HATCH,
  SWITCH,
  visible,
} from './layout';
import { shopPath } from './navigation';
import {
  distance,
  idleInput,
  type Action,
  type BotBrain,
  type Point,
  type Snapshot,
  type World,
} from './types';

const patrol: Point[] = [
  { x: 0, z: -8.3 },
  { x: -11, z: -6.4 },
  { x: -10, z: 1.8 },
  { x: -4, z: 7 },
  { x: 3.7, z: 4.5 },
  { x: 11, z: 7.5 },
  { x: 10.5, z: 0 },
  { x: 10, z: -9 },
];
export function botRandom(brain: BotBrain) {
  brain.seed = (Math.imul(brain.seed, 1664525) + 1013904223) >>> 0;
  return brain.seed / 4294967296;
}
export function newBotBrain(seed: number, body: Point): BotBrain {
  return {
    seed,
    thinkAt: 0,
    thoughtAt: 0,
    repathAt: 0,
    actionAt: 0,
    goal: null,
    routeGoal: null,
    path: [],
    mode: 'hide',
    job: '',
    holdUntil: 0,
    watchSince: 0,
    last: { ...body },
    movedAt: 0,
    roam: seed % patrol.length,
    guardMemory: null,
    items: Object.fromEntries(
      EQUIPMENT.map((i) => [
        i.id,
        { x: i.x, z: i.z, kind: i.kind, free: true },
      ]),
    ),
    suspects: {},
    cleared: [],
  };
}
const near = (a: Point, b: Point, range = 1.35) =>
  distance(a, b) < range && clearSight(a, b);
function goal(brain: BotBrain, point: Point | null, mode: BotBrain['mode']) {
  brain.goal = point ? { x: point.x, z: point.z } : null;
  brain.mode = mode;
}
function cover(view: Snapshot, brain: BotBrain) {
  const body = view.you.body!,
    guard = view.guard ?? brain.guardMemory;
  const options = DISPLAYS.filter((p) => distance(body, p) > 1.5);
  options.sort((a, b) => {
    const score = (p: Point) =>
      distance(body, p) +
      (guard
        ? (clearSight(guard, p) ? 18 : 0) +
          Math.max(0, 4 - distance(guard, p)) * 5
        : 0);
    return score(a) - score(b);
  });
  return options[0] ?? body;
}
function observeItems(view: Snapshot, brain: BotBrain) {
  for (const [id, item] of Object.entries(brain.items)) {
    const seen = view.items.find((i) => i.id === id);
    if (seen)
      brain.items[id] = {
        x: seen.x,
        z: seen.z,
        kind: seen.kind,
        free: !seen.holder,
      };
    else if (visible(view.you.body!, item, false)) item.free = false;
  }
  for (const item of view.items)
    if (item.kind !== 'prop')
      brain.items[item.id] = {
        x: item.x,
        z: item.z,
        kind: item.kind,
        free: !item.holder,
      };
}

/** Decisions use the mannequin's private view and shared NPC job intentions, not hidden item coordinates. */
export function thinkMannequin(
  view: Snapshot,
  brain: BotBrain,
  reserved: ReadonlySet<string>,
): Action | undefined {
  const body = view.you.body!,
    now = view.clock,
    objectives = view.objectives!;
  if (view.phase === 'hiding') {
    if (brain.job !== 'hide') {
      brain.job = 'hide';
      brain.holdUntil = now + view.remaining;
      const options = DISPLAYS.filter(
        (p) => distance(p, body) > 1 && distance(p, body) < 9,
      );
      goal(
        brain,
        options[Math.floor(botRandom(brain) * options.length)] ?? body,
        'hide',
      );
    }
    if (brain.goal && near(body, brain.goal, 0.6)) {
      goal(brain, null, 'pose');
      return { type: 'pose' };
    }
    return;
  }
  if (brain.job === 'hide') {
    brain.job = '';
    brain.holdUntil = 0;
  }
  observeItems(view, brain);
  if (view.guard) brain.guardMemory = { ...view.guard, at: now };
  if (brain.guardMemory && now - brain.guardMemory.at > 2500)
    brain.guardMemory = null;
  const watching = !!view.guard && visible(view.guard, body, true);
  brain.watchSince = watching ? brain.watchSince || now : 0;
  const exits = [
    ...(objectives.powerOff && objectives.keys >= 2 ? [DOOR] : []),
    ...(objectives.powerOff && objectives.ladder ? [HATCH] : []),
  ].sort((a, b) => distance(body, a) - distance(body, b));
  if (exits[0] && near(body, exits[0])) {
    goal(brain, null, 'job');
    return { type: 'interact' };
  }
  if (
    brain.mode === 'flee' &&
    brain.holdUntil > now &&
    brain.goal &&
    !near(body, brain.goal, 0.7)
  )
    return;
  if (watching && now - brain.watchSince > 5000) {
    goal(brain, cover(view, brain), 'flee');
    brain.holdUntil = now + 2500;
    return;
  }
  if (
    watching &&
    view.guard &&
    distance(body, view.guard) < 6 &&
    view.you.carrying &&
    view.you.carrying !== 'prop'
  ) {
    goal(brain, cover(view, brain), 'flee');
    brain.holdUntil = now + 2000 + botRandom(brain) * 900;
    return;
  }
  if (brain.mode === 'pose' && brain.holdUntil > now) return;
  if (
    watching &&
    view.guard &&
    now - brain.watchSince > 800 &&
    !view.you.carrying &&
    !view.you.task
  ) {
    if (distance(body, view.guard) < 2.7) {
      goal(brain, cover(view, brain), 'flee');
      brain.holdUntil = now + 2200;
      return;
    }
    brain.holdUntil = now + 1000 + botRandom(brain) * 1800;
    goal(brain, null, 'pose');
    return { type: 'pose' };
  }
  if (view.you.task) {
    goal(brain, null, 'job');
    return;
  }
  if (exits[0]) {
    brain.job = 'escape';
    goal(brain, exits[0], 'job');
    return;
  }
  if (view.you.carrying === 'prop') {
    goal(brain, null, 'job');
    return { type: 'drop' };
  }
  if (view.you.carrying) {
    const destination = view.you.carrying === 'ladder' ? HATCH : DOOR;
    brain.job = view.you.carrying === 'ladder' ? 'ladder' : 'deliver-key';
    goal(brain, destination, 'job');
    if (near(body, destination)) return { type: 'interact' };
    return;
  }
  // Keep a valid assignment. Reassign when equipment disappears or a teammate finishes security.
  if (brain.job === 'security' && objectives.powerOff) brain.job = '';
  if (
    brain.job !== 'security' &&
    (!brain.items[brain.job]?.free || reserved.has(brain.job))
  )
    brain.job = '';
  if (!objectives.powerOff && !reserved.has('security')) brain.job = 'security';
  if (!brain.job) {
    const choices = Object.entries(brain.items).filter(
      ([id, item]) =>
        item.free &&
        !reserved.has(id) &&
        (item.kind === 'key' ? objectives.keys < 2 : !objectives.ladder),
    );
    choices.sort(
      ([a, pa], [b, pb]) =>
        distance(body, pa) +
        (a === 'ladder' ? 2 : 0) -
        distance(body, pb) -
        (b === 'ladder' ? 2 : 0),
    );
    brain.job = choices[0]?.[0] ?? '';
  }
  if (brain.job === 'security') {
    goal(brain, SWITCH, 'job');
    if (near(body, SWITCH)) return { type: 'interact' };
    return;
  }
  const item = brain.items[brain.job];
  if (item?.free) {
    goal(brain, item, 'job');
    if (
      near(body, item) &&
      view.items.some((i) => i.id === brain.job && !i.holder)
    )
      return { type: 'interact', target: brain.job };
    return;
  }
  // Look for dropped equipment using normal local vision if known pickups are unavailable.
  if (!brain.goal || near(body, brain.goal, 0.8) || brain.mode !== 'patrol') {
    brain.roam++;
    goal(brain, DISPLAYS[brain.roam % DISPLAYS.length], 'patrol');
  }
}

/** Deliberately accepts no World, ownership map, bot roster or global objective state. */
export function thinkGuard(
  view: Snapshot,
  brain: BotBrain,
): Action | undefined {
  const body = view.you.body!,
    now = view.clock;
  if (view.phase === 'hiding') {
    goal(brain, null, 'patrol');
    return;
  }
  const dt = Math.min(0.8, Math.max(0, (now - brain.thoughtAt) / 1000));
  // A missing item is a clue only when its remembered location is actually in view.
  for (const [id, item] of Object.entries(brain.items)) {
    if (!visible(body, item, true)) continue;
    const seen = view.items.find((i) => i.id === id);
    if (!seen && item.free) {
      item.free = false;
      brain.job = item.kind === 'ladder' ? 'check-hatch' : 'check-door';
    } else if (seen && !seen.holder) {
      item.x = seen.x;
      item.z = seen.z;
      item.free = true;
    }
  }
  for (const figure of view.figures) {
    if (brain.cleared.includes(figure.id)) continue;
    const memory = brain.suspects[figure.id] ?? {
      x: figure.x,
      z: figure.z,
      seenAt: now,
      score: 0,
      movingFor: 0,
      reactAt: now + 850 + botRandom(brain) * 550,
    };
    const oldScore = memory.score;
    memory.movingFor = figure.moving
      ? memory.movingFor + dt
      : Math.max(0, memory.movingFor - dt * 2);
    memory.score = Math.max(0, memory.score - dt * 0.04);
    const held = view.items.find((item) => item.holder === figure.id);
    if (held?.kind === 'key' || held?.kind === 'ladder' || figure.task > 0)
      memory.score = 4;
    else if (memory.movingFor > 5) memory.score = Math.max(memory.score, 3);
    else if (memory.movingFor > 2.7) memory.score = Math.max(memory.score, 2.1);
    if (oldScore < 3 && memory.score >= 3)
      memory.reactAt = now + 650 + botRandom(brain) * 550;
    Object.assign(memory, { x: figure.x, z: figure.z, seenAt: now });
    brain.suspects[figure.id] = memory;
  }
  const suspects = Object.entries(brain.suspects).filter(
    ([id, s]) =>
      !brain.cleared.includes(id) &&
      now - s.seenAt < 6500 &&
      s.score >= 3 &&
      now >= s.reactAt,
  );
  suspects.sort(
    ([, a], [, b]) =>
      b.score - a.score || distance(body, a) - distance(body, b),
  );
  const suspect = suspects[0];
  if (suspect) {
    const [id, memory] = suspect,
      seen = view.figures.find((f) => f.id === id);
    if (seen && near(body, seen, 1.75) && view.inspectCooldown === 0) {
      goal(brain, null, 'chase');
      brain.cleared.push(id);
      return { type: 'inspect', target: id };
    }
    if (!seen && near(body, memory, 0.85)) {
      memory.seenAt = now - 6500;
      brain.holdUntil = now + 1800;
      goal(brain, null, 'search');
      return;
    }
    goal(brain, memory, 'chase');
    return;
  }
  // A rare close, prolonged movement suspicion can be mistaken; conserve the last two guesses.
  if (
    view.mistakes > 2 &&
    view.inspectCooldown === 0 &&
    now >= brain.holdUntil
  ) {
    const uncertain = view.figures.find(
      (f) =>
        near(body, f, 1.75) &&
        !brain.cleared.includes(f.id) &&
        (brain.suspects[f.id]?.score ?? 0) >= 2.1,
    );
    if (uncertain && botRandom(brain) < 0.08) {
      brain.cleared.push(uncertain.id);
      brain.holdUntil = now + 15000;
      goal(brain, null, 'patrol');
      return { type: 'inspect', target: uncertain.id };
    }
  }
  if (brain.mode === 'search' && brain.holdUntil > now) {
    goal(brain, null, 'search');
    return;
  }
  if (brain.job === 'check-door' || brain.job === 'check-hatch') {
    const exit = brain.job === 'check-door' ? DOOR : HATCH;
    if (near(body, exit, 1)) {
      brain.job = '';
      brain.holdUntil = now + 1600;
      goal(brain, null, 'search');
    } else goal(brain, exit, 'patrol');
    return;
  }
  if (brain.goal && brain.mode === 'patrol' && near(body, brain.goal, 0.65)) {
    brain.holdUntil = now + 1100 + botRandom(brain) * 500;
    brain.roam++;
    goal(brain, null, 'search');
    return;
  }
  if (!brain.goal || brain.mode !== 'patrol')
    goal(brain, patrol[brain.roam % patrol.length], 'patrol');
}

function steer(view: Snapshot, brain: BotBrain) {
  const body = view.you.body!,
    now = view.clock;
  if (!brain.goal) {
    brain.path = [];
    brain.routeGoal = null;
    if (view.you.role === 'guard' && brain.mode === 'search') {
      const angle = (now - brain.holdUntil) / 650 + brain.roam;
      return { x: Math.sin(angle) * 0.06, z: Math.cos(angle) * 0.06 };
    }
    return { x: 0, z: 0 };
  }
  if (distance(body, brain.last) > 0.12) {
    brain.last = { x: body.x, z: body.z };
    brain.movedAt = now;
  }
  const stalled = now - brain.movedAt > 1300;
  const changed =
    !brain.routeGoal || distance(brain.goal, brain.routeGoal) > 0.75;
  if (
    now >= brain.repathAt &&
    (changed || stalled || (!brain.path.length && !near(body, brain.goal, 0.2)))
  ) {
    brain.path = shopPath(
      body,
      brain.goal,
      view.you.role === 'mannequin' ? brain.guardMemory : null,
    );
    brain.routeGoal = { ...brain.goal };
    brain.repathAt = now + 650;
    brain.movedAt = now;
  }
  while (brain.path.length && distance(body, brain.path[0]) < 0.16)
    brain.path.shift();
  const target = brain.path[0];
  if (!target) return { x: 0, z: 0 };
  const d = distance(body, target),
    scale = Math.max(0.14, d);
  return { x: (target.x - body.x) / scale, z: (target.z - body.z) / scale };
}

export function driveBots(
  w: World,
  viewFor: (id: string) => Snapshot,
  perform: (id: string, action: Action) => void,
) {
  const brains = w.botBrains ?? (w.botBrains = {});
  for (const player of w.players) {
    if (!player.bot) continue;
    const view = viewFor(player.id);
    if (
      !view.you.body ||
      view.you.status !== 'active' ||
      view.you.role === 'waiting'
    ) {
      player.input = idleInput(player.input.seq);
      if (brains[player.id]) brains[player.id].job = '';
      continue;
    }
    let brain = brains[player.id];
    if (!brain) {
      let seed = w.seed;
      for (const c of player.id)
        seed = (Math.imul(seed, 31) + c.charCodeAt(0)) >>> 0;
      brain = newBotBrain(seed, view.you.body);
      brains[player.id] = brain;
    }
    if (w.clock >= brain.thinkAt) {
      const reserved = new Set(
        w.players
          .filter(
            (p) =>
              p.bot &&
              p.id !== player.id &&
              p.id !== w.guardId &&
              w.figures.some(
                (f) => f.id === p.figureId && f.status === 'active',
              ),
          )
          .map((p) => brains[p.id]?.job ?? ''),
      );
      const action =
        view.you.role === 'guard'
          ? thinkGuard(view, brain)
          : thinkMannequin(view, brain, reserved);
      brain.thoughtAt = w.clock;
      brain.thinkAt = w.clock + 250 + botRandom(brain) * 150;
      if (action && w.clock >= brain.actionAt) {
        try {
          perform(player.id, action);
        } catch {
          brain.goal = null;
          brain.path = [];
        }
        brain.actionAt = w.clock + 450;
      }
    }
    const input =
      view.phase === 'hiding' && view.you.role === 'guard'
        ? { x: 0, z: 0 }
        : steer(view, brain);
    player.input = { ...input, seq: player.input.seq + 1 };
    player.seen = w.clock;
  }
}
