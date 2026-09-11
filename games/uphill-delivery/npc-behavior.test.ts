import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDelivery,
  deliveryAction,
  deliveryPlayer,
  freshDelivery,
} from './simulation';
import { tickDeliveryNpcs } from './npcs';
import { steerDeliveryNpc, deliveryGripClear } from './navigation';
import { gripPosition } from './physics';
import { SOFA_CENTER, type DeliveryWorld } from './types';
import { Quaternion, Vec3 } from 'cannon-es';
import { deliveryPath, followDeliveryPath } from './npc-path';
import type { DeliveryBrain } from './npc-types';
import { carryDeliveryInput } from './npc-carry';

function crew(humans = 1, bots = 3) {
  const w = freshDelivery(100000);
  w.players = Array.from({ length: humans }, (_, i) =>
    deliveryPlayer(`human-${i}`, `Human ${i}`, i, w.clock),
  );
  for (let i = humans; i < humans + bots; i++)
    deliveryAction(w, 'human-0', { type: 'add-npc', slot: i }, 'human-0');
  deliveryAction(w, 'human-0', { type: 'start' }, 'human-0');
  return w;
}
function tick(w: DeliveryWorld) {
  tickDeliveryNpcs(w, (id, a) => deliveryAction(w, id, a, 'human-0'));
}
function advance(w: DeliveryWorld, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) {
    for (const p of w.players.filter((p) => !p.bot)) p.seen = w.clock;
    advanceDelivery(w, w.clock + 1000 / 60);
  }
}
function placeCargo(w: DeliveryWorld, x: number, y: number, z: number) {
  Object.assign(w.sofa, { x, y: y + SOFA_CENTER, z });
}

void test('NPC teammates obey a human stop and reverse direction without moving bodies directly', () => {
  const w = crew();
  w.players.forEach((p, i) => {
    p.grip = i;
    p.grounded = true;
    p.y = 0;
  });
  const human = w.players[0];
  tick(w);
  for (const p of w.players.filter((p) => p.bot))
    assert.deepEqual([p.input.x, p.input.z], [0, 0]);
  human.input = { x: -0.7, z: 0, jump: false, seq: 1 };
  const before = w.players.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  const sofa = structuredClone(w.sofa);
  tick(w);
  for (const p of w.players.filter((p) => p.bot))
    assert.ok(p.input.x < 0, 'Follow the human back toward the depot');
  assert.deepEqual(
    w.players.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    before,
  );
  assert.deepEqual(
    w.sofa,
    sofa,
    'Planning may not teleport or directly accelerate cargo',
  );
  human.seen = w.clock - 1000;
  tick(w);
  for (const p of w.players.filter((p) => p.bot))
    assert.deepEqual([p.input.x, p.input.z], [0, 0]);
});

void test('opposing human carriers cancel movement and NPC-only abandoned worlds remain idle', () => {
  const w = crew(2, 2);
  w.players.forEach((p, i) => {
    p.grip = i;
    p.grounded = true;
    p.y = 0;
  });
  w.players[0].input.x = 1;
  w.players[1].input.x = -1;
  tick(w);
  for (const p of w.players.filter((p) => p.bot))
    assert.ok(Math.hypot(p.input.x, p.input.z) < 0.05);
  w.players = w.players.filter((p) => p.bot);
  tick(w);
  for (const p of w.players)
    assert.deepEqual([p.input.x, p.input.z, p.input.jump], [0, 0, false]);
});

void test('a free NPC opens each panel once through the normal action and waits for its swing', () => {
  for (const panel of ['gate', 'door'] as const) {
    const w = crew(1, 1),
      npc = w.players[1];
    placeCargo(
      w,
      panel === 'gate' ? -3 : 1,
      panel === 'gate' ? 9 : 22,
      panel === 'gate' ? -1 : -23,
    );
    Object.assign(
      npc,
      panel === 'gate'
        ? { x: 0.1, y: 9.5, z: 0.4 }
        : { x: -0.5, y: 22, z: -21 },
    );
    tick(w);
    assert.ok((panel === 'gate' ? w.gateTarget : w.doorTarget) > 1.5);
    for (let i = 0; i < 80; i++) {
      w.clock += 20;
      tick(w);
    }
    assert.ok(
      (panel === 'gate' ? w.gateTarget : w.doorTarget) > 1.5,
      'Do not toggle a door closed while it opens',
    );
    assert.equal(
      w.events.filter((e) => /opening|OUTWARD/.test(e.text)).length,
      1,
    );
  }
});

