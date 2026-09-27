import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CharacterEventTracker,
  celebrationPosition,
  characterMode,
  facingAngle,
  stagingPosition,
} from './character-presentation';
import { freshWorld, snapshot } from './simulation';

void test('staging target stays behind the ball and inside the course', () => {
  const world = freshWorld(0);
  const ball = world.balls[0];
  const target = stagingPosition(world.course, ball, 0);
  assert.ok(target.z < ball.z);
  const edge = stagingPosition(
    world.course,
    { x: world.course.width, z: world.course.length + 2 },
    -1,
  );
  assert.ok(edge.x <= world.course.width / 2 - 0.42);
  assert.ok(edge.z <= world.course.length - 0.42);
});

void test('cup celebration slots remain on the course and are distinct', () => {
  const world = freshWorld(0);
  const slots = [0, 1, 2, 3].map((seat) =>
    celebrationPosition(world.course, seat),
  );
  assert.equal(new Set(slots.map((slot) => `${slot.x}:${slot.z}`)).size, 4);
  assert.ok(slots.every((slot) => Math.abs(slot.x) < world.course.width / 2));
  assert.ok(slots.every((slot) => slot.z < world.course.length));
});

void test('character mode follows authoritative ball state', () => {
  const world = freshWorld(0);
  const player = world.players[0];
  const ball = world.balls[0];
  assert.equal(characterMode(world, player.id, 0), 'ready');
  assert.equal(characterMode(world, player.id, 1), 'walk');
  ball.moving = true;
  assert.equal(characterMode(world, player.id, 0), 'watch');
  ball.holed = true;
  assert.equal(characterMode(world, player.id, 0), 'celebrate');
  assert.equal(characterMode(world, player.id, 0, true), 'swing');
});

void test('character event tracker deduplicates swings and broadcasts multi-cup celebrations', () => {
  const world = freshWorld(0);
  world.events.push({
    id: 1,
    kind: 'shot',
    at: 0,
    x: 0,
    z: 0,
    player: world.players[0].id,
  });
  world.events.push({ id: 2, kind: 'multi-cup', at: 1, x: 0, z: 0 });
  const state = snapshot(world, 'SOLO', 'local', 'local', 1);
  const tracker = new CharacterEventTracker();
  assert.equal(tracker.ingest(state).length, 5);
  assert.equal(tracker.ingest(state).length, 0);
});

void test('facing angle uses the same x/z convention as golf aim', () => {
  assert.equal(facingAngle({ x: 0, z: 0 }, { x: 0, z: 2 }), 0);
  assert.ok(
    Math.abs(facingAngle({ x: 0, z: 0 }, { x: 2, z: 0 }) - Math.PI / 2) <
      0.0001,
  );
});
