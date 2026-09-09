import test from 'node:test';
import assert from 'node:assert/strict';
import { SitePhysics } from './physics';
import {
  applyAction,
  freshWorld,
  SAYINGS,
  tickWorld,
  type Piece,
  type Player,
} from './model';
import { findPath, inReach } from './colliders';

const player = (x = 0, z = 2): Player => ({
  id: 'p',
  name: 'Meister',
  color: 0,
  x,
  z,
  y: 0.43,
  angle: Math.PI,
  seen: 1000,
});
function simulate(items: Piece[], p = player()) {
  const physics = new SitePhysics();
  physics.sync(items, [p], p.id);
  return physics;
}
const solid = (kind: Piece['kind'] = 'table'): Piece => ({
  id: 'obstacle',
  kind,
  x: 0,
  z: 0,
  rotation: 0,
  placed: true,
});

void test('walking collides with walls, tables, the office and crane instead of phasing through', () => {
  for (const fixture of [
    {
      items: [solid('wall')],
      p: player(),
      vx: 0,
      vz: -4,
      axis: 'z',
      limit: 0.5,
    },
    {
      items: [solid('table')],
      p: player(),
      vx: 0,
      vz: -4,
      axis: 'z',
      limit: 0.9,
    },
    { items: [], p: player(-5, -6.6), vx: -4, vz: 0, axis: 'x', limit: -5.72 },
  ] as const) {
    const sim = simulate([...fixture.items], fixture.p);
    for (let i = 0; i < 150; i++) {
      sim.move('p', fixture.vx, fixture.vz);
      sim.step(1 / 60);
    }
    const pos = sim.playerPosition('p')!;
    assert.ok(
      pos[fixture.axis] > fixture.limit,
      `${fixture.axis}: ${JSON.stringify(pos)}`,
    );
  }
  const crane = simulate([], player(4, -6));
  for (let i = 0; i < 120; i++) {
    crane.move('p', 4, 0);
    crane.step(1 / 60);
  }
  assert.ok(crane.playerPosition('p')!.x < 6.25);
});

void test('a loose cone receives momentum and falls rather than being walked through', () => {
  const cone = { ...solid('cone'), placed: false };
  const sim = simulate([cone]);
  for (let i = 0; i < 70; i++) {
    sim.move('p', 0, -3);
    sim.step(1 / 60);
  }
  const pose = sim.pose(cone.id)!;
  assert.ok(Math.hypot(pose.x, pose.z) > 0.3, JSON.stringify(pose));
});

void test('jump uses gravity, requires ground contact and lands on the foundation', () => {
  const sim = simulate([]);
  for (let i = 0; i < 90; i++) sim.step(1 / 60);
  assert.equal(sim.jump('p'), true);
  sim.step(1 / 60);
  assert.equal(sim.jump('p'), false);
  let high = 0;
  for (let i = 0; i < 150; i++) {
    sim.step(1 / 60);
    high = Math.max(high, sim.playerPosition('p')!.y);
  }
  assert.ok(high > 1.35, `peak=${high}`);
  assert.ok(Math.abs(sim.playerPosition('p')!.y - 0.43) < 0.08);
});

void test('a carried wide object has collision geometry attached to its carrier', () => {
  const p = player(0, 2);
  const sim = simulate(
    [
      { ...solid('sofa'), id: 'carry', heldBy: p.id, placed: false },
      solid('wall'),
    ],
    p,
  );
  assert.ok(sim.players.get(p.id)!.shapes.length > 3);
  for (let i = 0; i < 90; i++) {
    sim.move(p.id, 0, -3);
    sim.step(1 / 60);
  }
  assert.ok(sim.playerPosition(p.id)!.z > 0.65);
});

void test('a thrown object collides with the crane and its saved state continues under gravity', () => {
  const w = freshWorld('sandbox', 1000);
  const p = { ...player(4, -6), angle: Math.PI / 2 };
  w.pieces = [
    {
      id: 'throw',
      kind: 'bone',
      x: p.x,
      z: p.z,
      rotation: 0,
      heldBy: p.id,
      placed: false,
    },
  ];
  applyAction(w, { type: 'throw' }, p, [p], p.id, 1000);
  let maxX = 0;
  for (let t = 1050; t <= 3000; t += 50) {
    tickWorld(w, [p], t);
    maxX = Math.max(maxX, w.pieces[0].x);
  }
  assert.ok(maxX < 7, `passed crane: ${maxX}`);
  assert.ok(w.pieces[0].physics);
  assert.equal(w.pieces[0].flight, undefined);
  const restored = JSON.parse(JSON.stringify(w));
  tickWorld(restored, [p], 3050);
  assert.ok(Number.isFinite(restored.pieces[0].physics.y));
});

void test('navigation goes around a wall and work cannot reach through it', () => {
  const w = freshWorld('sandbox', 1000);
  w.pieces = [solid('wall')];
  assert.equal(inReach(w, { x: 0, z: 1 }, { x: 0, z: -1 }), false);
  const path = findPath(w, { x: 0, z: 2 }, { x: 0, z: -2 });
  assert.ok(path);
  assert.ok(path.some((p) => Math.abs(p.x) > 1.3));
});

