import type { AudioManifest, GameId } from '../../../shared/audio/types';

/** Bundled gameplay cues work before a workshop recording has been generated. */
export const FARM_FENCE_CUES: AudioManifest['cues'] = {
  'ambience.fence': {
    url: '/audio/act-natural/fence-powered.wav',
    volume: 0.55,
    category: 'ambience',
    loop: true,
  },
  'event.fence-shock': {
    url: '/audio/act-natural/fence-shock.wav',
    volume: 0.8,
    category: 'event',
    loop: false,
  },
};

export function withFarmFenceAudio(
  game: GameId,
  manifest: AudioManifest,
): AudioManifest {
  return game === 'act-natural'
    ? { ...manifest, cues: { ...FARM_FENCE_CUES, ...manifest.cues } }
    : manifest;
}
