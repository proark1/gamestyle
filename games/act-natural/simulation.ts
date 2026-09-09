import {
  GATE,
  PANEL,
  LADDER_EXIT,
  INSPECTIONS,
  ROUND_MS,
  distance,
  idleInput,
  farmMode,
  type Cow,
  type FarmAction,
  type FarmPlayer,
  type FarmSnapshot,
  type FarmWorld,
  type Point,
} from './types';
import { farmRandom as random, herdIntent, resetHerd } from './herd';
import { cowExposed, shockAge, shockAtFence, SHOCK_STUN_MS } from './fence';
import { clearCoverPosition, farmerSees } from './visibility';
import { farmMove, FARMER_SPEED } from './movement';
export { farmMove } from './movement';
import { privateFarmView } from './view';
import { tickFarmBots } from './bots';
function clue(w: FarmWorld, sound: string, position: Point) {
  w.clues ??= [];
  w.clues.push({
    id: (w.clues.at(-1)?.id ?? 0) + 1,
    clock: w.clock,
    sound,
    x: position.x,
    z: position.z,
  });
  w.clues = w.clues.slice(-24);
}
function note(w: FarmWorld, text: string) {
  w.events.push({ id: (w.events.at(-1)?.id ?? 0) + 1, text });
  w.events = w.events.slice(-6);
}
export function farmPlayer(id: string, name: string, now: number): FarmPlayer {
  return { id, name, cowId: null, seen: now, input: idleInput() };
}
export function freshFarm(
  now: number,
  seed = 9717,
  practice = false,
): FarmWorld {
  const w: FarmWorld = {
    mode: practice ? 'computer' : 'human',
    phase: 'lobby',
    clock: now,
    started: 0,
    round: 0,
    players: [],
    farmerId: '',
    farmer: { x: 0, z: -3, angle: 0 },
    cows: [],
    items: [],
    herd: 'graze',
    herdTarget: { x: 0, z: 0 },
    cueUntil: now + 11000,
    inspections: INSPECTIONS,
    lastInspection: 0,
    powerOff: false,
    keysDelivered: 0,
    ladderPlaced: false,
    events: [],
    seed,
    aiSuspicion: {},
    practice,
  };
  resetField(w);
  return w;
}
function resetField(w: FarmWorld) {
  w.cows = Array.from({ length: 18 }, (_, i) => ({
    id: `cow-${i}`,
    x: ((i % 6) - 2.5) * 2.3 + (random(w) - 0.5) * 1.6,
    z: (Math.floor(i / 6) - 1) * 3.1 + (random(w) - 0.5) * 1.6,
    angle: random(w) * Math.PI * 2,
    grazing: true,
    moving: false,
    carrying: null,
    captured: false,
    escaped: false,
    checkedUntil: 0,
    shockedAt: 0,
    task: 0,
  }));
  w.items = [
    {
      id: 'barn-key',
      kind: 'key',
      x: -7,
      z: -6,
      holder: null,
      delivered: false,
    },
    {
      id: 'shed-key',
      kind: 'key',
      x: 7,
      z: -6,
      holder: null,
      delivered: false,
    },
    {
      id: 'ladder',
      kind: 'ladder',
      x: 6,
      z: 4,
      holder: null,
      delivered: false,
    },
  ];
  w.farmer = { x: 0, z: -4, angle: 0 };
  w.clues = [];
  if (farmMode(w) === 'human')
    for (const cow of w.cows) clearCoverPosition(cow);
  w.powerOff = false;
  w.keysDelivered = 0;
  w.ladderPlaced = false;
  w.inspections = INSPECTIONS;
  w.lastInspection = 0;
  w.aiSuspicion = {};
  w.botBrains = {};
  w.herd = 'graze';
  w.herdTarget = { x: 0, z: 0 };
  w.cueUntil = w.clock + 10000;
  resetHerd(w);
}
function begin(w: FarmWorld) {
  w.round++;
  resetField(w);
  const humans = w.players.filter((p) => !p.bot);
  w.farmerId =
    farmMode(w) === 'computer'
      ? 'computer-farmer'
      : humans[(w.round - 1) % humans.length].id;
  const available = [...w.cows];
  for (const p of w.players) {
    p.input = idleInput();
    p.cowId =
      p.id === w.farmerId
        ? null
        : available.splice(Math.floor(random(w) * available.length), 1)[0].id;
    const cow = w.cows.find((c) => c.id === p.cowId);
    if (cow) {
      p.input.graze = true;
      cow.grazing = true;
      cow.moving = false;
    }
  }
  w.phase = 'playing';
  w.started = w.clock;
  note(w, 'The gate is locked. Look innocent.');
}
export function dropItem(w: FarmWorld, cow: Cow) {
  if (!cow.carrying) return;
  const item = w.items.find((i) => i.id === cow.carrying);
  if (item) {
    clue(w, `item.${item.kind}.drop`, cow);
    item.holder = null;
    item.x = cow.x;
    item.z = cow.z;
  }
  cow.carrying = null;
}
function inspect(w: FarmWorld, target?: string) {
  if (!w.inspections)
    throw new Error(
      'No inspections left. Guard the exits until the timer ends.',
    );
  if (w.clock - w.lastInspection < 1600)
    throw new Error('Wait a moment before the next inspection.');
  const cow = w.cows.find((c) => c.id === target);
  if (!cow || cow.captured || cow.escaped)
    throw new Error('Choose a cow in the pasture.');
  if (distance(cow, w.farmer) > 3.2)
    throw new Error('Walk closer to that cow to inspect it.');
  if (farmMode(w) === 'human' && !farmerSees(w, cow))
    throw new Error(
      'That cow is out of sight. Face it and move around the hay.',
    );
  if (cow.checkedUntil > w.clock) throw new Error('You just checked this cow.');
  w.inspections--;
  w.lastInspection = w.clock;
  cow.checkedUntil = w.clock + 7000;
  if (w.players.some((p) => p.cowId === cow.id)) {
    dropItem(w, cow);
    cow.captured = true;
    cow.task = 0;
    note(w, 'Busted! The farmer found a fake cow.');
  } else note(w, 'An entirely ordinary cow. One inspection spent.');
  finish(w);
}
export function farmAction(
  w: FarmWorld,
  id: string,
  a: FarmAction,
  host: string,
) {
  const p = w.players.find((p) => p.id === id);
  if (!p) throw new Error('Rejoin the farm to play.');
  if (
    a.type === 'add-bot' ||
    a.type === 'fill-bots' ||
    a.type === 'remove-bot'
  ) {
    if (id !== host || p.bot) throw new Error('Only the host can manage NPCs.');
    if (w.phase === 'playing')
      throw new Error('Finish this round before changing NPCs.');
    if (farmMode(w) !== 'human' || w.practice)
      throw new Error('Choose Player farmer to add NPC cows.');
    if (a.type === 'remove-bot') {
      const bot = w.players.find(
        (player) => player.id === a.target && player.bot,
      );
      if (!bot) throw new Error('Choose an NPC slot to remove.');
      removeFarmPlayer(w, bot.id);
      note(w, `${bot.name} left the farm.`);
    } else {
      if (w.players.length >= 4) throw new Error('All four slots are filled.');
      const count = a.type === 'fill-bots' ? 4 - w.players.length : 1;
      const names = ['Clover', 'Maple', 'Mochi'];
      for (let i = 0; i < count; i++) {
        const slot = [1, 2, 3].find(
          (n) => !w.players.some((player) => player.id === `farm-bot-${n}`),
        )!;
        const bot = farmPlayer(`farm-bot-${slot}`, names[slot - 1], w.clock);
        bot.bot = true;
        w.players.push(bot);
      }
      note(
        w,
        count === 1
          ? 'An NPC cow joined the herd.'
          : 'Empty cow slots filled with NPCs.',
      );
    }
    return;
  }
  if (a.type === 'mode') {
    if (id !== host)
      throw new Error('Only the host can choose the farmer mode.');
    if (w.phase === 'playing')
      throw new Error('Finish this round before changing modes.');
    if (a.mode !== 'human' && a.mode !== 'computer')
      throw new Error('Choose a valid farmer mode.');
    if (w.practice && a.mode !== 'computer')
      throw new Error('Invite friends in a room to play as the farmer.');
    w.mode = a.mode;
    if (a.mode === 'computer')
      w.players = w.players.filter((player) => !player.bot);
    w.phase = 'lobby';
    w.farmerId = '';
    for (const player of w.players) {
      player.cowId = null;
      player.input = idleInput();
    }
    resetField(w);
    note(
      w,
      a.mode === 'human'
        ? 'Player farmer: one hunter, up to three hidden cows.'
        : 'Escape the computer: everyone joins the cow team.',
    );
    return;
  }
  if (a.type === 'start' || a.type === 'restart') {
    if (id !== host) throw new Error('Only the host can start the round.');
    if (w.phase === 'playing') throw new Error('Finish this round first.');
    if (!w.players.some((player) => !player.bot))
      throw new Error('A human farmer must join first.');
    if (farmMode(w) === 'human' && w.players.length < 2)
      throw new Error('Invite a friend or fill a cow slot with an NPC.');
    begin(w);
    return;
  }
  if (w.phase !== 'playing') throw new Error('Wait for the next round.');
  if (id === w.farmerId) {
    if (a.type !== 'inspect' && a.type !== 'interact')
      throw new Error('Watch the herd, then inspect a suspicious cow.');
    const nearest = w.cows
      .filter(
        (c) =>
          !c.escaped &&
          !c.captured &&
          (farmMode(w) !== 'human' || farmerSees(w, c)),
      )
      .sort((a, b) => distance(a, w.farmer) - distance(b, w.farmer))[0];
    inspect(w, a.target ?? nearest?.id);
    return;
  }
  const cow = w.cows.find((c) => c.id === p.cowId);
  if (!cow || cow.captured || cow.escaped)
    throw new Error('You are spectating until the next round.');
  if (shockAge(cow, w.clock) < SHOCK_STUN_MS)
    throw new Error('Zapped! Recover for a moment before acting.');
  if (a.type === 'graze') {
    p.input.graze = !p.input.graze;
    return;
  }
  if (a.type === 'drop') {
    dropItem(w, cow);
    cow.task = 0;
    return;
  }
  if (a.type !== 'interact')
    throw new Error('Only the farmer can inspect cows.');
  if (!w.powerOff && distance(cow, PANEL) < 2) {
    cow.task = cow.task ? 0 : 0.001;
    p.input = idleInput();
    return;
  }
  const held = w.items.find((i) => i.id === cow.carrying);
  if (held?.kind === 'key' && distance(cow, GATE) < 2) {
    held.delivered = true;
    held.holder = null;
    cow.carrying = null;
    w.keysDelivered++;
    cow.interactedAt = w.clock;
    clue(w, 'item.key.unlock', GATE);
    note(w, `A gate lock clicked open. ${w.keysDelivered}/2 keys delivered.`);
    return;
  }
  if (held?.kind === 'ladder' && distance(cow, LADDER_EXIT) < 2) {
    held.delivered = true;
    held.holder = null;
    cow.carrying = null;
    w.ladderPlaced = true;
    cow.interactedAt = w.clock;
    clue(w, 'item.ladder.place', LADDER_EXIT);
    note(w, 'Someone left a ladder at the east fence. Very cow-like.');
    return;
  }
  if (
    distance(cow, GATE) < 2 ||
    (w.ladderPlaced && distance(cow, LADDER_EXIT) < 2)
  ) {
    if (!w.powerOff)
      throw new Error(
        'The fence is still live. Cut the power at the west switch.',
      );
    if (distance(cow, GATE) < 2 && w.keysDelivered < 2)
      throw new Error(
        'Bring both keys here, or take the ladder to the east fence.',
      );
    dropItem(w, cow);
    cow.escaped = true;
    note(w, 'A fake cow made it out!');
    finish(w);
    return;
  }
  if (cow.carrying)
    throw new Error(
      'Take your key to the south gate, or your ladder to the east fence. Q drops it.',
    );
  const item = w.items
    .filter((i) => !i.delivered && !i.holder && distance(i, cow) < 1.8)
    .sort((a, b) => distance(a, cow) - distance(b, cow))[0];
  if (!item)
    throw new Error(
      'Get closer to a key, the ladder, the power switch, or an exit.',
    );
  cow.carrying = item.id;
  cow.interactedAt = w.clock;
  clue(w, `item.${item.kind}.grab`, cow);
  item.holder = cow.id;
  cow.grazing = false;
  cow.task = 0;
}
function finish(w: FarmWorld) {
  if (w.phase !== 'playing') return;
  const fakes = w.players
    .map((p) => w.cows.find((c) => c.id === p.cowId))
    .filter((c): c is Cow => !!c);
  if (!fakes.length) w.phase = 'farmer-win';
  else if (fakes.every((c) => c.captured || c.escaped)) {
    w.phase = fakes.some((c) => c.escaped) ? 'cows-win' : 'farmer-win';
  } else if (w.clock - w.started >= ROUND_MS)
    w.phase = fakes.some((c) => c.escaped) ? 'cows-win' : 'farmer-win';
  if (w.phase !== 'playing') {
    w.players.forEach((p) => (p.input = idleInput()));
    note(
      w,
      w.phase === 'cows-win'
        ? 'The cows win. At least one friend reached freedom!'
        : 'The farmer wins. Nobody escaped the pasture.',
    );
  }
}
export function advanceFarm(w: FarmWorld, now: number) {
  if (now <= w.clock) return;
  if (w.phase !== 'playing') {
    w.clock = now;
    return;
  }
  // Only catch up a short movement window after a disconnect. The round deadline still uses wall time.
  const elapsed = Math.min((now - w.clock) / 1000, 0.5);
  const steps = Math.max(1, Math.ceil(elapsed / 0.05));
  const dt = elapsed / steps;
  for (let step = 0; step < steps; step++) {
    w.clock = now - (steps - step - 1) * dt * 1000;
    if (w.players.some((p) => p.bot))
      tickFarmBots(w, (id, action) => farmAction(w, id, action, ''));
    if (w.phase !== 'playing') break;
    for (let i = 0; i < w.cows.length; i++) {
      const c = w.cows[i];
      if (c.captured || c.escaped) {
        c.moving = false;
        continue;
      }
      const player = w.players.find((p) => p.cowId === c.id);
      if (player) {
        if (shockAge(c, w.clock) < SHOCK_STUN_MS) {
          c.moving = false;
          c.grazing = false;
          continue;
        }
        const input =
          player.bot || w.practice || w.clock - player.seen < 1200
            ? player.input
            : idleInput();
        const speed = c.carrying === 'ladder' ? 1.45 : 2.6;
        c.moving = farmMove(c, input, speed, dt, farmMode(w) === 'human');
        if (shockAtFence(c, w.clock, w.powerOff)) {
          player.input.graze = false;
          note(w, 'ZAP! A fake cow touched the live fence and is exposed!');
          continue;
        }
        c.grazing =
          input.graze &&
          !c.moving &&
          (farmMode(w) === 'human' ? c.carrying !== 'ladder' : !c.carrying) &&
          !c.task;
        if (c.task) {
          if (c.moving || distance(c, PANEL) >= 2 || w.powerOff) c.task = 0;
          else {
            c.task += dt / 4;
            if (c.task >= 1) {
              w.powerOff = true;
              c.task = 0;
              note(w, 'The electric fence went quiet.');
            }
          }
        }
      } else {
        const intent = herdIntent(w, c);
        c.moving = farmMove(
          c,
          intent,
          intent.speed,
          dt,
          farmMode(w) === 'human',
        );
        if (
          !c.moving &&
          Math.hypot(intent.x, intent.z) > 0.1 &&
          w.cowRoutines?.[c.id]
        )
          w.cowRoutines[c.id].until = 0;
      }
    }
    // Keep the old summary field readable for existing clients; it no longer controls any cow.
    const active = w.cows.filter((c) => !c.captured && !c.escaped);
    w.herd =
      active.filter((c) => c.grazing).length >= active.length / 2
        ? 'graze'
        : 'walk';
    const farmer = w.players.find((p) => p.id === w.farmerId);
    if (farmer)
      farmMove(
        w.farmer,
        w.clock - farmer.seen < 1200 ? farmer.input : idleInput(),
        FARMER_SPEED,
        dt,
        farmMode(w) === 'human',
      );
    else if (farmMode(w) === 'computer') computerFarmer(w, dt);
  }
  w.clock = now;
  finish(w);
}
function computerFarmer(w: FarmWorld, dt: number) {
  // The computer observes every cow identically; it never reads the hidden ownership map.
  let suspect: Cow | undefined;
  let best = 2.8;
  for (const c of w.cows) {
    if (c.captured || c.escaped || c.checkedUntil > w.clock) continue;
    const dx = c.x - w.farmer.x,
      dz = c.z - w.farmer.z,
      len = Math.hypot(dx, dz);
    const visible =
      len < 7 &&
      (Math.sin(w.farmer.angle) * dx + Math.cos(w.farmer.angle) * dz) /
        Math.max(0.01, len) >
        0.2;
    const neighbours = w.cows.filter(
      (other) =>
        other.id !== c.id &&
        !other.captured &&
        !other.escaped &&
        distance(c, other) < 4,
    ).length;
    // Grazing, standing and walking in different directions are all normal now.
    // Long solitary walks are only a weak clue; visibly carrying loot or sabotaging is much stronger.
    const suspicionRate = c.carrying
      ? 2
      : c.task > 0
        ? 1
        : c.moving && neighbours < 2
          ? 0.15
          : 0;
    w.aiSuspicion[c.id] = Math.max(
      0,
      (w.aiSuspicion[c.id] ?? 0) +
        (visible && suspicionRate > 0 ? dt * suspicionRate : -dt * 0.8),
    );
    // The exposed marker is public evidence, also visible to the practice farmer.
    const suspicion = cowExposed(c, w.clock) ? 10 : w.aiSuspicion[c.id];
    if ((visible || cowExposed(c, w.clock)) && suspicion > best) {
      suspect = c;
      best = suspicion;
    }
  }
  const patrol = [
    { x: -5, z: -5 },
    { x: 5, z: -5 },
    { x: 6, z: 5 },
    { x: -6, z: 5 },
  ];
  const target =
    suspect ?? patrol[Math.floor((w.clock - w.started) / 8500) % 4];
  const dx = target.x - w.farmer.x,
    dz = target.z - w.farmer.z,
    len = Math.hypot(dx, dz);
  if (len > (suspect ? 2.2 : 0.4))
    farmMove(w.farmer, { x: dx / len, z: dz / len }, suspect ? 2.8 : 1.5, dt);
  if (
    suspect &&
    len < 3 &&
    w.inspections &&
    w.clock - w.lastInspection > 2200
  ) {
    inspect(w, suspect.id);
    w.aiSuspicion[suspect.id] = 0;
  }
}
export function removeFarmPlayer(w: FarmWorld, id: string) {
  const p = w.players.find((p) => p.id === id),
    cow = w.cows.find((c) => c.id === p?.cowId);
  if (cow) {
    dropItem(w, cow);
    cow.captured = true;
  }
  w.players = w.players.filter((p) => p.id !== id);
  if (w.botBrains) delete w.botBrains[id];
  if (!w.players.some((player) => !player.bot)) {
    w.players = [];
    w.botBrains = {};
    w.farmerId = '';
    w.phase = 'lobby';
    return;
  }
  if (w.phase === 'playing' && id === w.farmerId) {
    w.phase = 'lobby';
    note(w, 'The farmer left. Gather the group and start a new round.');
  } else finish(w);
}
export function farmSnapshot(
  w: FarmWorld,
  code: string,
  host: string,
  id: string,
  version: number,
): FarmSnapshot {
  const p = w.players.find((p) => p.id === id);
  // Explicit whitelist: no random seed, other players' controls, suspicion or cow ownership.
  return {
    code,
    host,
    version,
    you: {
      id,
      role: id === w.farmerId ? 'farmer' : 'cow',
      cowId: p?.cowId ?? null,
      ...(p?.inputSequence !== undefined
        ? { motion: { sequence: p.inputSequence, x: p.input.x, z: p.input.z } }
        : {}),
    },
    world: privateFarmView(w, id),
  };
}
