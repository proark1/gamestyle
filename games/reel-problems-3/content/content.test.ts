import assert from 'node:assert/strict';
import test from 'node:test';
import { CHAOS_DEFINITIONS, INCIDENT_KINDS } from './chaos';
import { FISH_DEFINITIONS, FISH_SPECIES } from './fish';
import { ITEM_DEFINITIONS, LOADOUT } from './items';
import { MISSION_DEFINITIONS, MISSION_KINDS } from './missions';
void test('party round catalogs are complete and internally consistent', () => {
  assert.equal(new Set(FISH_SPECIES).size, 6);
  assert.equal(new Set(MISSION_KINDS).size, 6);
  assert.equal(new Set(INCIDENT_KINDS).size, 10);
  for (const species of FISH_SPECIES) {
    const fish = FISH_DEFINITIONS[species];
    assert.ok(fish.name && fish.color && fish.accent);
    assert.ok(fish.minWeight > 0 && fish.maxWeight > fish.minWeight);
    assert.ok(fish.stamina > 0 && fish.safeTension > 0);
  }
  for (const kind of MISSION_KINDS)
    assert.ok(MISSION_DEFINITIONS[kind].baseGoal > 0);
  for (const kind of INCIDENT_KINDS)
    assert.ok(CHAOS_DEFINITIONS[kind].durationMs > 0);
  for (const kind of LOADOUT) {
    const item = ITEM_DEFINITIONS[kind];
    assert.ok(item.model && item.mass > 0);
    if (item.essential) assert.ok(item.rack);
  }
});