void test('NPCs release at a valid delivery location and the ordinary rest check completes the delivery', () => {
  const w = crew();
  placeCargo(w, -6.05, 22.01, -23);
  w.door = w.doorTarget = Math.PI / 2;
  Object.assign(w.players[0], { x: 1, y: 22, z: -23 });
  for (const [i, p] of w.players.filter((p) => p.bot).entries()) {
    const g = gripPosition(w, i);
    Object.assign(p, {
      x: g.x,
      y: 22,
      z: g.z + (i < 2 ? 0.8 : -0.8),
      grounded: true,
    });
    deliveryAction(w, p.id, { type: 'grab' }, 'human-0');
  }
  advance(w, 5);
  assert.equal(w.phase, 'delivered');
  assert.ok(w.players.every((p) => p.grip === null));
});

void test('continuous steep roads do not trigger repeated jumps and a worker can step down off the sofa', () => {
  const w = crew(1, 1),
    p = w.players[1];
  Object.assign(p, { x: 10, y: 3.3, z: 9.92, grounded: true, grip: 1 });
  const input = steerDeliveryNpc(w, p, { x: 10, y: 4, z: 8.5 }, 0.7);
  assert.ok(input.z < 0);
  assert.equal(input.jump, false);
  placeCargo(w, -12, 0, 13);
  Object.assign(p, { x: -12, y: 1.3, z: 14, grip: null, support: 'sofa' });
  const down = steerDeliveryNpc(w, p, { x: -12, y: 0, z: 15.5 }, 0.6);
  assert.ok(down.z > 0);
  assert.equal(down.jump, false);
});

void test('persistent blockage leads to a visible request for help and human input resumes cooperation', () => {
  const w = crew();
  tick(w);
  for (let i = 0; i < 5; i++) {
    w.clock += 11000;
    tick(w);
  }
  assert.ok(
    w.players
      .filter((p) => p.bot)
      .every((p) => p.task === 'Needs a hand: move the sofa'),
  );
  w.players[0].grip = 0;
  w.players[0].seen = w.clock;
  tick(w);
  assert.equal(w.npcTeam?.needsHelp, false);
});

void test('slow analog movement climbs the icy ramp against its downhill pull', () => {
  const w = crew(1, 0),
    p = w.players[0];
  Object.assign(p, { x: -8, y: 16.1, z: -15 });
  for (let i = 0; i < 1800 && p.x < 9.2; i++) {
    p.input = { x: 0.25, z: 0, jump: false, seq: i };
    advance(w, 1 / 60);
  }
  assert.ok(p.x > 9 && p.y > 18.7, `Stopped at ${JSON.stringify(p)}`);
});

void test('a carrier releases before a gap jump and lands using ordinary movement and gravity', () => {
  const w = crew(1, 2),
    p = w.players[1];
  placeCargo(w, 4.4, 12.85, -8);
  const q = new Quaternion().setFromAxisAngle(new Vec3(0, 1, 0), Math.PI);
  w.sofa.quaternion = { x: q.x, y: q.y, z: q.z, w: q.w };
  w.carryYaw = Math.PI;
  Object.assign(p, {
    x: 1.8,
    y: 13.15,
    z: -8.95,
    grounded: true,
    grip: 1,
    velocity: { x: -2.65, y: 0, z: 0 },
  });
  Object.assign(w.players[2], {
    x: 7,
    y: 12.4,
    z: -8.9,
    grip: 0,
    grounded: true,
  });
  tick(w);
  assert.equal(p.grip, null);
  assert.ok(p.input.x < 0, 'Build running speed before take-off');
  advance(w, 2);
  assert.ok(p.x < -1.75 && p.y > 13.4, `Missed landing at ${p.x}, ${p.y}`);
});

