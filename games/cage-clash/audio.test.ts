import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cageCatalog } from './audio/catalog';
import { CageAudioDirector } from './audio/director';
import { cageAudioProfile } from './audio/profile';
import { freshWorld } from './simulation';
import { emit } from './events';
import { hurt } from './combat';
import { manifest, parseCue } from '../../platform/audio/service';
import { DEFAULT_SETTINGS } from '../../shared/audio/types';

void test('Cage sound bank: every cue is valid, distinct, audible stereo PCM with clean endpoints', () => {
  const hashes = new Set<string>();
  for (const cue of cageCatalog) {
    parseCue(cue, cue);
    const b = readFileSync(`public/audio/cage-clash/${cue.id}.wav`);
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    assert.equal(b.readUInt16LE(22), 2);
    assert.equal(b.readUInt32LE(24), 44100);
    assert.equal(b.readUInt32LE(40), b.length - 44);
    assert.ok(Math.abs((b.length - 44) / 176400 - cue.duration) < 0.00003);
    let energy = 0,
      peak = 0;
    for (let i = 44; i < b.length; i += 2) {
      const v = b.readInt16LE(i) / 32768;
      energy += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak > 0.5 && peak < 0.85, `${cue.id}: headroom`);
    assert.ok(
      Math.sqrt(energy / ((b.length - 44) / 2)) > 0.018,
      `${cue.id}: audible`,
    );
    for (const channel of [0, 2]) {
      if (cue.loop)
        assert.ok(
          Math.abs(
            b.readInt16LE(44 + channel) - b.readInt16LE(b.length - 4 + channel),
          ) < 4,
          `${cue.id}: seam`,
        );
      else
        assert.equal(
          b.readInt16LE(b.length - 4 + channel),
          0,
          `${cue.id}: tail`,
        );
    }
    hashes.add(createHash('sha256').update(b).digest('hex'));
  }
  assert.equal(hashes.size, cageCatalog.length);
});

void test('Cage workshop recordings and saved mix override bundled sounds', () => {
  const cues = cageCatalog.map((c) => ({
    ...c,
    file: null as string | null,
    generated: null,
    error: '',
    stale: false,
  }));
  cues[0].file = 'cage-clash/custom.mp3';
  cues[1].volume = 0.123;
  const result = cageAudioProfile.prepareManifest!(
    manifest({
      game: 'cage-clash',
      settings: DEFAULT_SETTINGS,
      keySaved: false,
      keyAvailable: false,
      busy: false,
      cues,
    }),
  );
  assert.equal(Object.keys(result.cues).length, cageCatalog.length);
  assert.match(result.cues[cues[0].id].url, /custom.mp3$/);
  assert.equal(result.cues[cues[1].id].volume, 0.123);
});

const playing = () => {
  const w = freshWorld(1000);
  w.phase = 'playing';
  return w;
};
void test('Impacts distinguish kicks and heavy punches; snapshots and reconnects do not replay hits', () => {
  const w = playing(),
    d = new CageAudioDirector(),
    [a, b] = w.players;
  emit(w, 'hit', a);
  assert.deepEqual(d.update(w).hits, []);
  a.move = 'kick';
  hurt(w, a, b, 10);
  w.clock += 50;
  assert.deepEqual(
    d.update(w).hits.map((h) => h.cue),
    ['cage.kick-hit'],
  );
  assert.deepEqual(d.update(w).hits, []);
  a.move = 'hook';
  hurt(w, a, b, 10);
  w.clock += 50;
  assert.equal(d.update(w).hits[0].cue, 'cage.heavy');
  emit(w, 'down', b);
  d.reset();
  assert.deepEqual(d.update(w).hits, []);
  emit(w, 'takedown', b);
  w.clock += 5000;
  assert.deepEqual(d.update(w).hits, []);
  w.clock = 0;
  assert.deepEqual(d.update(w).hits, []);
});
void test('Countdown, bell, ten-second warning, and local result each fire once', () => {
  const w = freshWorld(1000),
    d = new CageAudioDirector(),
    me = w.players[0];
  d.update(w, me.id);
  w.phase = 'countdown';
  w.phaseTime = 3;
  w.clock += 50;
  assert.deepEqual(
    d.update(w).hits.map((h) => h.cue),
    ['cage.countdown'],
  );
  assert.deepEqual(d.update(w).hits, []);
  w.phaseTime = 2;
  w.clock += 1000;
  assert.equal(d.update(w).hits[0].cue, 'cage.countdown');
  w.phase = 'playing';
  w.time = 12;
  w.clock += 50;
  emit(w, 'bell', me);
  assert.deepEqual(
    d.update(w).hits.map((h) => h.cue),
    ['cage.bell'],
  );
  w.time = 9.9;
  w.clock += 50;
  assert.equal(d.update(w).hits[0].cue, 'cage.warning');
  assert.deepEqual(d.update(w).hits, []);
  w.phase = 'ended';
  w.winner = me.team;
  w.clock += 50;
  assert.deepEqual(
    d.update(w, me.id).hits.map((h) => h.cue),
    ['cage.round-end', 'cage.win', 'cage.cheer'],
  );
  assert.deepEqual(d.update(w, me.id).hits, []);
  w.selection++;
  w.phase = 'selection';
  assert.deepEqual(d.update(w, me.id).hits, []);
});
void test('Crowd reactions are limited and submission atmosphere stops outside the fight', () => {
  const w = playing(),
    d = new CageAudioDirector(),
    p = w.players[0];
  d.update(w);
  emit(w, 'down', p);
  emit(w, 'takedown', p);
  w.clock += 50;
  assert.equal(
    d.update(w).hits.filter((h) => h.cue === 'cage.cheer').length,
    1,
  );
  emit(w, 'counter', p);
  w.clock += 50;
  assert.ok(!d.update(w).hits.some((h) => h.cue === 'cage.gasp'));
  w.grapple = {
    mode: 'guard',
    top: p.id,
    age: 0,
    progress: 0,
    submissionBy: p.id,
    submission: 0.7,
    cooldown: 0,
    still: 0,
  };
  const active = d.update(w);
  assert.ok(active.grapple > 0 && active.tension > 0);
  w.phase = 'break';
  const stopped = d.update(w);
  assert.equal(stopped.grapple, 0);
  assert.equal(stopped.tension, 0);
});
void test('Footwork uses motion, stamina breathing is local, and held dodges do not repeat', () => {
  const w = playing(),
    d = new CageAudioDirector(),
    p = w.players[0],
    opponent = w.players[1];
  d.update(w, p.id);
  w.clock += 400;
  p.x += 1;
  p.dodge = 0.3;
  opponent.stamina = 1;
  const cues = d.update(w, p.id).hits.map((h) => h.cue);
  assert.ok(cues.includes('cage.step.1'));
  assert.ok(cues.includes('cage.dodge'));
  assert.ok(!cues.includes('cage.breath'));
  w.clock += 50;
  p.stamina = 10;
  assert.deepEqual(
    d.update(w, p.id).hits.map((h) => h.cue),
    ['cage.breath'],
  );
  w.clock += 50;
  assert.deepEqual(d.update(w, p.id).hits, []);
  w.phase = 'ended';
  d.update(w, p.id);
  w.clock += 2000;
  p.x += 1;
  assert.deepEqual(d.update(w, p.id).hits, []);
});
