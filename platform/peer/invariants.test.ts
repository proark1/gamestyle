import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPeerEngine } from './engine';
import type { Member } from '../../shared/peer/types';
import type { GameId } from '../../shared/audio/types';
import { roomCapacity } from '../../shared/games/identity';

/**
 * Invariants every peer game must keep, checked through the same engine entry
 * point the server and host handover use.
 *
 * Each game's own tests cover its mechanics. These cover the contract the
 * transport depends on, which no single game's tests look at:
 *
 * - A snapshot and a checkpoint cross the wire as JSON. `sealCheckpoint` runs
 *   `JSON.stringify` before encrypting, so a world holding a Map, a Set, NaN or
 *   Infinity survives locally and then corrupts on host handover, silently.
 * - A handed-over world must keep playing, because that is exactly what happens
 *   when the host closes their tab.
 * - Players leave mid-round, and tabs are backgrounded for minutes.
 */

const GAMES: readonly GameId[] = [
  'act-natural',
  'basketball',
  'bungee-doubles',
  'cage-clash',
  'carry-on-carnage',
  'chain-of-fools',
  'crane-clash',
  'dont-wake-the-giant',
  'drive-thru',
  'four-brain-cells',
  'load-bearing',
  'one-more-button',
  'panic-curling',
  'reel-problems',
  'sample-stampede',
  'scaffold-scramble',
  'siege-and-desist',
  'stack-or-sink',
  'uphill-delivery',
  'wrong-floor',
  'zorb-clash',
];

const TICK_MS = 50;

/** A small seeded generator, so a failing run reproduces exactly. */
function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

const member = (id: string, order: number): Member => ({
  id,
  name: `Player ${order}`,
  order,
  color: order % 4,
  instance: `instance-${id}`,
  seen: 0,
});

/**
 * Every control any game reads. Adapters sanitise their input, so each takes
 * the keys it knows and ignores the rest.
 */
function randomInput(next: () => number): Record<string, unknown> {
  const axis = () => next() * 2 - 1;
  const press = () => next() < 0.2;
  return {
    x: axis(),
    y: axis(),
    z: axis(),
    yaw: next() * Math.PI * 2,
    pitch: axis(),
    jump: press(),
    sprint: press(),
    grab: press(),
    tuck: press(),
    brace: press(),
    dash: press(),
    action1: press(),
    action2: press(),
    action3: press(),
    use: press(),
    crank: axis(),
  };
}

/** Walks a value and reports the first thing JSON cannot carry faithfully. */
function wireProblem(value: unknown, path = 'snapshot'): string | null {
  if (value === null) return null;
  switch (typeof value) {
    case 'number':
      return Number.isFinite(value) ? null : `${path} is ${value}`;
    case 'string':
    case 'boolean':
      return null;
    case 'undefined':
      return null; // Dropped from objects; harmless unless inside an array.
    case 'bigint':
    case 'function':
    case 'symbol':
      return `${path} is a ${typeof value}`;
  }
  if (value instanceof Map || value instanceof Set)
    return `${path} is a ${value.constructor.name}, which JSON flattens to {}`;
  if (value instanceof Date)
    return `${path} is a Date, which JSON turns into a string`;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (value[index] === undefined)
        return `${path}[${index}] is undefined, which JSON turns into null`;
      const problem = wireProblem(value[index], `${path}[${index}]`);
      if (problem) return problem;
    }
    return null;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null)
    return `${path} is a ${proto?.constructor?.name ?? 'class'} instance, which loses its methods`;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const problem = wireProblem(child, `${path}.${key}`);
    if (problem) return problem;
  }
  return null;
}

/**
 * The world as it should read after a handover. Held controls are dropped: a
 * player's input vector belongs to the old host's last tick, and each game's
 * `idle()` clears it so nobody keeps running in the direction they last
 * pressed. Everything else must come through unchanged.
 */