void test('the next gap carrier waits until the first jumper has secured another grip', () => {
  const w = crew();
  placeCargo(w, 3.5, 13, -8);
  tick(w);
  const [first, next, rear] = w.players.filter((p) => p.bot);
  Object.assign(first, {
    x: -2.1,
    y: 13.9,
    z: -8.9,
    grip: null,
    grounded: true,
  });
  w.npcBrains![first.id].crossing = { x: -2.1, y: 13.9, z: -8.9 };
  Object.assign(next, { x: 1.8, y: 13.2, z: -7.1, grip: 0, grounded: true });
  Object.assign(rear, { x: 6, y: 12.6, z: -8.9, grip: 3, grounded: true });
  tick(w);
  assert.equal(next.grip, 0);
  assert.equal(w.npcBrains![next.id].crossing, undefined);
});

void test('height-aware return paths walk continuous ramps without jumping at each metre', () => {
  const path = deliveryPath({ x: 10, y: 3, z: 11 }, { x: 10, y: 4, z: 8 });
  assert.ok(path.length > 2);
  assert.ok(path.every((point) => !point.jump));
});

void test('a blocked crew keeps supporting cargo suspended over the gap', () => {
  const w = crew();
  placeCargo(w, 1.7, 13.5, -8);
  Object.assign(w.players[1], { x: 4.3, y: 13, z: -7, grounded: true });
  Object.assign(w.players[2], { x: -1, y: 13.5, z: -9, grounded: true });
  w.players[1].grip = 1;
  w.players[2].grip = 2;
  tick(w);
  w.npcTeam!.needsHelp = true;
  w.npcTeam!.last = { x: w.sofa.x, y: w.sofa.y - SOFA_CENTER, z: w.sofa.z };
  tick(w);
  assert.equal(w.players[1].grip, 1);
  assert.equal(w.players[2].grip, 2);
  assert.equal(w.players[1].task, 'Needs a hand: move the sofa');
});

void test('all six mixed crew sizes carry with human input and honor a human halt', () => {
  for (const [humans, bots] of [
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1],
    [2, 2],
    [3, 1],
  ]) {
    const w = crew(humans, bots);
    for (const p of w.players.filter((p) => !p.bot)) {
      deliveryAction(w, p.id, { type: 'grab' }, 'human-0');
      p.input = { x: 0.55, z: 0, jump: false, seq: 1 };
    }
    const start = w.sofa.x;
    advance(w, 4);
    assert.ok(w.sofa.x > start + 1, `${humans}+${bots} did not carry forward`);
    assert.ok(
      w.players.some((p) => p.bot && p.grip !== null),
      `${humans}+${bots} lost all NPC grips`,
    );
    for (const p of w.players.filter((p) => !p.bot)) p.input.x = 0;
    advance(w, 0.1);
    for (const p of w.players.filter((p) => p.bot && p.grip !== null))
      assert.deepEqual(
        [p.input.x, p.input.z],
        [0, 0],
        `${humans}+${bots} ignored halt`,
      );
  }
});

void test('correcting cargo heading midway along a road does not send the crew back to its previous corner', () => {
  const w = crew();
  placeCargo(w, 3, 12.8, -8);
  const yaw = 0.4;
  w.sofa.quaternion = {
    x: 0,
    y: Math.sin(yaw / 2),
    z: 0,
    w: Math.cos(yaw / 2),
  };
  const sum = { x: 0, z: 0 };
  for (let grip = 0; grip < 4; grip++) {
    const p = w.players[grip];
    const lx = (grip % 2 ? 1 : -1) * 2.56,
      lz = (grip < 2 ? 1 : -1) * 0.945;
    Object.assign(p, {
      grip,
      x: 3 + lx * Math.cos(yaw) + lz * Math.sin(yaw),
      z: -8 - lx * Math.sin(yaw) + lz * Math.cos(yaw),
    });
    const input = carryDeliveryInput(
      w,
      p,
      { x: 10, y: 12, z: -8 },
      { x: -10, y: 15, z: -8 },
      0,
    );
    sum.x += input.x;
    sum.z += input.z;
  }
  assert.ok(
    Math.abs(sum.x) < 0.1 && Math.abs(sum.z) < 0.1,
    `Heading correction translated the crew: ${JSON.stringify(sum)}`,
  );
});

