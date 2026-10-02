import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getCatalog } from './catalog';
import { manifest, parseCue } from './service';
import { DEFAULT_SETTINGS, type GameId } from '../../shared/audio/types';
import { bundledProfile } from '../../shared/audio/bundled-profile';
import { CraneAudioDirector } from '../../games/crane-clash/audio/director';
import { LoadAudioDirector } from '../../games/load-bearing/audio/director';
import { CurlingAudioDirector } from '../../games/panic-curling/audio/director';
import { ZorbAudioDirector } from '../../games/zorb-clash/audio/director';
import { SiegeAudioDirector } from '../../games/siege-and-desist/audio/director';
import { ButtonAudioDirector } from '../../games/one-more-button/audio/director';
import { freshClashWorld } from '../../games/crane-clash/simulation';
import { freshSite, newWrecker } from '../../games/load-bearing/simulation';
import {
  freshCurlingWorld,
  newCurlingPlayer,
  launchDelivery,
} from '../../games/panic-curling/simulation';
import {
  freshZorbWorld,
  newZorbPlayer,
} from '../../games/zorb-clash/simulation';
import { freshSiege, newCrew } from '../../games/siege-and-desist/simulation';
import {
  freshButton,
  newContestant,
} from '../../games/one-more-button/simulation';

const games: GameId[] = [
  'crane-clash',
  'load-bearing',
  'panic-curling',
  'zorb-clash',
  'one-more-button',
  'siege-and-desist',
];
for (const game of games) {
  void test(`${game}: every cue has distinct audible stereo PCM, headroom and clean endpoints`, () => {
    const hashes = new Set<string>();
    for (const cue of getCatalog(game)) {
      parseCue(cue, cue);
      const data = readFileSync(`public/audio/${game}/${cue.id}.wav`);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.readUInt16LE(22), 2);
      assert.equal(data.readUInt32LE(24), 44100);
      assert.equal(data.readUInt32LE(40), data.length - 44);
      assert.ok(
        Math.abs((data.length - 44) / 176400 - cue.duration) < 0.00003,
        cue.id,
      );
      let energy = 0,
        peak = 0;
      for (let i = 44; i < data.length; i += 2) {
        const v = data.readInt16LE(i) / 32768;
        energy += v * v;
        peak = Math.max(peak, Math.abs(v));
      }
      assert.ok(peak > 0.5 && peak < 0.85, `${cue.id}: headroom`);
      assert.ok(
        Math.sqrt(energy / ((data.length - 44) / 2)) > 0.018,
        `${cue.id}: audible`,
      );
      if (cue.loop)
        for (const channel of [0, 2])
          assert.ok(
            Math.abs(
              data.readInt16LE(44 + channel) -
                data.readInt16LE(data.length - 4 + channel),
            ) < 4,
            `${cue.id}: seam`,
          );
      hashes.add(createHash('sha256').update(data).digest('hex'));
    }
    assert.equal(hashes.size, getCatalog(game).length);
  });
  void test(`${game}: published recordings and saved mix override bundled defaults`, () => {
    const cues = getCatalog(game).map((c) => ({
      ...c,
      file: null as string | null,
      generated: null,
      error: '',
      stale: false,
    }));
    cues[0].file = `${game}/replacement.mp3`;
    cues[1].volume = 0.123;
    const result = manifest({
      game,
      settings: DEFAULT_SETTINGS,
      keySaved: false,
      keyAvailable: false,
      busy: false,
      cues,
    });
    assert.equal(Object.keys(result.cues).length, cues.length);
    assert.match(result.cues[cues[0].id].url, /replacement.mp3$/);
    assert.equal(result.cues[cues[1].id].volume, 0.123);
    const prepared = bundledProfile(game, getCatalog(game)).prepareManifest!(
      result,
    );
    assert.equal(prepared.cues[cues[1].id].volume, 0.123);
  });
}

void test('Crane machinery moves, falling materials land once, old events do not replay', () => {
  const d = new CraneAudioDirector(),
    w = freshClashWorld(100000);
  w.phase = 'playing';
  w.started = w.clock;
  const crate = w.crates[0];
  crate.kind = 'beam';
  crate.vy = -6;
  d.update(w);
  w.clock += 50;
  w.cranes.red.cableLength += 0.1;
  crate.vy = 0;
  w.events.push({ id: 1, type: 'grab', at: w.clock, text: '', team: 'red' });
  const p = d.update(w);
  assert.ok(p.motor > 0);
  assert.ok(p.hits.some((h) => h.cue === 'event.impact-metal'));
  assert.ok(p.hits.some((h) => h.cue === 'event.cable'));
  assert.equal(d.update(structuredClone(w)).hits.length, 0);
  w.phase = 'ended';
  w.winner = 'draw';
  assert.ok(d.update(w).hits.some((h) => h.cue === 'event.draw'));
  assert.equal(d.update(null).motor, 0);
  w.clock += 5000;
  assert.equal(d.update(w).hits.length, 0);
});

