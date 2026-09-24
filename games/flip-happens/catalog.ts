import { cue } from '../../shared/audio/catalog-helpers';
import type { AudioManifest } from '../../shared/audio/types';
import type { EventKind } from './types';
const clips: Record<EventKind, [string, string]> = {
  throw: ['Object thrown', 'jump'],
  land: ['Upright landing', 'ball_kick'],
  bust: ['Combo lost', 'zorb_bonk'],
  bank: ['Points banked', 'goal_cheer'],
  impact: ['Table impact', 'spring_recoil'],
  win: ['Round complete', 'win'],
  select: ['Object selected', 'ui'],
};
export const flipCatalog = Object.entries(clips).map(([id, [name]]) =>
  cue(
    `flip.${id}`,
    name,
    'Flip Happens',
    `Short playful ${name.toLowerCase()} sound, warm toy percussion, no speech.`,
    'event',
    1,
    false,
    0.6,
  ),
);
export const FLIP_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  Object.entries(clips).map(([id, [, clip]]) => [
    `flip.${id}`,
    {
      url: `/audio/zorb-clash/event.${clip}.wav`,
      volume: 0.6,
      category: 'event',
      loop: false,
    },
  ]),
);