void test('a planned carrying jump keeps its grip while the feet are above the cargo', () => {
  const w = crew(),
    p = w.players[1];
  placeCargo(w, 3.4, 12.8, -8);
  Object.assign(p, { x: 5.8, y: 13.9, z: -7, grip: 1, grounded: false });
  tick(w);
  // Simulate the serialized flight state of a deliberate lift, then replay the
  // observation that previously looked like an accidental fall onto the sofa.
  p.grip = 1;
  w.npcBrains![p.id].jumpUntil = w.clock + 1000;
  tick(w);
  assert.equal(p.grip, 1);
});

void test('a returning worker can step down from the depot and reach cargo on the catchment', () => {
  const w = crew(1, 0),
    p = w.players[0];
  Object.assign(p, { x: -7.5, y: 0, z: 16.3, grounded: true });
  const goal = { x: 2, y: -0.6, z: 18 };
  const b: DeliveryBrain = {
    grip: null,
    actionAt: 0,
    movedAt: w.clock,
    last: { ...p },
    goal: null,
    thinkAt: 0,
  };
  for (let i = 0; i < 600; i++) {
    Object.assign(p.input, followDeliveryPath(w, p, b, goal));
    p.input.seq++;
    advance(w, 1 / 60);
  }
  assert.ok(
    Math.hypot(p.x - goal.x, p.z - goal.z) < 0.6 && p.y < -0.5,
    `Worker stopped at ${p.x}, ${p.y}, ${p.z}`,
  );
});

void test('two rescuers retain reachable end grips when the opposite end hangs outside the road', () => {
  const w = crew();
  placeCargo(w, -13, 7.6, -0.4);
  Object.assign(w.players[1], {
    x: -10.4,
    y: 7.9,
    z: 0.5,
    grip: 1,
    grounded: true,
  });
  Object.assign(w.players[2], {
    x: -10.4,
    y: 7.9,
    z: -1.3,
    grip: 3,
    grounded: true,
  });
  tick(w);
  assert.equal(w.players[1].grip, 1);
  assert.equal(w.players[2].grip, 3);
});

void test('a carrier on the higher bank keeps lifting cargo hanging below the road', () => {
  const w = crew(),
    p = w.players[1];
  placeCargo(w, -0.7, 12.95, -8);
  Object.assign(p, {
    x: -2.9,
    y: 14.1,
    z: -7,
    grip: 0,
    grounded: true,
    support: 'road',
  });
  tick(w);
  assert.equal(
    p.grip,
    0,
    'Standing on the higher bank is not falling onto the sofa',
  );
});

void test('grip visibility uses the real wall thickness and prevents reaching through an open door', () => {
  const w = crew();
  w.door = w.doorTarget = Math.PI / 2;
  assert.equal(
    deliveryGripClear(
      w,
      { x: -0.2, y: 22, z: -25.3 },
      { x: 0.1, y: 23, z: -24 },
    ),
    false,
  );
  assert.equal(
    deliveryGripClear(
      w,
      { x: 1.3, y: 22, z: -25.3 },
      { x: 1.3, y: 23, z: -24 },
    ),
    true,
  );
  assert.equal(
    deliveryGripClear(
      w,
      { x: -5, y: 8.75, z: -2.2 },
      { x: -4, y: 9.8, z: -2.1 },
    ),
    true,
    'An arm beside the alley wall is not a whole walking capsule',
  );
});

void test('a gap jumper who lands on the sofa can jump over its backrest', () => {
  const w = crew(),
    p = w.players[1];
  placeCargo(w, -0.7, 13, -8);
  tick(w);
  Object.assign(p, {
    x: -1,
    y: 15,
    z: -7.3,
    grip: null,
    grounded: true,
    support: 'sofa',
  });
  w.npcBrains![p.id].crossing = { x: -2.1, y: 13.85, z: -7.3 };
  tick(w);
  assert.equal(p.input.jump, true);
  assert.ok(p.input.x < 0);
});

