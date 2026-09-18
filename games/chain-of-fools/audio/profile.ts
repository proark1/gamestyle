import type { AudioProfile } from '../../../shared/audio/profile';

/**
 * Only recordings made in the sound workshop enter the manifest. Anything not
 * recorded yet is left out, so the game knows to fall back to its synthesized
 * cue instead of reaching for a file that does not exist.
 */
export const chainOfFoolsAudioProfile: AudioProfile = {
  crossfadeMusic: false,
  effectLimit: 20,
  bufferLimit: 32,
  warmLimit: 24,
  musicVolume: 1,
  ambienceVolume: 0.7,
  preload: () => true,
  range: () => 45,
  attenuation: (_id, distance) => Math.max(0.2, 1 - distance / 40),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
};
