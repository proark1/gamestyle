import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshHotel, hotelAction, hotelSnapshot, newGuest } from './simulation';
import {
  HotelFootsteps,
  hotelAcoustics,
  hotelHorror,
  hotelSurface,
} from './horror';

function snapshot() {
  const w = freshHotel(100000);
  w.players.push(newGuest('you', 'You', 0, w.clock));
  hotelAction(w, 'you', { type: 'start' }, 'you');
  return hotelSnapshot(w, 'PRACTICE', 'you', 'you', 1);
}

void test('normal private views never produce supernatural sights or sounds throughout a floor', () => {
  const s = snapshot();
  s.you.anomaly = s.you.apparition = false;
  for (let ms = 0; ms < 90000; ms += 100) {
    s.world.clock = s.world.stopAt + ms;
    const h = hotelHorror(s);
    assert.equal(h.ghost || h.encounter || h.portrait, false);
    assert.equal(h.lightDip, 0);
    assert.equal(h.knockKey + h.handleKey + h.wetKey, '');
    assert.equal(h.clockStep, 0);
  }
});

void test('haunted sightings arrive early, recur with quiet gaps, and recover identically from snapshots', () => {
  const s = snapshot();
  s.you.apparition = true;
  const cycles = new Set<number>();
  let first = Infinity,
    quiet = 0;
  for (let ms = 0; ms < 60000; ms += 100) {
    s.world.clock = s.world.stopAt + ms;
    const h = hotelHorror(s);
    if (h.ghost) {
      first = Math.min(first, ms);
      cycles.add(h.cycle);
    } else quiet++;
    assert.ok(h.lightDip >= 0 && h.lightDip <= 0.86);
    assert.deepEqual(hotelHorror(structuredClone(s)), h);
  }
  assert.ok(first < 8000);
  assert.ok(cycles.size >= 3);
  assert.ok(quiet > 300);
  s.you.apparition = false;
  s.you.anomaly = true;
  s.world.phase = 'escape';
  assert.equal(
    hotelHorror(s).ghost,
    false,
    'only the selected witness sees the pursuer',
  );
  s.you.apparition = true;
  s.world.ghostZ = -7;
  assert.deepEqual(hotelHorror(s).ghostPosition, { x: 0, z: -7 });
  s.world.phase = 'playing';
  s.world.stage = 'travel';
  assert.equal(hotelHorror(s).active, false);
  assert.equal(hotelHorror(s).ghost, false);
});

void test('door impacts, handle movement, wet prints and clock ticks have one matching sound key per motion', () => {
  const s = snapshot();
  s.you.anomaly = true;
  s.you.station = 2;
  const knocks = new Set<string>(),
    handles = new Set<string>();
  for (let ms = 0; ms < 6700; ms += 50) {
    s.world.clock = s.world.stopAt + ms;
    const h = hotelHorror(s);
    if (h.knockKey) knocks.add(h.knockKey);
    if (h.handleKey) {
      handles.add(h.handleKey);
      assert.ok(h.handle > 0);
    }
  }
  assert.equal(knocks.size, 3);
  assert.equal(handles.size, 1);
  s.you.station = 0;
  for (let i = 0; i < 10; i++) {
    s.world.clock = s.world.stopAt + i * 560;
    assert.equal(hotelHorror(s).wetStep, i);
    assert.equal(hotelHorror(s).wetKey, `0:${i}`);
  }
  s.you.station = 3;
  s.world.clock = s.world.stopAt + 1440;
  assert.equal(hotelHorror(s).clockStep, 2);
});

void test('all moving guests make surface footsteps and sprint cadence is faster without wall or teleport footsteps', () => {
  function walk(speed: number) {
    const s = snapshot(),
      tracker = new HotelFootsteps();
    tracker.update(s);
    let steps = 0;
    for (let frame = 0; frame < 60; frame++) {
      s.world.clock += 50;
      for (const p of s.world.players) p.z -= speed * 0.05;
      steps += tracker.update(s).length;
    }
    return steps;
  }
  assert.ok(walk(5.8) > walk(3.7));
  assert.ok(walk(3.7) >= 24, 'all four human/computer guests are audible');
  assert.equal(walk(0), 0);
  const s = snapshot(),
    tracker = new HotelFootsteps();
  tracker.update(s);
  s.world.clock += 50;
  s.world.players[0].z = -23;
  assert.deepEqual(tracker.update(s), []);
  s.world.clock += 5000;
  s.world.players[0].z = 2;
  assert.deepEqual(tracker.update(s), []);
  s.world.stage = 'travel';
  s.world.clock += 200;
  s.world.players[0].z = 3;
  assert.deepEqual(tracker.update(s), []);
  assert.equal(hotelSurface({ x: 0, z: 3 }), 'metal');
  assert.equal(hotelSurface({ x: 0, z: -10 }), 'carpet');
  assert.equal(hotelSurface({ x: 4, z: -10 }), 'wood');
});

void test('turning the camera reverses left/right sound and distant sources fade out', () => {
  const source = { x: 4, z: -10 },
    listener = { x: 0, z: -10 };
  assert.ok(hotelAcoustics(source, listener, 0).pan > 0);
  assert.ok(hotelAcoustics(source, listener, Math.PI).pan < 0);
  assert.ok(
    hotelAcoustics(source, listener, 0).gain >
      hotelAcoustics(source, { x: 0, z: 0 }, 0).gain,
  );
  assert.equal(hotelAcoustics(source, { x: 0, z: 20 }, 0).gain, 0);
});
