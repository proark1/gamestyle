import type { AudioProfile } from '../../../shared/audio/profile';

/** Other workers' footsteps fade out well before the rest of the site does. */
export const STEP_RANGE = 14;
/** The wrecking load's whoosh is for whoever is near the ledge. */
export const SWING_RANGE = 24;
/** Everything else on the site carries this far. */
export const SITE_RANGE = 45;

function range(id: string) {
  if (id.startsWith('step.')) return STEP_RANGE;
  return id === 'hazard.swing' ? SWING_RANGE : SITE_RANGE;
}

/** Cues recorded as one take; a small pitch spread keeps repeats from sounding copied. */
const SINGLE_TAKES = new Set([
  'step.net',
  'hazard.swing',
  'crew.brace',
  'chain.taut',
  'chain.dangle',
]);

/**
 * Only recordings made in the sound workshop enter the manifest. Anything not
 * recorded yet is left out, so the game knows to fall back to its synthesized
 * cue instead of reaching for a file that does not exist.
 */
export const chainOfFoolsAudioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  effectLimit: 20,
  bufferLimit: 56,
  warmLimit: 40,
  musicVolume: 1,
  ambienceVolume: 0.8,
  // Short one-shots are decoded ahead; beds, score and lines load when needed.
  preload: (id) =>
    !id.startsWith('music.') &&
    !id.startsWith('ambience.') &&
    !id.startsWith('speech.'),
  seamless: () => true,
  range,
  // Nearby-only sounds fade right out; the rest stay faintly audible site-wide.
  attenuation: (id, distance) =>
    range(id) < SITE_RANGE
      ? Math.max(0, Math.min(1, 1 - distance / range(id)))
      : Math.max(0.2, 1 - distance / 40),
  playbackRate: (id) =>
    SINGLE_TAKES.has(id) ? 0.94 + Math.random() * 0.12 : 1,
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
};
