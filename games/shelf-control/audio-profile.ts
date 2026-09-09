import type { AudioProfile } from '../../shared/audio/profile';
import type { AudioManifest } from '../../shared/audio/types';

export const SHELF_DEFAULT_AUDIO: AudioManifest['cues'] = {
  'music.showroom': {
    url: '/audio/shelf-control/music.showroom.wav',
    category: 'music',
    volume: 0.5,
    loop: true,
  },
  ...Object.fromEntries(
    ['step.floor', 'step.floor.1', 'step.floor.2', 'step.floor.3'].map((id) => [
      id,
      {
        url: `/audio/shelf-control/${id}.wav`,
        category: 'material' as const,
        volume: 0.55,
        loop: false,
      },
    ]),
  ),
};

function acoustics(id: string) {
  if (/^item\.(key|ladder)\.(grab|drop|unlock|place)$/.test(id))
    return { range: 5, near: 1 };
  if (id.startsWith('step.')) return { range: 7, near: 1 };
  return { range: 24, near: 2 };
}

/** Keep workshop interaction clips; bundle a quiet score and soft showroom soles. */
export const audioProfile: AudioProfile = {
  availableVariants: true,
  trackSources: true,
  warmLimit: 5,
  prepareManifest: (manifest) => ({
    ...manifest,
    cues: { ...SHELF_DEFAULT_AUDIO, ...manifest.cues },
  }),
  preload: (id) => id === 'music.showroom',
  cooldownKey: (id, sourceId) =>
    id.startsWith('step.') ? `step:${sourceId ?? 'local'}` : id,
  natural: () => true,
  range: (id) => acoustics(id).range,
  attenuation: (id, distance) => {
    const { range, near } = acoustics(id);
    return Math.max(0, Math.min(1, (range - distance) / (range - near))) ** 2;
  },
};
