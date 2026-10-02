import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {
  advanceZorbClash,
  freshZorbWorld,
  newZorbPlayer,
  restartZorbMatch,
} from './simulation';
import { ZorbClashPhysics } from './physics';
import { createEngine } from './peer';
import { createZorbAvatar, poseZorbWorker } from './avatar';
import { movement, cameraTarget } from './controls';
import { BALL_RADIUS, GOAL_HEIGHT, PITCH_WIDTH, ZORB_RADIUS } from './types';

const tick = (physics: ZorbClashPhysics, count = 60, dt = 1 / 60) => {
  for (let i = 0; i < count; i++) physics.step(dt);
};
function setup() {
  const world = freshZorbWorld(1000);
  const player = newZorbPlayer('p', 'Player', 0, 'red');
  world.players.push(player);
  const physics = new ZorbClashPhysics(world);
  const body = physics.playerBodies.get('p')!;
  return { world, player, physics, body };
}

void test('world orientation of the upright worker is independent of a rolling shell', () => {
  const rig = createZorbAvatar('red', 0);
  for (let angle = 0; angle <= Math.PI * 4; angle += 0.2) {
    rig.shell.rotation.set(angle, angle / 2, angle / 3);
    poseZorbWorker(rig, angle, {
      speed: 6,
      turtle: false,
      braced: false,
      dashCharge: 0,
      dashing: false,
      heading: 0.7,
      gait: angle,
    });
    rig.root.updateMatrixWorld(true);
    const up = new T.Vector3(0, 1, 0).applyQuaternion(
      rig.workerGroup.getWorldQuaternion(new T.Quaternion()),
    );
    assert.ok(up.y > 0.999);
    assert.equal(rig.shadow!.parent, rig.root);
  }
});

void test('an inverted shell does not knock down an upright human', () => {
  const { physics, body, player } = setup();
  body.position.y = ZORB_RADIUS;
  body.quaternion.set(1, 0, 0, 0);
  tick(physics, 120);
  assert.equal(player.turtle, false);
});

void test('identical inputs away from obstacles are independent of world position', () => {
  const sample = (x: number) => {
    const { physics, body, player } = setup();
    body.position.set(x, ZORB_RADIUS, -16);
    tick(physics, 30);
    player.input.z = 1;
    tick(physics, 30);
    return { v: body.velocity.toArray(), w: body.angularVelocity.toArray() };
  };
  const a = sample(-5),
    b = sample(5);
  a.v.forEach((v, i) => assert.ok(Math.abs(v - b.v[i]) < 1e-5));
  a.w.forEach((v, i) => assert.ok(Math.abs(v - b.w[i]) < 1e-5));
});

void test('one contact produces one bonk and cannot multiply incoming speed', () => {
  const { world, physics, body, player } = setup();
  const other = newZorbPlayer('q', 'Other', 1, 'blue');
  world.players.push(other);
  physics.syncPlayers(world.players);
  const b = physics.playerBodies.get('q')!;
  body.position.set(-1.21, ZORB_RADIUS, 0);
  b.position.set(1.21, ZORB_RADIUS, 0);
  body.velocity.x = 5;
  b.velocity.x = -5;
  physics.ballBody.position.set(0, BALL_RADIUS, 15);
  let count = 0;
  for (let i = 0; i < 5; i++) {
    physics.step(1 / 60);
    count += physics.impacts.filter((e) => e.type === 'zorb_zorb').length;
  }
  assert.equal(count, 1);
  assert.ok(body.velocity.length() < 8 && b.velocity.length() < 8);
  assert.equal(player.turtle, true);
  assert.equal(other.turtle, true);
});

void test('downed players receive no running force or dash and cannot recover in midair', () => {
  const run = (input: boolean) => {
    const { physics, body, player } = setup();
    body.position.set(0, 5, 0);
    player.turtle = true;
    player.posture = 'fallen';
    player.turtleTimer = 0.1;
    player.input = { x: input ? 1 : 0, z: 0, dash: input, brace: input };
    tick(physics, 12);
    assert.equal(player.turtle, true);
    assert.equal(player.dashCharge, 0);
    assert.equal(player.braced, false);
    return body.position.x;
  };
  assert.equal(run(true), run(false));
});

void test('holding a direction accelerates grounded recovery with a distinct getting-up phase', () => {
  const { physics, body, player } = setup();
  body.position.set(-5, ZORB_RADIUS, -15);
  player.turtle = true;
  player.posture = 'fallen';
  player.turtleTimer = 3.5;
  player.input.z = 1;
  tick(physics, 75);
  assert.equal(player.posture, 'recovering');
  assert.equal(player.turtle, true);
  assert.ok(
    Math.abs(body.position.z + 15) < 0.01,
    'no running while recovering',
  );
  tick(physics, 45);
  assert.equal(player.turtle, false);
  assert.equal(player.posture, 'upright');
  assert.ok(
    body.position.y < ZORB_RADIUS + 0.05,
    'no vertical pop on recovery',
  );
});

