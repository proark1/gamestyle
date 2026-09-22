import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  freshWorld,
  stepWorld,
  advanceWorld,
  startMatch,
  snapshot,
  fightAction,
} from './simulation';
import {
  commitment,
  sha256,
  resetSelection,
  selectionAction,
} from './selection';
import {
  BODY_RADIUS,
  STEP,
  idleInput,
  cleanInput,
  type World,
  type Style,
} from './types';
import { STYLE_IDS, score } from './styles';
import { contain, cageDistance } from './physics';
import { MOVES } from './combat';
import { CageControls } from './controls';
import { createEngine } from './peer';
import { handlePeerRoom } from '../../shared/peer/coordinator';
import type { RoomStore, Row } from '../../shared/rooms/types';
import type { Member } from '../../shared/peer/types';
const nonce = '0123456789abcdef0123456789abcdef';
function fight(a: Style = 'mma', b: Style = 'mma') {
  const w = freshWorld(1000);
  w.players.forEach((p) => {
    p.bot = false;
  });
  w.players[0].style = a;
  w.players[1].style = b;
  startMatch(w);
  w.phase = 'playing';
  w.players[0].x = -0.6;
  w.players[1].x = 0.6;
  return w;
}
function run(w: World, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) stepWorld(w);
}
function contact(w: World, move: keyof typeof MOVES = 'jab') {
  const p = w.players[0];
  p.move = move;
  p.attack = MOVES[move].duration - MOVES[move].windup + STEP / 2;
  p.struck = false;
  stepWorld(w);
}
function ground(w: World, mode: 'guard' | 'mount' | 'clinch' = 'guard') {
  w.grapple = {
    mode,
    top: w.players[0].id,
    age: 0,
    progress: 0,
    submissionBy: null,
    submission: 0,
    cooldown: 0,
    still: 0,
  };
}
const member = (id: string, color: number): Member => ({
  id,
  name: id,
  color,
  order: color,
  seen: 1000,
  instance: `tab-${id}`,
});

void test('brief touch and keyboard kicks survive input polling, and blur clears them', () => {
  const controls = new CageControls();
  controls.patch({ kick: true, dodge: true });
  controls.patch({ kick: false, dodge: false });
  assert.equal(controls.read().kick, true);
  assert.equal(controls.read().dodge, true);
  controls.clear();
  assert.deepEqual(controls.read(), { ...idleInput(), cancel: true });
  controls.key('KeyF', true);
  controls.key('KeyF', false);
  assert.equal(controls.read().kick, true);
});

void test('a missed heavy attack retains a longer recovery after the animation ends', () => {
  const w = fight();
  w.players[1].x = 4;
  const p = w.players[0];
  p.move = 'hook';
  p.attack = MOVES.hook.duration;
  p.struck = false;
  while (p.attack > 0) stepWorld(w);
  assert.ok(p.whiffed);
  assert.ok(p.cooldown >= MOVES.hook.recovery + 0.3);
});

