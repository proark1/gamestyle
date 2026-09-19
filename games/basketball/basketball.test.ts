import test from 'node:test';
import assert from 'node:assert/strict';
import {
  basketballAction,
  canSuperJump,
  freshBall,
  freshBasketballWorld,
  newPlayer,
} from './simulation';
import { reconcileBasketballBots } from './bots';
import {
  calculateShotVelocity,
  isBeyondThreePoint,
  stepBallPhysics,
} from './physics';
import { createEngine } from './peer';
import {
  BALL_RADIUS,
  HOOP,
  TARGET_SCORE,
  type BasketballAction,
  type BasketballWorld,
} from './types';
import { basketballAvatars } from './avatar';

void test('world initializes with court, ball, and scores', () => {
  const w = freshBasketballWorld(1000);
  assert.equal(w.phase, 'lobby');
  assert.equal(w.scores.red, 0);
  assert.equal(w.scores.blue, 0);
  assert.equal(w.targetScore, TARGET_SCORE);
  assert.ok(w.ball.y > 0, 'ball is above ground');
});

void test('bot reconciliation maintains 4 players in 2v2 setup', () => {
  const w = freshBasketballWorld(1000);
  w.players.push(newPlayer('human-1', 'Player 1', 0, 'red', false, 0));
  reconcileBasketballBots(w);

  assert.equal(w.players.length, 4, '4 players on court for 2v2');
  const bots = w.players.filter((p) => p.bot);
  assert.equal(bots.length, 3, '3 bots fill the remaining seats');

  const red = w.players.filter((p) => p.team === 'red');
  const blue = w.players.filter((p) => p.team === 'blue');
  assert.equal(red.length, 2, '2 players on Team Red');
  assert.equal(blue.length, 2, '2 players on Team Blue');
});

void test('ball physics bounces off floor and reflects from backboard', () => {
  const ball = freshBall();
  ball.y = 2.0;
  ball.vy = -5.0;

  const eventRef = { current: 0 };
  stepBallPhysics(ball, 0.4, eventRef);

  assert.ok(ball.y >= BALL_RADIUS, 'ball stays above floor');
  assert.ok(ball.vy > 0, 'ball bounced upwards');
  assert.ok(eventRef.current > 0, 'bounce event was generated');

  // Backboard reflection
  ball.x = HOOP.x;
  ball.y = HOOP.backboardY;
  ball.z = HOOP.backboardZ + 0.08;
  ball.vz = -4.0;
  stepBallPhysics(ball, 0.02, eventRef);
  assert.ok(ball.vz > 0, 'ball reflected away from backboard');
});

void test('scoring detects basket through hoop cylinder', () => {
  const ball = freshBall();
  ball.x = HOOP.x;
  ball.z = HOOP.z;
  ball.y = HOOP.y + 0.1;
  ball.vy = -3.0;
  ball.shotTeam = 'red';

  const eventRef = { current: 0 };
  const res = stepBallPhysics(ball, 0.1, eventRef);

  assert.equal(res.scored, true, 'scored through hoop');
  assert.equal(res.shooterTeam, 'red');
  assert.ok(
    eventRef.current > 0 &&
      res.events.some((e) => e.type === 'swish' || e.type === 'dunk'),
    'generated score event',
  );
});

void test('three point distance calculation correctly distinguishes 2s and 3s', () => {
  // Inside the paint (near hoop)
  assert.equal(isBeyondThreePoint(HOOP.x, HOOP.z + 2.0), false);
  // Outside arc (dist >= 6.75)
  assert.equal(isBeyondThreePoint(HOOP.x, HOOP.z + 7.2), true);

  const shot = calculateShotVelocity(0, 1.8, HOOP.z + 7.5, 0.78, false);
  assert.equal(shot.isThree, true);
  assert.ok(shot.vy > 0, 'launches upwards');
  assert.ok(shot.vz < 0, 'travels towards hoop in negative Z');
});

