// Original procedural Foley and music. No external samples, accounts or services.
// Run from the repository root: node --import tsx scripts/generate-immersive-audio.mjs
// Existing recordings are preserved. Delete an individual generated file to rebuild it.
import { mkdir, access, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getCatalog } from '../platform/audio/catalog.ts';

const games = [
  'crane-clash',
  'load-bearing',
  'panic-curling',
  'zorb-clash',
  'one-more-button',
  'siege-and-desist',
];
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

function score(r, c, gameIndex) {
  const beat = c.duration / 16,
    root = 48 + gameIndex * 2;
  const melody = [0, 7, 12, 10, 7, 3, 5, 7, 0, 3, 7, 12, 10, 7, 5, 3];
  for (let i = 0; i < 16; i++) {
    r.tone(
      i * beat,
      beat * 1.7,
      hz(root + 12 + melody[(i + gameIndex) % 16]),
      0.2,
      undefined,
      'wood',
      Math.sin(i) * 0.4,
    );
    if (i % 2 === 0)
      r.tone(i * beat, beat * 1.5, hz(root + (i < 8 ? 0 : 5)), 0.25);
    r.noise(i * beat, 0.06, 0.2, 0.12);
    if (i % 4 === 2) r.noise(i * beat, 0.09, 0.22, 0.6);
    r.noise((i + 0.5) * beat, 0.045, 0.08, 0.8, false, 0.5);
  }
}

function bed(r, c) {
  const id = c.id,
    d = c.duration;
  const mechanical = /crane|winch|conveyor|spinner|charge|hairdryer/.test(id);
  const ice = /slide|sweep|rink/.test(id),
    fire = /fire|soap|debris/.test(id);
  // Periodic colored texture keeps the ambience quiet, broad and free of hiss.
  for (const pan of [-0.75, 0.75]) {
    let low = 0;
    r.add(
      0,
      d,
      (t) => {
        low += 0.028 * (random() * 2 - 1 - low);
        return low * (0.7 + 0.18 * Math.sin((TAU * t * 2) / d));
      },
      0.7,
      pan,
    );
  }
  if (mechanical || /bees/.test(id)) {
    const f = /bees/.test(id) ? 185 : /charge/.test(id) ? 165 : 73;
    r.add(
      0,
      d,
      (t) =>
        (Math.sin(TAU * f * t) + 0.18 * Math.sin(TAU * f * 3 * t)) *
        (0.12 + 0.03 * Math.sin((TAU * t * 8) / d)),
      0.7,
    );
    for (let at = 0; at < d; at += 0.16)
      r.tone(
        at,
        0.08,
        480 + random() * 90,
        0.065,
        undefined,
        'wood',
        random() - 0.5,
      );
  } else if (fire) {
    for (let i = 0; i < d * 18; i++) {
      const at = random() * d;
      r.noise(
        at,
        0.03 + random() * 0.08,
        0.15 + random() * 0.2,
        0.3,
        false,
        random() * 1.6 - 0.8,
      );
    }
  } else if (ice || /roll|swing|flight/.test(id)) {
    for (let at = 0; at < d; at += 0.24)
      r.noise(at, 0.38, 0.35, ice ? 0.3 : 0.08, true, Math.sin(at) * 0.5);
  } else if (/crowd|camp/.test(id)) {
    for (let i = 0; i < d * 3; i++)
      r.noise(random() * d, 0.09, 0.25, 0.2, false, random() * 1.6 - 0.8);
  }
}