void test('a human turning around the sofa does not also translate the whole NPC crew', () => {
  const w = crew();
  const radial = Math.hypot(1.95, 0.72);
  for (const [i, p] of w.players.entries()) {
    Object.assign(p, {
      grip: i,
      grounded: true,
      y: 0,
      x: w.sofa.x + (i % 2 ? 1 : -1) * 1.95 * (1 + 0.65 / radial),
      z: w.sofa.z + (i < 2 ? 1 : -1) * 0.72 * (1 + 0.65 / radial),
    });
  }
  w.sofa.angular.y = 0.4;
  const human = w.players[0];
  human.input.x = (0.4 * (human.z - w.sofa.z)) / 2.65;
  human.input.z = (-0.4 * (human.x - w.sofa.x)) / 2.65;
  tick(w);
  const sum = w.players.reduce(
    (v, p) => ({ x: v.x + p.input.x, z: v.z + p.input.z }),
    { x: 0, z: 0 },
  );
  assert.ok(
    Math.hypot(sum.x, sum.z) < 0.05,
    `Orbit became translation: ${JSON.stringify(sum)}`,
  );
});

void test('regrouping assigns different corners and preserves them while the crew walks around', () => {
  const w = crew();
  tick(w);
  const bots = w.players.filter((p) => p.bot);
  for (const p of bots) {
    p.grip = p.color;
    p.grounded = true;
  }
  w.clock += 600;
  w.npcTeam!.progressAt = w.clock - 11000;
  tick(w);
  const corners = bots.map((p) => w.npcBrains![p.id].grip);
  assert.deepEqual(corners, [2, 3, 0]);
  assert.ok(bots.every((p) => p.grip === null));
  w.clock += 1000;
  tick(w);
  assert.deepEqual(
    bots.map((p) => w.npcBrains![p.id].grip),
    corners,
  );
});

void test('one NPC can keep bridging when its human partner has jumped to the far bank', () => {
  const w = crew(1, 1),
    human = w.players[0],
    npc = w.players[1];
  placeCargo(w, 2.2, 13, -8);
  Object.assign(human, { x: -2.1, y: 13.9, z: -9, grounded: true });
  Object.assign(npc, { x: 4.8, y: 12.5, z: -7.1, grip: 1, grounded: true });
  tick(w);
  assert.ok(
    npc.input.x < 0,
    'Push the bridge toward the human waiting across the gap',
  );
  assert.equal(npc.grip, 1, 'Keep supporting the bridge');
  w.clock += 1800;
  tick(w);
  assert.equal(
    npc.input.jump,
    true,
    'Lift a blocked bridge toward the partner on the higher bank',
  );
});

void test('a human taking a corner takes priority over an unfinished NPC gap formation', () => {
  const w = crew();
  placeCargo(w, 6, 12.6, -8);
  tick(w);
  assert.equal(w.npcTeam?.gap?.ready, false);
  const human = w.players[0];
  Object.assign(human, { x: 3.5, y: 12.8, z: -7, grip: 0, grounded: true });
  human.input.x = -0.6;
  tick(w);
  assert.equal(w.npcTeam?.gap, undefined);
  assert.ok(
    w.players
      .filter((p) => p.bot)
      .every((p) => p.task !== 'Repositioning for the gap'),
  );
});

void test('a stationary human lift uses ordinary simultaneous jumps without losing NPC grips', () => {
  const w = crew(1, 1);
  const [human, npc] = w.players;
  deliveryAction(w, human.id, { type: 'grab' }, human.id);
  advance(w, 2);
  assert.notEqual(npc.grip, null);
  const feet = [human.y, npc.y];
  human.input = { x: 0, z: 0, jump: true, seq: human.lastJump + 1 };
  advance(w, 0.15);
  for (const [i, p] of w.players.entries()) {
    assert.ok(p.y > feet[i] + 0.3, `${p.name} did not join the lift`);
    assert.notEqual(p.grip, null, `${p.name} released during the lift`);
  }
  advance(w, 1.5);
  tick(w);
  assert.equal(npc.input.jump, false, 'A consumed human jump is not replayed');
  human.seen = w.clock - 1000;
  human.input.seq++;
  human.grounded = npc.grounded = true;
  tick(w);
  assert.equal(npc.input.jump, false, 'Do not follow stale jump packets');
});

