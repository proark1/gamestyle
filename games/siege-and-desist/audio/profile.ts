import type { AudioProfile } from '../../../shared/audio/profile';

export const siegeAudioProfile: AudioProfile = {
  crossfadeMusic: true,
  effectLimit: 18,
  bufferLimit: 32,
  warmLimit: 24,
  musicVolume: 1,
  ambienceVolume: 0.75,
  preload: () => true,
  // The field is wide, so distant masonry still reads from the engine.
  range: () => 90,
  attenuation: (_id, distance) => Math.max(0.28, 1 - distance / 80),
  cooldownKey: (id, sourceId) => (sourceId ? `${id}:${sourceId}` : id),
};
