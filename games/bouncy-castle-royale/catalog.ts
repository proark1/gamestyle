import { cue } from '../../shared/audio/catalog-helpers';
import type { AudioManifest } from '../../shared/audio/types';
import type { EventKind } from './types';

// Reuse existing recordings at their original paths; no copied audio assets.
const clips: Record<EventKind, [string, string]> = {
  slap: ['Volley', 'ball_kick'],
  smash: ['Smash', 'dash_burst'],
  bounce: ['Bounce', 'jump'],
  wave: ['Floor wave', 'spring_recoil'],
  wall: ['Bumper', 'zorb_bonk'],
  net: ['Net', 'brace_thud'],
  point: ['Point', 'goal_cheer'],
  win: ['Match won', 'win'],
  air: ['Air valve', 'ui'],
  pump: ['Air pump', 'recover'],
};
export const castleCatalog = Object.entries(clips).map(([id, [name]]) =>
  cue(
    `castle.${id}`,
    name,
    'Bouncy Castle Royale',
    `Playful sports ${name.toLowerCase()} sound, short and warm, no speech.`,
    'event',
    1,
    false,
    0.65,
  ),
);
export const CASTLE_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  Object.entries(clips).map(([id, [, clip]]) => [
    `castle.${id}`,
    {
      url: `/audio/zorb-clash/event.${clip}.wav`,
      volume: 0.65,
      category: 'event',
      loop: false,
    },
  ]),
);
