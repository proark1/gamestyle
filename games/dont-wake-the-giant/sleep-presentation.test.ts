import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Raycaster, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { GiantModel } from './giant-model';
import { giantJoints } from './giant-motion';
import {
  advanceGiant,
  freshGiant,
  giantAction,
  giantPlayer,
  giantSnapshot,
  warnGiant,
} from './simulation';
import { armPosition, platforms, restingItemPosition } from './level';
import { giantAudioEvents } from './audio-events';
import { ESCAPE_WARNING_MS, escapeWarning, untilGiantWakes } from './urgency';
import { giantAudioProfile, GIANT_DEFAULT_AUDIO } from './audio/profile';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';

void test('lobby loot and its child labels follow the rendered shirt throughout every breath', () => {
  const w = freshGiant(10_000);
  const model = new GiantModel(w);
  const ray = new Raycaster();
  const offsets = new Map<string, number>();
  for (let elapsed = 0; elapsed <= 11_400; elapsed += 90) {
    w.clock = w.started + elapsed;
    model.update(w, 0.3);
    model.updateMatrixWorld(true);
    for (const item of w.items) {
      const resting = restingItemPosition(w, item, model.clock);
      if (!resting) continue;
      const point = model.restingLootPosition(resting, item.kind);
      ray.set(new Vector3(point.x, 30, point.z), new Vector3(0, -1, 0));
      const surface = ray.intersectObject(model, true)[0];
      assert.ok(surface, `${item.id}: shirt is present`);
      assert.ok(
        point.y > surface.point.y + 0.01,
        `${item.id} clips at ${elapsed}ms`,
      );
      const offset = point.y - surface.point.y;
      if (!offsets.has(item.id)) offsets.set(item.id, offset);
      assert.ok(
        Math.abs(offset - offsets.get(item.id)!) < 0.04,
        `${item.id} floats off shirt`,
      );
    }
  }
});

void test('sleeping toes point upward and feet stay above the mattress through standing', () => {
  const w = freshGiant(10_000);
  const model = new GiantModel(w);
  for (const rig of model.legRigs) {
    const direction = new Vector3(0, 0, 1).applyQuaternion(rig.foot.quaternion);
    assert.ok(direction.y > 0.95, 'toes point toward the ceiling');
    assert.ok(new Box3().setFromObject(rig.foot).min.y >= 2.6);
  }
  w.phase = 'escape';
  w.escapeAt = w.clock + 25_000;
  for (let elapsed = 0; elapsed <= 5500; elapsed += 50) {
    w.clock = w.started + elapsed;
    model.update(w, 1);
    for (const rig of model.legRigs)
      assert.ok(
        new Box3().setFromObject(rig.foot).min.y >= 2.59,
        `heel clips at ${elapsed}`,
      );
  }
  assert.ok(
    giantJoints(w, armPosition(w)).legs.every(
      (leg) => Math.abs(leg.footPitch) < 1e-6,
    ),
  );
  for (const foot of platforms(w).filter((p) => p.id.startsWith('feet')))
    assert.ok(Math.abs(foot.y - foot.h - 2.6) < 1e-6);
});

void test('warning sounds fire exactly twenty seconds before actual wake, once, with early-wake and reconnect handling', () => {
  const w = freshGiant(10_000);
  w.players = [giantPlayer('a', 'Ada', 0, w.clock)];
  giantAction(w, 'a', { type: 'start' }, 'a');
  const snap = () =>
    structuredClone(giantSnapshot(w, 'ABC234', 'a', 'a', w.clock));
  w.clock = w.deadline + 3000 - ESCAPE_WARNING_MS - 1;
  const before = snap();
  assert.equal(escapeWarning(w), false);
  w.clock++;
  const warning = snap();
  assert.equal(untilGiantWakes(w), 20_000);
  assert.deepEqual(
    giantAudioEvents(before, warning).map((e) => e.id),
    ['speech.escape-warning', 'event.escape-warning'],
  );
  assert.deepEqual(giantAudioEvents(warning, warning), []);
  assert.deepEqual(giantAudioEvents(null, warning), []);
  w.clock = w.deadline + 2999;
  const sleeping = snap();
  advanceGiant(w, w.clock + 1);
  assert.equal(w.phase, 'escape');
  assert.equal(escapeWarning(w), false);
  assert.equal(giantAudioEvents(sleeping, snap())[0].id, 'speech.giant-wake');

  const early = freshGiant(10_000);
  early.phase = 'playing';
  early.clock += 1000;
  const old = giantSnapshot(structuredClone(early), 'ABC234', 'a', 'a', 1);
  warnGiant(early, 'wake');
  assert.equal(untilGiantWakes(early), 3000);
  assert.equal(
    giantAudioEvents(old, giantSnapshot(early, 'ABC234', 'a', 'a', 2))[0].id,
    'speech.escape-warning',
  );
});

void test('bundled sounds exist and saved workshop files and mute levels take precedence', () => {
  for (const cue of Object.values(GIANT_DEFAULT_AUDIO)) {
    const file = readFileSync(`public${cue.url}`);
    assert.ok(file.length > 1000, cue.url);
    if (cue.url.endsWith('.wav')) {
      assert.equal(file.toString('ascii', 0, 4), 'RIFF');
      assert.equal(file.readUInt32LE(40), file.length - 44);
    }
  }
  const replacement = {
    ...GIANT_DEFAULT_AUDIO['ambience.breathing'],
    url: '/custom.mp3',
    volume: 0,
  };
  const manifest = giantAudioProfile.prepareManifest!({
    settings: DEFAULT_SETTINGS,
    cues: { 'ambience.breathing': replacement },
  });
  assert.deepEqual(manifest.cues['ambience.breathing'], replacement);
  assert.equal(manifest.cues['speech.giant-wake'].category, 'speech');
});
