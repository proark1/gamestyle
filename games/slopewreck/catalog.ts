import { cue } from '../../shared/audio/catalog-helpers';
import type { AudioManifest } from '../../shared/audio/types';
import type { RaceEvent } from './types';

const clips: Record<RaceEvent['kind'], [string, string]> = {
  jump: ['Takeoff', 'jump'],
  trick: ['Air trick', 'dash_burst'],
  land: ['Snowboard landing', 'brace_thud'],
  wipeout: ['Snowy wipeout', 'zorb_bonk'],
  feature: ['Course feature appears', 'spring_recoil'],
  boost: ['Rider boosted', 'dash_burst'],
  finish: ['Finish line cheer', 'goal_cheer'],
};

export const slopewreckCatalog = Object.entries(clips).map(([id, [name]]) =>
  cue(
    `slopewreck.${id}`,
    name,
    'Slopewreck',
    `Short, playful winter sports ${name.toLowerCase()} sound. No speech.`,
    'event',
    1,
    false,
    0.7,
  ),
);
export const SLOPE_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  Object.entries(clips).map(([id, [, file]]) => [
    `slopewreck.${id}`,
    {
      url: `/audio/zorb-clash/event.${file}.wav`,
      volume: 0.7,
      category: 'event',
      loop: false,
    },
  ]),
);
