import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine as zorb } from '../../games/zorb-clash/peer';
import { createEngine as stampede } from '../../games/sample-stampede/peer';
import { createEngine as drive } from '../../games/drive-thru/peer';

const members = Array.from({ length: 4 }, (_, order) => ({
  id: `player-${order}`,
  name: `Player ${order}`,
  color: order,
  order,
  instance: `browser-${order}`,
  seen: 1000,
}));

void test('Zorb rooms retain two players per team through joins, departures and recovery', () => {
  const engine = zorb(1000);
  for (let count = 1; count <= 4; count++) {
    engine.reconcile(members.slice(0, count));
    engine.advance(50);
    assert.equal(engine.open, true, 'friends can join an ongoing Zorb match');
    assert.equal(engine.world.players.length, 4);
    assert.equal(engine.world.players.filter((p) => !p.bot).length, count);
    for (const team of ['red', 'blue'])
      assert.equal(
        engine.world.players.filter((p) => p.team === team).length,
        2,
      );
  }
  engine.reconcile(members.slice(1));
  assert.equal(engine.world.players.length, 4);
  assert.equal(engine.world.players.filter((p) => p.bot).length, 1);
  const recovered = zorb(2000, JSON.parse(JSON.stringify(engine.checkpoint())));
  recovered.reconcile(members);
  assert.equal(recovered.world.players.filter((p) => !p.bot).length, 4);
  assert.equal(recovered.world.players.length, 4);
});

void test('Sample Stampede replaces a departing driver or grabber with an NPC in the same cart', () => {
  const engine = stampede(1000);
  engine.reconcile(members);
  for (const id of ['player-0', 'player-2']) {
    const before = engine.world.players.find((p) => p.id === id)!;
    const { team, role, cartId } = before;
    engine.reconcile(members.filter((m) => m.id !== id));
    assert.equal(engine.world.players.length, 4);
    const replacement = engine.world.players.find(
      (p) => p.bot && p.team === team && p.role === role,
    );
    assert.ok(replacement);
    assert.equal(replacement.cartId, cartId);
    engine.reconcile(members);
    assert.equal(engine.world.players.filter((p) => p.bot).length, 0);
  }
});

void test('Drive-Thru exposes its existing drink action through the shared peer engine', () => {
  const engine = drive(1000);
  engine.reconcile(members);
  const barista = engine.world.players.find((p) => p.role === 'barista')!;
  assert.deepEqual(
    engine.execute(barista.id, 'pour', { type: 'pourDrink' }, members[0].id),
    {},
  );
});

void test('Sample Stampede rematch resets the world while preserving the room crew', () => {
  const engine = stampede(1000);
  engine.reconcile(members);
  engine.advance(50);
  const crew = engine.world.players.map(({ id, team, role, cartId }) => ({
    id,
    team,
    role,
    cartId,
  }));
  engine.world.status = 'finished';
  engine.world.winnerTeam = 'red';
  engine.world.teamScores.red = 1000;
  engine.world.carts[0].x = 99;
  engine.execute(members[0].id, 'rematch', { type: 'reset' }, members[0].id);
  assert.equal(engine.world.status, 'active');
  assert.equal(engine.world.winnerTeam, null);
  assert.equal(engine.world.teamScores.red, 0);
  assert.notEqual(engine.world.carts[0].x, 99);
  assert.deepEqual(
    engine.world.players.map(({ id, team, role, cartId }) => ({
      id,
      team,
      role,
      cartId,
    })),
    crew,
  );
  engine.advance(50);
  assert.notEqual(
    engine.world.carts[0].x,
    99,
    'the previous round physics must be discarded',
  );
});
