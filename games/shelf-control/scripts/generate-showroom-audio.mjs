// Original, deterministic showroom score and soft shoe Foley. No external samples.
// Run: node games/shelf-control/scripts/generate-showroom-audio.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const output = new URL('../../../public/audio/shelf-control/', import.meta.url);
const RATE = 32_000,
  TAU = 2 * Math.PI;
let seed = 9317;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};
await mkdir(output, { recursive: true });

async function writeWav(name, channels, peakTarget) {
  const frames = channels[0].length;
  let peak = 0,
    squares = 0;
  for (const channel of channels)
    for (const v of channel) peak = Math.max(peak, Math.abs(v));
  const gain = peakTarget / Math.max(peak, 0.001);
  const data = Buffer.alloc(44 + frames * channels.length * 2);
  data.write('RIFF');
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(channels.length, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * channels.length * 2, 28);
  data.writeUInt16LE(channels.length * 2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(data.length - 44, 40);
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels.length; c++) {
      const v = channels[c][i] * gain;
      squares += v * v;
      data.writeInt16LE(
        Math.round(v * 32767),
        44 + (i * channels.length + c) * 2,
      );
    }
  }
  await writeFile(new URL(name, output), data);
  console.log(
    `${name}: ${(frames / RATE).toFixed(2)}s, peak ${peakTarget}, RMS ${Math.sqrt(squares / (frames * channels.length)).toFixed(3)}`,
  );
}

// A heel contact, a softer toe roll, and a brief sole brush. Filtered stochastic
// transients avoid the pitched wooden knock and long scrape of workshop steps.
for (let take = 0; take < 4; take++) {
  const samples = new Float32Array(Math.round(RATE * 0.3));
  const toeAt = 0.065 + take * 0.008;
  let low = 0,
    body = 0,
    brush = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / RATE,
      white = noise();
    low += 0.045 * (white - low);
    body += 0.18 * (white - body);
    brush += 0.32 * (white - brush);
    const contact = (at, decay) => {
      const age = t - at;
      return age < 0 ? 0 : (1 - Math.exp(-age * 950)) * Math.exp(-age * decay);
    };
    const heel = contact(0.006, 62 + take * 2);
    const toe = contact(toeAt, 48 + take * 3);
    const scuff = contact(toeAt + 0.025, 29);
    const release = Math.min(1, (0.3 - t) / 0.055);
    samples[i] =
      release *
      (low * (2.5 * heel + 1.3 * toe) +
        body * (0.42 * heel + 0.26 * toe) +
        (brush - body) * scuff * 0.15);
  }
  await writeWav(
    `step.floor${take ? `.${take}` : ''}.wav`,
    [samples],
    0.62 - take * 0.025,
  );
}

// Sixteen bars at 96 BPM. Soft felt-like keys, round bass and sparse high notes.
// Every note tail wraps into the start of the buffer, including room reflections.
const seconds = 40,
  frames = seconds * RATE,
  beat = 60 / 96;
const score = [new Float32Array(frames), new Float32Array(frames)];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
function note(at, midi, duration, gain, pan = 0, bass = false) {
  const freq = hz(midi);
  for (const [delay, level, spread] of [
    [0, 1, pan],
    [0.071, 0.09, -pan],
    [0.137, 0.045, pan * 0.4],
  ]) {
    const offset = Math.round((at + delay) * RATE);
    const left = gain * level * Math.sqrt((1 - spread) / 2);
    const right = gain * level * Math.sqrt((1 + spread) / 2);
    for (let n = 0; n < duration * RATE; n++) {
      const t = n / RATE,
        phase = TAU * freq * t;
      const envelope =
        (1 - Math.exp(-t * (bass ? 45 : 100))) *
        Math.exp(-t * (bass ? 3 : 4)) *
        Math.min(1, (duration - t) / 0.08);
      const v =
        envelope *
        (Math.sin(phase) +
          0.18 * Math.sin(phase * 2) * Math.exp(-t * 5) +
          (bass ? 0 : 0.07 * Math.sin(phase * 3) * Math.exp(-t * 12)));
      const i = (offset + n) % frames;
      score[0][i] += v * left;
      score[1][i] += v * right;
    }
  }
}
const chords = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [55, 59, 62, 65],
  [52, 55, 59, 62],
];
const melody = [
  [76, 72, 71],
  [72, 69, 67],
  [74, 71, 69],
  [71, 67, 64],
];
for (let bar = 0; bar < 16; bar++) {
  const at = bar * 4 * beat,
    chord = chords[bar % 4];
  note(at, chord[0] - 12, 1.6, 0.34, 0, true);
  note(at + 2.5 * beat, chord[0] - 5, 1.2, 0.16, 0, true);
  chord.forEach((pitch, index) => {
    note(
      at + (0.5 + index * 0.5) * beat,
      pitch + 12,
      1.7,
      0.13,
      (index - 1.5) * 0.2,
    );
    if (bar % 2 === 0)
      note(at + 3 * beat + index * 0.022, pitch, 1.4, 0.055, -0.2);
  });
  if (bar % 2 === 1)
    melody[Math.floor(bar / 2) % 4].forEach((pitch, index) =>
      note(at + [0.25, 1.75, 3.25][index] * beat, pitch, 1.8, 0.085, 0.18),
    );
}
await writeWav('music.showroom.wav', score, 0.6);