void test('super jump combo charges and activates', () => {
  const p = newPlayer('p1', 'Baller', 0, 'red', false, 0);
  assert.equal(canSuperJump(p), false, 'cannot super jump without combo');

  p.combo = 80;
  assert.equal(canSuperJump(p), true, 'super jump ready with 80 combo');

  const w = freshBasketballWorld(1000);
  w.phase = 'playing';
  w.players.push(p);

  basketballAction(w, 'p1', { type: 'superJump' }, true);
  assert.equal(p.superJump, true, 'super jump flag activated');
  assert.ok(p.vy >= 10.0, 'super jump launched with high velocity');
});

void test('peer createEngine initializes 2v2 adapter and handles member actions', () => {
  const engine = createEngine(1000);
  assert.ok(engine, 'engine created');
  assert.equal(engine.checkpoint().game, 'basketball');

  engine.reconcile([
    {
      id: 'human-1',
      name: 'Player 1',
      color: 0,
      order: 0,
      instance: 'a',
      seen: 1000,
    },
  ]);
  assert.equal(
    engine.world.players.length,
    4,
    'engine auto-filled 2v2 with bots',
  );

  engine.execute('human-1', 'req-1', { type: 'start' }, 'human-1');
  assert.equal(engine.world.phase, 'playing', 'engine started the match');
});

void test('the admin shows the kid in both team kits, dressable', () => {
  assert.deepEqual(
    basketballAvatars.map((look) => look.key),
    ['baller-red', 'baller-blue'],
  );
  for (const look of basketballAvatars) {
    assert.equal(look.dressable, true);
    const preview = look.create();
    assert.equal(preview.root.userData.kid, 'nico');
    assert.ok(typeof preview.pose === 'function', 'pose function exists');
  }
});

void test('crossover breaks defender ankles and triggers anklebreaker event', () => {
  const w = freshBasketballWorld(1000);
  w.phase = 'playing';

  const p1 = newPlayer('p1', 'Baller', 0, 'red', false, 0);
  p1.hasBall = true;
  p1.x = 0;
  p1.z = 0;

  const def = newPlayer('def1', 'Defender', 1, 'blue', false, 1);
  def.x = 0.5;
  def.z = -1.2;

  w.players.push(p1, def);
  w.ball.heldBy = p1.id;

  basketballAction(w, 'p1', { type: 'crossover' }, true);

  assert.equal(p1.specialMove, 'crossover', 'p1 executed crossover');
  assert.equal(
    def.specialMove,
    'stumbled',
    'defender stumbled / broken ankles',
  );
  assert.ok(def.stunnedUntil > w.clock, 'defender is stunned');
  assert.ok(
    w.events.some((e) => e.type === 'anklebreaker'),
    'anklebreaker event emitted',
  );
});

void test('360 spin move grants forward boost and evades steals', () => {
  const w = freshBasketballWorld(1000);
  w.phase = 'playing';

  const p1 = newPlayer('p1', 'Baller', 0, 'red', false, 0);
  p1.hasBall = true;
  p1.facing = 0;

  const def = newPlayer('def1', 'Defender', 1, 'blue', false, 1);
  def.x = p1.x + 0.5;
  def.z = p1.z;

  w.players.push(p1, def);
  w.ball.heldBy = p1.id;

  basketballAction(w, 'p1', { type: 'spin' }, true);
  assert.equal(p1.specialMove, 'spin', 'p1 entered spin move');
  assert.ok(p1.combo > 0, 'spin awarded combo');

  // Attempt steal while p1 is spinning
  basketballAction(w, 'def1', { type: 'steal' }, true);
  assert.equal(p1.hasBall, true, 'p1 kept ball during spin');
  assert.equal(
    def.hasBall,
    false,
    'defender could not steal from spinning player',
  );
});

