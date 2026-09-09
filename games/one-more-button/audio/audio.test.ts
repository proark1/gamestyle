import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buttonCatalog } from './catalog';
import { BUTTON_DEFAULT_AUDIO, buttonAudioProfile } from './profile';
import { ButtonAudioDirector } from './director';
import { buttonAction, freshButton, newContestant } from '../simulation';
import { nextHazard } from '../level';
import { manifest, parseCue } from '../../../platform/audio/service';
import {
  DEFAULT_SETTINGS,
  type AudioLibrary,
} from '../../../shared/audio/types';

function show() {
  const world = freshButton(100_000);
  for (let i = 0; i < 4; i++)
    world.players.push(newContestant(String(i), `Player ${i}`, i, world.clock));
  buttonAction(world, '0', { type: 'start' }, '0');
  return world;
}
void test('The complete original sound bank is playable stereo PCM with headroom and clean loop seams', () => {
  const hashes = new Set<string>();
  assert.equal(buttonCatalog.length, 28);
  for (const cue of buttonCatalog) {
    assert.doesNotThrow(() => parseCue(cue, cue), cue.id);
    const data = readFileSync(`public${BUTTON_DEFAULT_AUDIO[cue.id].url}`);
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.readUInt16LE(22), 2);
    assert.equal(data.readUInt32LE(24), 44100);
    assert.equal(data.readUInt16LE(34), 16);
    assert.equal(data.readUInt32LE(40), data.length - 44);
    assert.ok(
      Math.abs((data.length - 44) / 176400 - cue.duration) < 0.00003,
      cue.id,
    );
    let energy = 0,
      peak = 0;
    for (let i = 44; i < data.length; i += 2) {
      const value = data.readInt16LE(i) / 32768;
      energy += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    assert.ok(peak > 0.5 && peak < 0.85, `${cue.id} has headroom`);
    assert.ok(
      Math.sqrt(energy / ((data.length - 44) / 2)) > 0.018,
      `${cue.id} is audible`,
    );
    if (cue.loop)
      for (const channel of [0, 2])
        assert.ok(
          Math.abs(
            data.readInt16LE(44 + channel) -
              data.readInt16LE(data.length - 4 + channel),
          ) < 4,
          `${cue.id} seamless endpoints`,
        );
    hashes.add(createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(
    hashes.size,
    buttonCatalog.length,
    'Every recording is distinct',
  );
});
void test('Public manifest includes bundled audio, honors saved volume and prefers workshop replacements', () => {
  const library: AudioLibrary = {
    game: 'one-more-button',
    settings: DEFAULT_SETTINGS,
    keySaved: false,
    keyAvailable: false,
    busy: false,
    cues: buttonCatalog.map((c) => ({
      ...c,
      file: null,
      generated: null,
      error: '',
      stale: false,
    })),
  };
  library.cues.find((c) => c.id === 'music.show')!.volume = 0.31;
  library.cues.find((c) => c.id === 'event.press')!.file =
    'one-more-button/custom.mp3';
  const result = manifest(library);
  assert.equal(Object.keys(result.cues).length, 28);
  assert.equal(result.cues['music.show'].volume, 0.31);
  assert.match(result.cues['event.press'].url, /custom.mp3/);
  assert.equal(
    buttonAudioProfile.prepareManifest!(result).cues['music.show'].volume,
    0.31,
  );
  assert.notEqual(
    buttonAudioProfile.cooldownKey!('event.punch', '1'),
    buttonAudioProfile.cooldownKey!('event.punch', '2'),
  );
});
void test('Music escalates with greed and escape, then ends with the correct sting', () => {
  const d = new ButtonAudioDirector(),
    w = show();
  assert.equal(d.update(null).music, 'music.show');
  assert.equal(d.update(w).music, 'music.show');
  w.presses = 4;
  assert.equal(d.update(w).music, 'music.chaos');
  w.phase = 'escape';
  w.escapeAt = w.clock + 5000;
  let plan = d.update(w);
  assert.equal(plan.music, 'music.escape');
  assert.ok(plan.hits.some((h) => h.cue === 'event.tick'));
  assert.ok(!d.update(w).hits.some((h) => h.cue === 'event.tick'));
  w.clock += 1000;
  assert.ok(d.update(w).hits.some((h) => h.cue === 'event.tick'));
  w.phase = 'lost';
  w.events.push({ id: ++w.eventId, kind: 'finish', text: '', at: w.clock });
  plan = d.update(w);
  assert.equal(plan.music, null);
  assert.ok(plan.hits.some((h) => h.cue === 'event.bust'));
  assert.equal(plan.conveyor + plan.spinner + plan.soap, 0);
});
void test('Four simultaneous launches retain four impacts, without replaying snapshots or old events', () => {
  const d = new ButtonAudioDirector(),
    w = show();
  d.update(w);
  for (let i = 0; i < 4; i++)
    w.events.push({
      id: ++w.eventId,
      kind: 'punch',
      at: w.clock,
      text: `Player ${i} launched`,
    });
  const hits = d.update(w).hits.filter((h) => h.cue === 'event.punch');
  assert.equal(hits.length, 4);
  assert.equal(new Set(hits.map((h) => h.source)).size, 4);
  assert.equal(d.update(structuredClone(w)).hits.length, 0);
  w.clock += 2000;
  assert.equal(
    new ButtonAudioDirector().update(w).hits.length,
    0,
    'Joining does not replay old chaos',
  );
});
void test('Hazards become audible on activation and each glove warns before firing', () => {
  const d = new ButtonAudioDirector(),
    w = show();
  w.hazards = [0, 1, 2, 3].map((i) => nextHazard(i, w.clock));
  assert.equal(d.update(w).conveyor, 0);
  w.clock += 1400;
  const plan = d.update(w, '0');
  assert.equal(plan.hits.filter((h) => h.cue === 'event.hazard').length, 4);
  assert.equal(
    plan.hits.filter((h) => h.cue === 'event.glove-windup').length,
    1,
  );
  assert.ok(plan.conveyor > 0 && plan.spinner > 0 && plan.soap > 0);
  assert.equal(d.update(w).hits.length, 0);
  w.clock += 1100;
  assert.equal(
    d.update(w).hits.filter((h) => h.cue === 'event.glove-fire').length,
    1,
  );
  w.clock += 4300;
  assert.equal(
    d.update(w).hits.filter((h) => h.cue === 'event.glove-windup').length,
    1,
  );
  d.reset();
  assert.equal(d.update(null).conveyor, 0);
});
void test('Movement creates jump, landing and soap cues, and the exit chimes once when unlocked', () => {
  const d = new ButtonAudioDirector(),
    w = show(),
    p = w.players[0];
  w.doorUntil = w.clock + 5000;
  w.presses = 1;
  d.update(w, p.id);
  p.y = 0.5;
  w.clock += 50;
  assert.ok(d.update(w, p.id).hits.some((h) => h.cue === 'event.jump'));
  p.y = 0;
  w.clock += 500;
  assert.ok(d.update(w, p.id).hits.some((h) => h.cue === 'event.land'));
  const soap = nextHazard(2, w.clock - 2000);
  w.hazards.push(soap);
  p.x = soap.x;
  p.z = soap.z;
  p.vx = 3;
  assert.ok(d.update(w, p.id).hits.some((h) => h.cue === 'event.slip'));
  w.clock = w.doorUntil;
  assert.ok(d.update(w, p.id).hits.some((h) => h.cue === 'event.door-open'));
  assert.ok(!d.update(w, p.id).hits.some((h) => h.cue === 'event.door-open'));
});