void test('a human halt prevents a gap release and pauses a jumper still on the near bank', () => {
  const w = crew(1, 1);
  placeCargo(w, 4.4, 12.85, -8);
  const [human, npc] = w.players;
  Object.assign(human, { x: 7, y: 12.4, z: -8.9, grip: 1, grounded: true });
  Object.assign(npc, { x: 1.8, y: 13.15, z: -8.95, grip: 0, grounded: true });
  tick(w);
  assert.equal(npc.grip, 0, 'Keep supporting a stopped human at the edge');
  assert.equal(w.npcBrains![npc.id].crossing, undefined);
  npc.grip = null;
  w.npcBrains![npc.id].crossing = { x: -2.1, y: 13.85, z: -8.95 };
  tick(w);
  assert.deepEqual([npc.input.x, npc.input.z, npc.input.jump], [0, 0, false]);
  npc.grounded = false;
  npc.x = 0.5;
  tick(w);
  assert.ok(
    npc.input.x < 0,
    'Finish an airborne crossing to reach safe ground',
  );
});

void test('a human can choose a valid placement away from the autonomous target', () => {
  const w = crew(1, 1);
  placeCargo(w, -6.05, 22.01, -21.5);
  w.door = w.doorTarget = Math.PI / 2;
  for (const [i, p] of w.players.entries()) {
    const g = gripPosition(w, i);
    Object.assign(p, { x: g.x, y: 22, z: g.z + 0.8, grounded: true });
    deliveryAction(w, p.id, { type: 'grab' }, 'human-0');
  }
  tick(w);
  assert.equal(w.players[1].grip, null, 'Accept the whole valid room');
  assert.notEqual(
    w.players[0].grip,
    null,
    'Only the human releases their own grip',
  );
  deliveryAction(w, 'human-0', { type: 'release' }, 'human-0');
  advance(w, 5);
  assert.equal(w.phase, 'delivered');
});

void test('cargo sliding out of the delivery area is picked up again after settling', () => {
  const w = crew(1, 1);
  placeCargo(w, -6.8, 22.01, -23);
  w.door = w.doorTarget = Math.PI / 2;
  Object.assign(w.players[0], { x: 1, y: 22, z: -23 });
  tick(w);
  w.npcTeam!.delivering = true;
  w.npcTeam!.deliveringAt = w.clock - 2000;
  tick(w);
  assert.equal(w.npcTeam!.delivering, false);
  assert.notEqual(w.players[1].task, 'Putting the sofa down');
});

void test('a requested turn is shared before cargo angular velocity has caught up', () => {
  const w = crew();
  const radial = Math.hypot(1.95, 0.72);
  for (const [i, p] of w.players.entries()) {
    Object.assign(p, {
      grip: i,
      grounded: true,
      y: 0,
      x: w.sofa.x + (i % 2 ? 1 : -1) * 1.95 * (1 + 0.65 / radial),
      z: w.sofa.z + (i < 2 ? 1 : -1) * 0.72 * (1 + 0.65 / radial),
    });
  }
  w.carryYaw = Math.PI / 2;
  const human = w.players[0];
  human.input.x = (0.85 * (human.z - w.sofa.z)) / 2.65;
  human.input.z = (-0.85 * (human.x - w.sofa.x)) / 2.65;
  tick(w);
  const sum = w.players.reduce(
    (v, p) => ({ x: v.x + p.input.x, z: v.z + p.input.z }),
    { x: 0, z: 0 },
  );
  assert.ok(
    Math.hypot(sum.x, sum.z) < 0.05,
    `Turn onset translated the crew: ${JSON.stringify(sum)}`,
  );
  assert.ok(
    w.players[1].input.z < 0,
    'The opposite end walks the opposite arc',
  );
});

