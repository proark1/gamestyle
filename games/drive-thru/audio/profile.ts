import type { AudioProfile } from '../../../shared/audio/profile';
import type { AudioManifest } from '../../../shared/audio/types';
import { driveThruCatalog } from './catalog';

export const DRIVE_THRU_DEFAULT_AUDIO: AudioManifest['cues'] =
  Object.fromEntries(
    driveThruCatalog.map((c) => [
      c.id,
      {
        url: `/audio/drive-thru/${c.id.replace('event.', '').replace('speech.', '').replace('ambience.', '').replace('music.', '')}.mp3`,
        category: c.category,
        volume: c.volume,
        loop: c.loop,
      },
    ]),
  );

export const driveThruAudioProfile: AudioProfile = {
  crossfadeMusic: true,
  preload: (id) =>
    [
      'event.speaker-crackle',
      'event.car-horn',
      'event.grill-sizzle',
      'event.patty-flip',
      'event.shake-vent',
      'event.pole-crash',
      'event.order-served',
    ].includes(id),
  playbackRate: (id) => {
    if (id === 'event.car-horn') return 0.95 + Math.random() * 0.1;
    if (id === 'event.patty-flip') return 0.9 + Math.random() * 0.2;
    return 1;
  },
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...DRIVE_THRU_DEFAULT_AUDIO, ...manifest.cues },
  }),
};
