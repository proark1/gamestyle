import type { AudioManifest } from '../../../shared/audio/types';
import type { AudioProfile } from '../../../shared/audio/profile';
import { scaffoldScrambleCatalog } from './catalog';

export const SCAFFOLD_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  scaffoldScrambleCatalog.map((c) => [
    c.id,
    {
      url: `/audio/scaffold-scramble/${c.id}.wav`,
      volume: c.volume,
      category: c.category,
      loop: c.loop,
    },
  ]),
);

export const scaffoldScrambleAudioProfile: AudioProfile = {
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
    cues: { ...SCAFFOLD_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
