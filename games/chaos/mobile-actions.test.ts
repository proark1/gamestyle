import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ActionContact,
  describeTarget,
  mobileActions,
  type MobileActionState,
} from './mobile-actions';
import { carryPlacement } from './carry-placement';
import {
  applyAction,
  freshWorld,
  type Piece,
  type Player,
  type Snapshot,
} from './model';

const player: Player = {
  id: 'me',
  name: 'Builder',
  x: 0,
  z: 3,
  angle: 0,
  color: 0,
  seen: 10000,
};
const prop: Piece = {
  id: 'duck',
  kind: 'duck',
  x: 0,
  z: 2,
  rotation: 0,
  placed: true,
};
const snapshot = (): Snapshot => ({
  world: { ...freshWorld('sandbox', 10000), pieces: [{ ...prop }] },
  players: [{ ...player }],
  now: 10000,
  code: 'TEST',
  host: player.id,
  version: 1,
});
const base: MobileActionState = {
  context: 'site:round',
  tool: 'walk',
  target: null,
  blocked: false,
  working: false,
};

void test('a usable prop offers distinct pick-up and use commands, with fetch for distant selection', () => {
  const s = snapshot();
  const target = describeTarget(s, player, prop)!;
  const nearby = mobileActions({ ...base, target });
  assert.equal(nearby.primary.label, 'Pick up');
  assert.equal(nearby.primary.disabled, false);
  assert.equal(nearby.secondary.label, 'Use');
  assert.equal(nearby.secondary.disabled, false);
  assert.equal(nearby.secondary.targetId, prop.id);
  const distant = describeTarget(s, { ...player, z: 10 }, prop)!;
  assert.equal(
    mobileActions({ ...base, target: distant }).primary.label,
    'Fetch',
  );
  assert.equal(
    mobileActions({ ...base, target: distant }).primary.disabled,
    false,
  );
});
void test('moving, taken and cooling-down props retain their target with the correct unavailable action', () => {
  const s = snapshot();
  const taken = describeTarget(s, player, { ...prop, heldBy: 'other' })!;
  assert.match(taken.grabError!, /carrying/);
  assert.equal(
    mobileActions({ ...base, target: taken }).primary.disabled,
    true,
  );
  const cooling = describeTarget(s, player, { ...prop, usedAt: s.now - 100 })!;
  assert.equal(
    mobileActions({ ...base, target: cooling }).primary.disabled,
    false,
  );
  assert.equal(
    mobileActions({ ...base, target: cooling }).secondary.disabled,
    true,
  );
  const moving = describeTarget(s, player, {
    ...prop,
    physics: { v: [5, 0, 0], q: [0, 0, 0, 1], w: [0, 0, 0], y: 1 },
  })!;
  assert.match(moving.grabError!, /land/);
});
void test('an invalid secured drop leaves Throw available; tools never become a drop toggle', () => {
  const commands = mobileActions({
    ...base,
    held: { ...prop, heldBy: player.id },
    dropError: 'Occupied',
  });
  assert.equal(commands.primary.type, 'drop');
  assert.equal(commands.primary.disabled, true);
  assert.equal(commands.secondary.type, 'throw');
  assert.equal(commands.secondary.disabled, false);
  const empty = mobileActions(base);
  assert.equal(empty.primary.type, 'grab');
  assert.equal(empty.primary.disabled, true);
  const build = mobileActions({
    ...base,
    tool: 'build',
    placementKey: 'floor:0:0',
  });
  assert.equal(build.primary.type, 'place');
  assert.equal(build.secondary.type, 'rotate');
  assert.equal(
    mobileActions({ ...base, tool: 'build' }).primary.disabled,
    true,
  );
  assert.equal(
    mobileActions({ ...base, blocked: true, held: prop }).secondary.disabled,
    true,
  );
});
void test('a held button cannot retarget, be stolen by another finger or activate after cancellation', () => {
  const contact = new ActionContact();
  assert.equal(contact.down(7, 'grab:duck'), true);
  assert.equal(contact.down(8, 'throw:chair'), false);
  assert.equal(contact.up(8, 'grab:duck'), false);
  assert.equal(contact.up(7, 'grab:chair'), false);
  contact.down(7, 'grab:duck');
  assert.equal(contact.up(7, 'grab:duck', true), false);
  contact.down(7, 'grab:duck');
  assert.equal(contact.up(7, 'grab:duck'), true);
  assert.equal(contact.up(7, 'grab:duck'), false);
  contact.down(7, 'place:floor:0:0');
  contact.clear();
  assert.equal(contact.up(7, 'place:floor:0:0'), false);
});
void test('drop preview agrees with authoritative placement in every facing direction and rejects an occupied spot', () => {
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const s = snapshot(),
      actor = { ...player, angle, z: 0 };
    const held = { ...prop, placed: false, heldBy: player.id };
    s.world.pieces = [held];
    const preview = carryPlacement(s.world, actor, held, [actor]);
    assert.equal(preview.error, null);
    applyAction(s.world, { type: 'drop' }, actor, [actor], actor.id, s.now);
    assert.deepEqual(
      { x: held.x, z: held.z, rotation: held.rotation, level: held.level || 0 },
      {
        x: preview.x,
        z: preview.z,
        rotation: preview.rotation,
        level: preview.level,
      },
    );
    assert.equal(held.heldBy, undefined);
    const blocked = {
      ...prop,
      id: 'held-again',
      placed: false,
      heldBy: player.id,
    };
    s.world.pieces.push(blocked);
    assert.ok(carryPlacement(s.world, actor, blocked, [actor]).error);
    assert.throws(() =>
      applyAction(s.world, { type: 'drop' }, actor, [actor], actor.id, s.now),
    );
    assert.equal(blocked.heldBy, actor.id);
  }
});
