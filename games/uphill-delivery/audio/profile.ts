import type { AudioProfile } from '../../../shared/audio/profile';

export const audioProfile: AudioProfile = {
  bufferLimit: 64,
  warmLimit: 64,
  seamless: () => true,
  preload: (id) =>
    /^(sofa\.|goat\.|bird\.|bridge\.|clothing\.|material\.sofa\.impact$|event\.)/.test(
      id,
    ),
  natural: () => true,
};