void test('a panel helper uses a reachable handle when the crew blocks its preferred standing point', () => {
  const w = crew(2, 2);
  placeCargo(w, -2, 9.8, -1);
  Object.assign(w.players[2], { x: 0, y: 9.5, z: -2.6, grounded: true });
  tick(w);
  assert.equal(w.npcTeam!.helper, w.players[2].id);
  assert.equal(w.gateTarget, 0, 'First try the preferred approach');
  w.clock += 1600;
  tick(w);
  assert.ok(
    w.gateTarget > 1.5,
    'The normal interaction is already reachable on the safe side',
  );
  w.clock += 1000;
  tick(w);
  assert.ok(w.gateTarget > 1.5, 'Do not toggle again while the gate swings');
});

void test('mixed crews complete a human-requested quarter turn with real carrying physics', () => {
  for (const [humans, bots] of [
    [1, 1],
    [1, 3],
    [2, 2],
  ]) {
    const w = crew(humans, bots);
    for (const p of w.players.filter((p) => !p.bot))
      deliveryAction(w, p.id, { type: 'grab' }, 'human-0');
    advance(w, 2);
    const start = { x: w.sofa.x, z: w.sofa.z };
    deliveryAction(w, 'human-0', { type: 'rotate' }, 'human-0');
    let error = Math.PI / 2;
    for (let frame = 0; frame < 600; frame++) {
      const q = w.sofa.quaternion;
      const yaw = Math.atan2(
        2 * (q.w * q.y + q.x * q.z),
        1 - 2 * (q.y * q.y + q.z * q.z),
      );
      error = Math.atan2(
        Math.sin(w.carryYaw - yaw),
        Math.cos(w.carryYaw - yaw),
      );
      const omega =
        Math.abs(error) > 0.18
          ? Math.max(-0.85, Math.min(0.85, error * 1.3))
          : w.sofa.angular.y;
      for (const p of w.players.filter((p) => !p.bot)) {
        p.input = {
          x: (omega * (p.z - w.sofa.z)) / 2.65,
          z: (-omega * (p.x - w.sofa.x)) / 2.65,
          jump: false,
          seq: frame + 1,
        };
      }
      advance(w, 1 / 60);
      if (Math.abs(error) < 0.15) break;
    }
    assert.ok(
      Math.abs(error) < 0.2,
      `${humans}+${bots} did not complete the turn: ${error}`,
    );
    assert.ok(
      Math.hypot(w.sofa.x - start.x, w.sofa.z - start.z) < 1.5,
      'A turn should not drag the cargo out of the depot',
    );
    assert.ok(w.players.some((p) => p.bot && p.grip !== null));
  }
});

void test('a two-person crew balances the sofa across diagonally opposite corners', () => {
  const w = crew(1, 1);
  deliveryAction(w, 'human-0', { type: 'grab' }, 'human-0');
  advance(w, 4);
  assert.equal(
    w.players[1].grip,
    w.players[0].grip! ^ 3,
    'Two workers on the same long side twist the load instead of balancing it',
  );
});

void test('backtracking with a human resets the route before the NPCs take over again', () => {
  const w = crew(1, 1);
  placeCargo(w, -10, 7, 6);
  tick(w);
  assert.equal(w.npcTeam!.stage, 3);
  placeCargo(w, 0, 5.5, 6);
  Object.assign(w.players[0], { x: -2.5, y: 5.9, z: 7, grip: 0 });
  tick(w);
  assert.equal(w.npcTeam!.stage, 2);
  assert.deepEqual(w.npcTeam!.goal, { x: -10, y: 7, z: 6 });
});

void test('NPCs recognize the gap after human carriers bypass an earlier waypoint', () => {
  const w = crew(1, 1);
  tick(w);
  assert.equal(w.npcTeam!.stage, 0);
  placeCargo(w, 4, 12.9, -8);
  const [human, npc] = w.players;
  Object.assign(human, { x: 6.5, y: 12.5, z: -9, grip: 1, grounded: true });
  Object.assign(npc, { x: 2.1, y: 13.2, z: -7.1, grip: 0, grounded: true });
  w.clock += 1000;
  human.seen = w.clock;
  human.input.x = -0.6;
  tick(w);
  assert.equal(w.npcTeam!.stage, 6);
  assert.equal(npc.grip, null, 'Use the ordinary gap release at the near bank');
  assert.ok(w.npcBrains![npc.id].crossing);
  assert.equal(npc.task, 'Crossing the gap');
});

