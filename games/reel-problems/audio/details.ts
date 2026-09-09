import { cue, speech } from '../../../shared/audio/catalog-helpers';

const fx = (
  id: string,
  name: string,
  prompt: string,
  duration = 1.5,
  volume = 0.6,
) =>
  cue(
    id,
    name,
    'Boat details',
    `${prompt} Realistic small-boat Foley, natural decay, no speech or music.`,
    'event',
    duration,
    false,
    volume,
  );
const bed = (id: string, name: string, prompt: string, volume = 0.55) =>
  cue(
    id,
    name,
    'Lake atmosphere',
    `${prompt} Constant seamless loop, no beginning or ending, no foreground voices or music.`,
    'ambience',
    12,
    true,
    volume,
  );

export const reelDetails = [
  fx(
    'event.ui',
    'Boat control',
    'One compact tackle-box clasp clicks.',
    0.5,
    0.3,
  ),
  fx(
    'event.join',
    'Angler aboard',
    'One shoe steps aboard a wooden boat with a gentle hull creak.',
    1,
    0.45,
  ),
  fx(
    'event.leave',
    'Angler ashore',
    'A rope lifts from a wooden cleat with a soft friction sound and tap.',
    1,
    0.4,
  ),
  fx(
    'event.fail',
    'The lake wins',
    'A small boat horn gives two short low sympathetic notes.',
    2,
  ),
  fx(
    'event.time-warning',
    'Last minute fishing',
    'A clear outdoor handbell rings three times above calm water.',
    1.8,
  ),
  fx(
    'event.untangle',
    'Knot worked loose',
    'Wet nylon fishing lines rub and slacken with a tiny reel click.',
    1.2,
  ),
  fx(
    'event.gear',
    'Boat gear fitted',
    'A small metal bracket tightens against a wooden gunwale, two ratchet clicks and a firm knock.',
    1.5,
  ),
  fx(
    'event.hull',
    'Hull under strain',
    'An intact small wooden boat hull flexes under a wave with a low short timber creak.',
    2,
    0.48,
  ),
  ...[1, 2, 3].map((v) =>
    fx(
      `step.deck.${v}`,
      `Deck footstep · take ${v}`,
      [
        'One rubber-soled shoe steps on a dry wooden boat deck, a low board knock.',
        'One fishing boot shifts onto a wooden plank, sole friction and a short hollow tap.',
        'One rubber boot presses a slightly damp wooden boat floor with a restrained squeak and thud.',
      ][v - 1],
      0.6,
      0.35,
    ),
  ),
  bed(
    'ambience.lake',
    'Water around the boat',
    'Gentle freshwater ripples lap against a small wooden boat at rest, close soft watery texture.',
    0.6,
  ),
  bed(
    'ambience.wind',
    'Wind across the lake',
    'Open-water wind brushes reeds on a distant shore, a soft steady air rush without microphone buffeting.',
    0.48,
  ),
  bed(
    'ambience.rain',
    'Rain on the boat',
    'Steady rain patters onto wet wooden gunwales and the lake surface, fine drops without thunder.',
    0.65,
  ),
  bed(
    'ambience.reel',
    'Fishing reel turning',
    'A small fishing reel winds steadily, soft mechanical ratchet clicks and nylon line friction.',
    0.4,
  ),
  bed(
    'ambience.strain',
    'Loaded fishing line',
    'A taut nylon line and intact flexible fishing rod strain gently under a steady pull, quiet friction creaks.',
    0.48,
  ),
  bed(
    'ambience.wake',
    'Boat moving through water',
    'A small rowing boat glides through fresh water, gentle bow fizz and a close trailing wake.',
    0.48,
  ),
  bed(
    'ambience.swim',
    'Swimming beside the boat',
    'A person slowly paddles in calm lake water, small regular hand splashes and close ripples, no distress.',
    0.4,
  ),
  ...(
    [
      ['menu', 'At the dock', 'Easygoing anticipation, 84 BPM.', 32, true],
      [
        'build',
        'A questionable fishing trip',
        'Unhurried playful rhythm, 96 BPM, space for splashes and fishing sounds.',
        40,
        true,
      ],
      [
        'challenge',
        'Fish pulling the boat',
        'Gentle adventurous momentum, 116 BPM, restrained tension without horror.',
        40,
        true,
      ],
      [
        'win',
        'Catch of the day',
        'A short cheerful accomplished ending.',
        7,
        false,
      ],
      [
        'fail',
        'The one that got away',
        'A short good-humored, sympathetic ending.',
        6,
        false,
      ],
    ] as const
  ).map(([id, name, direction, duration, loop]) =>
    cue(
      `music.${id}`,
      name,
      'Lake score',
      `Original instrumental cooperative fishing score: acoustic guitar, warm clarinet, soft upright bass and brushed percussion. ${direction} No vocals. ${loop ? 'Loop-friendly beginning and ending with no final cadence.' : ''}`,
      'music',
      duration,
      loop,
      0.65,
    ),
  ),
  speech(
    'start',
    'Tournament begins',
    'Five minutes. Cast together, watch your lines, and keep your friends in the boat.',
    '[playfully]',
  ),
  speech(
    'win',
    'Catch of the day',
    'Catch of the day. Somehow the boat survived your teamwork.',
    '[pleased]',
  ),
  speech(
    'fail',
    'The lake wins',
    'The lake wins this round. At least we brought most of the crew back.',
    '[warmly]',
  ),
];
