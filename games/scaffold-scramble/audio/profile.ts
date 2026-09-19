import type { AudioProfile } from '../../../shared/audio/profile';

/** Frequently repeated handling sounds get a little pitch spread per play. */
const VARIED = /^(crank|step|soap|squeegee)\.|^(bucket\.slide|hazard\.slip)/;

/** Decoded before they are first needed, so the busiest sounds are never late. */
const WARM =
  /^(crank|soap|squeegee|hazard\.slip)|^(event\.(start|tick)|window\.clean|speech\.(start|ten))$/;

/**
 * Only recordings generated in the Admin workshop play. There are no bundled
 * defaults: a cue without a recording falls back to the small synthesized
 * stand-in in `synth.ts` until the owner generates it.
 */
export const scaffoldScrambleAudioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  effectLimit: 24,
  bufferLimit: 48,
  warmLimit: 32,
  musicVolume: 1,
  ambienceVolume: 0.8,
  seamless: () => true,
  preload: (id) => WARM.test(id),
  // The whole cradle is ten metres wide; everything on it stays audible.
  range: () => 60,
  attenuation: (_id, distance) => Math.max(0.3, 1 - distance / 40),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
  playbackRate: (id) => (VARIED.test(id) ? 0.94 + Math.random() * 0.12 : 1),
};