void test('human-led route progress is not inferred from cargo floating above a lower road', () => {
  const w = crew(1, 1);
  tick(w);
  placeCargo(w, 0, 9, 6);
  Object.assign(w.players[0], { x: -2.5, y: 9, z: 7, grip: 0 });
  tick(w);
  assert.equal(
    w.npcTeam!.stage,
    0,
    'Wait until the cargo is on a route surface',
  );
});

void test('a gap crossing is abandoned when the cargo falls to a lower route', () => {
  const w = crew(1, 1);
  placeCargo(w, 4, 12.9, -8);
  const [human, npc] = w.players;
  Object.assign(human, { x: 6.5, y: 12.5, z: -9, grip: 1, grounded: true });
  Object.assign(npc, { x: 2.1, y: 13.2, z: -7.1, grip: 0, grounded: true });
  human.input.x = -0.6;
  tick(w);
  assert.ok(w.npcBrains![npc.id].crossing);
  placeCargo(w, -12, -0.6, 18);
  Object.assign(human, { x: -14.5, y: -0.6, z: 19 });
  w.clock += 1000;
  human.seen = w.clock;
  tick(w);
  assert.equal(w.npcBrains![npc.id].crossing, undefined);
  assert.ok(
    w.npcBrains![npc.id].path?.length,
    'Plan the return to the fallen cargo',
  );
  assert.notEqual(npc.task, 'Crossing the gap');
  assert.notEqual(npc.task, 'Waiting across the gap');
});

void test('a two-person gap jumper can secure a reachable front corner before the rear crosses', () => {
  const w = crew(1, 1);
  placeCargo(w, 0.2, 13.5, -8);
  const [human, npc] = w.players;
  Object.assign(human, { x: -2.3, y: 13.9, z: -7, grip: 0, grounded: true });
  human.input.x = -0.6;
  tick(w);
  Object.assign(npc, { x: -2.1, y: 13.9, z: -8.9, grip: null, grounded: true });
  w.npcBrains![npc.id].crossing = { x: -2.1, y: 13.9, z: -8.9 };
  tick(w);
  assert.equal(w.npcBrains![npc.id].crossing, undefined);
  assert.equal(npc.grip, 2, 'Hold the reachable corner on the higher bank');
  tick(w);
  assert.ok(
    npc.input.x < 0,
    'Pull with the human instead of seeking a corner on the other bank',
  );
});

void test('a pair gives up an unreachable diagonal and retains another reachable grip', () => {
  const w = crew(1, 1);
  placeCargo(w, 8.96, 20.09, -23.69);
  const yaw = 2.65;
  w.sofa.quaternion = {
    x: 0,
    y: Math.sin(yaw / 2),
    z: 0,
    w: Math.cos(yaw / 2),
  };
  w.carryYaw = Math.PI;
  const [human, npc] = w.players;
  Object.assign(human, { x: 10.77, y: 20, z: -21.6, grip: 2, grounded: true });
  Object.assign(npc, { x: 11.47, y: 20, z: -22.19, grounded: true });
  tick(w);
  assert.equal(npc.grip, null, 'Initially try the balanced diagonal');
  w.clock += 6100;
  human.seen = w.clock;
  tick(w);
  assert.equal(
    npc.grip,
    0,
    'Use the reachable corner after the approach times out',
  );
  w.clock += 600;
  human.seen = w.clock;
  tick(w);
  assert.equal(
    npc.grip,
    0,
    'Keep a useful grip instead of repeating the failed approach',
  );
  deliveryAction(w, human.id, { type: 'release' }, human.id);
  w.clock += 700;
  human.seen = w.clock;
  tick(w);
  deliveryAction(w, human.id, { type: 'grab' }, human.id);
  assert.equal(human.grip, 2, 'The human returns to the same corner');
  w.clock += 700;
  human.seen = w.clock;
  tick(w);
  assert.equal(
    npc.grip,
    0,
    'Brief human regripping must not restart a failed diagonal approach',
  );
});
