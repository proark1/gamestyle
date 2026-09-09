import type { AudioProfile } from '../../../shared/audio/profile';
import type { AudioManifest } from '../../../shared/audio/types';

/** Bundled defaults keep the warning and sleeping giant audible in new libraries. */
export const GIANT_DEFAULT_AUDIO: AudioManifest['cues'] = {
  'speech.escape-warning': {
    url: '/audio/dont-wake-the-giant/shupia-escape-warning.mp3',
    category: 'speech',
    volume: 0.8,
    loop: false,
  },
  'speech.giant-wake': {
    url: '/audio/dont-wake-the-giant/giant-angry-shout.mp3',
    category: 'speech',
    volume: 0.9,
    loop: false,
  },
  'ambience.breathing': {
    url: '/audio/dont-wake-the-giant/snoring.wav',
    category: 'ambience',
    volume: 0.6,
    loop: true,
  },
  'ambience.escape-warning': {
    url: '/audio/dont-wake-the-giant/hurry.wav',
    category: 'ambience',
    volume: 0.7,
    loop: true,
  },
  'event.escape-warning': {
    url: '/audio/dont-wake-the-giant/shupia-warning.wav',
    category: 'event',
    volume: 0.7,
    loop: false,
  },
  'music.escape': {
    url: '/audio/dont-wake-the-giant/escape.wav',
    category: 'music',
    volume: 0.65,
    loop: true,
  },
};

export const giantAudioProfile: AudioProfile = {
  playbackRate: (id) => (id === 'speech.giant-wake' ? 0.84 : 1),
  crossfadeMusic: true,
  preload: (id) =>
    [
      'speech.escape-warning',
      'speech.giant-wake',
      'event.escape-warning',
      'music.escape',
      'ambience.breathing',
      'ambience.escape-warning',
    ].includes(id),
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...GIANT_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
