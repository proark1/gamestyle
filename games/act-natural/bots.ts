import { cowExposed, shockAge, SHOCK_STUN_MS } from './fence';
import { farmClearPath, farmPath, farmRisk } from './navigation';
import { privateFarmView } from './view';
import { FARM_COVER, coverBlocks, farmerSees } from './visibility';
import {
  distance,
  idleInput,
  ROUND_MS,
  type FarmAction,
  type FarmBotBrain,
  type FarmSnapshot,
  type FarmWorld,
  type Point,
} from './types';

const POWER = { x: -8.1, z: 2 },
  GATE = { x: 0, z: 8.1 },
  EAST = { x: 8.1, z: 5 };
export function botRandom(brain: FarmBotBrain) {
  brain.seed = (Math.imul(brain.seed, 1664525) + 1013904223) >>> 0;
  return brain.seed / 4294967296;
}
export function freshBotBrain(
  seed: number,
  position: Point,
  now: number,
): FarmBotBrain {
  const brain: FarmBotBrain = {
    seed,
    boldness: 0.5,
    thinkAt: now,
    actionAt: now,
    repathAt: 0,
    blendUntil: now,
    nextBlendAt: now,
    watchedSince: 0,
    job: '',
    goal: null,
    path: [],
    mode: 'blend',
    farmerMemory: null,
    last: { ...position },
    movedAt: now,
  };
  brain.boldness = 0.25 + botRandom(brain) * 0.65;
  brain.blendUntil = now + 1800 + botRandom(brain) * 4200;
  brain.nextBlendAt = now + 9000 + botRandom(brain) * 6000;
  return brain;
}
function setGoal(
  brain: FarmBotBrain,
  job: string,
  point: Point,
  mode: FarmBotBrain['mode'],
) {
  if (brain.job !== job || !brain.goal || distance(brain.goal, point) > 0.5) {
    brain.path = [];
    brain.repathAt = 0;
  }
  brain.job = job;
  brain.goal = { ...point };
  brain.mode = mode;
}
function coverGoal(view: FarmSnapshot, brain: FarmBotBrain, body: Point) {
  const options = FARM_COVER.flatMap<Point>((c) => [
    { x: c.x - c.width / 2 - 0.9, z: c.z },
    { x: c.x + c.width / 2 + 0.9, z: c.z },
    { x: c.x, z: c.z - c.depth / 2 - 0.9 },
    { x: c.x, z: c.z + c.depth / 2 + 0.9 },
  ]).concat(
    view.world.cows
      .filter((c) => distance(c, body) > 2 && distance(c, body) < 6)
      .map((c) => ({ x: c.x, z: c.z })),
  );
  const safe = options.filter(
    (p) =>
      !coverBlocks(p, 0.55) &&
      Math.abs(p.x) < 8.7 &&
      Math.abs(p.z) < 8.7 &&
      distance(p, body) > 1.2,
  );
  safe.sort(
    (a, b) =>
      distance(a, body) +
      farmRisk(a, brain.farmerMemory) * 5 -
      (distance(b, body) + farmRisk(b, brain.farmerMemory) * 5),
  );
  return safe[0] ?? { x: 0, z: 0 };
}
function observeFarmer(from: Point, to: Point) {
  const d = distance(from, to);
  if (d >= 8) return false;
  const steps = Math.max(1, Math.ceil(d / 0.15));
  for (let i = 0; i <= steps; i++) {
    if (
      coverBlocks(
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          z: from.z + ((to.z - from.z) * i) / steps,
        },
        0,
      )
    )
      return false;
  }
  return true;
}

