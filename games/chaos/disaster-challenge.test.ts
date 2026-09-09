import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, type Player } from './model';
import { enableParty, partyAction, publicWorld, tickParty } from './party';
import {
  DISASTER_RULES,
  challengeSnapshot,
  challengeOutcome,
  checkChallengeCrew,
  formatChallengeTime,
  invalidateChallengeRun,
} from './disaster-challenge';
import { restoreBuild } from './build-snapshot';

const start = 100000;
function fixture(size = 2) {
  const world = enableParty(freshWorld('job', start), start, 123);
  const players: Player[] = Array.from({ length: size }, (_, i) => ({
    id: `private-${i}`,
    name: `Builder ${i}`,
    color: i,
    x: 0,
    z: 5,
    angle: 0,
    seen: start,
  }));
  partyAction(
    world,
    { type: 'party', op: 'start' },
    players[0],
    players,
    players[0].id,
    start,
  );
  return { world, players };
}
function finish(f: ReturnType<typeof fixture>, elapsed = 40000) {
  const p = f.world.party!;
  // Objective validity is covered by inspection/party tests. Exercise the real verdict/timer path.
  p.task.phase = 'done';
  p.task.roles = ['', ''];
  p.phase = 'lastCall';
  p.deadline = start + elapsed;
  f.players.forEach((v) => (v.seen = start + elapsed));
  tickParty(f.world, f.players, start + elapsed, 1);
}
void test('only new, successful, server-timed rounds can create a benchmark', () => {
  const f = fixture();
  assert.throws(() => challengeSnapshot(f.world), /Finish a successful/);
  finish(f, 40234);
  assert.equal(challengeSnapshot(f.world).challenge!.elapsedMs, 40234);
  assert.equal(formatChallengeTime(40234), '40.234s');
  assert.equal(challengeSnapshot(f.world).challenge!.crewSize, 2);
  f.world.party!.result!.passed = false;
  assert.throws(() => challengeSnapshot(f.world), /Finish a successful/);
});
void test('challenge stores immutable starting construction and supplies, excluding identities and final progress', () => {
  const f = fixture();
  const original = structuredClone(f.world.pieces);
  f.world.pieces[0].x = 88;
  finish(f);
  const saved = challengeSnapshot(f.world);
  assert.equal(saved.pieces[0].x, original[0].x);
  assert.deepEqual(
    saved.pieces.map((v) => v.id),
    original.map((v) => v.id),
  );
  assert.ok(saved.pieces.some((v) => v.supply));
  assert.equal(saved.delivery, undefined);
  assert.ok(!JSON.stringify(saved).includes('private-'));
  assert.equal(publicWorld(f.world).challengeSetup, undefined);
  saved.pieces[0].x = -99;
  assert.equal(challengeSnapshot(f.world).pieces[0].x, original[0].x);
});
void test('challengers need matching crew size and cannot change rules, but can name their crew', () => {
  const f = fixture();
  finish(f);
  const saved = challengeSnapshot(f.world);
  const copy = enableParty(freshWorld('job', start), start, 123);
  restoreBuild(copy, saved, 'a'.repeat(32), 'try');
  assert.throws(
    () =>
      partyAction(
        copy,
        { type: 'party', op: 'start' },
        f.players[0],
        f.players.slice(0, 1),
        f.players[0].id,
        start,
      ),
    /needs 2/,
  );
  for (const change of [
    { job: 'glass' as const },
    { format: 'classic' as const },
    { daily: '2026-09-06' },
  ])
    assert.throws(
      () =>
        partyAction(
          copy,
          { type: 'party', op: 'configure', ...change },
          f.players[0],
          f.players,
          f.players[0].id,
          start,
        ),
      /original job/,
    );
  partyAction(
    copy,
    { type: 'party', op: 'configure', crewName: 'Next crew' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  partyAction(
    copy,
    { type: 'party', op: 'start' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  assert.equal(copy.party!.crewName, 'Next crew');
  assert.deepEqual(copy.challengeSetup!.startRules, saved.startRules);
});
void test('joining, leaving, stale presence and solo fallback invalidate a time permanently', () => {
  for (const change of ['join', 'leave', 'stale', 'solo']) {
    const f = fixture();
    if (change === 'join')
      checkChallengeCrew(
        f.world,
        [...f.players, { ...f.players[0], id: 'extra' }],
        start,
      );
    if (change === 'leave') invalidateChallengeRun(f.world, 'Builder left');
    if (change === 'stale')
      checkChallengeCrew(f.world, f.players, start + 3001);
    if (change === 'solo') {
      f.world.party!.task.solo = true;
      checkChallengeCrew(f.world, f.players, start);
    }
    finish(f);
    assert.equal(f.world.party!.run!.elapsedMs, undefined);
    assert.throws(() => challengeSnapshot(f.world), /Finish a successful/);
  }
});
void test('comparison reports wins, losses, exact ties and failures without inventing a win', () => {
  const f = fixture();
  finish(f, 40000);
  f.world.party!.challenge = {
    ...challengeSnapshot(f.world).challenge!,
    buildId: 'source',
  };
  assert.match(challengeOutcome(f.world)!, /tie/);
  f.world.party!.challenge.elapsedMs = 50000;
  assert.match(challengeOutcome(f.world)!, /beat.*10.000s/);
  f.world.party!.challenge.elapsedMs = 30000;
  assert.match(challengeOutcome(f.world)!, /10.000s behind/);
  f.world.party!.result!.passed = false;
  assert.match(challengeOutcome(f.world)!, /not approved/);
});
void test('retry retains the benchmark and starting setup; a new job or remix clears competition', () => {
  const f = fixture();
  finish(f);
  const saved = challengeSnapshot(f.world);
  const copy = enableParty(freshWorld('job', start), start, 123);
  restoreBuild(copy, saved, 'a'.repeat(32), 'try');
  partyAction(
    copy,
    { type: 'party', op: 'start' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  copy.pieces[0].x = 99;
  const retry = applyAction(
    copy,
    { type: 'reset', mode: 'job', retry: true },
    f.players[0],
    f.players,
    f.players[0].id,
    start + 50000,
  );
  assert.deepEqual(retry.party!.challenge, copy.party!.challenge);
  assert.equal(retry.pieces[0].x, saved.pieces[0].x);
  assert.equal(retry.party!.run, undefined);
  assert.equal(
    applyAction(
      copy,
      { type: 'reset', mode: 'job' },
      f.players[0],
      f.players,
      f.players[0].id,
      start + 50000,
    ).party!.challenge,
    undefined,
  );
  const remix = enableParty(freshWorld('sandbox', start), start);
  restoreBuild(remix, saved, 'a'.repeat(32), 'remix');
  assert.equal(remix.party!.challenge, undefined);
});
void test('daily rules and delivery origin survive a challenge copy', () => {
  const f = fixture();
  const w = enableParty(freshWorld('job', start), start);
  partyAction(
    w,
    { type: 'party', op: 'configure', daily: '2026-09-06' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  partyAction(
    w,
    { type: 'party', op: 'start' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  const setup = structuredClone(w.challengeSetup!);
  setup.challenge = {
    rulesVersion: DISASTER_RULES,
    elapsedMs: 70000,
    crewSize: 2,
    crewName: 'Daily crew',
  };
  const copy = enableParty(freshWorld('job', start + 90000), start + 90000);
  restoreBuild(copy, setup, 'b'.repeat(32), 'try');
  partyAction(
    copy,
    { type: 'party', op: 'start' },
    f.players[0],
    f.players,
    f.players[0].id,
    start + 90000,
  );
  assert.deepEqual(copy.challengeSetup!.startRules, setup.startRules);
  assert.equal(
    copy.party!.inspection!.rainAt - copy.started,
    setup.startRules!.rainAfter,
  );
});
void test('classic times include last call but exclude the verdict presentation and later departures', () => {
  const f = fixture();
  const p = f.world.party!;
  p.task.phase = 'done';
  f.players.forEach((v) => (v.seen = start + 10000));
  tickParty(f.world, f.players, start + 10000, 1);
  assert.equal(p.phase, 'lastCall');
  assert.equal(p.run!.elapsedMs, undefined);
  f.players.forEach((v) => (v.seen = start + 40000));
  tickParty(f.world, f.players, start + 40000, 1);
  assert.equal(p.run!.elapsedMs, 40000);
  invalidateChallengeRun(f.world, 'Post-round departure');
  tickParty(f.world, [], start + 71000, 1);
  assert.equal(p.phase, 'results');
  assert.equal(challengeSnapshot(f.world).challenge!.elapsedMs, 40000);
});
void test('inspection times include rescue and require a real passing functional check', () => {
  const f = fixture(1);
  const w = enableParty(freshWorld('job', start), start);
  partyAction(
    w,
    { type: 'party', op: 'configure', format: 'inspection' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  partyAction(
    w,
    { type: 'party', op: 'start' },
    f.players[0],
    f.players,
    f.players[0].id,
    start,
  );
  f.players[0].seen = start + 240000;
  tickParty(w, f.players, start + 240000, 1);
  assert.equal(w.party!.phase, 'rescue');
  assert.equal(w.party!.run!.elapsedMs, undefined);
  w.pieces = [
    { id: 'roof', kind: 'roof', x: 0, z: 0, rotation: 0, placed: true },
  ];
  Object.assign(w.party!.task, { phase: 'done', x: 0, z: 0 });
  f.players[0].seen = start + 260000;
  tickParty(w, f.players, start + 260000, 1);
  assert.equal(challengeSnapshot(w).challenge!.elapsedMs, 260000);
});
