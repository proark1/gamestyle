import type { AudioManifest } from '../../../shared/audio/types';
import type { AudioProfile } from '../../../shared/audio/profile';
import { craneClashCatalog } from './catalog';

export const CRANE_CLASH_DEFAULT_AUDIO: AudioManifest['cues'] =
  Object.fromEntries(
    craneClashCatalog.map((c) => [
      c.id,
      {
        url: `/audio/crane-clash/${c.id}.wav`,
        volume: c.volume,
        category: c.category,
        loop: c.loop,
      },
    ]),
  );

export const craneClashAudioProfile: AudioProfile = {
  crossfadeMusic: false,
  effectLimit: 24,
  bufferLimit: 40,
  warmLimit: 32,
  musicVolume: 1,
  ambienceVolume: 0.75,
  preload: () => true,
  range: () => 60,
  attenuation: (_id, distance) => Math.max(0.25, 1 - distance / 50),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...CRANE_CLASH_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
