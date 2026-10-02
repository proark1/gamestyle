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

void test('four humans replace bots in balanced teams, departed players become bots', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  assert.equal(e.world.players.filter((p) => p.bot).length, 0);
  assert.equal(e.world.players.filter((p) => p.team === 'red').length, 2);
  e.execute('p0', 'start', { type: 'start' }, 'p0');
  e.reconcile(members.slice(1));
  assert.equal(e.world.players.filter((p) => p.bot).length, 1);
  assert.equal(e.world.players.length, 4);
  const sub = { ...members[0], id: 'replacement', instance: 'new' };
  e.reconcile([...members.slice(1), sub]);
  assert.equal(e.world.players.filter((p) => p.bot).length, 0);
  assert.equal(e.world.phase, 'serve');
});
void test('actions are idempotent and host handoff preserves the ball, air and score', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  assert.ok(e.execute('p1', 'start-denied', { type: 'start' }, 'p0').error);
  assert.deepEqual(e.execute('p0', 'start', { type: 'start' }, 'p0'), {});
  for (let i = 0; i < 40; i++) e.advance(50);
  e.execute('p1', 'air', { type: 'air', preset: 'walls' }, 'p0');
  const setting = e.world.air.blue.preset;
  e.execute('p1', 'air', { type: 'air', preset: 'bumpers' }, 'p0');
  assert.equal(e.world.air.blue.preset, setting);
  const checkpoint = JSON.parse(JSON.stringify(e.checkpoint()));
  const next = createEngine(100_000, checkpoint);
  assert.deepEqual(next.world.ball, e.world.ball);
  assert.deepEqual(next.world.air, e.world.air);
  assert.deepEqual(next.world.scores, e.world.scores);
  next.reconcile(members.slice(1));
  next.advance(50);
  assert.equal(next.world.started, e.world.started);
  assert.ok(next.world.clock > e.world.clock);
});
void test('stale packets cannot re-enable controls, and party rounds lock team changes and rematches', () => {
  const e = createEngine(1000);
  e.reconcile(members);
  e.input('p1', { x: 1, z: 0, pump: true }, 3);
  e.input('p1', { x: -1, z: 0 }, 2);
  assert.equal(e.world.players.find((p) => p.id === 'p1')!.input.x, 1);
  for (let i = 0; i < 12; i++) e.advance(50);
  assert.equal(e.world.players.find((p) => p.id === 'p1')!.input.pump, false);
  e.configureParty(1);
  const clock = e.world.clock;
  e.advance(100);
  assert.equal(e.world.clock, clock);
  e.execute('p0', 'party-start', { type: 'start' }, 'p0');
  e.world.partyRoundStarted = true;
  assert.ok(e.execute('p0', 'reset', { type: 'reset' }, 'p0').error);
  assert.ok(e.execute('p1', 'switch', { type: 'switch_team' }, 'p0').error);
});
