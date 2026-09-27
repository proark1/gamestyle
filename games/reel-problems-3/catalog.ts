import { cue } from '../../shared/audio/catalog-helpers';

const cues = [
  ['harbor', 'Busy fishing harbor ambience', 'ambience', true],
  ['ocean', 'Open sea and hull ambience', 'ambience', true],
  ['bite', 'Fishing bite bell', 'event', false],
  ['hook', 'Fish hooked sting', 'event', false],
  ['catch', 'Catch lands on deck', 'event', false],
  ['chaos', 'Deck chaos impact', 'event', false],
  ['repair', 'Timber hull repair', 'event', false],
  ['rescue', 'Crew hauled aboard', 'event', false],
  ['home', 'Catch delivered celebration', 'music', false],
] as const;

export const reelProblems3Catalog = cues.map(([id, name, category, loop]) =>
  cue(
    `voyage.${id}`,
    name,
    'Reel Problems 3',
    `${name}; handcrafted clay maritime adventure, intimate, warm, tactile, no speech.`,
    category,
    loop ? 12 : 2.5,
    loop,
    category === 'ambience' ? 0.28 : 0.72,
  ),
);
