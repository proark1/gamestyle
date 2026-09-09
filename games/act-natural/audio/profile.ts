import type { AudioProfile } from '../../../shared/audio/profile';
import { farmAcoustics, farmAttenuation } from '../audio';
import { farmRecordingGain } from './recording-levels';
import { FARM_FENCE_CUES, withFarmFenceAudio } from './fence';

export const audioProfile: AudioProfile = {
  trackSources: true,
  musicVolume: 0.65,
  bufferLimit: 96,
  warmLimit: 66,
  prepareManifest: (manifest) => withFarmFenceAudio('act-natural', manifest),
  seamless: (id, cue) => cue.url !== FARM_FENCE_CUES[id]?.url,
  preload: (id) =>
    /^(animal\.|nature\.|movement\.|item\.|ambience\.fence$|event\.(gate|power-off|fence-shock))/.test(
      id,
    ),
  range: (id) => farmAcoustics(id).range,
  attenuation: farmAttenuation,
  recordingGain: farmRecordingGain,
  natural: () => true,
  cooldownKey: (id, sourceId) =>
    id === 'event.fence-shock' && sourceId ? `${id}:${sourceId}` : id,
};
