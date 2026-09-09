import type { AudioManifest } from '../../../shared/audio/types';
import type { AudioProfile } from '../../../shared/audio/profile';
import { buttonCatalog } from './catalog';
export const BUTTON_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  buttonCatalog.map((c) => [
    c.id,
    {
      url: `/audio/one-more-button/${c.id}.wav`,
      volume: c.volume,
      category: c.category,
      loop: c.loop,
    },
  ]),
);
export const buttonAudioProfile: AudioProfile = {
  crossfadeMusic: true,
  effectLimit: 22,
  bufferLimit: 40,
  warmLimit: 32,
  musicVolume: 1.15,
  ambienceVolume: 0.8,
  preload: () => true,
  range: () => 45,
  attenuation: (_id, distance) => Math.max(0.22, 1 - distance / 38),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...BUTTON_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
