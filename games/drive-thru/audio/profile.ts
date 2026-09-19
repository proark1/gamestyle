import type { AudioProfile } from '../../../shared/audio/profile';

/** Frequent or first-heard sounds, decoded as soon as the audio unlocks. */
const PRELOAD = new Set([
  'event.speaker-crackle',
  'event.lane-chime',
  'event.car-horn',
  'event.patty-flip',
  'event.patty-land',
  'event.shake-vent',
  'event.spatula-scrape',
  'event.toddler-toy',
  'event.wiper-sweep',
  'event.countdown-tick',
  'speech.welcome',
  'ambience.drive-thru-lane',
  'ambience.kitchen-chaos',
  'ambience.sedan-engine',
  'music.drive-thru-rush',
]);

/** Single-take sounds that repeat a lot get a little pitch drift instead. */
const DRIFT: Record<string, number> = {
  'event.car-horn': 0.05,
  'event.speaker-crackle': 0.1,
  'event.toddler-toy': 0.12,
  'event.spatula-scrape': 0.1,
  'event.patty-flip': 0.06,
  'event.patty-land': 0.06,
  'event.soda-pour': 0.05,
  'event.wiper-sweep': 0.04,
  'event.curb-scrape': 0.08,
};

/**
 * Only recordings generated in the Admin sound workshop are played. A cue with
 * no recording yet is absent from the manifest, so the game falls back to its
 * synthesized stand-in (or silence) instead of fetching a missing file.
 */
export const driveThruAudioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  effectLimit: 16,
  bufferLimit: 48,
  warmLimit: 24,
  preload: (id) => PRELOAD.has(id.replace(/\.\d$/, '')),
  // The lot is small: the kitchen still hears the lane, just quieter.
  range: () => 45,
  attenuation: (_id, distance) =>
    Math.max(0.15, Math.min(1, 1 - (distance - 3) / 24)),
  playbackRate: (id) => {
    const drift = DRIFT[id.replace(/\.\d$/, '')];
    return drift ? 1 - drift + Math.random() * drift * 2 : 1;
  },
};
