import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShelfMotion } from './motion';
import { blocked } from './layout';
import { GUARD_SPEED, WALK_SPEED, type Snapshot } from './types';

function sample(clock = 0, x = 0, z = 9): Snapshot {
  const body = { x, z, angle: Math.PI / 2 };
  return {
    code: 'MOTION',
    host: 'you',
    version: clock,
    phase: 'playing',
    round: 1,
    clock,
    remaining: 100000,
    players: [{ id: 'you', name: 'You' }],
    you: {
      id: 'you',
      role: 'guard',
      figureId: null,
      status: 'active',
      body,
      pose: 0,
      carrying: null,
      task: 0,
      input: { x: 1, z: 0, seq: 1 },
      stunnedFor: 0,
    },
    guard: body,
    figures: [],
    items: [],
    events: [],
    mistakes: 5,
    escaped: 0,
    caught: 0,
    message: '',
    objectives: null,
    inspectCooldown: 0,
  };
}

void test('Local walking remains continuous with irregular 90–230ms replies at 30, 60 and 144 Hz', () => {
  for (const fps of [30, 60, 144]) {
    const motion = new ShelfMotion();
    motion.push(sample(), 0);
    motion.setInput({ x: 1, z: 0, seq: 1 }, 0);
    let previous = 0,
      nextReply = 120,
      sentAt = 0,
      index = 0;
    const gaps = [120, 190, 90, 230, 150];
    for (let frame = 1; frame <= fps * 2; frame++) {
      const now = (frame * 1000) / fps;
      if (now >= nextReply) {
        const s = sample(sentAt, (GUARD_SPEED * sentAt) / 1000);
        s.version = index + 1;
        motion.push(s, now, { sentAt, receivedAt: now, input: s.you.input! });
        sentAt = now;
        nextReply = now + gaps[index++ % gaps.length];
      }
      motion.advance(now);
      const own = motion.own()!;
      assert.ok(
        own.x - previous > (GUARD_SPEED / fps) * 0.75,
        `Walking stalled at ${fps} Hz, frame ${frame}`,
      );
      assert.ok(own.moving);
      previous = own.x;
    }
    assert.ok(Math.abs(previous - GUARD_SPEED * 2) < 0.08);
  }
});

void test('Releasing movement stops immediately before another server response', () => {
  const motion = new ShelfMotion();
  motion.push(sample(), 0);
  motion.setInput({ x: 1, z: 0, seq: 1 }, 0);
  for (let at = 16; at <= 320; at += 16) motion.advance(at);
  const stoppedAt = motion.own()!.x;
  motion.setInput({ x: 0, z: 0, seq: 2 }, 320);
  for (let at = 336; at <= 640; at += 16) motion.advance(at);
  assert.equal(motion.own()!.x, stoppedAt);
  assert.equal(motion.own()!.moving, false);
});

void test('An old in-flight movement reply cannot restart walking after key release', () => {
  const motion = new ShelfMotion();
  motion.push(sample(), 0);
  motion.setInput({ x: 1, z: 0, seq: 1 }, 0);
  for (let now = 10; now <= 100; now += 10) motion.advance(now);
  motion.setInput({ x: 0, z: 0, seq: 2 }, 100);
  motion.push(sample(80), 160, {
    sentAt: 0,
    receivedAt: 160,
    input: { x: 1, z: 0, seq: 1 },
  });
  const stoppedAt = motion.own()!.x;
  for (let now = 170; now <= 300; now += 10) motion.advance(now);
  assert.ok(Math.abs(motion.own()!.x - stoppedAt) < 0.01);
  assert.equal(motion.own()!.moving, false);
});

void test('Prediction respects shelves, hiding, stun, capture and a disconnected client', () => {
  for (const condition of ['shelf', 'hiding', 'stun', 'caught', 'offline']) {
    const motion = new ShelfMotion(),
      s = sample(0, 5.8, 1);
    if (condition === 'hiding') s.phase = 'hiding';
    if (condition === 'stun') s.you.stunnedFor = 1800;
    if (condition === 'caught') s.you.status = 'caught';
    motion.push(s, 0);
    motion.setInput({ x: 1, z: 0, seq: 1 }, 0);
    for (let at = 16; at <= 704; at += 16) motion.advance(at);
    assert.ok(!blocked(motion.own()!));
    if (
      condition === 'hiding' ||
      condition === 'stun' ||
      condition === 'caught'
    )
      assert.equal(motion.own()!.x, 5.8);
    const before = motion.own()!.x;
    for (let at = 800; at <= 1600; at += 16) motion.advance(at);
    assert.equal(motion.own()!.x, before);
  }
});

void test('Camera/local motion survives the hiding-to-playing transition and uses the carrying speed', () => {
  const motion = new ShelfMotion(),
    s = sample();
  s.phase = 'hiding';
  s.you.role = 'mannequin';
  s.you.figureId = 'self';
  motion.push(s, 0);
  motion.setInput({ x: 1, z: 0, seq: 1 }, 0);
  for (let at = 10; at <= 200; at += 10) motion.advance(at);
  assert.ok(Math.abs(motion.own()!.x - WALK_SPEED * 0.2) < 0.0001);
  const next = sample(200, motion.own()!.x);
  next.you.role = 'mannequin';
  next.you.figureId = 'self';
  motion.push(next, 200);
  motion.advance(216);
  assert.ok(motion.own()!.moving);
  next.you.carrying = 'ladder';
  next.version++;
  next.you.body = { ...motion.own()! };
  motion.push(next, 216);
  const before = motion.own()!.x;
  motion.advance(236);
  assert.ok(Math.abs(motion.own()!.x - before - 2.15 * 0.02) < 0.0001);
});

void test('Visible NPCs interpolate continuously and disappear immediately when visibility is revoked', () => {
  const motion = new ShelfMotion();
  let next = 0,
    before = 0,
    moving = 0,
    frames = 0;
  for (let now = 0; now <= 1500; now += 10) {
    if (now >= next) {
      const s = sample(now);
      s.you.input = { x: 0, z: 0, seq: 0 };
      s.figures = [
        {
          id: 'visible',
          x: (now / 1000) * WALK_SPEED,
          z: 7,
          angle: Math.PI / 2,
          status: 'active',
          pose: 0,
          task: 0,
          carrying: null,
          moving: true,
        },
      ];
      motion.push(s, now);
      next += 120;
    }
    motion.advance(now);
    const actor = motion.actor('visible')!;
    if (now > 400) {
      frames++;
      if (actor.x > before) moving++;
    }
    before = actor.x;
  }
  assert.ok(moving / frames > 0.95, `Only ${moving}/${frames} moving frames`);
  motion.push(sample(1510), 1510);
  motion.advance(1510);
  assert.equal(motion.actor('visible'), null);
  const hiddenGuard = sample(1520);
  hiddenGuard.guard = null;
  motion.push(hiddenGuard, 1520);
  assert.equal(motion.actor('guard'), null);
});
