// Original synthesized defaults. No external samples, credentials or generation fees.
// node games/dont-wake-the-giant/scripts/generate-sleep-audio.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const directory = new URL(
  '../../../public/audio/dont-wake-the-giant/',
  import.meta.url,
);
mkdirSync(directory, { recursive: true });
const rate = 24_000;
let seed = 1873;
const noise = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const tau = Math.PI * 2;
function wav(name, seconds, sample) {
  const count = Math.round(seconds * rate);
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  let peak = 0,
    energy = 0;
  for (let i = 0; i < count; i++) {
    const value = sample(i / rate);
    if (!Number.isFinite(value) || Math.abs(value) >= 1)
      throw Error('Clipped audio');
    peak = Math.max(peak, Math.abs(value));
    energy += value * value;
    bytes.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
  }
  writeFileSync(new URL(name, directory), bytes);
  console.log(
    `${name}: ${seconds.toFixed(2)} seconds, peak ${peak.toFixed(3)}, RMS ${Math.sqrt(energy / count).toFixed(3)}`,
  );
}

let air = 0,
  rumble = 0;
// Two 5.655-second breaths match the giant's 900ms sine period. Quiet nasal
// turbulence plus fluttering low harmonics create a gentle, recognisable snore.
wav('snoring.wav', 4 * Math.PI * 0.9, (t) => {
  const phase = (t / (tau * 0.9)) % 1;
  const inhale = Math.sin(Math.PI * Math.min(1, phase / 0.46)) ** 2;
  const exhale =
    phase > 0.5 ? Math.sin((Math.PI * (phase - 0.5)) / 0.5) ** 2 : 0;
  air += (noise() - air) * 0.2;
  rumble += (noise() - rumble) * 0.035;
  const flutter = 0.6 + 0.4 * Math.sin(tau * 27 * t);
  const nasal =
    Math.sin(tau * 74 * t) +
    0.35 * Math.sin(tau * 148 * t) +
    0.16 * Math.sin(tau * 296 * t);
  return (
    inhale * (0.13 * nasal * flutter + 0.3 * rumble + 0.1 * air) +
    exhale * air * 0.16
  );
});
wav('shupia-warning.wav', 1.8, (t) => {
  const call = Math.floor(t / 0.48),
    local = t % 0.48;
  if (call > 2 || local > 0.29) return 0;
  const envelope = Math.sin((Math.PI * local) / 0.29) ** 2;
  return (
    envelope *
    (0.2 * Math.sin(tau * ((850 + call * 150) * local + 200 * local * local)) +
      noise() * 0.025)
  );
});
wav('hurry.wav', 2, (t) => {
  const beat = t % 0.25;
  const envelope = Math.min(1, beat * 1000) * Math.exp(-beat * 60);
  return envelope * (Math.sin(tau * 380 * beat) * 0.26 + noise() * 0.07);
});
const notes = [146.83, 174.61, 220, 233.08, 146.83, 174.61, 207.65, 220];
wav('escape.wav', 20, (t) => {
  const eighth = 60 / 144 / 2,
    beat = t % eighth;
  const note = notes[Math.floor(t / eighth) % notes.length];
  const envelope = Math.min(1, beat * 160) * Math.exp(-beat * 18);
  const pluck =
    Math.sin(tau * note * beat) + 0.25 * Math.sin(tau * note * 2 * beat);
  const bassBeat = t % (eighth * 4);
  const bass =
    Math.min(1, bassBeat * 70) *
    Math.exp(-bassBeat * 6) *
    Math.sin(tau * 73.416 * bassBeat);
  return envelope * pluck * 0.2 + bass * 0.14;
});
