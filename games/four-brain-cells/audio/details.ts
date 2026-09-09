import { cue, speech } from '../../../shared/audio/catalog-helpers';

const fx = (
  id: string,
  name: string,
  prompt: string,
  duration = 1.5,
  volume = 0.65,
) =>
  cue(
    id,
    name,
    'Kitchen details',
    `${prompt} Close tactile kitchen Foley, natural short decay. No speech or music.`,
    'event',
    duration,
    false,
    volume,
  );
const bed = (id: string, name: string, prompt: string, volume = 0.55) =>
  cue(
    id,
    name,
    'Kitchen atmosphere',
    `${prompt} Steady seamless loop, no start or stop, no foreground voices or music.`,
    'ambience',
    12,
    true,
    volume,
  );

export const breakfastDetails = [
  fx(
    'event.ui',
    'Kitchen control',
    'One small plastic appliance switch clicks.',
    0.5,
    0.3,
  ),
  fx(
    'event.join',
    'A brain cell arrived',
    'A kitchen door opens with a gentle latch and one soft shoe step.',
    1.2,
    0.45,
  ),
  fx(
    'event.leave',
    'A brain cell left',
    'A kitchen door closes gently with a soft latch.',
    1,
    0.4,
  ),
  fx(
    'event.fail',
    'Breakfast became brunch',
    'A kitchen timer winds down with two low mechanical bell notes.',
    2,
  ),
  fx(
    'event.time-warning',
    'One minute left',
    'An egg timer gives three clear, spaced mechanical rings.',
    1.5,
  ),
  fx(
    'event.pancake-ready',
    'Golden on both sides',
    'A crisp little pan-handle tap followed by a light service bell.',
    1,
  ),
  fx(
    'event.burnt',
    'Pancake burnt',
    'A hot pancake crackles dry in a pan with a brief escaping puff of steam.',
    1.5,
  ),
  fx(
    'event.refill',
    'Fresh batter',
    'Thick pancake batter pours from a jug into a small metal pan, a short sticky plop.',
    1.3,
  ),
  fx(
    'event.coffee-refill',
    'Fresh coffee',
    'Hot coffee trickles from a countertop brewer into a glass jug, light bubbles and a final drip.',
    1.3,
  ),
  fx(
    'event.utensil-land',
    'Utensil hit the floor',
    'A small empty metal pan lands on kitchen tiles, two hollow clanks and a short handle rattle.',
    1.4,
  ),
  ...[1, 2, 3].map((v) =>
    fx(
      `event.step.${v}`,
      `Robot footstep · take ${v}`,
      [
        'One small tin robot foot plants on ceramic tile, rubber sole thud and a light ankle gear click.',
        'One small metal robot shoe lands heel then toe on kitchen tile, short hollow clunk.',
        'One small robot foot shifts weight on ceramic tile, a muted metal tap and soft sole squeak.',
      ][v - 1],
      0.6,
      0.4,
    ),
  ),
  bed(
    'ambience.kitchen',
    'Quiet working kitchen',
    'A small bright kitchen room tone, low refrigerator hum and very distant ventilation.',
    0.42,
  ),
  bed(
    'ambience.sizzle',
    'Pancake cooking',
    'Butter and pancake batter gently sizzle in a small hot frying pan, fine irregular bubbles.',
    0.6,
  ),
  bed(
    'ambience.brewer',
    'Coffee brewer',
    'A small countertop coffee brewer quietly bubbles and trickles into its jug.',
    0.42,
  ),
  bed(
    'ambience.servo',
    'Robot balancing',
    'Small electric servo motors softly turn under strain, restrained gear friction without alarms.',
    0.28,
  ),
  ...(
    [
      ['menu', 'Kitchen opens', 'Relaxed anticipation, 88 BPM.', 32, true],
      [
        'build',
        'Breakfast teamwork',
        'Light patient rhythm, 100 BPM, playful short phrases with space for cooking sounds.',
        40,
        true,
      ],
      [
        'challenge',
        'Breakfast rush',
        'A lightly urgent 120 BPM kitchen rhythm, no alarms or harsh stabs.',
        40,
        true,
      ],
      ['win', 'Order up', 'A short satisfying cheerful resolution.', 7, false],
      [
        'fail',
        'Brunch again',
        'A short warm comic descending resolution.',
        6,
        false,
      ],
    ] as const
  ).map(([id, name, direction, duration, loop]) =>
    cue(
      `music.${id}`,
      name,
      'Kitchen score',
      `Original instrumental toy-robot breakfast score with muted piano, pizzicato strings, brushed percussion and soft marimba. ${direction} No vocals. ${loop ? 'Loop-friendly beginning and ending, no final cadence.' : ''}`,
      'music',
      duration,
      loop,
      0.65,
    ),
  ),
  speech(
    'start',
    'Breakfast begins',
    'Three pancakes and a full cup of coffee. One robot. Please coordinate your limbs.',
    '[playfully]',
  ),
  speech(
    'win',
    'Breakfast served',
    'Breakfast is served. Four brain cells were apparently enough.',
    '[pleased]',
  ),
  speech(
    'fail',
    'Another attempt',
    'Breakfast has become brunch. Reset your robot and try again.',
    '[warmly]',
  ),
];
