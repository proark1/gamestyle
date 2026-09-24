import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from './peer';
import type { Member } from '../../shared/peer/types';
const members: Member[] = [0, 1, 2, 3].map((i) => ({
  id: `p${i}`,
  name: `Player ${i}`,
  color: i,
  order: i,
  instance: `instance-${i}`,
  seen: 0,
}));
void test('four humans replace bots; disconnect and reconnect transfer prop ownership consistently', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  assert.equal(e.world.players.filter((p) => p.bot).length, 0);
  e.execute('p0', 'start', { type: 'start' }, 'p0');
  e.execute('p1', 'charge', { type: 'charge' }, 'p0');
  for (let i = 0; i < 8; i++) {
    e.input('p1', { x: 0, z: 0 }, i);
    e.advance(100);
  }
  e.execute('p1', 'throw', { type: 'throw' }, 'p0');
  assert.equal(e.world.props.length, 1);
  e.reconcile(members.filter((m) => m.id !== 'p1'));
  assert.equal(e.world.props[0].owner, 'bot-1');
  assert.equal(e.world.players.length, 4);
  e.reconcile(members);
  assert.equal(e.world.props[0].owner, 'p1');
});
void test('actions are authenticated, host-only starts are enforced and repeated throws are idempotent', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  assert.ok(e.execute('p1', 'no', { type: 'start' }, 'p0').error);
  e.execute('p0', 'start', { type: 'start' }, 'p0');
  e.execute('p1', 'select', { type: 'select', object: 5 }, 'p0');
  e.execute('p1', 'select', { type: 'select', object: 0 }, 'p0');
  assert.equal(e.world.players[1].selected, 5);
  e.execute('p1', 'charge', { type: 'charge' }, 'p0');
  e.advance(100);
  e.execute('p1', 'throw', { type: 'throw' }, 'p0');
  e.execute('p1', 'throw', { type: 'throw' }, 'p0');
  assert.equal(e.world.players[1].throws, 1);
});
void test('host migration preserves flight, scoring, seed and table motion but cancels a held charge', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  e.execute('p0', 'start', { type: 'start' }, 'p0');
  e.execute('p1', 'charge', { type: 'charge' }, 'p0');
  e.advance(100);
  e.execute('p1', 'throw', { type: 'throw' }, 'p0');
  e.world.table.vx = 0.3;
  e.world.players[2].score = 50;
  e.execute('p2', 'charge', { type: 'charge' }, 'p0');
  const next = createEngine(900000, JSON.parse(JSON.stringify(e.checkpoint())));
  assert.deepEqual(next.world.props, e.world.props);
  assert.deepEqual(next.world.table, e.world.table);
  assert.equal(next.world.seed, e.world.seed);
  assert.equal(next.world.players[2].score, 50);
  assert.equal(next.world.players[2].chargingAt, null);
  next.reconcile(members.slice(1));
  next.advance(100);
  assert.equal(next.world.started, 1000);
});
void test('stale controls cancel safely and party configuration locks daily mode and rematches', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  e.configureParty(1);
  const clock = e.world.clock;
  e.advance(100);
  assert.equal(e.world.clock, clock);
  e.execute('p0', 'start', { type: 'start' }, 'p0');
  e.world.partyRoundStarted = true;
  e.input('p1', { x: 1, z: 0 }, 3);
  e.input('p1', { x: -1, z: 0 }, 2);
  assert.equal(e.world.players[1].input.x, 1);
  e.execute('p1', 'charge', { type: 'charge' }, 'p0');
  for (let i = 0; i < 8; i++) e.advance(100);
  assert.equal(e.world.players[1].chargingAt, null);
  assert.equal(e.world.players[1].throws, 0);
  assert.ok(
    e.execute('p0', 'mode', { type: 'mode', mode: 'daily' }, 'p0').error,
  );
  assert.ok(e.execute('p0', 'reset', { type: 'reset' }, 'p0').error);
});
