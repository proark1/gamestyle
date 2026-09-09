import type { Cue } from '../../../shared/audio/types';

const details = [
  [
    'animal.breath',
    'Cow · gentle breath',
    'Herd',
    1.8,
    0.28,
    [
      'An adult cow quietly exhales through its nostrils, warm soft air and slight coat movement, relaxed and healthy.',
      'A resting adult cow takes one slow nasal breath, a faint airy inhale and soft rounded exhale.',
      'One gentle breath from an adult cow, low soft nostril air with a little natural lip movement.',
    ],
  ],
  [
    'animal.snuffle',
    'Cow · snuffle',
    'Herd',
    1.5,
    0.3,
    [
      'An adult cow briefly sniffs meadow grass, two soft nasal snuffles and a tiny grass brush.',
      'One relaxed cow gently clears its nostrils with a short airy snort, quiet and unforced.',
      'A calm cow noses fresh grass with a soft nasal puff and subtle muzzle friction.',
    ],
  ],
  [
    'animal.scuff',
    'Hoof · settling scuff',
    'Herd',
    0.8,
    0.32,
    [
      'One adult cow hoof drags a few centimetres through turf as the animal settles its weight, soft soil scrape and bent grass.',
      'A cloven hoof pivots gently on meadow earth, muted gritty contact and a brief grass swish.',
      'A heavy cow comes to rest with a small hoof shuffle, restrained damp earth compression and grass friction.',
    ],
  ],
  [
    'nature.bird',
    'Hedgerow · bird phrase',
    'Environment',
    3,
    0.32,
    [
      'One small countryside songbird gives a short relaxed three-note phrase from a leafy tree. Isolated bird, no flock or other background animals.',
      'One small meadow-edge songbird makes two delicate chirps with a natural pause between them. Isolated bird, no background chorus.',
      'A single hedgerow songbird gives a brief soft warbling phrase then falls quiet. No other animals or background bed.',
    ],
  ],
  [
    'nature.insect',
    'Grass · passing insect',
    'Environment',
    2.5,
    0.16,
    [
      'A small summer insect passes low over meadow grass with a very soft airy buzz, approaches gently then recedes. No mosquito whine.',
      'One quiet bumblebee briefly hovers above a meadow flower and drifts away, gentle low wing buzz, no threatening swarm.',
      'A small flying insect moves through tall grass, a faint rounded fluttering buzz fading naturally into silence.',
    ],
  ],
  [
    'nature.leaves',
    'Trees · loose leaves',
    'Environment',
    4,
    0.26,
    [
      'A brief mild breeze brushes one leafy hedgerow branch, delicate dry leaf patter gradually settling to silence. No wind rumble.',
      'A small gust softly stirs deciduous leaves and a little tall grass below, gentle irregular friction, fading away naturally.',
      'A light breeze turns a cluster of tree leaves, fine soft foliage movement with a little branch flex, then stillness.',
    ],
  ],
  [
    'nature.barn',
    'Barn · timber settling',
    'Environment',
    2,
    0.23,
    [
      'A sun-warmed wooden barn board makes one small dry settling creak, low timber friction with a short natural tail. No door opening.',
      'An intact barn roof timber gently flexes in a light breeze, one restrained woody creak and a tiny joint tick. No damage.',
      'One old but sound barn wall board shifts slightly, a brief soft wooden groan and little dry contact tick. No impact or door movement.',
    ],
  ],
] as const;

const additions = [
  [
    'movement.grass',
    'Grass · leg brush',
    'Movement',
    1.2,
    0.26,
    [
      'A moving cow lower leg brushes meadow grass, one soft irregular swish of fresh blades against short hair. No hoof impact or animal call.',
      'Meadow grass bends against a passing lower leg and springs back, a brief gentle fibrous brush. No footsteps or voices.',
      'One slow stride parts ankle-high grass, soft dry blade friction with a little fresh leaf movement. No footfall or heavy wind.',
    ],
  ],
  [
    'item.ladder.carry',
    'Ladder · carried creak',
    'Ladder',
    1.5,
    0.3,
    [
      'An intact wooden farm ladder flexes slightly as it is carried at a walk, one quiet rail creak and tiny rung joint tick. No ground contact.',
      'A carried wooden ladder shifts under its own weight, a restrained dry wood rub and short loaded joint creak. No metal or impact.',
      'One small walking jostle through a solid wooden ladder, soft timber tension and a muted rung tick. No damage or dragging.',
    ],
  ],
  [
    'nature.trough',
    'Trough · water lap',
    'Environment',
    3,
    0.22,
    [
      'A light breeze makes a tiny wave lap against the inside of a small stone cattle trough, soft close water movement, then stillness. No pouring or drinking.',
      'Two small wind-driven ripples softly touch the edge of a shallow farm water trough, delicate rounded water taps. No stream or splashing animal.',
      'Still trough water briefly stirs in a mild breeze, a gentle little lap against stone followed by a faint receding ripple. No running water.',
    ],
  ],
  [
    'nature.wings',
    'Trees · small wing flutter',
    'Environment',
    1.4,
    0.22,
    [
      'One small songbird flutters between nearby leafy branches, three light soft wingbeats then silence. No bird call or flock.',
      'A small hedgerow bird settles on a branch with a brief delicate feather flutter. No chirping, impact or other animals.',
      'One small countryside bird lifts from a branch, a short airy flutter of wings fading naturally away. No loud flapping or calls.',
    ],
  ],
] as const;

function makeDetails(
  entries: readonly (readonly [
    string,
    string,
    string,
    number,
    number,
    readonly string[],
  ])[],
): Cue[] {
  return entries.flatMap(([id, name, group, duration, volume, prompts]) =>
    prompts.map((prompt, index) => ({
      id: `${id}.${index + 1}`,
      name: `${name} ${index + 1}`,
      group,
      prompt: `${prompt} Natural outdoor field recording, isolated source with quiet background, short natural decay. No speech, music, cartoon effects, distortion or exaggerated reverb.`,
      category: 'event',
      duration,
      loop: false,
      volume,
      text: '',
    })),
  );
}

/** Existing IDs and prompts remain stable; generation can target just this pass. */
export const farmNaturalAdditions = makeDetails(additions);
export const farmDetailCatalog: Cue[] = [
  ...makeDetails(details),
  ...farmNaturalAdditions,
];