void test('outside and invalid bodies return to finite, unoccupied field positions', () => {
  const { physics, body, player } = setup();
  body.position.set(35, ZORB_RADIUS, 0);
  body.velocity.set(50, 0, 0);
  player.turtle = true;
  physics.ballBody.position.set(-40, BALL_RADIUS, 0);
  physics.step(1 / 60);
  assert.ok(Math.abs(body.position.x) < PITCH_WIDTH / 2);
  assert.equal(player.turtle, false);
  assert.ok(body.velocity.length() < 1);
  assert.equal(physics.ballBody.position.x, 0);
  body.position.x = NaN;
  physics.step(1 / 60);
  assert.ok(Number.isFinite(body.position.x));
});

void test('continuous side walls retain balls at the old center gap and corners', () => {
  for (const z of [0, 24, -24])
    for (const side of [-1, 1]) {
      const { physics, body } = setup();
      body.position.set(side * 12, ZORB_RADIUS, z);
      body.velocity.x = side * 16;
      physics.ballBody.position.set(side * 12, BALL_RADIUS, z + 2.5);
      physics.ballBody.velocity.x = side * 24;
      tick(physics, 100);
      assert.ok(Math.abs(body.position.x) < PITCH_WIDTH / 2);
      assert.ok(Math.abs(physics.ballBody.position.x) < PITCH_WIDTH / 2);
    }
});

void test('all player postures inside either goal leave the score unchanged', () => {
  for (const posture of [
    'upright',
    'unstable',
    'fallen',
    'recovering',
  ] as const)
    for (const sign of [-1, 1]) {
      const { world, physics, body, player } = setup();
      player.posture = posture;
      player.turtle = posture === 'fallen' || posture === 'recovering';
      player.turtleTimer = 3.5;
      body.position.set(0, ZORB_RADIUS, sign * 28.5);
      advanceZorbClash(world, physics, 1 / 60);
      assert.deepEqual(world.score, { red: 0, blue: 0 });
    }
});

void test('stationary invalid goal positions never score', () => {
  for (const [x, y, z] of [
    [0, BALL_RADIUS, 27.01],
    [0, 3.6, 28.5],
    [3.9, BALL_RADIUS, 28.5],
    [0, -2, 28.5],
    [0, BALL_RADIUS, 29],
  ]) {
    const { physics } = setup();
    physics.ballBody.position.set(x, y, z);
    physics.step(1 / 60);
    assert.equal(physics.checkGoal(), null);
  }
});

void test('a goal requires the entire ball to cross and fires once for either team', () => {
  for (const sign of [-1, 1]) {
    const world = freshZorbWorld(1000),
      physics = new ZorbClashPhysics(world);
    physics.ballBody.position.set(
      0,
      BALL_RADIUS,
      sign * (27 - BALL_RADIUS - 0.15),
    );
    physics.ballBody.velocity.z = sign * 12;
    for (let i = 0; i < 90; i++) {
      advanceZorbClash(world, physics, 1 / 60);
      if (Math.abs(world.ball.z) < 27 + BALL_RADIUS)
        assert.deepEqual(world.score, { red: 0, blue: 0 });
      if (world.status === 'goal_scored') break;
    }
    assert.equal(world.score[sign === 1 ? 'red' : 'blue'], 1);
    for (let i = 0; i < 100; i++) advanceZorbClash(world, physics, 1 / 60);
    assert.equal(world.score[sign === 1 ? 'red' : 'blue'], 1);
  }
});

void test('shots above, beside or backwards through the goal do not count', () => {
  for (const [x, y, z, vz] of [
    [0, GOAL_HEIGHT + 1, 24, 16],
    [4.2, BALL_RADIUS, 24, 16],
    [0, BALL_RADIUS, 29, -12],
  ]) {
    const world = freshZorbWorld(1000),
      physics = new ZorbClashPhysics(world);
    physics.ballBody.position.set(x, y, z);
    physics.ballBody.velocity.z = vz;
    for (let i = 0; i < 30; i++) advanceZorbClash(world, physics, 1 / 60);
    assert.deepEqual(world.score, { red: 0, blue: 0 });
  }
});

void test('slow ball contacts update attribution; kickoff clears it', () => {
  const { world, physics, body } = setup();
  body.position.set(0, ZORB_RADIUS, 0);
  physics.ballBody.position.set(
    0,
    BALL_RADIUS,
    ZORB_RADIUS + BALL_RADIUS - 0.02,
  );
  physics.step(1 / 60);
  assert.equal(world.ball.lastTouchPlayerId, 'p');
  physics.resetBall();
  assert.equal(world.ball.lastTouchPlayerId, null);
  assert.equal(world.ball.lastTouchTeam, null);
});

