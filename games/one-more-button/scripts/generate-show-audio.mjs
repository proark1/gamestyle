// Original score and comic Foley, synthesized locally. No samples or external services.
// Run: node --import tsx games/one-more-button/scripts/generate-show-audio.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buttonCatalog } from '../audio/catalog.ts';

const RATE = 44100,
  TAU = Math.PI * 2;
const output = resolve('public/audio/one-more-button');
await mkdir(output, { recursive: true });
let seed = 173;
const random = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
class Recording {
  constructor(seconds, loop = false) {
    this.frames = Math.round(seconds * RATE);
    this.loop = loop;
    this.left = new Float32Array(this.frames);
    this.right = new Float32Array(this.frames);
  }
  add(at, duration, signal, gain = 1, pan = 0) {
    const offset = Math.round(at * RATE),
      count = Math.ceil(duration * RATE);
    const l = Math.sqrt((1 - pan) / 2) * gain,
      r = Math.sqrt((1 + pan) / 2) * gain;
    for (let n = 0; n < count; n++) {
      let i = offset + n;
      if (this.loop) i = ((i % this.frames) + this.frames) % this.frames;
      if (i < 0 || i >= this.frames) continue;
      const v = signal(n / RATE, n / count);
      this.left[i] += v * l;
      this.right[i] += v * r;
    }
  }
  tone(
    at,
    freq,
    duration,
    gain = 0.3,
    kind = 'mallet',
    pan = 0,
    endFreq = freq,
  ) {
    const sample = (t, u) => {
      const phase =
        TAU * (freq * t + ((endFreq - freq) * t * t) / (2 * duration));
      const attack = Math.min(1, t / 0.006),
        release = Math.min(1, (1 - u) * 25);
      if (kind === 'brass')
        return (
          (Math.sin(phase) +
            0.36 * Math.sin(phase * 2) +
            0.2 * Math.sin(phase * 3)) *
          attack *
          release *
          Math.exp(-u * 1.8) *
          (1 + 0.04 * Math.sin(t * TAU * 5))
        );
      if (kind === 'bass')
        return (
          (Math.sin(phase) +
            0.18 * Math.sin(phase * 2) +
            0.08 * Math.sin(phase * 3)) *
          attack *
          release *
          Math.exp(-u * 3.2)
        );
      if (kind === 'whistle')
        return (
          Math.sin(phase + 0.035 * Math.sin(t * TAU * 13)) *
          Math.sin(Math.PI * u) ** 0.7
        );
      if (kind === 'bell')
        return (
          (Math.sin(phase) * Math.exp(-u * 5) +
            0.3 * Math.sin(phase * 2.76) * Math.exp(-u * 9) +
            0.13 * Math.sin(phase * 5.4) * Math.exp(-u * 12)) *
          attack *
          release
        );
      return (
        (Math.sin(phase) * Math.exp(-u * 7) +
          0.27 * Math.sin(phase * 4) * Math.exp(-u * 22)) *
        attack *
        release
      );
    };
    this.add(at, duration, sample, gain, pan);
    if (kind === 'mallet' || kind === 'brass' || kind === 'bell') {
      this.add(at + 0.075, duration, sample, gain * 0.08, -pan);
      this.add(at + 0.131, duration, sample, gain * 0.045, pan * 0.5);
    }
  }
  noise(at, duration, gain = 0.3, color = 'white', pan = 0, rise = false) {
    let low = 0,
      last = 0;
    this.add(
      at,
      duration,
      (t, u) => {
        const white = random() * 2 - 1;
        low += 0.12 * (white - low);
        const value =
          color === 'low'
            ? low * 2.5
            : color === 'high'
              ? (white - last) * 0.5
              : white;
        last = white;
        return (
          value *
          Math.min(1, t / 0.003) *
          (rise
            ? Math.sin(Math.PI * u * 0.5) * Math.min(1, (1 - u) * 15)
            : Math.exp(-u * 7) * (1 - u))
        );
      },
      gain,
      pan,
    );
  }
  drum(at, type, gain = 1, pan = 0) {
    if (type === 'kick') {
      this.tone(at, 145, 0.22, gain * 0.75, 'bass', pan, 42);
      this.noise(at, 0.018, gain * 0.11, 'low', pan);
    }
    if (type === 'snare') {
      this.noise(at, 0.19, gain * 0.46, 'high', pan);
      this.tone(at, 185, 0.12, gain * 0.17, 'bass', pan, 130);
    }
    if (type === 'hat') this.noise(at, 0.067, gain * 0.21, 'high', pan);
    if (type === 'clap')
      for (let n = 0; n < 3; n++)
        this.noise(at + n * 0.012, 0.095, gain * 0.22, 'high', pan);
    if (type === 'rim') {
      this.tone(at, 780, 0.048, gain * 0.32, 'mallet', pan);
      this.noise(at, 0.029, gain * 0.22, 'high', pan);
    }
  }
  write() {
    // Remove tiny DC bias, then use one gain for both channels to preserve stereo.
    for (const data of [this.left, this.right]) {
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      for (let i = 0; i < data.length; i++) data[i] -= mean;
      // The score's note/reverb tails wrap; a short splice also removes noise-loop clicks.
      if (this.loop) {
        const seam = 180,
          first = data[0],
          last = data[data.length - 1],
          center = (first + last) / 2;
        for (let i = 0; i < seam; i++) {
          const blend = (1 - i / seam) ** 2;
          data[i] += (center - first) * blend;
          data[data.length - 1 - i] += (center - last) * blend;
        }
      } else
        for (let i = 0; i < 220; i++) {
          data[i] *= i / 220;
          data[data.length - 1 - i] *= i / 220;
        }
    }
    let peak = 0.01;
    for (let i = 0; i < this.frames; i++)
      peak = Math.max(peak, Math.abs(this.left[i]), Math.abs(this.right[i]));
    const scale = 0.83 / peak,
      bytes = this.frames * 4,
      b = Buffer.alloc(44 + bytes);
    b.write('RIFF');
    b.writeUInt32LE(36 + bytes, 4);
    b.write('WAVEfmt ', 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(2, 22);
    b.writeUInt32LE(RATE, 24);
    b.writeUInt32LE(RATE * 4, 28);
    b.writeUInt16LE(4, 32);
    b.writeUInt16LE(16, 34);
    b.write('data', 36);
    b.writeUInt32LE(bytes, 40);
    for (let i = 0; i < this.frames; i++) {
      b.writeInt16LE(
        Math.round(Math.tanh(this.left[i] * scale) * 32767),
        44 + i * 4,
      );
      b.writeInt16LE(
        Math.round(Math.tanh(this.right[i] * scale) * 32767),
        46 + i * 4,
      );
    }
    return b;
  }
}
function score(r, name) {
  const mode = name === 'show' ? 0 : name === 'chaos' ? 1 : 2;
  const beat = 60 / [120, 144, 168][mode];
  const roots = [48, 48, 53, 53, 50, 55, 48, 55];
  const motifs = [
    [72, 76, 79, 81, 79, 76, 74, 76],
    [77, 81, 84, 86, 84, 81, 79, 77],
    [74, 77, 81, 84, 81, 79, 77, 74],
    [79, 83, 86, 88, 86, 83, 81, 79],
  ];
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * 4 * beat,
      root = roots[bar];
    for (let eighth = 0; eighth < 8; eighth++) {
      const swing = eighth % 2 ? 0.045 * beat : 0,
        t = at + (eighth * beat) / 2 + swing;
      r.drum(t, 'hat', eighth % 2 ? 0.42 : 0.7, 0.45);
      const bass = root + [0, 12, 7, 12, 0, 12, 7, 10][eighth];
      if (mode || eighth % 2 === 0)
        r.tone(t, hz(bass), beat * 0.62, 0.36, 'bass', -0.12);
      if (eighth !== 3 || mode) {
        const melody =
          motifs[
            bar < 2
              ? 0
              : bar < 4
                ? 1
                : bar === 4
                  ? 2
                  : bar === 5 || bar === 7
                    ? 3
                    : 0
          ];
        r.tone(t, hz(melody[eighth]), 0.31, 0.25, 'mallet', -0.3);
        if (mode === 2 && eighth % 2)
          r.tone(
            t + beat * 0.25,
            hz(melody[eighth] + 12),
            0.17,
            0.075,
            'mallet',
            0.4,
          );
      }
    }
    for (let b = 0; b < 4; b++) {
      r.drum(at + b * beat, b % 2 ? 'snare' : 'kick', b % 2 ? 0.68 : 0.75);
      if (b % 2) r.drum(at + b * beat + 0.013, 'clap', 0.5, -0.4);
      if (mode && b % 2 === 0)
        r.drum(at + (b + 0.75) * beat, 'rim', 0.35, -0.6);
    }
    // Cheeky syncopated major-sixth brass, with a dominant turn at the end.
    for (const b of [1.5, 3])
      for (const [i, interval] of [12, 16, 21].entries())
        r.tone(
          at + b * beat + i * 0.004,
          hz(root + interval),
          beat * 0.38,
          0.095 + mode * 0.018,
          'brass',
          0.35,
        );
    if (bar === 3 || bar === 7)
      for (let n = 0; n < 4 + mode * 2; n++)
        r.drum(
          at + (3 + n / (4 + mode * 2)) * beat,
          'snare',
          0.22 + n * 0.035,
          (n % 2 ? 1 : -1) * 0.3,
        );
  }
}
function effect(r, name) {
  const bell = (at, notes, gap = 0.11, gain = 0.4) =>
    notes.forEach((n, i) =>
      r.tone(at + i * gap, hz(n), 0.65, gain, 'bell', ((i % 3) - 1) * 0.35),
    );
  const boing = (at, freq = 150, length = 0.45, gain = 0.4) =>
    r.add(
      at,
      length,
      (t, u) =>
        Math.sin(
          TAU * freq * t + 10 * Math.sin(t * TAU * 19) * Math.exp(-u * 4),
        ) *
        Math.exp(-u * 5) *
        Math.min(1, t * 400),
      gain,
    );
  const clunk = (at, power = 0.5) => {
    r.noise(at, 0.18, power, 'low');
    r.tone(at, 125, 0.2, power, 'bass', 0, 55);
    r.drum(at + 0.015, 'rim', power * 0.4);
  };
  switch (name) {
    case 'start':
    case 'finish': {
      const notes =
        name === 'start' ? [60, 64, 67, 72, 76] : [67, 69, 71, 72, 76, 79];
      notes.forEach((n, i) => {
        r.tone(0.06 + i * 0.18, hz(n), 0.62, 0.28, 'brass', -0.15);
        r.tone(0.06 + i * 0.18, hz(n + 12), 0.4, 0.18, 'mallet', 0.3);
        r.drum(i * 0.18, 'snare', 0.35);
      });
      r.drum(notes.length * 0.18, 'kick', 0.8);
      r.noise(notes.length * 0.18, 0.9, 0.3, 'high');
      bell(1.2, [84, 88, 91], 0.12, 0.17);
      break;
    }
    case 'press':
      clunk(0, 0.9);
      boing(0.09, 110, 0.3, 0.3);
      bell(0.14, [84, 88, 91], 0.1, 0.48);
      for (let i = 0; i < 12; i++)
        r.drum(0.35 + i * 0.046, 'rim', 0.15 + random() * 0.12, random() - 0.5);
      break;
    case 'warning':
      for (let i = 0; i < 3; i++) {
        r.tone(i * 0.29, 220 + i * 95, 0.2, 0.45, 'brass');
        r.tone(i * 0.29, 233 + i * 95, 0.2, 0.18, 'brass');
      }
      break;
    case 'punch':
      r.noise(0, 0.08, 0.65, 'high', 0, true);
      clunk(0.055, 1.1);
      boing(0.12, 125, 0.75, 0.68);
      for (let i = 0; i < 5; i++)
        r.drum(0.17 + i * 0.065, 'rim', 0.25, i % 2 ? -0.5 : 0.5);
      break;
    case 'hit':
      clunk(0, 0.8);
      boing(0.035, 74, 0.5, 0.5);
      r.tone(0.08, 480, 0.34, 0.16, 'whistle', 0.3, 160);
      break;
    case 'fall':
      r.tone(0, 1800, 0.73, 0.32, 'whistle', -0.3, 180);
      clunk(0.76, 0.65);
      for (let i = 0; i < 5; i++)
        r.tone(
          0.84 + i * 0.085,
          700 + random() * 1400,
          0.17,
          0.17,
          'bell',
          random() - 0.5,
        );
      break;
    case 'escape':
      bell(0, [72, 76, 79, 84], 0.1, 0.48);
      [60, 64, 67].forEach((n) => r.tone(0.42, hz(n), 0.85, 0.2, 'brass'));
      for (let i = 0; i < 8; i++)
        r.drum(0.64 + i * 0.075, 'rim', 0.18, random() - 0.5);
      break;
    case 'stop':
      for (const at of [0, 0.24]) {
        r.tone(at, 420, 0.2, 0.45, 'brass', 0, 360);
        r.tone(at, 525, 0.2, 0.3, 'brass', 0, 455);
      }
      r.tone(0.48, 1100, 0.2, 0.27, 'whistle', 0, 600);
      break;
    case 'bust':
      [60, 59, 58, 53].forEach((n, i) => {
        r.tone(i * 0.4, hz(n), 0.55, 0.43, 'brass', 0, hz(n - 1));
        r.tone(i * 0.4, hz(n - 12), 0.55, 0.16, 'brass');
      });
      bell(1.94, [72], 0.1, 0.15);
      break;
    case 'glove-windup':
      r.noise(0, 1.05, 0.45, 'high', 0, true);
      for (let i = 0; i < 11; i++) r.drum(i * 0.093, 'rim', 0.2 + i * 0.025);
      r.tone(0.1, 150, 0.95, 0.32, 'whistle', 0, 600);
      break;
    case 'glove-fire':
      r.noise(0, 0.5, 0.8, 'white');
      boing(0.015, 100, 0.65, 0.65);
      r.tone(0.02, 1100, 0.3, 0.2, 'whistle', 0, 140);
      break;
    case 'hazard':
      r.noise(0, 0.45, 0.46, 'low');
      for (let i = 0; i < 9; i++)
        r.drum(0.04 + i * 0.047, 'rim', 0.25, random() - 0.5);
      bell(0.4, [79, 84], 0.16, 0.35);
      break;
    case 'slip':
      r.tone(0, 500, 0.24, 0.45, 'whistle', -0.2, 2100);
      r.tone(0.22, 2100, 0.37, 0.35, 'whistle', 0.2, 300);
      r.noise(0, 0.12, 0.15, 'high');
      break;
    case 'jump':
      r.tone(0, 160, 0.22, 0.42, 'whistle', 0, 650);
      r.noise(0, 0.11, 0.13, 'high');
      break;
    case 'land':
      clunk(0, 0.55);
      clunk(0.05, 0.28);
      break;
    case 'step':
      r.noise(0, 0.075, 0.4, 'low');
      r.tone(0.01, 210, 0.065, 0.25, 'bass');
      r.tone(0.03, 950, 0.045, 0.07, 'whistle', 0, 750);
      break;
    case 'door-open':
      bell(0, [79, 84], 0.2, 0.42);
      clunk(0.02, 0.15);
      break;
    case 'tick':
      r.drum(0, 'rim', 0.8);
      break;
    case 'crowd-cheer':
      for (let i = 0; i < 55; i++)
        r.drum(
          random() * 2.1,
          'clap',
          (0.22 + random() * 0.3) * (1 - i / 95),
          random() * 1.7 - 0.85,
        );
      for (let i = 0; i < 6; i++)
        r.tone(
          0.12 + random() * 1.5,
          1200 + random() * 900,
          0.45,
          0.12,
          'whistle',
          random() - 0.5,
          2100,
        );
      break;
    case 'crowd-gasp':
      for (let i = 0; i < 8; i++) {
        const at = random() * 0.2;
        r.noise(
          at,
          0.55 + random() * 0.35,
          0.25,
          'low',
          random() * 1.5 - 0.75,
          true,
        );
        r.tone(
          at,
          260 + i * 75,
          0.55,
          0.05,
          'whistle',
          random() - 0.5,
          550 + i * 65,
        );
      }
      break;
    case 'ui':
      r.drum(0, 'rim', 0.5);
      break;
  }
}
function ambience(r, name) {
  if (name === 'conveyor') {
    r.add(
      0,
      4,
      (t) =>
        (0.5 * Math.sin(TAU * 60 * t) +
          0.25 * Math.sin(TAU * 120 * t) +
          0.1 * Math.sin(TAU * 180 * t)) *
        (0.8 + 0.2 * Math.cos(TAU * 4 * t)),
      0.25,
    );
    for (let i = 0; i < 24; i++) {
      r.noise(i / 6, 0.075, 0.16, 'low', i % 2 ? -0.3 : 0.3);
      r.drum(i / 6, 'rim', 0.09);
    }
  } else if (name === 'spinner') {
    for (let i = 0; i < 8; i++) {
      r.tone(
        i * 0.5,
        310 + (i % 2) * 180,
        0.3,
        0.18,
        'whistle',
        i % 2 ? -0.4 : 0.4,
        140,
      );
      r.noise(i * 0.5, 0.14, 0.16, 'low');
    }
    r.add(
      0,
      4,
      (t) => Math.sin(TAU * 45 * t) * (0.6 + 0.4 * Math.cos(TAU * 2 * t)),
      0.08,
    );
  } else {
    for (let i = 0; i < 45; i++) {
      const at = random() * 4;
      r.tone(
        at,
        250 + random() * 1600,
        0.04 + random() * 0.08,
        0.08 + random() * 0.17,
        'bass',
        random() * 1.5 - 0.75,
        140,
      );
    }
    r.noise(0, 4, 0.04, 'high');
  }
}
const report = [];
for (const cue of buttonCatalog) {
  seed =
    (173 + cue.id.split('').reduce((n, c) => n * 31 + c.charCodeAt(0), 0)) >>>
    0;
  const r = new Recording(cue.duration, cue.loop),
    name = cue.id.split('.')[1];
  if (cue.category === 'music') score(r, name);
  else if (cue.category === 'ambience') ambience(r, name);
  else effect(r, name);
  const bytes = r.write();
  await writeFile(resolve(output, `${cue.id}.wav`), bytes);
  report.push({ cue: cue.id, seconds: r.frames / RATE, bytes: bytes.length });
}
console.log(
  JSON.stringify(
    {
      tracks: report.length,
      bytes: report.reduce((sum, f) => sum + f.bytes, 0),
      files: report,
    },
    null,
    2,
  ),
);
