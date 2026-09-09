import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, freshWorld, tickWorld, type Player } from './model';
import {
  enableParty,
  partyAction,
  publicWorld,
  privateCard,
  tickParty,
  tickTask,
  roleAnchor,
  missionAction,
  missionCard,
  parseChallenge,
  challengeLink,
  type CrewJob,
} from './party';
const time = 100000;
const player = (id = 'host'): Player => ({
  id,
  name: id,
  x: 3,
  z: 7,
  color: 0,
  seen: time,
  angle: 0,
});
function site(job: CrewJob = 'sofa') {
  const w = enableParty(freshWorld('job', time), time, 3, job);
  return w;
}
void test('public challenge seeds and one player’s card cannot determine other private cards', (t) => {
  const worlds = [site(), site()],
    a = player(),
    b = player('guest'),
    values = [0, 7, 0, 3];
  t.mock.method(crypto, 'getRandomValues', ((array: Uint32Array) => {
    array[0] = values.shift()!;
    return array;
  }) as typeof crypto.getRandomValues);
  for (const w of worlds)
    partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
  assert.equal(worlds[0].party!.seed, worlds[1].party!.seed);
  assert.equal(
    privateCard(worlds[0], a.id)!.id,
    privateCard(worlds[1], a.id)!.id,
  );
  assert.notEqual(
    privateCard(worlds[0], b.id)!.id,
    privateCard(worlds[1], b.id)!.id,
  );
});
for (const map of ['small', 'medium'] as const)
  for (const kind of ['sofa', 'glass', 'crane', 'barrow'] as CrewJob[])
    void test(`${kind} can traverse the actual ${map} delivery lane with two players`, () => {
      const w = enableParty(freshWorld('job', time, 0, map), time, 1, kind),
        a = player(),
        b = player('partner'),
        players = [a, b];
      partyAction(w, { type: 'party', op: 'start' }, a, players, a.id, time);
      for (const [i, v] of players.entries()) {
        Object.assign(v, roleAnchor(w.party!.task, i));
        partyAction(
          w,
          { type: 'party', op: 'role', role: i },
          v,
          players,
          a.id,
          time,
        );
      }
      for (
        let i = 1;
        i <= 100 && w.party!.task.x > w.party!.task.target.x + 0.2;
        i++
      ) {
        const now = time + i * 100;
        for (const v of players) {
          v.seen = now;
          partyAction(
            w,
            { type: 'party', op: 'drive', x: -1, z: 0, turn: 0 },
            v,
            players,
            a.id,
            now,
          );
        }
        tickTask(w, players, now);
        assert.equal(
          w.party!.task.phase,
          'working',
          JSON.stringify(w.party!.task),
        );
      }
      assert.ok(
        Math.abs(w.party!.task.x - w.party!.task.target.x) < 0.25,
        JSON.stringify(w.party!.task),
      );
      for (const v of kind === 'crane' ? [b] : players)
        partyAction(
          w,
          { type: 'party', op: 'place' },
          v,
          players,
          a.id,
          v.seen,
        );
      assert.equal(w.party!.task.phase, 'done');
    });
