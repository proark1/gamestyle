import test from 'node:test';
import assert from 'node:assert/strict';
import { freshWorld } from './model';
import { enableParty } from './party';
import { buildSnapshot, restoreBuild } from './build-snapshot';
void test('saved builds are an explicit construction projection without player identities or private data', () => {
  const world = enableParty(freshWorld('job', 1, 0, 'large'), 1);
  world.party!.audioConsent = ['secret-player'];
  world.partyPrivate!.receipts['secret-player'] = {
    id: 'secret-receipt',
    seq: 1,
  };
  world.pieces[0].usedAt = 123;
  world.pieces[1].heldBy = 'secret-player';
  world.pieces[2].physics = {
    y: 1,
    q: [0, 0, 0, 1],
    v: [20, 3, 9],
    w: [4, 5, 6],
  };
  world.pieces[2].placed = false;
  const saved = buildSnapshot(world),
    text = JSON.stringify(saved);
  assert.equal(saved.map, 'large');
  assert.ok(
    !/secret-player|secret-receipt|heldBy|receipts|audioConsent|usedAt/.test(
      text,
    ),
  );
  assert.equal(
    saved.pieces.some((p) => p.supply),
    false,
  );
  assert.deepEqual(
    saved.pieces.find((p) => p.kind === world.pieces[2].kind && !p.placed)!
      .physics!.v,
    [0, 0, 0],
  );
});
void test('a remix creates independent pieces and retains attribution without changing its source', () => {
  const source = buildSnapshot(enableParty(freshWorld('job', 1), 1));
  const target = enableParty(freshWorld('sandbox', 2), 2);
  const before = JSON.stringify(source);
  restoreBuild(target, source, 'source-id', 'remix');
  target.pieces[0].x = 99;
  assert.equal(JSON.stringify(source), before);
  assert.equal(target.sharedFrom, 'source-id');
  assert.ok(target.pieces.some((p) => p.supply));
});
