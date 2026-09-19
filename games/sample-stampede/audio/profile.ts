import type { AudioProfile } from '../../../shared/audio/profile';

/** Other shoppers' footsteps fade out well before the rest of the store does. */
export const STEP_RANGE = 16;
/** The warehouse is 52 by 68 metres; a crash at the far wall is still faint news. */
export const STORE_RANGE = 50;

/** `cart.skid.3` and `cart.skid` share one cooldown, per cart. */
export const takeBase = (id: string) => id.replace(/\.[23]$/, '');

export const sampleStampedeAudioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  effectLimit: 20,
  bufferLimit: 64,
  warmLimit: 48,
  musicVolume: 1,
  ambienceVolume: 0.85,
  // Short one-shots are decoded ahead; beds, score and lines load when needed.
  preload: (id) =>
    !id.startsWith('music.') &&
    !id.startsWith('ambience.') &&
    !id.startsWith('speech.') &&
    id !== 'stampede.store_muzak' &&
    id !== 'stampede.squeaky_wheel',
  seamless: () => true,
  natural: () => true,
  range: (id) => (id.startsWith('step.') ? STEP_RANGE : STORE_RANGE),
  attenuation: (id, distance) =>
    id.startsWith('step.')
      ? Math.max(0, Math.min(1, 1 - distance / STEP_RANGE))
      : Math.max(0.15, 1 - distance / 42),
  cooldownKey: (id, sourceId) =>
    sourceId ? `${takeBase(id)}:${sourceId}` : takeBase(id),
};
