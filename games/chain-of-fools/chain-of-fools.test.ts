import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BRACE_STAMINA_MAX,
  CHAIN_MAX,
  CHAIN_SLACK,
  CREW_SIZE,
  NO_SUPPORT,
  chainOrder,
  inverseMass,
  type ChainWorld,
  type Player,
} from './types';
import {
  advanceChainOfFools,
  chainOfFoolsAction,
  chainSnapshot,
  crewScore,
  freshChainWorld,
  newPlayer,
  placeAtCheckpoint,
} from './simulation';
import { reconcileChainBots, stepChainBot } from './bots';
import { stepChain, supportUnder } from './physics';
import {
  CHECKPOINTS,
  FINISH_X,
  SURFACES,
  checkpointAt,
  sectionAt,
} from './course';
import { createEngine } from './peer';

function crew(count = CREW_SIZE): ChainWorld {
  const world = freshChainWorld(1_000_000);
  for (let i = 0; i < count; i++) {
    world.players.push(newPlayer(`p${i}`, `Worker ${i}`, i, i, false));
  }
  return world;
}

function playing(count = CREW_SIZE): ChainWorld {
  const world = crew(count);
  chainOfFoolsAction(world, 'p0', { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;
  return world;
}

function run(world: ChainWorld, seconds: number, step = 1 / 60) {
  const ticks = Math.round(seconds / step);
  for (let i = 0; i < ticks; i++) {
    for (const player of world.players) {
      if (player.bot) stepChainBot(player, world, step);
    }
    advanceChainOfFools(world, world.clock + step * 1000, step);
  }
}

function longestLink(world: ChainWorld): number {
  const order = chainOrder(world);
  let longest = 0;
  for (let i = 0; i < order.length - 1; i++) {
    const a = order[i];
    const b = order[i + 1];
    longest = Math.max(longest, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  return longest;
}

void test('the course runs unbroken from the gate to the office', () => {
  assert.ok(SURFACES.length > 10);
  assert.equal(sectionAt(0), 'gate');
  assert.equal(sectionAt(30), 'girders');
  assert.equal(sectionAt(100), 'pipe');
  assert.equal(sectionAt(FINISH_X + 1), 'office');

  // Every checkpoint spawn must be standing on something solid.
  for (const point of CHECKPOINTS) {
    const [x, y, z] = point.spawn;
    const support = supportUnder(x, y + 0.3, z, 0);
    assert.notEqual(support, null, `${point.label} spawn has ground`);
    assert.ok(
      Math.abs((support as number) - y) < 0.35,
      `${point.label} spawn sits on its ground`,
    );
  }

  // Checkpoints only ever move forward.
  for (let i = 1; i < CHECKPOINTS.length; i++) {
    assert.ok(CHECKPOINTS[i].x > CHECKPOINTS[i - 1].x);
  }
  assert.equal(checkpointAt(-100), 0);
  assert.equal(checkpointAt(FINISH_X), CHECKPOINTS.length - 1);
});

void test('the safety line is never stretched past its length', () => {
  const world = playing();
  const order = chainOrder(world);
  // Fling the crew apart hard in every direction at once.
  order[0].vx = 40;
  order[1].vz = -40;
  order[2].vx = -40;
  order[3].vy = 30;

  run(world, 3);
  assert.ok(
    longestLink(world) <= CHAIN_MAX + 0.02,
    `longest link ${longestLink(world)} within ${CHAIN_MAX}`,
  );
});

void test('inverse mass reflects what a stance can resist', () => {
  const world = crew();
  const [braced, standing, falling, limp] = world.players;

  braced.grounded = true;
  braced.braced = true;
  assert.equal(inverseMass(braced), 0, 'a braced worker is an anchor');

  standing.grounded = true;
  standing.braced = false;
  assert.ok(inverseMass(standing) > 0 && inverseMass(standing) < 1);

  falling.grounded = false;
  falling.braced = false;
  assert.equal(inverseMass(falling), 1, 'a falling worker is dead weight');

  limp.state = 'limp';
  limp.grounded = true;
  assert.equal(inverseMass(limp), 1, 'a limp worker is dead weight too');

  // A clipped worker holds like a braced one even without bracing.
  standing.anchorId = 'ring-gap-1';
  assert.equal(inverseMass(standing), 0);
});

void test('two braced workers hold two who have gone over the edge', () => {
  const world = playing();
  const order = chainOrder(world);
  const [a, b, c, d] = order;

  // Front pair planted on the wrecking ledge, back pair off the side of it.
  for (const anchor of [a, b]) {
    anchor.x = anchor === a ? 79.0 : 79.9;
    anchor.y = 8.0;
    anchor.z = 0;
    anchor.grounded = true;
    anchor.braced = true;
    anchor.input.brace = true;
    anchor.stamina = 999;
  }
  c.x = 80.8;
  c.y = 5.0;
  c.z = 3.0;
  c.grounded = false;
  d.x = 81.7;
  d.y = 3.0;
  d.z = 4.5;
  d.grounded = false;

  const startX = a.x;
  const startZ = a.z;
  run(world, 2.5);

  assert.ok(a.grounded, 'the front anchor stayed on their feet');
  assert.ok(
    Math.hypot(a.x - startX, a.z - startZ) < 1.2,
    `the front anchor barely moved (${Math.hypot(a.x - startX, a.z - startZ).toFixed(2)}m)`,
  );
  assert.equal(c.state, 'dangling', 'the pair over the side are on the line');
  assert.equal(d.state, 'dangling');
  assert.ok(longestLink(world) <= CHAIN_MAX + 0.02);
});

void test('one lone anchor is dragged over by three dead weights', () => {
  const world = playing();
  const order = chainOrder(world);
  const [a, b, c, d] = order;

  a.x = 79.0;
  a.y = 8.0;
  a.z = 0;
  a.grounded = true;
  a.braced = false;
  a.input.brace = false;

  const fallers: [number, number, number][] = [
    [80.0, 5.0, 3.5],
    [80.5, 3.5, 4.5],
    [81.0, 2.0, 5.5],
  ];
  [b, c, d].forEach((faller, index) => {
    const [x, y, z] = fallers[index];
    faller.x = x;
    faller.y = y;
    faller.z = z;
    faller.grounded = false;
    faller.vy = -6;
  });

  // Checked before the wipe timer fires and puts the crew back on the ledge.
  run(world, 1.0);
  assert.ok(
    !a.grounded && a.y < 7,
    `the lone worker was pulled off the ledge (y=${a.y.toFixed(2)}, z=${a.z.toFixed(2)})`,
  );
  assert.equal(a.state, 'dangling');
});

void test('bracing costs stamina and gives out once it runs dry', () => {
  const world = playing();
  const me = world.players[0];
  me.input.brace = true;

  run(world, 1);
  assert.ok(me.braced, 'holding at first');
  assert.ok(me.stamina < BRACE_STAMINA_MAX, 'bracing drains stamina');

  // Long past the point the arms give out, even with the key still held.
  run(world, 3);
  assert.equal(me.braced, false, 'an exhausted worker stops holding');
  assert.ok(me.braceCooldown > 0, 'and cannot simply re-plant next tick');
  assert.ok(inverseMass(me) > 0, 'so the line can drag them again');
});

void test('hauling brings a dangling worker back onto the deck', () => {
  const world = playing();
  const order = chainOrder(world);
  const [hauler, , , dangler] = order;

  hauler.x = 80.0;
  hauler.y = 8.0;
  hauler.z = 0;
  hauler.grounded = true;
  hauler.input.haul = true;

  dangler.x = 79.8;
  dangler.y = 5.5;
  dangler.z = 2.2;
  dangler.grounded = false;
  dangler.state = 'dangling';
  dangler.airTime = 1.0;

  // Everyone else stays put on the ledge and out of the way.
  order[1].x = 78.0;
  order[2].x = 78.9;
  for (const other of [order[1], order[2]]) {
    other.y = 8.0;
    other.z = 0;
    other.grounded = true;
  }

  for (let i = 0; i < 300; i++) {
    hauler.input.haul = true;
    advanceChainOfFools(world, world.clock + 16, 1 / 60);
    if ((dangler.state as string) === 'standing') break;
  }

  assert.equal(dangler.state, 'standing', 'the dangler was hauled up');
  assert.ok(dangler.supportY > NO_SUPPORT + 1, 'and has ground under them');
  assert.ok(hauler.hauls > 0, 'the hauler got the credit');
});

void test('a wipe returns the whole crew to the gate even after reaching later sections', () => {
  const world = playing();
  world.checkpoint = 2;
  for (const player of world.players) {
    player.x = 30;
    player.y = -8;
    player.grounded = false;
    player.state = 'dangling';
    player.respawnAt = 0;
  }

  run(world, 2.5);

  assert.ok(world.wipes >= 1, 'the crew wiped');
  const spawn = CHECKPOINTS[0].spawn;
  for (const player of world.players) {
    assert.ok(
      Math.abs(player.x - spawn[0]) < 8,
      'everyone is back at the scaffold foot',
    );
    assert.equal(player.state, 'standing');
  }
});

void test('clipping onto a ring plants a worker as a pivot', () => {
  const world = playing();
  const me = world.players[0];
  me.x = 23.4;
  me.y = 0.1;
  me.z = 0;

  chainOfFoolsAction(world, me.id, { type: 'clip' });
  assert.equal(me.anchorId, 'ring-gap-1');
  assert.equal(inverseMass(me), 0, 'a clipped worker cannot be dragged');

  chainOfFoolsAction(world, me.id, { type: 'clip' });
  assert.equal(me.anchorId, null, 'clipping again unclips');
});

void test('hanging on the wrecking hook stalls the load', () => {
  const world = playing();
  world.pendulumAngle = 0.0;
  world.pendulumVel = 0.9;

  const rider = world.players[0];
  world.pendulumRider = rider.id;

  run(world, 4);
  assert.ok(
    Math.abs(world.pendulumVel) < 0.15,
    `the load was stalled (${world.pendulumVel.toFixed(3)} rad/s)`,
  );
});

void test('the plank tips when the crew bunches on one end', () => {
  const world = playing();
  for (const player of world.players) {
    player.x = 75.4;
    player.y = 8.0;
    player.z = 0;
    player.grounded = true;
  }
  run(world, 1.5);
  assert.ok(
    Math.abs(world.plankTilt) > 0.15,
    `the plank tipped (${world.plankTilt.toFixed(3)} rad)`,
  );
});

void test('a full bot crew gets itself to the site office', () => {
  const world = freshChainWorld(1_000_000);
  reconcileChainBots(world);
  assert.equal(world.players.length, CREW_SIZE);
  assert.ok(world.players.every((p) => p.bot));

  chainOfFoolsAction(world, 'bot-1', { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;

  run(world, 230);

  assert.equal(world.phase, 'ended', 'the round finished');
  assert.equal(
    world.winner,
    'crew',
    `bots reached the office (x=${world.bestX.toFixed(1)})`,
  );
  assert.ok(crewScore(world) > 0);
});

void test('bots keep a human in the crew and never out-walk the line', () => {
  const world = freshChainWorld(1_000_000);
  world.players.push(newPlayer('me', 'Human', 0, 0, false));
  reconcileChainBots(world);

  assert.equal(world.players.length, CREW_SIZE);
  assert.equal(world.players.filter((p) => p.bot).length, CREW_SIZE - 1);
  assert.deepEqual(
    world.players.map((p) => p.link),
    [0, 1, 2, 3],
  );

  chainOfFoolsAction(world, 'me', { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;

  // The human stands still; the bots must not drag them off the start yard.
  const me = world.players[0];
  run(world, 20);

  assert.ok(longestLink(world) <= CHAIN_MAX + 0.02);
  assert.ok(
    me.x < 24,
    `bots waited rather than towing the human away (x=${me.x.toFixed(1)})`,
  );
});

void test('a wandering crew banks checkpoints only once everyone is past', () => {
  const world = playing();
  world.players[0].x = 50;
  world.players[1].x = 48;
  world.players[2].x = 47;
  world.players[3].x = 20;
  for (const player of world.players) {
    player.y = 0.0;
    player.grounded = true;
  }

  run(world, 0.2);
  assert.equal(world.checkpoint, 1, 'the trailing worker sets the checkpoint');
});

void test('the round ends when the horn goes', () => {
  const world = playing();
  world.endsAt = world.clock + 200;
  run(world, 0.5);
  assert.equal(world.phase, 'ended');
  assert.equal(world.winner, 'failed');
});

void test('reaching the office with the whole crew wins the shift', () => {
  const world = playing();
  for (const player of world.players) {
    player.x = FINISH_X + 1;
    player.y = 0;
    player.grounded = true;
  }
  run(world, 0.2);
  assert.equal(world.phase, 'ended');
  assert.equal(world.winner, 'crew');
  assert.ok(crewScore(world) > 0);
});

void test('the chain solver leaves a single worker alone', () => {
  const world = crew(1);
  const events: never[] = [];
  const links = stepChain(world, 1 / 60, events, { current: 0 });
  assert.equal(links.length, 0);
  assert.equal(events.length, 0);
});

void test('link tension reads zero while slack and one at the limit', () => {
  const world = crew(2);
  const [a, b] = chainOrder(world);
  a.x = 0;
  a.y = 0;
  a.z = 0;
  b.x = CHAIN_SLACK - 0.5;
  b.y = 0;
  b.z = 0;
  let links = stepChain(world, 1 / 60, [], { current: 0 });
  assert.equal(links[0].tension, 0);
  assert.equal(links[0].taut, false);

  b.x = CHAIN_MAX + 2;
  a.grounded = true;
  b.grounded = false;
  links = stepChain(world, 1 / 60, [], { current: 0 });
  assert.equal(links[0].taut, true);
  assert.ok(links[0].distance <= CHAIN_MAX + 0.02);
});

void test('the peer engine replays actions once and snapshots the world', () => {
  const engine = createEngine(1_000_000);
  engine.reconcile([
    { id: 'a', name: 'Ana', color: 0 },
    { id: 'b', name: 'Bo', color: 1 },
  ] as never);

  const world = engine.world as unknown as ChainWorld;
  assert.equal(world.players.length, CREW_SIZE);
  assert.equal(world.players.filter((p: Player) => !p.bot).length, 2);

  engine.execute('a', 'act-1', { type: 'start' }, 'a');
  const startedAt = world.startedAt;
  engine.execute('a', 'act-1', { type: 'start' }, 'a');
  assert.equal(world.startedAt, startedAt, 'a repeated action is not replayed');
  assert.equal(world.phase, 'playing');

  engine.input('a', { x: 1, z: 0, jump: true, seq: 1 }, 1);
  engine.advance(32);

  const snapshot = chainSnapshot(world, 'CHAIN1', 'a', 'a', 1);
  assert.equal(snapshot.code, 'CHAIN1');
  assert.equal(snapshot.world.players.length, CREW_SIZE);
  assert.equal(JSON.parse(JSON.stringify(snapshot)).world.phase, 'playing');
});

void test('placing the crew at a checkpoint keeps them inside line reach', () => {
  const world = playing();
  for (let index = 0; index < CHECKPOINTS.length; index++) {
    placeAtCheckpoint(world, index);
    assert.ok(
      longestLink(world) <= CHAIN_MAX,
      `${CHECKPOINTS[index].label} spawns inside line reach`,
    );
    for (const player of world.players) {
      const support = supportUnder(player.x, player.y + 0.3, player.z, 0);
      assert.notEqual(support, null, `${CHECKPOINTS[index].label} has footing`);
    }
  }
});

void test('pushing forward on the cargo net climbs down it', () => {
  const world = playing(1);
  const me = world.players[0];
  me.x = 118.3;
  me.y = 6.0;
  me.z = 0;
  me.grounded = false;
  me.input.x = 1;

  const startY = me.y;
  run(world, 0.5);
  assert.ok(me.y < startY - 1, `climbed down (y ${me.y.toFixed(2)})`);
  assert.ok(me.vy <= 0, 'no gravity-fed fall, just climbing');

  // Letting go of the stick leaves the worker hanging where they are.
  me.input.x = 0;
  const heldY = me.y;
  run(world, 0.5);
  assert.ok(Math.abs(me.y - heldY) < 0.05, 'holding on without input');

  // All the way down, forward walks off onto the pad.
  me.input.x = 1;
  run(world, 3);
  assert.ok(me.grounded, 'standing on the lower pad');
  assert.ok(me.x > 119.5, `walked away from the net (x ${me.x.toFixed(2)})`);
});

void test('the pipe has headroom to walk but not to jump', () => {
  const world = playing(1);
  const me = world.players[0];
  me.x = 100;
  me.y = 8.0;
  me.z = 0;
  me.grounded = true;
  me.input.x = 1;

  run(world, 0.5);
  assert.ok(me.x > 101.5, `walked along the pipe (x ${me.x.toFixed(2)})`);
  assert.ok(Math.abs(me.y - 8.0) < 0.02, 'feet stay on the pipe floor');

  me.input.jump = true;
  let highest = me.y;
  for (let i = 0; i < 30; i++) {
    advanceChainOfFools(world, world.clock + 16, 1 / 60);
    highest = Math.max(highest, me.y);
  }
  assert.ok(
    highest < 8.2,
    `the ceiling stops the jump (peak ${highest.toFixed(2)})`,
  );
});

void test('the human leads the line and the bots follow their route down', () => {
  const world = freshChainWorld(1_000_000);
  world.players.push(newPlayer('me', 'Human', 0, 0, false));
  reconcileChainBots(world);
  chainOfFoolsAction(world, 'me', { type: 'start' });
  for (const player of world.players) player.respawnAt = 0;

  const me = world.players.find((p) => p.id === 'me')!;
  assert.ok(
    world.players.every((p) => p === me || p.x < me.x),
    'the human starts at the front of the line',
  );

  // Choose the narrow side catwalk, then stop before its first turn.
  const step = 1 / 60;
  for (let i = 0; i < 18 * 60; i++) {
    me.input = {
      ...me.input,
      x: me.x < 27 ? 1 : 0,
      z: me.x > 22 ? Math.max(-1, Math.min(1, (-1.9 - me.z) * 2)) : 0,
      jump: false,
    };
    for (const player of world.players)
      if (player.bot) stepChainBot(player, world, step);
    advanceChainOfFools(world, world.clock + step * 1000, step);
  }

  assert.ok(me.y < -2, `the human took the low road (y ${me.y.toFixed(2)})`);
  for (const bot of world.players.filter((p) => p.bot)) {
    assert.ok(
      bot.y < -2 && bot.grounded,
      `${bot.name} followed down onto the catwalk (y ${bot.y.toFixed(2)})`,
    );
    assert.ok(bot.x < me.x, `${bot.name} stayed behind the human`);
  }
  assert.equal(world.wipes, 0);
});