/** Decisions receive the same private information as a cow client, plus teammates' declared jobs. */
export function thinkFarmBot(
  view: FarmSnapshot,
  brain: FarmBotBrain,
  reserved: ReadonlySet<string>,
): FarmAction | undefined {
  const w = view.world,
    now = w.clock;
  const cow = w.cows.find((c) => c.id === view.you.cowId);
  if (!cow || cow.captured || cow.escaped) return;
  brain.thinkAt = now + 260 + botRandom(brain) * 330;
  if (observeFarmer(cow, w.farmer))
    brain.farmerMemory = { ...w.farmer, at: now };
  if (brain.farmerMemory && now - brain.farmerMemory.at > 3500)
    brain.farmerMemory = null;
  const danger = brain.farmerMemory;
  const watched =
    !!danger &&
    farmerSees({ farmer: danger, mode: 'human', practice: false }, cow);
  brain.watchedSince = watched ? brain.watchedSince || now : 0;
  const exposed = cowExposed(cow, now),
    urgency = Math.min(1, (now - w.started) / ROUND_MS);
  if (shockAge(cow, now) < SHOCK_STUN_MS) {
    brain.mode = 'blend';
    return;
  }
  if (cow.task) {
    brain.mode = 'work';
    if (
      danger &&
      watched &&
      distance(cow, danger) < 3.5 &&
      now >= brain.actionAt
    ) {
      brain.actionAt = now + 800;
      setGoal(brain, 'hide', coverGoal(view, brain, cow), 'hide');
      return { type: 'interact' };
    }
    return;
  }
  const exits = [
    ...(w.powerOff && w.keysDelivered === 2 ? [GATE] : []),
    ...(w.powerOff && w.ladderPlaced ? [EAST] : []),
  ];
  exits.sort(
    (a, b) =>
      distance(cow, a) +
      farmRisk(a, danger) * 2 -
      distance(cow, b) -
      farmRisk(b, danger) * 2,
  );
  if (exits[0]) {
    setGoal(brain, 'escape', exits[0], 'escape');
  } else if (
    exposed ||
    (watched &&
      danger &&
      distance(cow, danger) < 3.4 &&
      now - brain.watchedSince > 700)
  ) {
    setGoal(
      brain,
      'hide',
      coverGoal(view, brain, cow),
      exposed ? 'flee' : 'hide',
    );
  } else {
    if (now < brain.blendUntil) {
      brain.mode = 'blend';
      return;
    }
    if (now >= brain.nextBlendAt && !cow.carrying && urgency < 0.78) {
      brain.blendUntil = now + 900 + botRandom(brain) * 2200;
      brain.nextBlendAt = now + 7000 + botRandom(brain) * 7000;
      brain.mode = 'blend';
      return;
    }
    const held = w.items.find((i) => i.id === cow.carrying);
    const jobs: { id: string; point: Point; value: number }[] = [];
    if (held)
      jobs.push({
        id: held.kind === 'key' ? 'deliver-key' : 'place-ladder',
        point: held.kind === 'key' ? GATE : EAST,
        value: 140,
      });
    else {
      if (!w.powerOff)
        jobs.push({
          id: 'power',
          point: POWER,
          value: w.ladderPlaced || w.keysDelivered === 2 ? 122 : 83,
        });
      for (const item of w.items)
        if (
          !item.holder &&
          !item.delivered &&
          (item.kind !== 'ladder' || !w.ladderPlaced)
        )
          jobs.push({
            id: item.id,
            point: item,
            value:
              item.kind === 'key'
                ? 80 + (1 - brain.boldness) * 12
                : 77 + brain.boldness * 15,
          });
    }
    const score = (job: (typeof jobs)[number]) =>
      job.value -
      distance(cow, job.point) * 2.8 -
      farmRisk(job.point, danger) *
        (1 - urgency * 0.8) *
        (6 - brain.boldness * 3) -
      (reserved.has(job.id) ? 95 : 0) +
      (brain.job === job.id ? 12 : 0);
    jobs.sort((a, b) => score(b) - score(a));
    const job = jobs[0];
    if (job && score(job) > -20) setGoal(brain, job.id, job.point, 'travel');
    else {
      brain.mode = 'blend';
      brain.job = '';
      return;
    }
    // A brief believable hesitation, not permanent freezing whenever the farmer looks over.
    if (
      watched &&
      !cow.carrying &&
      now >= brain.nextBlendAt - 3000 &&
      urgency < 0.65
    ) {
      brain.blendUntil = now + 1000 + botRandom(brain) * 1300;
      brain.nextBlendAt = now + 9000;
      brain.mode = 'blend';
      return;
    }
  }
  if (
    brain.goal &&
    distance(cow, brain.goal) < 0.65 &&
    farmClearPath(cow, brain.goal, 0.45)
  ) {
    if (brain.mode === 'hide' || brain.mode === 'flee') {
      brain.blendUntil = now + 700 + botRandom(brain) * 1100;
      brain.mode = 'blend';
      return;
    }
    // Sabotage is a four-second commitment. Wait for an opening instead of
    // announcing the fake cow within immediate inspection range.
    if (
      brain.job === 'power' &&
      watched &&
      danger &&
      distance(cow, danger) < 4.8 &&
      urgency < 0.88
    ) {
      setGoal(brain, 'hide', coverGoal(view, brain, cow), 'hide');
      brain.blendUntil = now + 1800 + botRandom(brain) * 1800;
      return;
    }
    if (now >= brain.actionAt) {
      brain.actionAt = now + 650 + botRandom(brain) * 450;
      return { type: 'interact' };
    }
  }
}