void test('Load Bearing warns about strain, piano damage, swings and moving feet without frame spam', () => {
  const d = new LoadAudioDirector(),
    w = freshSite(100000),
    p = newWrecker('me', 'Me', 0, w.clock);
  w.phase = 'playing';
  w.started = w.clock;
  w.players = [p];
  p.grounded = true;
  d.update(w);
  w.clock += 400;
  p.vx = 3;
  p.swingUntil = w.clock + 500;
  w.piano.integrity = 30;
  w.parts[0].strain = 0.8;
  const cues = d.update(w).hits.map((h) => h.cue);
  for (const id of [
    'event.swing',
    'event.piano-danger',
    'event.strain',
    'event.step.1',
  ])
    assert.ok(cues.includes(id), id);
  assert.equal(d.update(w).hits.length, 0);
  assert.equal(d.update(null).debris, 0);
});

void test('Curling uses world transitions, deduplicates snapshots and limits repeated gadget bursts', () => {
  const d = new CurlingAudioDirector(),
    w = freshCurlingWorld(100000);
  w.phase = 'aiming';
  w.players = [newCurlingPlayer('me', 'Me', 0, 'red', 'deliverer', false)];
  d.update(w);
  launchDelivery(w, 0.7, 0, 0, 'granite');
  let p = d.update(w);
  assert.ok(p.hits.some((h) => h.cue === 'curling.launch'));
  assert.equal(d.update(structuredClone(w)).hits.length, 0);
  w.events = [{ type: 'sweep_burst', gadget: 'hairdryer', x: 0, z: 0 }];
  w.clock += 50;
  assert.ok(d.update(w).hits.some((h) => h.cue === 'curling.hairdryer'));
  w.clock += 50;
  assert.ok(!d.update(w).hits.some((h) => h.cue === 'curling.hairdryer'));
  w.phase = 'match_over';
  p = d.update(w);
  assert.equal(p.slide, 0);
  assert.equal(p.sweep, 0);
  assert.ok(p.hits.some((h) => h.cue === 'curling.match'));
});

void test('Zorb snapshot sounds work for guests as well as solo and stop at results', () => {
  const d = new ZorbAudioDirector(),
    w = freshZorbWorld(100000),
    p = newZorbPlayer('me', 'Me', 0, 'red');
  w.status = 'playing';
  w.players = [p];
  d.update(w);
  w.clock += 50;
  p.dashing = 0.3;
  p.braced = true;
  w.bonkCount++;
  const cues = d.update(w).hits.map((h) => h.cue);
  for (const id of ['event.dash_burst', 'event.brace_thud', 'event.zorb_bonk'])
    assert.ok(cues.includes(id), id);
  assert.equal(d.update(structuredClone(w)).hits.length, 0);
  p.turtle = true;
  assert.ok(d.update(w).hits.some((h) => h.cue === 'event.turtle_slide'));
  p.turtle = false;
  assert.ok(d.update(w).hits.some((h) => h.cue === 'event.recover'));
  w.status = 'ended';
  const result = d.update(w);
  assert.equal(result.roll, 0);
  assert.ok(result.hits.some((h) => h.cue === 'event.win'));
  d.reset();
  assert.equal(d.update(w).hits.length, 0);
});

void test('Siege winch, bees, charge warning and relief end cleanly', () => {
  const d = new SiegeAudioDirector(),
    w = freshSiege(100000),
    p = newCrew('me', 'Me', 0, w.clock);
  w.phase = 'playing';
  w.started = w.clock;
  w.players = [p];
  d.update(w);
  w.clock += 100;
  p.winding = true;
  w.wind = 1;
  w.beesUntil = w.clock + 1000;
  let plan = d.update(w);
  assert.ok(plan.winch > 0 && plan.bees > 0);
  assert.ok(plan.hits.some((h) => h.cue === 'event.ready'));
  assert.equal(d.update(w).hits.length, 0);
  w.phase = 'relief';
  assert.ok(d.update(w).hits.some((h) => h.cue === 'event.relief'));
  w.phase = 'lost';
  plan = d.update(w);
  assert.equal(plan.winch + plan.bees + plan.flight + plan.fire, 0);
});

void test('Button last-heart and prize accents occur once per transition', () => {
  const d = new ButtonAudioDirector(),
    w = freshButton(100000),
    p = newContestant('me', 'Me', 0, w.clock);
  w.phase = 'playing';
  w.started = w.clock;
  w.players = [p];
  d.update(w);
  w.clock += 50;
  p.hearts = 1;
  w.events.push({ id: 1, kind: 'press', at: w.clock, text: '' });
  const cues = d.update(w).hits.map((h) => h.cue);
  assert.ok(cues.includes('event.low-heart'));
  assert.ok(cues.includes('event.reward'));
  assert.equal(d.update(w).hits.length, 0);
});