void test('alley-oop lob launches high pass and teammate slam', () => {
  const w = freshBasketballWorld(1000);
  w.phase = 'playing';

  const passer = newPlayer('p1', 'PointGuard', 0, 'red', false, 0);
  passer.hasBall = true;
  passer.x = 0;
  passer.z = 3.0;

  const dunker = newPlayer('p2', 'Center', 0, 'red', false, 1);
  dunker.x = HOOP.x;
  dunker.z = HOOP.z + 2.0;

  w.players.push(passer, dunker);
  w.ball.heldBy = passer.id;

  basketballAction(w, 'p1', { type: 'alleyoop' }, true);

  assert.equal(w.ball.isAlleyOop, true, 'ball is flagged as alley-oop');
  assert.equal(w.ball.shotBy, dunker.id, 'dunker is target shooter');
  assert.equal(dunker.specialMove, 'dunk', 'dunker leaps into air for slam');
  assert.ok(
    w.events.some((e) => e.type === 'alleyoop'),
    'alley-oop event was emitted',
  );
});

/** A lobby as the solo game builds it: one human on red, three bots. */
function soloLobby(): BasketballWorld {
  const w = freshBasketballWorld(1000);
  w.players.push(newPlayer('me', 'Du', 0, 'red', false, 0));
  reconcileBasketballBots(w);
  return w;
}

/** Two a side, every id distinct, and nobody standing on anybody. */
function assertFairCourt(w: BasketballWorld) {
  for (const team of ['red', 'blue'] as const)
    assert.equal(
      w.players.filter((p) => p.team === team).length,
      2,
      `two on ${team}`,
    );
  const ids = w.players.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, `unique ids: ${ids.join()}`);
  const spots = w.players.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`);
  assert.equal(new Set(spots).size, spots.length, `own spots: ${spots.join()}`);
}

void test('switchTeam joins the team it names, and your own team is a no-op', () => {
  const w = soloLobby();
  assertFairCourt(w);
  const me = () => w.players.find((p) => p.id === 'me')!;

  basketballAction(w, 'me', { type: 'switchTeam', team: 'blue' }, true);
  assert.equal(me().team, 'blue');
  assert.ok(me().x > 0, 'moved to the blue side');
  assertFairCourt(w);

  // The picker's button for the team you are already on used to flip you.
  const before = JSON.stringify(w.players);
  basketballAction(w, 'me', { type: 'switchTeam', team: 'blue' }, true);
  assert.equal(JSON.stringify(w.players), before, 'nothing changed');

  basketballAction(w, 'me', { type: 'switchTeam', team: 'red' }, true);
  assert.equal(me().team, 'red');
  assertFairCourt(w);
});

void test('switchTeam ignores unknown teams and matches in progress', () => {
  const w = soloLobby();
  const before = JSON.stringify(w.players);
  for (const team of ['green', undefined, 7])
    basketballAction(
      w,
      'me',
      { type: 'switchTeam', team } as unknown as BasketballAction,
      true,
    );
  assert.equal(JSON.stringify(w.players), before, 'unknown teams ignored');

  basketballAction(w, 'me', { type: 'start' }, true);
  basketballAction(w, 'me', { type: 'switchTeam', team: 'blue' }, true);
  assert.equal(w.players.find((p) => p.id === 'me')?.team, 'red');
});

void test('peer joiners take a free seat on their own team', () => {
  const member = (id: string, order: number) => ({
    id,
    name: id,
    color: 0,
    order,
    instance: id,
    seen: 1000,
  });
  const engine = createEngine(1000);
  engine.reconcile([member('a', 0), member('b', 1)]);
  const team = (id: string) =>
    engine.world.players.find((p) => p.id === id)?.team;
  assert.equal(team('a'), 'red');
  // The second joiner lands on blue but used to get red's seat number, which
  // put them on top of the blue bot left standing there.
  assert.equal(team('b'), 'blue');
  assertFairCourt(engine.world);

  // A bot refilling the gap once used the id of the bot still on court.
  engine.reconcile([member('a', 0)]);
  assertFairCourt(engine.world);
  engine.reconcile([member('a', 0), member('c', 2)]);
  assert.equal(team('c'), 'blue');
  assertFairCourt(engine.world);

  engine.execute('c', 'req-1', { type: 'switchTeam', team: 'red' }, 'a');
  assert.equal(team('c'), 'red');
  assertFairCourt(engine.world);
  // An old client's action without a team no longer does anything.
  engine.execute('c', 'req-2', { type: 'switchTeam' }, 'a');
  assert.equal(team('c'), 'red');
});
