import type { Cue } from '../../../shared/audio/types';
import { ITEM_NAMES, type ItemKind } from '../types';
import { GIANT_SHOUT } from '../urgency';

function cue(
  id: string,
  name: string,
  group: string,
  prompt: string,
  category: Cue['category'] = 'event',
  duration = 1.5,
  volume = 0.65,
  loop = false,
): Cue {
  return {
    id,
    name,
    group,
    prompt,
    category,
    duration,
    volume,
    loop,
    text: '',
  };
}
const foley =
  'Natural indoor Foley in a quiet timber cottage. Clear physical contact, believable weight, short room decay. No music, dialogue, electronic tones or cartoon effects.';
const effect = (
  id: string,
  name: string,
  group: string,
  action: string,
  duration = 1.5,
  volume = 0.65,
) => cue(id, name, group, `${action} ${foley}`, 'event', duration, volume);

const surfaces = {
  wood: 'One small soft-soled shoe steps on an old wooden floorboard, a light dry tap with a restrained board creak.',
  paper:
    'One small soft-soled shoe steps on a leather-bound book, a muted leather tap and faint compressed page rustle.',
  fabric:
    'One small soft-soled shoe presses into a cotton quilt or thick shirt, a padded contact and gentle cloth friction.',
  skin: 'One tiny soft-soled shoe presses gently against a sleeping giant’s bare skin, a soft dull pat with no slap.',
  metal:
    'One small soft-soled shoe steps onto a silver spoon or brass chandelier, a light metallic contact and short restrained ring.',
};
const materials: Record<ItemKind, string> = {
  coin: 'a handful of gold coins, with small dense metallic clinks',
  cup: 'a silver drinking cup, with a light hollow metal ring',
  necklace: 'a gold chain necklace, with delicate linked metal rattling',
  gem: 'a polished cut gemstone, with a small hard glassy click',
  pouch:
    'a leather coin pouch, with supple leather creaks and muffled coin movement',
  crown:
    'a heavy gold crown, with a low metal ring and a few tiny gemstone clicks',
  pillow:
    'a large feather pillow, with soft cotton rustling and a cushioned puff of air',
  spoon:
    'an oversized silver teaspoon, with a weighty metal scrape and brief clear ring',
};
const dialogue = [
  [
    'escape-warning',
    'Shupia escape warning',
    'Quick! He is about to wake up! Grab your friends and get to the door. We need to leave, now!',
    '[urgent] [shouting]',
  ],
  ['giant-wake', 'The furious giant', GIANT_SHOUT, '[angry] [shouting]'],
  [
    'start',
    'The heist begins',
    'Eight minutes. One sleeping giant. Let’s make some very quiet decisions.',
    '[whispering]',
  ],
  [
    'treasure',
    'Treasure collected',
    'Lovely. Now get it to the door before our host notices.',
    '[playfully]',
  ],
  [
    'bank',
    'Treasure secured',
    'Safely outside. A surprisingly professional burglary.',
    '[pleased]',
  ],
  [
    'target',
    'Treasure target reached',
    'That’s enough gold. Leaving now would be uncharacteristically sensible.',
    '[playfully]',
  ],
  [
    'tickle',
    'A questionable tickle',
    'You tickled him. Of course you did. Brace yourselves.',
    '[deadpan]',
  ],
  [
    'roll-warning',
    'The arm is about to move',
    'Mind the arm. The bridge has other plans.',
    '[whispering]',
  ],
  [
    'sneeze-warning',
    'A sneeze is coming',
    'That nose is twitching. Find somewhere soft.',
    '[concerned]',
  ],
  [
    'wake-warning',
    'The giant is waking',
    'He’s waking up. This is an excellent time to leave.',
    '[urgent]',
  ],
  [
    'wake',
    'The escape begins',
    'He’s up! Twenty-five seconds. Door. Now.',
    '[urgent]',
  ],
  [
    'dazed',
    'A thief needs help',
    'A slight landing problem. Somebody lend a hand.',
    '[warmly]',
  ],
  [
    'rescue',
    'A friend helps',
    'Back on your feet. Quietly, if you can manage it.',
    '[pleased]',
  ],
  [
    'exit',
    'A thief escapes',
    'One thief outside. Try to bring the others.',
    '[pleased]',
  ],
  [
    'win',
    'A successful heist',
    'Treasure secured. An excellent night for very small criminals.',
    '[pleased]',
  ],
  [
    'fail',
    'The heist ends short',
    'Well, he noticed. At least the gold outside is still ours.',
    '[warmly]',
  ],
] as const;