void test('own goals score for the opponent without inflating individual goals', () => {
  const { world, physics, body, player } = setup();
  body.position.set(8, ZORB_RADIUS, 0);
  world.ball.lastTouchPlayerId = player.id;
  world.ball.lastTouchTeam = player.team;
  physics.ballBody.position.set(0, BALL_RADIUS, -(27 - BALL_RADIUS - 0.15));
  physics.ballBody.velocity.z = -12;
  for (let i = 0; i < 30; i++) advanceZorbClash(world, physics, 1 / 60);
  assert.equal(world.score.blue, 1);
  assert.equal(world.lastGoal?.ownGoal, true);
  assert.equal(player.goals, 0);
});

void test('fixed physics stepping gives the same motion at 30, 60 and 120 Hz', () => {
  const run = (hz: number) => {
    const { physics, body, player } = setup();
    tick(physics, 30);
    player.input.z = 1;
    tick(physics, hz, hz ** -1);
    return body.position.toArray();
  };
  const baseline = run(60);
  for (const hz of [30, 120])
    run(hz).forEach((p, i) => assert.ok(Math.abs(p - baseline[i]) < 1e-6));
});

void test('peer engine advances milliseconds consistently and idles stale input', () => {
  const engine = createEngine(1000);
  engine.reconcile([
    {
      id: 'human',
      name: 'Human',
      color: 0,
      order: 0,
      instance: 'i',
      seen: 1000,
    },
  ]);
  engine.input('human', { x: 1, z: 0 }, 1);
  for (let i = 0; i < 60; i++) engine.advance(1000 / 60);
  const w = engine.snapshot('ROOM', 'human', 'human', 1).world;
  assert.ok(Math.abs(w.clock - 2000) < 0.001);
  assert.ok(Math.abs(w.timeRemaining - 179) < 0.001);
  assert.equal(w.players.find((p) => p.id === 'human')!.input.x, 0);
});

void test('touch and keyboard movement use the same unit disk and reject invalid input', () => {
  assert.ok(Math.abs(Math.hypot(...Object.values(movement(1, 1))) - 1) < 1e-10);
  assert.deepEqual(movement(0.05, 0.05, 0.12), { x: 0, z: 0 });
  assert.deepEqual(movement(Infinity, NaN), { x: 0, z: 0 });
});

void test('camera remains bounded even with distant or invalid world coordinates', () => {
  for (const x of [1e6, -1e6, NaN]) {
    const target = cameraTarget({ x, z: x }, { x: -x, z: -x }, 0.46);
    assert.ok(Math.abs(target.x) <= 10 && Math.abs(target.z) <= 20);
    assert.ok(Number.isFinite(target.height) && target.height <= 65);
  }
});

void test('rematch clears attribution, statistics, charges and overlapping spawns', () => {
  const { world, physics, player } = setup();
  const other = newZorbPlayer('q', 'Other', 0, 'red');
  world.players.push(other);
  physics.syncPlayers(world.players);
  player.goals = 4;
  player.bonks = 9;
  player.dashCharge = 1;
  player.input.dash = true;
  world.score.red = 5;
  world.status = 'ended';
  world.ball.lastTouchPlayerId = player.id;
  restartZorbMatch(world, physics);
  assert.deepEqual(world.score, { red: 0, blue: 0 });
  assert.equal(world.timeRemaining, 180);
  assert.equal(player.goals, 0);
  assert.equal(player.bonks, 0);
  assert.equal(player.dashCharge, 0);
  assert.equal(world.ball.lastTouchPlayerId, null);
  assert.equal(player.input.dash, false);
  assert.ok(
    Math.hypot(player.x - other.x, player.z - other.z) > 2 * ZORB_RADIUS,
  );
});

void test('a hard reversal can break human balance without shell inversion', () => {
  const { physics, body, player } = setup();
  tick(physics, 30);
  body.velocity.z = 8;
  body.angularVelocity.x = 8 / ZORB_RADIUS;
  player.balance = 0.85;
  player.input.z = -1;
  tick(physics, 8);
  assert.equal(player.turtle, true);
});

void test('a full simulated match keeps every player finite and within the arena', () => {
  const { world, physics } = setup();
  world.players.push(
    newZorbPlayer('a', 'A', 1, 'red', true),
    newZorbPlayer('b', 'B', 2, 'blue', true),
    newZorbPlayer('c', 'C', 3, 'blue', true),
  );
  physics.syncPlayers(world.players);
  physics.resetPlayers();
  for (let i = 0; i < 60 * 180; i++) {
    advanceZorbClash(world, physics, 1 / 60);
    for (const p of world.players) {
      assert.ok(Number.isFinite(p.x + p.y + p.z));
      assert.ok(Math.abs(p.x) < 18.1 && Math.abs(p.z) < 32);
    }
  }
});
