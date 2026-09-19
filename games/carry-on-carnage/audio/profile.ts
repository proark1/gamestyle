import type { AudioProfile } from '../../../shared/audio/profile';

/** Cues fetched as soon as the page may play sound, so the first ones are not late. */
const WARM = [
  'speech.start',
  'carryon.',
  'item.',
  'luggage.',
  'gate.sizer_',
  'event.',
];

/** Strips a `.2` or `.3` take suffix: every take of a cue shares one cooldown. */
export const takeBase = (id: string) => id.replace(/\.[23]$/, '');

export const carryOnAudioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  effectLimit: 16,
  bufferLimit: 64,
  warmLimit: 48,
  preload: (id) => WARM.some((prefix) => id.startsWith(prefix)),
  // A little distance filtering and pitch drift on positional Foley.
  natural: () => true,
  cooldownKey: (id, sourceId) =>
    sourceId ? `${takeBase(id)}:${sourceId}` : takeBase(id),
};