void test('physical player impacts produce bonks, while an intervening wall stops the projectile', () => {
  for (const barrier of [false, true]) {
    const p = { ...player(0, 2), angle: Math.PI / 2 };
    const other = { ...player(7, 2), id: 'friend', name: 'Kollege', y: 0.18 };
    const w = freshWorld('sandbox', 1000);
    w.pieces = [
      {
        id: 'projectile',
        kind: 'bone',
        x: 0,
        z: 2,
        rotation: 0,
        placed: false,
        heldBy: p.id,
      },
    ];
    if (barrier) w.pieces.push({ ...solid('wall'), x: 6, z: 2, rotation: 1 });
    applyAction(w, { type: 'throw' }, p, [p, other], p.id, 1000);
    for (let t = 1025; t <= 2500; t += 25) tickWorld(w, [p, other], t);
    assert.equal(
      w.bonks,
      barrier ? 0 : 1,
      `barrier=${barrier}, bone=${JSON.stringify(w.pieces[0])}`,
    );
  }
});

void test('remote construction/removal is rejected and speech varies without consecutive repetition', () => {
  const w = freshWorld('sandbox', 1000);
  w.pieces = [solid('table')];
  const p = player(0, 6);
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'floor', x: 0, z: 0, rotation: 0 },
        p,
        [p],
        p.id,
        1000,
      ),
    /reach/,
  );
  assert.throws(
    () =>
      applyAction(w, { type: 'remove', id: 'obstacle' }, p, [p], p.id, 1000),
    /reach/,
  );
  const lines = [];
  for (let i = 0; i < SAYINGS.length; i++) {
    applyAction(w, { type: 'emote' }, p, [p], p.id, 1000 + i);
    lines.push(w.events.at(-1)!.speech);
  }
  assert.equal(new Set(lines).size, SAYINGS.length);
});

void test('upgrading a saved room preserves construction and adds interactive scenery only once', () => {
  const w = freshWorld('sandbox', 1000);
  w.pieces = [solid('wall')];
  delete w.physicalVersion;
  tickWorld(w, [], 1000);
  const count = w.pieces.length;
  tickWorld(w, [], 1000);
  assert.equal(w.pieces.length, count);
  assert.equal(w.pieces[0].id, 'obstacle');
  assert.ok(w.pieces.some((p) => p.kind === 'workbench'));
  assert.ok(w.pieces.some((p) => p.kind === 'cone'));
});

void test('carried furniture can move beneath a completed roof without losing wall collisions', () => {
  const p = player(0, 2.5);
  const sim = simulate(
    [
      { ...solid('sofa'), id: 'carry', heldBy: p.id, placed: false },
      solid('roof'),
    ],
    p,
  );
  for (let i = 0; i < 90; i++) {
    sim.move(p.id, 0, -3);
    sim.step(1 / 60);
  }
  assert.ok(
    sim.playerPosition(p.id)!.z < -0.8,
    JSON.stringify(sim.playerPosition(p.id)),
  );
  const roof = sim.pieces.get('obstacle')!.body.shapes[0];
  assert.equal(roof.collisionFilterGroup, 4);
  assert.notEqual(sim.players.get(p.id)!.shapes[0].collisionFilterMask & 4, 0);
});

void test('Medium physics lets a player walk past the Small boundary and stops at its own boundary', () => {
  const simulation = new SitePhysics('medium');
  const player = {
    id: 'medium-walker',
    name: 'Walker',
    color: 0,
    x: 10,
    z: 0,
    y: 0.18,
    angle: Math.PI / 2,
    seen: 0,
  };
  simulation.sync([], [player], player.id);
  for (let i = 0; i < 90; i++) {
    simulation.move(player.id, 4.3, 0);
    simulation.step(1 / 60);
  }
  assert.ok(simulation.playerPosition(player.id)!.x > 13);
  for (let i = 0; i < 120; i++) {
    simulation.move(player.id, 4.3, 0);
    simulation.step(1 / 60);
  }
  assert.ok(simulation.playerPosition(player.id)!.x < 11.1 * Math.SQRT2);
});

void test('Large physics allows travel beyond Medium and contains players along the outer corners', () => {
  for (const [x, z, dx, dz] of [
    [16, 0, 4.3, 0],
    [21, 15, 0, 4.3],
    [-21, 15, 0, 4.3],
  ]) {
    const simulation = new SitePhysics('large');
    const p = {
      id: 'large-walker',
      name: 'Walker',
      color: 0,
      x,
      z,
      y: 0.18,
      angle: 0,
      seen: 0,
    };
    simulation.sync([], [p], p.id);
    for (let i = 0; i < 240; i++) {
      simulation.move(p.id, dx, dz);
      simulation.step(1 / 60);
    }
    const position = simulation.playerPosition(p.id)!;
    if (dx) assert.ok(position.x > 18, JSON.stringify(position));
    assert.ok(Math.abs(position.x) < 22.2, JSON.stringify(position));
    assert.ok(position.z < 17.3, JSON.stringify(position));
  }
});