export const giantCatalog: Cue[] = [
  cue(
    'event.escape-warning',
    'Shupia alarm call',
    'Escape warning',
    'Three tiny thieves urgently whistle to warn their friends, three rising shrill but soft organic whistles followed by a quick wooden rattle. No words.',
    'event',
    1.8,
    0.7,
  ),
  cue(
    'ambience.escape-warning',
    'Hurry to the door',
    'Escape warning',
    'Tiny thieves tap an urgent running signal on wood. Tight dry quick rattles and soft thumps, tense and insistent, seamless loop, no words or loud sirens.',
    'ambience',
    2,
    0.7,
    true,
  ),
  effect(
    'event.ui',
    'Menu button',
    'Interface',
    'One quiet wooden button click.',
    0.5,
    0.35,
  ),
  effect(
    'event.jump',
    'Tiny jump',
    'Movement',
    'A small shoe pushes off and trouser fabric flicks lightly.',
    0.7,
    0.35,
  ),
  effect(
    'event.land',
    'Soft landing',
    'Movement',
    'Two tiny shoes land with a subdued double pat and a brief trouser rustle, a short soft contact without a ring or rattle.',
    0.8,
    0.4,
  ),
  ...Object.entries(surfaces).flatMap(([surface, action]) =>
    [1, 2, 3].map((take) =>
      effect(
        `step.${surface}.${take}`,
        `${surface[0].toUpperCase() + surface.slice(1)} · footstep ${take}`,
        'Footsteps',
        `${action} ${['Balanced light heel contact.', 'Softer toe-first contact.', 'Slightly heavier planted contact with a tiny scrape.'][take - 1]}`,
        0.65,
        0.45,
      ),
    ),
  ),
  ...Object.entries(materials).flatMap(([kind, material]) => [
    effect(
      `item.${kind}.grab`,
      `Pick up ${ITEM_NAMES[kind as ItemKind]}`,
      'Treasure and tools',
      `Small gloved hands carefully lift ${material}.`,
      1.2,
      0.55,
    ),
    effect(
      `item.${kind}.place`,
      `Put down ${ITEM_NAMES[kind as ItemKind]}`,
      'Treasure and tools',
      `Set down ${material} on an old wooden floor, one clear contact then a short natural decay.`,
      1.5,
      kind === 'pillow' ? 0.35 : 0.6,
    ),
  ]),
  effect(
    'item.spoon.rotate',
    'Turn the teaspoon bridge',
    'Treasure and tools',
    'An oversized silver spoon turns in gloved hands, subtle grip friction and a brief metal resonance.',
    1.1,
    0.5,
  ),
  effect(
    'event.bank',
    'Bank treasure at the door',
    'Treasure and tools',
    'Gold coins and a small piece of jewellery settle into a leather-lined wooden box, a brief satisfying cluster of metal clinks.',
    1.5,
  ),
  effect(
    'event.tickle',
    'Tickle the giant’s foot',
    'Giant',
    'A feather gently brushes bare skin in two quick passes, delicate dry feather friction.',
    1.3,
    0.4,
  ),
  effect(
    'event.impact',
    'A noisy landing',
    'Movement',
    'A small body lands heavily on a wooden floor, low board thump and brief timber rattle, no injury or voice.',
    1.3,
  ),
  effect(
    'event.dazed',
    'Thief tumbles',
    'Movement',
    'A small clothed body tumbles to a stop, padded thud and fabric settling, no voice.',
    1.1,
    0.45,
  ),
  effect(
    'event.rescue',
    'Help a friend up',
    'Movement',
    'Gloved hands grip a coat sleeve and help someone stand, fabric stretches and two small shoes find their footing.',
    1.5,
    0.5,
  ),
  effect(
    'event.exit',
    'Slip through the door',
    'Movement',
    'A wooden cottage door opens just a crack, quiet iron hinge creak and two quick retreating footsteps.',
    1.5,
    0.5,
  ),
  effect(
    'giant.roll',
    'Giant shifts his arm',
    'Giant',
    'A very heavy sleeping man shifts an arm over a quilt. Deep mattress compression, cotton folds dragging and a slow wooden bed-frame creak.',
    3,
    0.7,
  ),
  effect(
    'giant.sneeze',
    'Giant sneezes',
    'Giant',
    'One enormous natural male sneeze: a short inhalation and sudden breathy expulsion with a low chest resonance. Playful scale, controlled volume, no words.',
    2.8,
    0.8,
  ),
  effect(
    'giant.wake',
    'Giant sits upright',
    'Giant',
    'An enormous man sits upright in a wooden bed. Heavy quilt sliding, deep loaded frame creaks, mattress springs unloading and one surprised breath. No words.',
    3.2,
    0.8,
  ),
  cue(
    'ambience.cottage',
    'Quiet cottage at night',
    'Environment',
    'Inside a quiet timber cottage at night: very soft wind behind closed windows, sparse distant crickets and occasional faint settling wood. Steady spacious room tone, seamless loop, no distinct foreground events, breathing, voices or music.',
    'ambience',
    24,
    0.55,
    true,
  ),
  cue(
    'ambience.breathing',
    'Sleeping giant’s breath',
    'Environment',
    'An enormous sleeping man breathes slowly and evenly through his nose, gentle low resonant snoring and soft quilt rustle. Warm and peaceful, no gasping, words or music. Four even breath cycles, smooth seamless indoor loop.',
    'ambience',
    24,
    0.6,
    true,
  ),
  ...dialogue.map(([id, name, text, direction]) => ({
    ...cue(
      `speech.${id}`,
      name,
      'Chaos Commentator',
      direction,
      'speech',
      5,
      0.8,
    ),
    text,
  })),
  ...(
    [
      [
        'menu',
        'A little heist',
        'Curious and welcoming, sparse notes, 76 BPM.',
        48,
        true,
      ],
      [
        'build',
        'Quiet feet',
        'A restrained tiptoe rhythm, 84 BPM, leave generous space for tiny footsteps and whispered commentary.',
        60,
        true,
      ],
      [
        'challenge',
        'Head for the door',
        'Quick controlled urgency, 112 BPM, a tighter plucked pulse without alarms or heavy percussion.',
        60,
        true,
      ],
      [
        'escape',
        'Last chance to leave',
        'The final twenty seconds before the giant wakes. Urgent racing strings, quick woodblock signals and low pulsing bass, 144 BPM. Clear rising tension, controlled dynamics.',
        20,
        true,
      ],
      [
        'win',
        'Safely outside',
        'A brief warm ascending phrase and satisfied final chord, clean ending.',
        8,
        false,
      ],
      [
        'fail',
        'The giant noticed',
        'A gently comic descending phrase and hopeful final chord, clean ending.',
        7,
        false,
      ],
    ] as const
  ).map(([id, name, mood, duration, loop]) =>
    cue(
      `music.${id}`,
      name,
      'Music',
      `Tiny thieves in a sleeping giant’s cottage. Muted pizzicato strings, bass clarinet, soft felt piano and very light brushed percussion. Mischievous chamber music, intimate dynamics. ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short resolution, no loop.'}`,
      'music',
      duration,
      0.55,
      loop,
    ),
  ),
];
