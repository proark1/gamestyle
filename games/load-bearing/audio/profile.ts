import type { AudioManifest } from '../../../shared/audio/types';
import type { AudioProfile } from '../../../shared/audio/profile';
import { loadBearingCatalog } from './catalog';

export const LOAD_BEARING_DEFAULT_AUDIO: AudioManifest['cues'] =
  Object.fromEntries(
    loadBearingCatalog.map((c) => [
      c.id,
      {
        url: `/audio/load-bearing/${c.id}.wav`,
        volume: c.volume,
        category: c.category,
        loop: c.loop,
      },
    ]),
  );

export const loadBearingAudioProfile: AudioProfile = {
  crossfadeMusic: false,
  effectLimit: 24,
  bufferLimit: 40,
  warmLimit: 32,
  musicVolume: 1,
  ambienceVolume: 0.75,
  preload: () => true,
  range: () => 50,
  // A collapse should still read from across the yard.
  attenuation: (_id, distance) => Math.max(0.25, 1 - distance / 42),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...LOAD_BEARING_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
