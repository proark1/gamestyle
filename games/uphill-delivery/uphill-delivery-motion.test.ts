import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { DeliveryMotion, DeliveryQuality } from './motion';
import { deliveryPlayer, freshDelivery } from './simulation';
import type { DeliverySnapshot } from './types';

function snapshot(time: number, local = false): DeliverySnapshot {
  const world = freshDelivery(1000);
  world.phase = 'playing';
  world.clock = time;
  world.players = [deliveryPlayer('a', 'Mover', 0, time)];
  world.sofa.x = ((time - 1000) / 1000) * 4;
  world.players[0].x = world.sofa.x + 1;
  world.gate = (time - 1000) / 1000;
  return {
    code: local ? 'PRACTICE' : 'ABC234',
    host: 'a',
    you: 'a',
    version: time,
    world,
  };
}

void test('irregular network arrivals render a continuous shared cargo and player timeline', () => {
  const motion = new DeliveryMotion(),
    position = new Vector3(),
    player = new Vector3(),
    q = new Quaternion();
  const arrivals = [0, 87, 191, 267, 378, 465, 552, 654, 739, 840, 932, 1025];
  let current = snapshot(1000),
    next = 0,
    previous = 0,
    movingFrames = 0;
  const distances: number[] = [];
  for (let frame = 0; frame < 63; frame++) {
    const now = (frame * 1000) / 60;
    while (next < arrivals.length && arrivals[next] <= now) {
      current = snapshot(1000 + arrivals[next]);
      motion.push(current, arrivals[next++]);
    }
    motion.advance(now);
    motion.sofa(current, position, q);
    motion.player(current.world.players[0], player);
    assert.ok(
      Math.abs(player.x - position.x - 1) < 1e-9,
      'hands and cargo use the same clock',
    );
    assert.ok(position.x >= previous, 'packet arrival never rewinds the sofa');
    if (now > 300) {
      distances.push(position.x - previous);
      if (position.x > previous) movingFrames++;
    }
    previous = position.x;
  }
  assert.equal(
    movingFrames,
    distances.length,
    'steady motion continues between irregular packets',
  );
  assert.ok(
    Math.max(...distances) < 0.09,
    'arrival does not create a large position step',
  );
});

void test('120 Hz rendering interpolates between 60 Hz physics without changing simulation positions', () => {
  const motion = new DeliveryMotion(),
    p = new Vector3(),
    q = new Quaternion();
  const step = 1000 / 60;
  const a = snapshot(1000, true),
    b = snapshot(1000 + step, true);
  motion.push(a, 0);
  motion.push(b, step);
  const half = structuredClone(b);
  half.world.clock += step / 2;
  half.world.remainder = step / 2000;
  motion.push(half, step * 1.5);
  motion.advance(step * 1.5);
  motion.sofa(half, p, q);
  assert.ok(Math.abs(p.x - (step / 1000) * 2) < 1e-9);
  assert.equal(
    half.world.sofa.x,
    b.world.sofa.x,
    'interpolation never writes back to authoritative physics',
  );
});

void test('restarts discard old downhill trajectories and network stalls never extrapolate through walls', () => {
  const motion = new DeliveryMotion(),
    p = new Vector3(),
    q = new Quaternion();
  motion.push(snapshot(1000), 0);
  motion.push(snapshot(1100), 100);
  for (let now = 100; now <= 5000; now += 16) motion.advance(now);
  motion.sofa(snapshot(1100), p, q);
  assert.equal(p.x, 0.4);
  const reconnect = snapshot(5900);
  motion.push(reconnect, 4900);
  motion.advance(4900);
  motion.sofa(reconnect, p, q);
  assert.equal(
    p.x,
    reconnect.world.sofa.x,
    'reconnect catches up immediately instead of trailing by seconds',
  );
  const reset = snapshot(6000);
  reset.world.started = 6000;
  reset.world.sofa.x = -11;
  motion.push(reset, 5000);
  motion.advance(5000);
  motion.sofa(reset, p, q);
  assert.equal(p.x, -11);
  assert.equal(motion.samples.length, 1);
});

void test('automatic quality ignores brief stalls and only reduces after sustained slow frames', () => {
  const quality = new DeliveryQuality();
  for (let i = 0; i < 700; i++) quality.record(i === 350 ? 100 : 1000 / 60);
  assert.equal(quality.level, 0);
  for (let i = 0; i < 200; i++) quality.record(1000 / 30);
  assert.equal(quality.level, 1);
  for (let i = 0; i < 10; i++) quality.record(1000 / 30);
  assert.equal(quality.level, 1, 'cooldown prevents repeated quality changes');
});
