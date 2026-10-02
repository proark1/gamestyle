// Original procedural Cage Clash sound bank. No external samples.
// Regenerate: node --import tsx games/cage-clash/scripts/generate-audio.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cageBundledCatalog } from '../audio/catalog.ts';

const RATE = 44100,
  TAU = Math.PI * 2;
let seed = 1;
const random = () =>
  (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);

class Recording {
  constructor(duration, loop) {
    this.n = Math.round(duration * RATE);
    this.loop = loop;
    this.left = new Float32Array(this.n);
    this.right = new Float32Array(this.n);
  }
  add(at, duration, signal, volume = 1, pan = 0) {
    const start = Math.round(at * RATE),
      count = Math.round(duration * RATE);
    for (let i = 0; i < count; i++) {
      let index = start + i;
      if (this.loop) index %= this.n;
      if (index < 0 || index >= this.n) continue;
      const v = signal(i / RATE, i / count) * volume;
      this.left[index] += v * Math.sqrt((1 - pan) / 2);
      this.right[index] += v * Math.sqrt((1 + pan) / 2);
    }
  }
  tone(
    at,
    duration,
    frequency,
    volume,
    end = frequency,
    material = 'wood',
    pan = 0,
  ) {
    this.add(
      at,
      duration,
      (t, u) => {
        const phase =
          TAU * (frequency * t + ((end - frequency) * t * t) / (2 * duration));
        const attack = Math.min(1, t / 0.004),
          tail = Math.min(1, (1 - u) * 30);
        const partial =
          material === 'metal' ? 2.76 : material === 'rubber' ? 1.015 : 2.08;
        return (
          attack *
          tail *
          (Math.sin(phase) * Math.exp(-u * 5) +
            0.3 * Math.sin(phase * partial) * Math.exp(-u * 9) +
            0.12 * Math.sin(phase * 4.13) * Math.exp(-u * 18))
        );
      },
      volume,
      pan,
    );
  }
  noise(at, duration, volume, color = 0.1, rise = false, pan = 0) {
    let low = 0;
    this.add(
      at,
      duration,
      (t, u) => {
        low += color * (random() * 2 - 1 - low);
        return (
          low *
          Math.min(1, t / 0.008) *
          Math.min(1, (1 - u) * 30) *
          (rise ? Math.sin(Math.PI * u) : Math.exp(-u * 5))
        );
      },
      volume,
      pan,
    );
  }
  async save(path) {
    // Smooth the seam correction across the tail without changing duration.
    if (this.loop)
      for (const data of [this.left, this.right]) {
        const blend = Math.min(Math.round(RATE * 0.04), this.n / 4);
        const correction = data[0] - data[this.n - 1];
        for (let i = 0; i < blend; i++) {
          const u = i / (blend - 1);
          data[this.n - blend + i] += correction * u * u * (3 - 2 * u);
        }
        data[this.n - 1] = data[0];
      }
    let peak = 0;
    for (let i = 0; i < this.n; i++)
      peak = Math.max(peak, Math.abs(this.left[i]), Math.abs(this.right[i]));
    const scale = 0.7 / Math.max(0.00001, peak),
      bytes = Buffer.alloc(44 + this.n * 4);
    bytes.write('RIFF');
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(2, 22);
    bytes.writeUInt32LE(RATE, 24);
    bytes.writeUInt32LE(RATE * 4, 28);
    bytes.writeUInt16LE(4, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36);
    bytes.writeUInt32LE(this.n * 4, 40);
    for (let i = 0; i < this.n; i++) {
      bytes.writeInt16LE(Math.round(this.left[i] * scale * 32767), 44 + i * 4);
      bytes.writeInt16LE(Math.round(this.right[i] * scale * 32767), 46 + i * 4);
    }
    await writeFile(path, bytes);
  }
}

