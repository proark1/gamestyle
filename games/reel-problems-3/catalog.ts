import { cue } from '../../shared/audio/catalog-helpers';

const cues = [
  ['harbor', 'Harbor morning ambience', 'ambience', true],
  ['ocean', 'Open sea and hull ambience', 'ambience', true],
  ['storm', 'Storm pursuit ambience', 'ambience', true],
  ['sanctuary', 'Sanctuary glow ambience', 'ambience', true],
  ['supply', 'Supply placed aboard', 'event', false],
  ['beacon', 'Ancient beacon bell', 'event', false],
  ['wave', 'Wave strikes the boat', 'event', false],
  ['repair', 'Timber hull repair', 'event', false],
  ['rescue', 'Crew hauled aboard', 'event', false],
  ['fish', 'Legendary fish song', 'music', false],
  ['home', 'Sunrise homecoming theme', 'music', false],
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
