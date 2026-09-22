import type { AudioProfile } from './profile';
import type { AudioManifest, Cue, GameId } from './types';

export function bundledCues(
  game: GameId,
  catalog: Cue[],
): AudioManifest['cues'] {
  return Object.fromEntries(
    catalog.map((cue) => [
      cue.id,
      {
        url: `/audio/${game}/${cue.id}.wav`,
        volume: cue.volume,
        category: cue.category,
        loop: cue.loop,
      },
    ]),
  );
}

export function bundledProfile(game: GameId, catalog: Cue[]): AudioProfile {
  const defaults = bundledCues(game, catalog);
  return {
    crossfadeMusic: true,
    availableVariants: true,
    effectLimit: 24,
    bufferLimit: 64,
    warmLimit: 48,
    preload: () => true,
    range: () => 80,
    attenuation: (_id, distance) => Math.max(0.15, 1 - distance / 70),
    cooldownKey: (id, source) => (source ? `${id}:${source}` : id),
    prepareManifest: (manifest) => ({
      ...manifest,
      cues: { ...defaults, ...manifest.cues },
    }),
  };
}