function impact(r, at, weight = 1, pan = 0) {
  const duration = 0.18 + weight * 0.08;
  r.tone(at, duration, 125 / weight, 0.65, 48 / weight, 'rubber', pan);
  r.noise(at, 0.045, 1.4, 0.75, false, pan);
  r.noise(at + 0.008, duration, 1.5, 0.12, false, pan);
  r.noise(at + 0.04, duration * 1.2, 0.3, 0.18, false, -pan);
}
function cloth(r, at, duration = 0.25, volume = 1, pan = 0) {
  r.noise(at, duration, volume, 0.12, true, pan);
  r.noise(at + duration * 0.3, duration * 0.6, volume * 0.4, 0.45, true, pan);
}
function bell(r, at) {
  for (const [ratio, level] of [
    [1, 0.7],
    [2.71, 0.25],
    [4.12, 0.13],
    [5.43, 0.07],
  ])
    r.tone(at, 1.5, 710 * ratio, level, undefined, 'metal', 0.03 * ratio);
  r.noise(at, 0.035, 0.3, 0.65);
}
function crowd(r, duration, excited = false, gasp = false) {
  // Overlapping breathy resonances form an anonymous arena, without words.
  for (let i = 0; i < (excited ? 110 : 200); i++) {
    const at = random() * (gasp ? 0.22 : duration);
    const length = gasp ? 0.7 + random() * 0.5 : 0.45 + random() * 1.7;
    const pitch = 100 + random() * 190,
      pan = random() * 1.8 - 0.9;
    let low = 0,
      phase = random() * TAU;
    r.add(
      at,
      length,
      (t, u) => {
        low += 0.12 * (random() * 2 - 1 - low);
        phase += (TAU * pitch * (1 + 0.045 * Math.sin(t * 12))) / RATE;
        const voice =
          0.5 * Math.sin(phase) +
          0.18 * Math.sin(phase * 3) +
          0.1 * Math.sin(phase * 5);
        return (
          Math.sin(Math.PI * u) ** 2 *
          (low * 1.4 + voice * (excited ? 0.12 : 0.035))
        );
      },
      0.3 + random() * 0.3,
      pan,
    );
  }
  if (!gasp)
    for (let i = 0; i < (excited ? 60 : 22); i++)
      r.noise(
        random() * duration,
        0.07 + random() * 0.08,
        excited ? 0.22 : 0.07,
        0.55,
        false,
        random() * 1.8 - 0.9,
      );
}
function generate(r, c) {
  const id = c.id.replace('cage.', '');
  if (id === 'ambience.crowd' || id === 'cheer' || id === 'gasp') {
    crowd(
      r,
      c.duration - (c.loop ? 0 : 0.8),
      id !== 'ambience.crowd',
      id === 'gasp',
    );
  } else if (id === 'ambience.grapple') {
    for (let i = 0; i < 9; i++)
      cloth(r, i * 0.47, 0.32, 0.5, Math.sin(i) * 0.3);
  } else if (id === 'ambience.tension') {
    for (let i = 0; i < 8; i++) {
      r.tone(i * 0.5, 0.25, 58, 0.7, 42, 'rubber');
      r.tone(i * 0.5 + 0.16, 0.18, 68, 0.3, 45, 'rubber');
    }
  } else if (id === 'music.arena') {
    for (let i = 0; i < 16; i++) {
      const at = i * 0.5;
      r.tone(at, 0.36, 110, 0.7, 42, 'rubber');
      r.tone(at + 0.25, 0.22, hz([38, 38, 41, 36][Math.floor(i / 4)]), 0.25);
      r.noise(at + 0.25, 0.08, 0.3, 0.75, false, 0.4);
      if (i % 2) r.noise(at, 0.12, 0.55, 0.3, false, -0.2);
      if (i % 4 === 3) r.tone(at + 0.375, 0.2, 165, 0.14, 110, 'wood', -0.35);
    }
  } else if (id === 'bell' || id === 'round-end') {
    for (const at of id === 'bell' ? [0] : [0, 0.24, 0.48]) bell(r, at);
  } else if (['win', 'loss', 'draw'].includes(id)) {
    const notes =
      id === 'win' ? [50, 57, 62] : id === 'loss' ? [53, 50, 45] : [50, 57, 55];
    notes.forEach((note, i) => {
      for (const interval of [0, 12, 19])
        r.tone(i * 0.32, 1.3, hz(note + interval), 0.26);
      r.noise(i * 0.32, 0.22, 0.16, 0.13);
    });
  } else if (
    [
      'hit',
      'hit.1',
      'hit.2',
      'heavy',
      'kick-hit',
      'counter',
      'block',
      'parry',
      'guard-break',
    ].includes(id)
  ) {
    const weight =
      id === 'kick-hit'
        ? 1.6
        : ['counter', 'heavy'].includes(id)
          ? 1.3
          : id === 'parry'
            ? 0.65
            : 0.85 + random() * 0.3;
    impact(r, 0, weight);
    if (id === 'guard-break' || id === 'block')
      impact(r, 0.075, weight * 0.7, 0.15);
    if (id === 'kick-hit') cloth(r, 0, 0.23, 1.8);
  } else if (id === 'takedown' || id === 'down') {
    impact(r, 0.02, 2.5);
    r.tone(0.03, 0.65, id === 'down' ? 65 : 55, 0.85, 28, 'rubber');
    r.noise(0.025, 0.6, 1.2, 0.045);
    cloth(r, 0.18, 0.36, 0.8, -0.25);
    impact(r, 0.26, 0.4, 0.3);
  } else if (id.startsWith('step.')) {
    const weight = 0.5 + Number(id.at(-1)) * 0.12;
    r.tone(0, 0.13, 95 * weight, 0.4, 50, 'rubber');
    r.noise(0, 0.09, 0.8, 0.18);
    cloth(r, 0.025, 0.15, 0.8);
  } else if (id === 'fence') {
    for (let i = 0; i < 15; i++) {
      r.tone(
        i * 0.024,
        0.18,
        650 + random() * 1300,
        0.14 * (1 - i / 17),
        undefined,
        'metal',
        random() * 0.5 - 0.25,
      );
      r.noise(i * 0.024, 0.045, 0.15, 0.5);
    }
    r.tone(0, 0.5, 90, 0.23, 70, 'metal');
  } else if (id === 'breath') {
    r.noise(0, 0.65, 1, 0.065, true);
    r.noise(0.05, 0.48, 0.4, 0.28, true);
  } else if (['countdown', 'warning', 'event.ui'].includes(id)) {
    for (const at of id === 'warning' ? [0, 0.18, 0.36] : [0]) {
      r.tone(at, 0.15, id === 'event.ui' ? 630 : 430, 0.5, 300, 'wood');
      r.noise(at, 0.045, 0.7, 0.45);
    }
  } else if (['punch', 'kick', 'miss', 'dodge'].includes(id)) {
    cloth(r, 0, id === 'punch' ? 0.18 : 0.3, 1.4, -0.1);
    r.noise(0.04, 0.17, 0.6, id === 'kick' ? 0.05 : 0.2, true, 0.2);
  } else {
    cloth(r, 0, 0.3, 1);
    cloth(r, 0.19, 0.22, 0.6, 0.2);
    r.tone(0.04, 0.2, 80, 0.08, 50, 'rubber');
    if (id === 'submission') r.tone(0.1, 0.45, 165, 0.14, 190, 'wood');
  }
  // Fade one-shot endpoints; normalization happens afterwards.
  if (!c.loop)
    for (let i = 0; i < r.n; i++) {
      const fade = Math.min(1, i / 180, (r.n - 1 - i) / 1500);
      r.left[i] *= fade;
      r.right[i] *= fade;
    }
}

await mkdir('public/audio/cage-clash', { recursive: true });
for (const c of cageBundledCatalog) {
  seed = createHash('sha256').update(c.id).digest().readUInt32LE(0);
  const recording = new Recording(c.duration, c.loop);
  generate(recording, c);
  await recording.save(`public/audio/cage-clash/${c.id}.wav`);
}
console.log(
  `Generated ${cageBundledCatalog.length} original Cage Clash fallback recordings.`,
);
