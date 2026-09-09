import type { AudioProfile } from '../../../shared/audio/profile';
import { stackAcoustics, stackAttenuation } from './ambience';

export const audioProfile: AudioProfile = {
  availableVariants: true,
  crossfadeMusic: true,
  musicVolume: 1.45,
  ambienceVolume: 1.2,
  bufferLimit: 112,
  warmLimit: 104,
  effectLimit: 10,
  seamless: () => true,
  preload: (id) =>
    /^(material\.|land\.|strain\.|water\.|crane\.|coast\.|event\.|music\.cinematic\.rescue$)/.test(
      id,
    ),
  range: (id) => stackAcoustics(id).range,
  attenuation: stackAttenuation,
  natural: (id) =>
    /^(material\.|step\.|land\.|strain\.|water\.|crane\.|coast\.|event\.)/.test(
      id,
    ),
};