function effect(r, c) {
  const id = c.id,
    d = c.duration,
    f = 110 + random() * 40;
  if (
    /win|finish|match|height|reward|ready|turn$|help|escape|cheer|start$|relief|goal/.test(
      id,
    )
  ) {
    const notes = /lose|lost|bust|draw/.test(id) ? [0, -3, -7] : [0, 4, 7, 12];
    notes.forEach((n, i) =>
      r.tone(
        i * d * 0.13,
        d * 0.55,
        hz(60 + n),
        0.4,
        undefined,
        'metal',
        (i - 1.5) * 0.25,
      ),
    );
    r.noise(0, Math.min(d, 0.7), 0.3, 0.15, true);
  } else if (/lose|lost|bust|draw/.test(id)) {
    [55, 52, 48].forEach((n, i) =>
      r.tone(i * d * 0.18, d * 0.5, hz(n), 0.4, undefined, 'rubber'),
    );
  } else if (/whistle|warning|tick|countdown|ui|mark|door|low-heart/.test(id)) {
    const pitch = /ui|tick|countdown/.test(id)
      ? 650
      : /whistle/.test(id)
        ? 1900
        : 440;
    r.tone(0, Math.min(d, 0.28), pitch, 0.4, pitch * 0.96, 'wood');
    if (!/ui|tick/.test(id)) r.tone(d * 0.36, d * 0.3, pitch * 0.75, 0.25);
  } else if (
    /slip|turtle|recover|recoil|bonk|brace|dash|ball_kick|zorb|honk/.test(id)
  ) {
    const rise = /recover|recoil/.test(id);
    r.tone(0, d * 0.85, rise ? 90 : 420, 0.55, rise ? 450 : 55, 'rubber');
    r.tone(0.035, d * 0.4, 120, 0.3, 42, 'rubber');
    r.noise(0, d * 0.4, 0.45, 0.12);
  } else if (/flyby|launch|swing|jump|toss|loose|place/.test(id)) {
    r.noise(0, d * 0.8, 0.9, 0.13, true, -0.3);
    r.noise(d * 0.1, d * 0.6, 0.6, 0.3, true, 0.4);
    r.tone(0, d * 0.35, 170, 0.12, 80);
  } else if (/hairdryer|blowtorch|bees/.test(id)) {
    r.noise(0, d, 0.9, 0.25, true);
    r.tone(0, d, id.includes('hairdryer') ? 220 : 160, 0.15, 120, 'rubber');
  } else if (/creak|strain|cable|wind/.test(id)) {
    for (let i = 0; i < 7; i++) {
      const at = (i * d) / 9;
      r.tone(
        at,
        d * 0.3,
        80 + i * 19,
        0.22,
        130 + i * 12,
        'wood',
        Math.sin(i) * 0.4,
      );
      r.noise(at, 0.045, 0.4, 0.2);
    }
  } else if (/splash|soap/.test(id)) {
    r.noise(0, d * 0.8, 1, 0.13);
    for (let i = 0; i < 14; i++)
      r.tone(
        random() * d * 0.8,
        0.1,
        300 + random() * 900,
        0.08,
        150,
        'rubber',
        random() - 0.5,
      );
  } else if (/piano/.test(id)) {
    [48, 49, 55, 61, 66].forEach((n, i) =>
      r.tone(
        i * 0.015,
        d * 0.9,
        hz(n),
        0.3,
        undefined,
        'metal',
        i * 0.25 - 0.5,
      ),
    );
    r.noise(0, 0.12, 0.7, 0.2);
  } else {
    const metal = /metal|rim|grab|crane|spinner/.test(id);
    const crash = /break|collapse|rubble|topple|impact|pot/.test(id);
    const step = /step/.test(id);
    r.tone(
      0,
      Math.min(d, 0.55),
      metal ? f * 3 : f,
      step ? 0.22 : 0.55,
      metal ? f * 2.9 : f * 0.8,
      metal ? 'metal' : 'wood',
    );
    r.noise(0, step ? 0.13 : Math.min(d, 0.5), 0.8, metal ? 0.4 : 0.16);
    if (crash)
      for (let i = 0; i < 12; i++) {
        const at = random() * d * 0.75;
        r.noise(
          at,
          0.035 + random() * 0.13,
          0.15 + random() * 0.35,
          0.2,
          false,
          random() * 1.5 - 0.75,
        );
        r.tone(at, 0.12, 200 + random() * 600, 0.1);
      }
  }
}

for (const [index, game] of games.entries()) {
  const dir = `public/audio/${game}`;
  await mkdir(dir, { recursive: true });
  let created = 0;
  for (const cue of getCatalog(game)) {
    const path = `${dir}/${cue.id}.wav`;
    if (
      await access(path).then(
        () => true,
        () => false,
      )
    )
      continue;
    seed = createHash('sha256')
      .update(`${game}:${cue.id}`)
      .digest()
      .readUInt32LE(0);
    const recording = new Recording(cue.duration, cue.loop);
    if (cue.category === 'music' && cue.loop) score(recording, cue, index);
    else if (cue.loop) bed(recording, cue);
    else effect(recording, cue);
    await recording.save(path);
    created++;
  }
  console.log(
    `${game}: ${created} originals created; ${getCatalog(game).length} bundled cues total`,
  );
}