void test('the waiting room does not age; only its host starts the shared clock', () => {
  const w = site(),
    a = player(),
    b = player('guest');
  tickWorld(w, [a, b], time + 400000);
  assert.equal(w.party!.phase, 'lobby');
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'build', kind: 'chair', x: 1, z: 1, rotation: 0 },
        a,
        [a],
        a.id,
        time,
      ),
    /Wait/,
  );
  assert.throws(
    () => partyAction(w, { type: 'party', op: 'start' }, b, [a, b], a.id, time),
    /manager/,
  );
  partyAction(
    w,
    { type: 'party', op: 'start' },
    a,
    [a, b],
    a.id,
    time + 400000,
  );
  assert.equal(w.started, time + 400000);
  assert.equal(w.party!.deadline, time + 640000);
  assert.equal(Object.keys(w.partyPrivate!.missions).length, 2);
});
void test('public snapshots cannot leak secret cards or action receipts', () => {
  const w = site(),
    a = player(),
    b = player('guest');
  partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
  const publicCopy = JSON.parse(JSON.stringify(publicWorld(w)));
  assert.equal(publicCopy.partyPrivate, undefined);
  assert.ok(privateCard(w, a.id));
  assert.equal(privateCard(w, 'intruder'), undefined);
  assert.equal(JSON.stringify(publicCopy).includes('Return to sender'), false);
});
void test('last call requires the delivery and is never extended after it starts', () => {
  const w = site(),
    a = player();
  partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, time);
  tickParty(w, [a], time + 1000, 1);
  assert.equal(w.party!.phase, 'building');
  w.party!.task.phase = 'done';
  tickParty(w, [a], time + 2000, 1);
  assert.equal(w.party!.phase, 'lastCall');
  assert.equal(w.party!.deadline, time + 32000);
  tickParty(w, [a], time + 10000, 0);
  assert.equal(w.party!.deadline, time + 32000);
  tickParty(w, [a], time + 32000, 0);
  const report = JSON.stringify(w.party!.result);
  assert.equal(w.party!.phase, 'inspection');
  tickParty(w, [a], time + 42000, 1);
  assert.equal(JSON.stringify(w.party!.result), report);
  tickParty(w, [a], time + 62000, 1);
  assert.equal(w.party!.phase, 'results');
});
void test('the four minute limit starts inspection even when nobody delivered', () => {
  const w = site(),
    a = player();
  partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, time);
  tickParty(w, [a], time + 210000, 0);
  assert.equal(w.party!.phase, 'lastCall');
  tickParty(w, [a], time + 240000, 0);
  assert.equal(w.party!.result!.passed, false);
});
void test('handles are exclusive; carrying cannot also grab normal furniture', () => {
  const w = site(),
    a = player(),
    b = player('guest');
  partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
  partyAction(w, { type: 'party', op: 'role', role: 0 }, a, [a, b], a.id, time);
  assert.throws(
    () =>
      partyAction(
        w,
        { type: 'party', op: 'role', role: 0 },
        b,
        [a, b],
        a.id,
        time,
      ),
    /free/,
  );
  assert.throws(
    () =>
      applyAction(
        w,
        { type: 'grab', id: 'starter-sofa' },
        a,
        [a, b],
        a.id,
        time,
      ),
    /Release/,
  );
  partyAction(w, { type: 'party', op: 'role', role: 1 }, b, [a, b], a.id, time);
  assert.equal(w.party!.task.phase, 'working');
  partyAction(w, { type: 'party', op: 'release' }, b, [a, b], a.id, time);
  assert.equal(w.party!.task.phase, 'waiting');
});
for (const kind of ['sofa', 'glass', 'crane', 'barrow'] as CrewJob[])
  void test(`${kind} has a recoverable solo delivery`, () => {
    const w = site(kind),
      a = player();
    partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, time);
    Object.assign(a, roleAnchor(w.party!.task, 0));
    partyAction(w, { type: 'party', op: 'role', role: 0 }, a, [a], a.id, time);
    Object.assign(w.party!.task, w.party!.task.target);
    partyAction(w, { type: 'party', op: 'place' }, a, [a], a.id, time);
    assert.equal(w.party!.task.phase, 'done');
    Object.assign(a, w.party!.task.origin);
    partyAction(w, { type: 'party', op: 'recover' }, a, [a], a.id, time);
    assert.equal(w.party!.task.phase, 'waiting');
    assert.equal(w.party!.task.damage, 0);
  });