void test('SHA-256 matches native crypto across UTF-8 and block boundaries', () => {
  for (const value of [
    '',
    'abc',
    'Käfig 🥊',
    ...Array.from({ length: 180 }, (_, i) => 'x'.repeat(i)),
  ])
    assert.equal(
      sha256(value),
      createHash('sha256').update(value).digest('hex'),
    );
});
void test('selection requires both locks, rejects switching and hides styles even after one reveal', () => {
  const w = fight();
  resetSelection(w);
  const [a, b] = w.players;
  selectionAction(w, a.id, {
    type: 'commit',
    selection: w.selection,
    commitment: commitment(w.selection, a.id, 'boxer', nonce),
  });
  // A double tap or replay uses the same sealed choice, never a new salt.
  selectionAction(w, a.id, {
    type: 'commit',
    selection: w.selection,
    commitment: commitment(w.selection, a.id, 'boxer', nonce),
  });
  assert.throws(
    () =>
      selectionAction(w, a.id, {
        type: 'reveal',
        selection: w.selection,
        style: 'boxer',
        nonce,
      }),
    /both/,
  );
  assert.throws(
    () =>
      selectionAction(w, a.id, {
        type: 'commit',
        selection: w.selection,
        commitment: 'f'.repeat(64),
      }),
    /already/,
  );
  selectionAction(w, b.id, {
    type: 'commit',
    selection: w.selection,
    commitment: commitment(w.selection, b.id, 'jiu-jitsu', nonce),
  });
  assert.throws(
    () =>
      selectionAction(w, a.id, {
        type: 'reveal',
        selection: w.selection,
        style: 'mma',
        nonce,
      }),
    /match/,
  );
  selectionAction(w, a.id, {
    type: 'reveal',
    selection: w.selection,
    style: 'boxer',
    nonce,
  });
  const publicState = snapshot(w, 'ABC234', a.id, b.id, 0).world;
  assert.ok(publicState.players.every((p) => p.style === null));
  assert.deepEqual(publicState.botChoices, {});
  selectionAction(w, b.id, {
    type: 'reveal',
    selection: w.selection,
    style: 'jiu-jitsu',
    nonce,
  });
  stepWorld(w);
  assert.equal(w.phase, 'countdown');
  assert.deepEqual(
    w.players.map((p) => p.style),
    ['boxer', 'jiu-jitsu'],
  );
});
void test('bot locks before human choice and abandoned locks reset after 30 seconds', () => {
  const w = freshWorld(1000);
  w.players[0].bot = false;
  resetSelection(w);
  const [a, b] = w.players;
  const fixed = w.botChoices[b.id].style,
    old = w.selection;
  assert.ok(b.commitment);
  assert.equal(
    snapshot(w, 'S', a.id, a.id, 0).world.botChoices[b.id],
    undefined,
  );
  selectionAction(w, a.id, {
    type: 'commit',
    selection: old,
    commitment: commitment(old, a.id, 'boxer', nonce),
  });
  assert.equal(b.style, fixed);
  run(w, 30.1);
  assert.equal(w.selection, old + 1);
  assert.equal(a.commitment, '');
  assert.throws(
    () =>
      selectionAction(w, a.id, {
        type: 'reveal',
        selection: old,
        style: 'boxer',
        nonce,
      }),
    /expired/,
  );
});
void test('every cage edge contains movement without rope rebounds', () => {
  const p = fight().players[0];
  for (let i = 0; i < 360; i++) {
    p.x = Math.cos(i) * 6;
    p.z = Math.sin(i) * 6;
    p.vx = p.x;
    p.vz = p.z;
    contain(p);
    assert.ok(cageDistance(p) >= BODY_RADIUS - 0.00001);
  }
});
void test('inputs are finite, normalized and only accept boolean actions', () => {
  const input = cleanInput({
    x: Infinity,
    z: NaN,
    punch: 'true',
    kick: 1,
    grapple: true,
  });
  assert.deepEqual(input, { ...idleInput(), grapple: true });
  const large = cleanInput({ x: 1e300, z: -1e300 });
  assert.ok(Math.hypot(large.x, large.z) <= 1.00001);
});
void test('boxer hits harder with hands; kickboxer hits harder with legs', () => {
  const damages = STYLE_IDS.map((style) => {
    const w = fight(style);
    contact(w);
    return 100 - w.players[1].health;
  });
  assert.equal(Math.max(...damages), damages[0]);
  const kicks = STYLE_IDS.map((style) => {
    const w = fight(style);
    contact(w, 'kick');
    return 100 - w.players[1].health;
  });
  assert.equal(Math.max(...kicks), kicks[1]);
});
void test('guard absorbs damage, timed guard parries, and low stamina guard breaks', () => {
  const guarded = fight();
  guarded.players[1].input.guard = true;
  guarded.players[1].guarding = true;
  guarded.players[1].guardAge = 1;
  contact(guarded);
  assert.ok(guarded.players[1].health > 98);
  const parry = fight();
  parry.players[1].input.guard = true;
  contact(parry);
  assert.equal(parry.players[1].health, 100);
  assert.ok(parry.players[1].counter > 0);
  const broken = fight();
  Object.assign(broken.players[1], { stamina: 6, guardAge: 1, guarding: true });
  broken.players[1].input.guard = true;
  contact(broken, 'hook');
  assert.ok(broken.events.some((e) => e.kind === 'guard-break'));
});
void test('dodges avoid contact and open a counter; out-of-range strikes miss', () => {
  const w = fight();
  w.players[1].dodge = 0.2;
  contact(w);
  assert.equal(w.players[1].health, 100);
  assert.ok(w.players[1].counter > 0);
  const far = fight();
  far.players[1].x = 4;
  contact(far, 'kick');
  assert.equal(far.players[1].health, 100);
  assert.ok(far.events.some((e) => e.kind === 'miss'));
});
void test('knockdown permits a grapple follow-up but not free standing strikes', () => {
  const w = fight();
  w.players[1].balance = 99;
  contact(w);
  assert.ok(w.players[1].down > 0);
  const hp = w.players[1].health;
  contact(w);
  assert.equal(w.players[1].health, hp);
  contact(w, 'clinch');
  assert.equal(w.grapple?.mode, 'guard');
});
void test('MMA clinch drives a takedown and defense can break the clinch', () => {
  const w = fight('mma', 'boxer');
  ground(w, 'clinch');
  w.players[0].input.grapple = true;
  run(w, 1.6);
  assert.equal(w.grapple?.mode, 'guard');
  assert.equal(w.players[0].takedowns, 1);
  const defended = fight();
  ground(defended, 'clinch');
  defended.players[1].input.guard = true;
  defended.players[1].input.dodge = true;
  run(defended, 1.5);
  assert.equal(defended.grapple, null);
});
void test('guard advances to mount; mount escapes to guard; jiu-jitsu can reverse', () => {
  const w = fight('mma', 'jiu-jitsu');
  ground(w);
  w.players[0].input.kick = true;
  run(w, 1.8);
  assert.equal(w.grapple?.mode, 'mount');
  assert.equal(w.players[0].advances, 1);
  w.players[0].input = idleInput();
  w.players[1].input.kick = true;
  run(w, 1.8);
  assert.equal(w.grapple?.mode, 'guard');
  run(w, 1.7);
  assert.equal(w.grapple?.top, w.players[1].id);
});
void test('every style can finish a timed unopposed submission', () => {
  for (const style of STYLE_IDS) {
    const w = fight(style);
    ground(w);
    w.players[0].input.grapple = true;
    stepWorld(w);
    for (let i = 0; i < 600 && w.phase !== 'ended'; i++) {
      w.players[0].input.grapple = (w.grapple?.age ?? 0) % 1.4 < 0.45;
      stepWorld(w);
    }
    assert.equal(w.finish, 'Submission', style);
    assert.equal(w.winner, 'red', style);
  }
});
void test('submission defense survives and nobody can submit from under mount', () => {
  const w = fight();
  ground(w);
  w.players[0].input.grapple = true;
  w.players[1].input.guard = true;
  run(w, 8);
  assert.equal(w.finish, null);
  assert.ok(!w.grapple?.submissionBy);
  const mounted = fight();
  ground(mounted, 'mount');
  mounted.players[1].input.grapple = true;
  stepWorld(mounted);
  assert.equal(mounted.grapple?.submissionBy, null);
});
void test('inactive ground positions stand up and ground hits score actual damage', () => {
  const w = fight();
  ground(w, 'mount');
  w.players[0].input.punch = true;
  stepWorld(w);
  assert.ok(w.players[0].damage > 0);
  assert.equal(w.players[0].damage, 100 - w.players[1].health);
  w.players[0].input = idleInput();
  run(w, 5.1);
  assert.equal(w.grapple, null);
});
void test('KO, simultaneous KO, three rounds and decision draws are bounded', () => {
  const ko = fight();
  ko.players[1].health = 1;
  contact(ko, 'hook');
  assert.equal(ko.finish, 'KO');
  assert.equal(ko.winner, 'red');
  const both = fight();
  both.players.forEach((p) => {
    p.health = 1;
    p.attack = MOVES.hook.duration - MOVES.hook.windup + STEP / 2;
    p.move = 'hook';
  });
  stepWorld(both);
  assert.equal(both.winner, 'draw');
  const draw = fight();
  run(draw, 190);
  assert.equal(draw.phase, 'ended');
  assert.equal(draw.round, 3);
  assert.equal(draw.finish, 'Decision');
  assert.equal(draw.winner, 'draw');
  const decision = fight();
  decision.round = 3;
  decision.time = STEP;
  decision.players[0].takedowns = 1;
  stepWorld(decision);
  assert.equal(decision.winner, 'red');
  assert.equal(score(decision.players[0]), 8);
});
void test('all style matchups produce finite bot fights that finish', () => {
  for (const a of STYLE_IDS)
    for (const b of STYLE_IDS) {
      const w = fight(a, b);
      w.players.forEach((p) => (p.bot = true));
      run(w, 195);
      assert.equal(w.phase, 'ended', `${a}/${b}`);
      assert.ok(
        w.players.every(
          (p) =>
            Number.isFinite(p.health) &&
            p.health >= 0 &&
            p.stamina >= 0 &&
            p.stamina <= 100,
        ),
      );
      assert.ok(
        w.players.some((p) => p.damage > 0),
        `${a}/${b} never connected`,
      );
    }
});
void test('peer locks and ground state survive JSON checkpoint recovery', () => {
  const engine = createEngine(1000);
  const members = [member('a', 0), member('b', 1)];
  engine.reconcile(members);
  const w = engine.world;
  for (const p of w.players)
    assert.deepEqual(
      engine.execute(
        p.id,
        `lock-${p.id}`,
        {
          type: 'commit',
          selection: w.selection,
          commitment: commitment(w.selection, p.id, 'mma', nonce),
        },
        'a',
      ),
      {},
    );
  const restored = createEngine(
    1000,
    JSON.parse(JSON.stringify(engine.checkpoint())),
  );
  restored.reconcile(members);
  for (const p of restored.world.players)
    assert.deepEqual(
      restored.execute(
        p.id,
        `reveal-${p.id}`,
        { type: 'reveal', selection: w.selection, style: 'mma', nonce },
        'a',
      ),
      {},
    );
  restored.advance(50);
  assert.equal(restored.world.phase, 'countdown');
  restored.world.phase = 'playing';
  ground(restored.world, 'mount');
  restored.world.grapple!.submission = 0.4;
  restored.world.grapple!.submissionBy = 'a';
  const successor = createEngine(
    1000,
    JSON.parse(JSON.stringify(restored.checkpoint())),
  );
  assert.deepEqual(successor.world.grapple, restored.world.grapple);
  successor.reconcile([members[1]]);
  assert.equal(successor.world.players.find((p) => p.id === 'a')!.bot, true);
  successor.advance(50);
  assert.ok(successor.world.clock > restored.world.clock);
});
void test('rematch is host-only and resets hidden choices; huge elapsed times are bounded', () => {
  const w = fight();
  w.phase = 'ended';
  w.winner = 'red';
  const old = w.selection;
  assert.throws(() =>
    fightAction(w, w.players[1].id, { type: 'reset' }, false),
  );
  fightAction(w, w.players[0].id, { type: 'reset' }, true);
  assert.equal(w.phase, 'selection');
  assert.equal(w.selection, old + 1);
  assert.ok(w.players.every((p) => !p.style && !p.commitment));
  advanceWorld(w, w.clock + 1e8);
  assert.ok(w.tick <= 120);
  assert.ok(Number.isFinite(w.clock));
});
void test('coordinator admits only two fighters without reducing other games capacity', async () => {
  class Store implements RoomStore {
    rows = new Map<string, Row>();
    async get(code: string) {
      return this.rows.get(code) ?? null;
    }
    async insert(row: Row) {
      if (this.rows.has(row.code)) return false;
      this.rows.set(row.code, row);
      return true;
    }
    async compareAndSwap(row: Row, version: number) {
      if (this.rows.get(row.code)?.version !== version) return false;
      this.rows.set(row.code, row);
      return true;
    }
  }
  for (const game of ['cage-clash', 'on-the-ropes']) {
    const store = new Store();
    const created = await handlePeerRoom(
      store,
      { game, op: 'create', name: 'A' },
      1000,
    );
    const code = created.session!.code;
    await handlePeerRoom(store, { game, op: 'join', code, name: 'B' }, 1000);
    const third = () =>
      handlePeerRoom(store, { game, op: 'join', code, name: 'C' }, 1000);
    if (game === 'cage-clash') await assert.rejects(third, /2 players/);
    else assert.ok((await third()).session);
  }
});
