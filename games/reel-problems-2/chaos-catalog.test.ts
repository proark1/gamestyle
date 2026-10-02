import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVoyageCatalog } from './chaos-catalog';
import type { VoyageEventDefinition } from './chaos-director';

const valid = (id: string): VoyageEventDefinition => ({
  id,
  category: 'setup',
  acts: ['plan'],
  urgent: false,
  danger: 0,
  warningMs: 0,
  cooldownMs: 100,
  weight: 1,
  incompatible: [],
  eligible: () => false,
  targets: () => ['crew'],
  activation: 'noop',
  complete: () => true,
  cancel: () => false,
  recovery: { kind: 'none' },
});

void test('a complete event catalog validates', () => {
  assert.doesNotThrow(() =>
    validateVoyageCatalog([valid('one'), valid('two')]),
  );
});

void test('catalog validation rejects duplicate ids and unknown incompatibilities', () => {
  assert.throws(
    () => validateVoyageCatalog([valid('one'), valid('one')]),
    /duplicate/i,
  );
  assert.throws(
    () =>
      validateVoyageCatalog([
        { ...valid('one'), incompatible: ['missing-event'] },
      ]),
    /unknown incompatibility/i,
  );
});

void test('catalog validation rejects invalid timing, cost, acts and lifecycle handlers', () => {
  assert.throws(
    () => validateVoyageCatalog([{ ...valid('bad'), warningMs: -1 }]),
    /warning/i,
  );
  assert.throws(
    () => validateVoyageCatalog([{ ...valid('bad'), danger: -1 }]),
    /danger/i,
  );
  assert.throws(
    () => validateVoyageCatalog([{ ...valid('bad'), acts: [] }]),
    /act/i,
  );
  assert.throws(
    () =>
      validateVoyageCatalog([{ ...valid('bad'), cancel: undefined as never }]),
    /cancel/i,
  );
  assert.throws(
    () =>
      validateVoyageCatalog([
        { ...valid('bad'), recovery: undefined as never },
      ]),
    /recovery/i,
  );
});
