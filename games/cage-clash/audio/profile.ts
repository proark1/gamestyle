import { bundledProfile } from '../../../shared/audio/bundled-profile';
import type { AudioProfile } from '../../../shared/audio/profile';
import { cageBundledCatalog } from './catalog';

export const cageAudioProfile: AudioProfile = {
  ...bundledProfile('cage-clash', cageBundledCatalog),
  effectLimit: 20,
  range: () => 30,
  attenuation: (_id, distance) => Math.max(0.5, 1 - distance / 32),
};
