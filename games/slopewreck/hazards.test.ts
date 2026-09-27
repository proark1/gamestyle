import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HAZARDS, hazardColliders, snowballX } from './hazards';

void test('moving snowballs are deterministic and stay inside the course', () => {
  const snowball = HAZARDS.find((hazard) => hazard.type === 'snowball');
  assert.ok(snowball && snowball.type === 'snowball');
  const first = snowballX(snowball, 12_345);
  assert.equal(first, snowballX(snowball, 12_345));
  assert.ok(Math.abs(first) < 9);
});

void test('gates expose two solid poles and collapsed banks stop colliding', () => {
  const gate = HAZARDS.find((hazard) => hazard.type === 'gate');
  const bank = HAZARDS.find((hazard) => hazard.type === 'snowbank');
  assert.ok(gate && bank);
  assert.equal(hazardColliders(gate, 0, []).length, 2);
  assert.equal(hazardColliders(bank, 0, []).length, 1);
  assert.equal(hazardColliders(bank, 0, [bank.id]).length, 0);
});