void test('a ladder needs a held work input and finishes once', () => {
  const w = site('ladder'),
    a = player();
  partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, time);
  partyAction(w, { type: 'party', op: 'role', role: 0 }, a, [a], a.id, time);
  tickTask(w, [a], time + 100);
  assert.equal(w.party!.task.progress, 0);
  for (let i = 1; i <= 85; i++) {
    a.seen = time + i * 100;
    partyAction(w, { type: 'party', op: 'work' }, a, [a], a.id, a.seen);
    tickTask(w, [a], a.seen);
    if (w.party!.task.phase === 'done') break;
  }
  assert.equal(w.party!.task.phase, 'done');
  assert.equal(w.party!.task.deliveries, 1);
});
void test('stale input stops and a disconnected partner releases the task', () => {
  const w = site(),
    a = player(),
    b = player('guest');
  w.pieces = [];
  partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
  for (const [i, v] of [a, b].entries()) {
    partyAction(
      w,
      { type: 'party', op: 'role', role: i },
      v,
      [a, b],
      a.id,
      time,
    );
    partyAction(
      w,
      { type: 'party', op: 'drive', x: -1, z: 0, turn: 0 },
      v,
      [a, b],
      a.id,
      time,
    );
  }
  tickTask(w, [a, b], time + 100);
  const x = w.party!.task.x;
  assert.ok(x < 3.1);
  a.seen = b.seen = time + 800;
  tickTask(w, [a, b], a.seen);
  assert.equal(w.party!.task.x, x);
  a.seen = time + 4000;
  tickTask(w, [a, b], a.seen);
  assert.equal(w.party!.task.phase, 'waiting');
  assert.deepEqual(w.party!.task.roles, ['', '']);
});
void test('malformed inputs cannot poison shared physics', () => {
  const w = site(),
    a = player();
  partyAction(w, { type: 'party', op: 'start' }, a, [a], a.id, time);
  partyAction(w, { type: 'party', op: 'role', role: 0 }, a, [a], a.id, time);
  assert.throws(
    () =>
      partyAction(
        w,
        { type: 'party', op: 'drive', x: NaN, z: 0, turn: 0 },
        a,
        [a],
        a.id,
        time,
      ),
    /Invalid/,
  );
  assert.throws(
    () =>
      partyAction(
        w,
        {
          type: 'party',
          op: 'consent',
          enabled: 'false' as unknown as boolean,
        },
        a,
        [a],
        a.id,
        time,
      ),
    /Invalid/,
  );
});
void test('reset keeps the voice room and consent while replacing private missions', () => {
  const w = site(),
    a = player();
  w.party!.audioConsent = [a.id];
  const next = applyAction(
    w,
    { type: 'reset', mode: 'job' },
    a,
    [a],
    a.id,
    time,
  );
  assert.equal(next.party!.roomId, w.party!.roomId);
  assert.notEqual(next.party!.roundId, w.party!.roundId);
  assert.deepEqual(next.party!.audioConsent, [a.id]);
  assert.equal(next.party!.phase, 'lobby');
});
void test('challenge links contain public settings and reject unknown versions', () => {
  const w = site('glass');
  w.map = 'large';
  const link = new URL(challengeLink('https://example.test', w));
  const challenge = parseChallenge(link.searchParams);
  assert.equal(challenge!.job, 'glass');
  assert.equal(challenge!.seed, 3);
  assert.equal(challenge!.map, 'large');
  assert.equal(link.searchParams.has('raum'), false);
  assert.equal(link.href.includes(w.party!.roomId), false);
  link.searchParams.set('challenge', '2');
  assert.throws(() => parseChallenge(link.searchParams), /unsupported/);
  link.searchParams.set('challenge', '1');
  link.searchParams.set('map', 'huge');
  assert.throws(() => parseChallenge(link.searchParams), /unsupported/);
});
for (let id = 0; id < 8; id++)
  void test(`secret mission ${id} only completes for its intended event`, () => {
    const w = site(),
      a = player(),
      b = player('guest');
    w.party!.seed = id;
    partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
    w.partyPrivate!.missions[a.id] = missionCard(a.id, id, w);
    const m = w.partyPrivate!.missions[a.id],
      piece = w.pieces.find((v) => v.id === m.objectId)!;
    if (id < 4) {
      piece.placed = true;
      Object.assign(piece, m.target);
      missionAction(w, { type: 'drop' }, b, 'unrelated');
      assert.equal(m.done, false);
      if (id >= 2) missionAction(w, { type: 'grab', id: m.objectId }, a);
      missionAction(w, { type: 'drop' }, b, m.objectId);
    } else if (id < 6) {
      w.party!.task.phase = 'done';
      w.party!.stats.helpers = [a.id, b.id];
      w.party!.task.angle = id === 4 ? Math.PI : -Math.PI;
      missionAction(w, { type: 'party', op: 'place' }, b);
    } else {
      const toilet = w.pieces.find((v) => v.kind === 'toilet')!;
      toilet.placed = true;
      piece.placed = true;
      Object.assign(piece, { x: toilet.x + 1.5, z: toilet.z });
      missionAction(w, { type: 'drop' }, b, m.objectId);
    }
    assert.equal(m.done, true);
  });
void test('a missing mission object is replaced once and then pauses without a penalty', () => {
  const w = site('ladder'),
    a = player(),
    b = player('guest');
  w.party!.seed = 0;
  partyAction(w, { type: 'party', op: 'start' }, a, [a, b], a.id, time);
  w.partyPrivate!.missions[a.id] = missionCard(a.id, 0, w);
  w.pieces = w.pieces.filter((v) => v.id !== 'starter-sofa');
  tickParty(w, [a, b], time + 100, 0);
  const m = w.partyPrivate!.missions[a.id];
  assert.equal(m.objectId, 'starter-plant');
  assert.equal(m.replaced, true);
  w.pieces = w.pieces.filter((v) => v.id !== 'starter-plant');
  tickParty(w, [a, b], time + 200, 0);
  assert.equal(m.paused, true);
  assert.equal(m.done, false);
});
