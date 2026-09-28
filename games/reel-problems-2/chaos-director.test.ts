import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDirector,
  freshDirectorState,
  type DirectorConfig,
  type DirectorObservation,
  type VoyageEventDefinition,
} from './chaos-director';

const config: DirectorConfig = {
  planMs: 100,
  finaleAtMs: 200,
  durationMs: 300,
  maxUrgent: 2,
  budgets: { plan: 1, escalation: 2, finale: 3, complete: 0 },
  gaps: { plan: 10, escalation: 10, finale: 10, complete: Infinity },
};

const observation = (
  now: number,
  extra: Partial<DirectorObservation> = {},
): DirectorObservation => ({
  now,
  phase: 'playing',
  struggling: false,
  playerIds: ['a', 'b'],
  flags: [],
  ...extra,
});

const event = (
  id: string,
  extra: Partial<VoyageEventDefinition> = {},
): VoyageEventDefinition => ({
  id,
  category: 'disruption',
  acts: ['plan', 'escalation'],
  urgent: true,
  danger: 1,
  warningMs: 5,
  cooldownMs: 20,
  weight: 1,
  incompatible: [],
  eligible: () => true,
  targets: (state) => state.playerIds,
  activation: `activate:${id}`,
  complete: () => false,
  cancel: () => false,
  recovery: { kind: 'quiet', durationMs: 15 },
  ...extra,
});

void test('same seed and authoritative observations choose the same event and target', () => {
  const catalog = [event('alpha'), event('beta')];
  const a = advanceDirector(
    freshDirectorState(1234, 0, config),
    observation(0),
    catalog,
    config,
  );
  const b = advanceDirector(
    freshDirectorState(1234, 0, config),
    observation(0),
    catalog,
    config,
  );
  assert.deepEqual(a, b);
  assert.equal(a.transitions[0]?.status, 'warned');
});

void test('acts advance at their boundaries and complete after the run duration', () => {
  const catalog: VoyageEventDefinition[] = [];
  let state = freshDirectorState(1, 0, config);
  state = advanceDirector(state, observation(99), catalog, config).state;
  assert.equal(state.act, 'plan');
  state = advanceDirector(state, observation(100), catalog, config).state;
  assert.equal(state.act, 'escalation');
  state = advanceDirector(state, observation(200), catalog, config).state;
  assert.equal(state.act, 'finale');
  state = advanceDirector(state, observation(300), catalog, config).state;
  assert.equal(state.act, 'complete');
});

void test('danger budget and urgent cap prevent extra simultaneous warnings', () => {
  const catalog = [event('one'), event('two'), event('three')];
  let state = freshDirectorState(9, 0, config);
  state = advanceDirector(state, observation(100), catalog, config).state;
  state.nextEventAt = 100;
  state = advanceDirector(state, observation(100), catalog, config).state;
  state.nextEventAt = 100;
  state = advanceDirector(state, observation(100), catalog, config).state;
  const live = state.events.filter((item) =>
    ['warned', 'active'].includes(item.status),
  );
  assert.equal(live.length, 2);
});

void test('completion creates a quiet recovery window', () => {
  const finishing = event('finishing', {
    warningMs: 0,
    complete: (_world, instance) => instance.status === 'active',
  });
  let state = freshDirectorState(2, 0, config);
  state = advanceDirector(state, observation(0), [finishing], config).state;
  state = advanceDirector(state, observation(1), [finishing], config).state;
  const result = advanceDirector(state, observation(2), [finishing], config);
  assert.equal(result.state.events[0]?.status, 'completed');
  assert.equal(result.state.recoveryUntil, 17);
  assert.equal(result.state.events.length, 1);
});

void test('invalid targets are skipped without spending budget or advancing selection state', () => {
  const invalid = event('invalid', { targets: () => [] });
  const initial = freshDirectorState(44, 0, config);
  const result = advanceDirector(initial, observation(0), [invalid], config);
  assert.deepEqual(result.state, initial);
  assert.deepEqual(result.transitions, []);
});

void test('the finale act reserves selection for finales and recovery content', () => {
  const disruption = event('ordinary', { acts: ['finale'] });
  const finale = event('big-pull', {
    category: 'finale',
    acts: ['finale'],
    danger: 3,
  });
  const result = advanceDirector(
    freshDirectorState(77, 0, config),
    observation(200),
    [disruption, finale],
    config,
  );
  assert.equal(result.state.events[0]?.definitionId, 'big-pull');
});

void test('struggling crews receive only recovery events', () => {
  const danger = event('danger');
  const recovery = event('recovery', {
    category: 'recovery',
    urgent: false,
    danger: 0,
    recovery: { kind: 'none' },
  });
  const result = advanceDirector(
    freshDirectorState(5, 0, config),
    observation(0, { struggling: true }),
    [danger, recovery],
    config,
  );
  assert.equal(result.state.events[0]?.definitionId, 'recovery');
});
