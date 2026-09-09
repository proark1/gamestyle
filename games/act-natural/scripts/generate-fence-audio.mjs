// Original, deterministic electrical Foley; no provider account or external samples.
// Run from the repository root: node games/act-natural/scripts/generate-fence-audio.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const directory = new URL(
  '../../../public/audio/act-natural/',
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
const rate = 48_000;
let seed = 8123;
function noise() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
}
function wav(name, seconds, sample) {
  const count = Math.round(rate * seconds);
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(count * 2, 40);
  let sum = 0,
    peak = 0;
  for (let i = 0; i < count; i++) {
    const value = sample(i / rate, i);
    if (!Number.isFinite(value) || Math.abs(value) >= 1)
      throw new Error('Invalid or clipped sample');
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
    data.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  writeFileSync(new URL(name, directory), data);
  console.log(
    `${name}: ${seconds}s, peak ${peak.toFixed(3)}, RMS ${Math.sqrt(sum / count).toFixed(3)}`,
  );
}

// Integer-frequency hum joins smoothly. Each energizer tick decays before the seam.
wav('fence-powered.wav', 2, (t) => {
  const phase = (t + 0.25) % 1;
  const tick = Math.min(1, phase / 0.0015) * Math.exp(-phase * 95);
  return (
    0.3 * Math.sin(2 * Math.PI * 100 * t) +
    0.14 * Math.sin(2 * Math.PI * 200 * t) +
    0.075 * Math.sin(2 * Math.PI * 400 * t) +
    tick * (0.32 * noise() + 0.12 * Math.sin(2 * Math.PI * 1800 * t))
  );
});
let previousNoise = 0;
wav('fence-shock.wav', 0.65, (t) => {
  const white = noise();
  const crackle = (white - previousNoise) * 0.5;
  previousNoise = white;
  const attack = Math.min(1, t / 0.0015);
  const release = Math.min(1, (0.65 - t) / 0.08);
  const burst = Math.exp(-t * 10);
  const pulse = 0.65 + 0.35 * Math.sin(2 * Math.PI * 85 * t);
  const chirp = Math.sin(2 * Math.PI * (1900 * t - 1100 * t * t));
  return (
    attack *
    release *
    (0.62 * crackle * Math.exp(-t * 16) +
      0.32 * chirp * burst * pulse +
      0.14 * Math.sin(2 * Math.PI * 120 * t) * Math.exp(-t * 13))
  );
});
console.log(`Saved original sounds in ${fileURLToPath(directory)}`);