function settled(world: unknown) {
  const copy = JSON.parse(JSON.stringify(world)) as {
    players?: Record<string, unknown>[];
  };
  for (const player of copy.players ?? []) delete player.input;
  return copy;
}
function assertWireSafe(game: string, label: string, value: unknown) {
  const problem = wireProblem(value, label);
  assert.equal(problem, null, `${game}: ${problem}`);
}

/** Runs a game with three players and random input for `ticks` ticks. */
function play(game: GameId, seed: number, ticks: number) {
  const next = random(seed);
  const engine = createPeerEngine(game, 1_000_000);
  const members = [member('a', 0), member('b', 1), member('c', 2)].slice(
    0,
    roomCapacity(game),
  );
  engine.reconcile(members);
  let order = 0;
  for (let tick = 0; tick < ticks; tick++) {
    for (const { id } of members) engine.input(id, randomInput(next), ++order);
    engine.advance(TICK_MS);
  }
  return { engine, members };
}

for (const game of GAMES) {
  void test(`${game}: snapshots stay wire-safe through a round of random play`, () => {
    const next = random(7);
    const engine = createPeerEngine(game, 1_000_000);
    const members = [member('a', 0), member('b', 1), member('c', 2)].slice(
      0,
      roomCapacity(game),
    );
    engine.reconcile(members);
    let order = 0;
    for (let tick = 0; tick < 200; tick++) {
      for (const { id } of members)
        engine.input(id, randomInput(next), ++order);
      engine.advance(TICK_MS);
      // Every player receives their own view, and all of them cross the wire.
      if (tick % 20 === 0)
        for (const { id } of members)
          assertWireSafe(
            game,
            `snapshot for ${id} at tick ${tick}`,
            engine.snapshot('ABC234', 'a', id, 1),
          );
    }
  });

  void test(`${game}: a checkpoint survives JSON and the world keeps playing`, () => {
    const { engine } = play(game, 11, 120);
    const checkpoint = engine.checkpoint();
    assertWireSafe(game, 'checkpoint', checkpoint);

    // Exactly what host handover does: seal as JSON, open, restore.
    const handedOver = JSON.parse(
      JSON.stringify(checkpoint),
    ) as typeof checkpoint;
    const successor = createPeerEngine(game, 1_000_000, handedOver);
    assert.deepEqual(
      settled(successor.checkpoint().world),
      settled(checkpoint.world),
      `${game}: the new host must start from the world the old host left`,
    );

    const next = random(13);
    let order = 10_000;
    for (let tick = 0; tick < 60; tick++) {
      for (const id of ['a', 'b', 'c'])
        successor.input(id, randomInput(next), ++order);
      successor.advance(TICK_MS);
    }
    assertWireSafe(
      game,
      'snapshot after handover',
      successor.snapshot('ABC234', 'b', 'b', 2),
    );
  });

  void test(`${game}: players can leave mid-round`, () => {
    const { engine } = play(game, 17, 60);
    engine.reconcile([member('a', 0)]);
    const next = random(19);
    let order = 20_000;
    for (let tick = 0; tick < 40; tick++) {
      engine.input('a', randomInput(next), ++order);
      engine.advance(TICK_MS);
    }
    assertWireSafe(
      game,
      'snapshot after two players left',
      engine.snapshot('ABC234', 'a', 'a', 1),
    );
    // And everyone leaving must not break the host either.
    engine.reconcile([]);
    engine.advance(TICK_MS);
  });

  void test(`${game}: a tab backgrounded for ten minutes comes back intact`, () => {
    const { engine } = play(game, 23, 40);
    // Browsers throttle hidden tabs, so the next frame can be minutes late.
    engine.advance(10 * 60 * 1000);
    for (let tick = 0; tick < 10; tick++) engine.advance(TICK_MS);
    assertWireSafe(
      game,
      'snapshot after a long gap',
      engine.snapshot('ABC234', 'a', 'a', 1),
    );
  });
}