export function tickFarmBots(
  w: FarmWorld,
  act: (id: string, action: FarmAction) => void,
) {
  if (w.mode !== 'human') return;
  w.botBrains ??= {};
  for (const player of w.players) {
    if (!player.bot) continue;
    const cow = w.cows.find((c) => c.id === player.cowId);
    if (!cow || cow.captured || cow.escaped) {
      player.input = idleInput();
      continue;
    }
    const brain = (w.botBrains[player.id] ??= freshBotBrain(
      w.seed ^ (w.players.indexOf(player) * 7919),
      cow,
      w.clock,
    ));
    player.seen = w.clock;
    if (w.clock >= brain.thinkAt) {
      const reserved = new Set(
        w.players
          .filter(
            (p) =>
              p.bot &&
              p.id !== player.id &&
              w.cows.some((c) => c.id === p.cowId && !c.captured && !c.escaped),
          )
          .map((p) => w.botBrains?.[p.id]?.job ?? ''),
      );
      const action = thinkFarmBot(
        {
          code: '',
          host: '',
          version: 0,
          you: { id: player.id, role: 'cow', cowId: cow.id },
          world: privateFarmView(w, player.id),
        },
        brain,
        reserved,
      );
      if (action) {
        try {
          act(player.id, action);
        } catch {
          brain.thinkAt = w.clock + 450;
          brain.repathAt = 0;
        }
        if (w.phase !== 'playing') return;
      }
    }
    if (distance(cow, brain.last) > 0.15) {
      brain.last = { x: cow.x, z: cow.z };
      brain.movedAt = w.clock;
    }
    player.input = idleInput();
    if (
      brain.mode === 'blend' ||
      cow.task ||
      shockAge(cow, w.clock) < SHOCK_STUN_MS
    ) {
      player.input.graze = !cow.task && cow.carrying !== 'ladder';
      continue;
    }
    if (!brain.goal) continue;
    if (w.clock - brain.movedAt > 2400) {
      brain.repathAt = 0;
      brain.thinkAt = 0;
      brain.movedAt = w.clock;
    }
    if (w.clock >= brain.repathAt) {
      const urgency = Math.min(1, (w.clock - w.started) / ROUND_MS);
      brain.path = farmPath(
        cow,
        brain.goal,
        brain.farmerMemory,
        (1.2 - brain.boldness * 0.6) * (1 - urgency * 0.7),
      );
      brain.repathAt = w.clock + 1000 + botRandom(brain) * 600;
    }
    while (
      brain.path[0] &&
      distance(cow, brain.path[0]) < 0.18 &&
      (!brain.path[1] || farmClearPath(cow, brain.path[1], 0.45))
    )
      brain.path.shift();
    const next = brain.path[0];
    if (!next) continue;
    const d = distance(cow, next),
      speed =
        brain.mode === 'flee' || brain.mode === 'escape'
          ? 1
          : 0.76 + brain.boldness * 0.22;
    const approach = Math.min(speed, d / (2.6 * 0.05));
    player.input = {
      x: ((next.x - cow.x) / Math.max(d, 0.001)) * approach,
      z: ((next.z - cow.z) / Math.max(d, 0.001)) * approach,
      graze: false,
    };
  }
}
