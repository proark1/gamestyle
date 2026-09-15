import type { AudioManifest } from '../../../shared/audio/types';
import type { AudioProfile } from '../../../shared/audio/profile';
import { bungeeDoublesCatalog } from './catalog';

export const BUNGEE_DOUBLES_DEFAULT_AUDIO: AudioManifest['cues'] =
  Object.fromEntries(
    bungeeDoublesCatalog.map((c) => [
      c.id,
      {
        url: `/audio/bungee-doubles/${c.id}.wav`,
        volume: c.volume,
        category: c.category,
        loop: c.loop,
      },
    ]),
  );

export const bungeeDoublesAudioProfile: AudioProfile = {
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
    cues: { ...BUNGEE_DOUBLES_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
