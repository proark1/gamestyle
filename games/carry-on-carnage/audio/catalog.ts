import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';
import type { ItemKind } from '../types';

/**
 * Carry-On Carnage sound library, generated in the Admin workshop.
 *
 * Every prompt names one physical action in the same airport terminal, so the
 * recordings share a room. Frequent actions get takes: the base id plus `.2`
 * and `.3`, which the player rotates so a repeat never sounds identical.
 */

const HALL =
  'Real Foley recorded in a modern airport terminal with polished stone tile floors: close perspective, natural weight, short bright hall reverb. No music, speech or beeps.';
const DEVICE =
  'Real recording of airport equipment in a large glass terminal hall: close perspective, short bright reverb. No music or speech.';
const LOOP =
  'Smooth seamless loop, steady level with no distinct foreground events, no music and no intelligible voices.';

type Group =
  | 'Packing'
  | 'Suitcases'
  | 'Footsteps'
  | 'Security'
  | 'Gate'
  | 'Terminal'
  | 'Interface';

function effect(
  id: string,
  name: string,
  group: Group,
  action: string,
  duration: number,
  volume: number,
  category: 'event' | 'material' = 'event',
  setting = HALL,
): Cue {
  return cue(
    id,
    name,
    group,
    `${action} ${setting}`,
    category,
    duration,
    false,
    volume,
  );
}

/** One cue per take: `id`, `id.2`, `id.3`, each with its own small twist. */
function takes(
  id: string,
  name: string,
  group: Group,
  action: string,
  variations: readonly string[],
  duration: number,
  volume: number,
  category: 'event' | 'material' = 'event',
): Cue[] {
  return variations.map((variation, index) =>
    effect(
      index ? `${id}.${index + 1}` : id,
      index ? `${name} · take ${index + 1}` : name,
      group,
      `${action} ${variation}`,
      duration,
      volume,
      category,
    ),
  );
}

const PACK: Record<ItemKind, [string, string, number]> = {
  clothes: [
    'Pack the Hawaiian shirts',
    'A thick stack of folded cotton Hawaiian shirts is stuffed into an open fabric suitcase: a soft heavy cloth flop, then hands press the pile down with a brisk rustle.',
    1.0,
  ],
  duck: [
    'Pack the rubber duck',
    'A large rubber duck toy is squashed into an open suitcase among clothes, letting out one long wheezing squeak as it is pressed down.',
    1.0,
  ],
  flamingo: [
    'Pack the inflatable flamingo',
    'A big inflatable pool flamingo is crammed into an open suitcase: stretchy vinyl squeaks and rubs, and trapped air hisses from the valve.',
    1.4,
  ],
  racket: [
    'Pack the tennis racket',
    'A tennis racket is jammed diagonally into an open suitcase: the graphite frame knocks the hard shell rim and the taut strings give one short dull twang.',
    1.0,
  ],
  shoes: [
    'Pack the tin foil shoes',
    'A pair of shoes wrapped in crumpled tin foil is shoved into an open suitcase: bright crinkly foil crunch and a soft rubber sole thud.',
    1.0,
  ],
  lobster: [
    'Pack the live lobster',
    'A live lobster is lowered into an open suitcase: its hard wet shell clatters on plastic, the tail flaps twice and the claws click.',
    1.2,
  ],
  shampoo: [
    'Pack the giant shampoo',
    'A huge two-litre plastic shampoo bottle is dropped into an open suitcase: a hollow plastic thunk and thick liquid glugging inside.',
    1.0,
  ],
  snowglobe: [
    'Pack the snow globe',
    'A heavy oversized glass snow globe is set into an open suitcase among clothes: a dense glass-on-fabric thud and a soft water slosh inside.',
    1.2,
  ],
};

const NARRATOR = [
  [
    'start',
    'Boarding begins',
    'Flight 707 to Ibiza is boarding. Four carry-ons, one sizer box, no dignity.',
    '[dryly]',
  ],
  [
    'halfway',
    'Halfway to take-off',
    'Halfway to take-off. Keep sitting on things. Apparently it works.',
    '[encouragingly]',
  ],
  [
    'jam',
    'Zipper jammed',
    'The zipper refuses. Have you considered sitting on the problem?',
    '[deadpan]',
  ],
  [
    'burst',
    'Suitcase explodes',
    'The suitcase has exploded. The terminal is now a jumble sale.',
    '[laughing]',
  ],
  [
    'tsa-distracted',
    'Security distracted',
    'Tin foil shoes! Security is baffled. Smuggle something, quickly!',
    '[excited]',
  ],
  [
    'tsa-caught',
    'Contraband seized',
    'Security has confiscated that. It had a good run.',
    '[dryly]',
  ],
  [
    'approved',
    'Bag approved',
    'It fits! The sizer box is quietly devastated.',
    '[pleased]',
  ],
  [
    'contraband',
    'Smuggled through',
    'Approved, with contraband inside. I saw nothing. Nobody saw anything.',
    '[mischievously]',
  ],
  [
    'rejected',
    'Bag rejected',
    'Rejected. That will be a hundred and fifty dollars, thank you.',
    '[deadpan]',
  ],
  [
    'target',
    'Every bag approved',
    'Four bags approved! The gate agent is visibly furious.',
    '[excited]',
  ],
  [
    'one-minute',
    'One minute left',
    'One minute to departure. Pack faster. Sit harder.',
    '[urgent]',
  ],
  [
    'ten-seconds',
    'Ten seconds left',
    'Ten seconds! Zip it, shove it, run!',
    '[urgent] [shouting]',
  ],
  [
    'win',
    'Boarding complete',
    'Every bag approved and aboard. Ibiza will never recover.',
    '[delighted]',
  ],
  [
    'fail',
    'Flight departed',
    'The plane has left. Your luggage, tragically, has not.',
    '[dryly]',
  ],
] as const;

const MUSIC_IDENTITY =
  'Carry-On Carnage, a comic airport packing race. Breezy holiday bossa nova and lounge jazz: nylon-string guitar, muted trumpet, vibraphone, upright bass, brushed drums and bongos, with a cheeky playful swing.';

const MUSIC = [
  [
    'menu',
    'Now boarding',
    'Relaxed, sunny departure-lounge mood, 92 BPM, a catchy laid-back trumpet motif with lots of space between phrases.',
    48,
    true,
  ],
  [
    'play',
    'Packing panic',
    'Busy, bouncy and mischievous, 116 BPM, a perky vibraphone ostinato over walking bass, leaving room for sound effects and commentary.',
    60,
    true,
  ],
  [
    'tension',
    'Final call',
    'Sprint-to-the-gate urgency, 138 BPM, driving bongos, staccato trumpet stabs and a rising vibraphone figure. Tense but still fun and musical, never shrill.',
    60,
    true,
  ],
  [
    'win',
    'Boarding complete',
    'A short triumphant holiday flourish: a bright trumpet fanfare over a sunny bossa cadence and a warm final chord.',
    8,
    false,
  ],
  [
    'fail',
    'Flight departed',
    'A short comic deflating phrase: muted trumpet falling over soft guitar and ending on a gentle shrug of a final chord, never sad.',
    7,
    false,
  ],
] as const;

export const carryOnCarnageCatalog: Cue[] = [
  // Packing: every item goes into a bag sounding like itself.
  ...(Object.entries(PACK) as [ItemKind, [string, string, number]][]).map(
    ([kind, [name, action, duration]]) =>
      effect(`item.${kind}.pack`, name, 'Packing', action, duration, 0.7),
  ),
  ...takes(
    'item.grab',
    'Grab an item',
    'Packing',
    'Quick hands snatch a holiday item up off a tile floor:',
    [
      'a fast grab, a light plastic knock and a brisk fabric rustle.',
      'a softer scoop into both arms, clothing rustle and a small plastic tap.',
    ],
    0.7,
    0.55,
    'material',
  ),
  effect(
    'carryon.lobster_pinch',
    'Lobster claw snap',
    'Packing',
    'A live lobster snaps its big claw shut twice in quick succession: sharp hard shell clacks with a tiny wet click.',
    0.6,
    0.7,
    'material',
  ),
  effect(
    'item.land.soft',
    'Soft item hits the floor',
    'Packing',
    'A bundle of clothes or a rubber toy drops onto a polished tile floor: a soft padded flop and a small springy bounce.',
    0.7,
    0.55,
    'material',
  ),
  effect(
    'item.land.hard',
    'Hard item hits the floor',
    'Packing',
    'A big plastic shampoo bottle clatters onto a polished tile floor: one bright hollow plastic knock and a short skittering bounce.',
    0.7,
    0.6,
    'material',
  ),
  effect(
    'item.land.glass',
    'Snow globe hits the floor',
    'Packing',
    'A heavy glass snow globe drops onto a polished tile floor and rolls a little: a thick solid glass clonk and water sloshing inside. It does not break.',
    0.9,
    0.65,
    'material',
  ),

  // Suitcases: sitting, zipping, lifting and the occasional explosion.
  ...takes(
    'carryon.zipper_pull',
    'Zipper pull',
    'Suitcases',
    'One hard pull of a chunky metal luggage zipper along a tight fabric seam of an overstuffed suitcase:',
    [
      'the teeth ratchet fast, then stop.',
      'a short strained tug, the teeth catching twice.',
      'a longer smooth pull ending with a small tab rattle.',
    ],
    0.8,
    0.7,
    'material',
  ),
  effect(
    'luggage.zip_closed',
    'Zipper closed',
    'Suitcases',
    'A strained suitcase zipper is dragged the last few centimetres around the corner and closes: fast ratchet, a firm snap of the pull tab and a satisfied pat on the lid.',
    1.2,
    0.75,
  ),
  effect(
    'luggage.zip_jam',
    'Zipper jams',
    'Suitcases',
    'The zipper of an overstuffed suitcase snags and jams: teeth grind, the pull tab rattles, the fabric strains and it will not move.',
    1.0,
    0.65,
  ),
  ...takes(
    'carryon.compress_groan',
    'Sit on the suitcase',
    'Suitcases',
    'A person sits down hard on an overstuffed fabric suitcase:',
    [
      'the fabric groans and squeaks, the lid bows and trapped air puffs out of the seams.',
      'a lighter bounce, a creaky frame and a short squeaky fabric complaint.',
      'a heavy flop and one long stretched fabric creak as the case squashes flat.',
    ],
    1.2,
    0.7,
    'material',
  ),
  effect(
    'carryon.burst_pinata',
    'Suitcase bursts like a piñata',
    'Suitcases',
    'An overstuffed suitcase bursts open violently like a piñata: a loud fabric rip and plastic pop as the zipper tears apart, and a shower of clothes and toys flies out and scatters across the floor.',
    1.8,
    0.95,
  ),
  effect(
    'luggage.pickup',
    'Lift a packed carry-on',
    'Suitcases',
    'A packed hard-shell carry-on is hoisted off the floor by its handle: the telescopic handle clicks up, the heavy case swings and its contents thump inside.',
    0.8,
    0.6,
  ),
  effect(
    'luggage.set_down',
    'Set a carry-on down',
    'Suitcases',
    'A heavy packed carry-on suitcase is set down on a polished tile floor: a solid hard-shell thump and a short rattle of spinner wheels.',
    0.8,
    0.6,
  ),

  // Footsteps: a traveller's sneakers, and the unmistakable tin foil shoes.
  ...takes(
    'step.tile',
    'Tile footstep',
    'Footsteps',
    'One sneaker footstep on polished stone tile in an airport concourse, a crisp rubber heel tap.',
    [
      'Balanced heel contact.',
      'Lighter hurried toe-first contact with a tiny squeak.',
      'Heavier planted step with a small scuff.',
    ],
    0.5,
    0.45,
    'material',
  ),
  ...takes(
    'step.foil',
    'Tin foil footstep',
    'Footsteps',
    'One shoe wrapped in crumpled tin foil steps on polished stone tile: a crinkly foil crunch over a soft sole tap.',
    [
      'Balanced heel contact.',
      'Lighter quick step with a thin foil rustle.',
      'Heavier planted step with a loud foil scrunch.',
    ],
    0.55,
    0.5,
    'material',
  ),
  effect(
    'event.jump',
    'Jump',
    'Footsteps',
    'A traveller pushes off a tile floor to jump: a sneaker squeak and a quick jacket rustle.',
    0.6,
    0.45,
  ),
  effect(
    'event.land',
    'Land',
    'Footsteps',
    'A traveller lands from a jump on a polished tile floor: two sneakers slap down with a solid thud and clothing settles.',
    0.7,
    0.55,
  ),

  // Security: the metal detector, a sly sneak past and a stern whistle.
  effect(
    'carryon.tsa_alarm',
    'Metal detector alarm',
    'Security',
    'A walk-through airport metal detector arch goes off: a loud rapid repeating electronic alarm beep that stops abruptly.',
    2.5,
    0.8,
    'event',
    DEVICE,
  ),
  effect(
    'security.sneak',
    'Sneak past security',
    'Security',
    'Someone tiptoes quickly past a security desk: soft sneaker squeaks, a coat rustled tight and one sly short exhale.',
    1.0,
    0.55,
  ),
  effect(
    'security.whistle',
    'Security whistle',
    'Security',
    'A security officer blows two sharp stern blasts on a metal whistle in an airport security hall.',
    1.2,
    0.75,
  ),

  // Gate: the dreaded sizer box, its verdicts and the fee.
  effect(
    'gate.sizer_insert',
    'Shove a bag into the sizer',
    'Gate',
    'A hard-shell suitcase is shoved into a metal luggage sizer cage at a boarding gate: the shell scrapes along steel bars and lands with a hollow clang.',
    1.0,
    0.7,
  ),
  effect(
    'gate.sizer_scan',
    'Sizer measures the bag',
    'Gate',
    'An electronic baggage measuring frame scans a suitcase: a short rising motorised whir with soft servo clicks, no beeps.',
    1.4,
    0.5,
    'event',
    DEVICE,
  ),
  effect(
    'carryon.sizer_pass',
    'Sizer approves the bag',
    'Gate',
    'An airport gate machine approves a bag: a bright cheerful electronic chime rising to a sparkling major chord.',
    1.5,
    0.75,
    'event',
    DEVICE,
  ),
  effect(
    'carryon.sizer_reject',
    'Sizer rejects the bag',
    'Gate',
    'An airport luggage sizer rejects a bag: one harsh low flat electronic buzzer blast, like a game show wrong answer.',
    1.2,
    0.75,
    'event',
    DEVICE,
  ),
  effect(
    'gate.fee',
    'Gate fee charged',
    'Gate',
    'A gate agent charges a baggage fee on an old cash register: a bright bell ding and the drawer sliding open with a rattle of coins.',
    1.0,
    0.65,
  ),
  effect(
    'gate.cheer',
    'Passengers cheer',
    'Gate',
    'A small crowd of waiting airline passengers at a boarding gate cheers and applauds for a few seconds with joyful whoops, no intelligible words.',
    2.5,
    0.7,
    'event',
    'Recorded at medium distance in a large glass airport terminal hall with short bright reverb. No music.',
  ),

  // Terminal: the public address, the departures board and the jet itself.
  effect(
    'carryon.airport_chime',
    'Public address chime',
    'Terminal',
    'An airport public address chime: a bright soft two-tone ding-dong over ceiling speakers, gently decaying in the hall.',
    2.0,
    0.7,
    'event',
    DEVICE,
  ),
  effect(
    'terminal.board_flap',
    'Departures board flip',
    'Terminal',
    'A split-flap departures board flips once: a quick mechanical flutter of plastic flaps ending in a firm click.',
    0.6,
    0.6,
  ),
  effect(
    'terminal.takeoff',
    'Flight takes off',
    'Terminal',
    'A passenger jet takes off from the runway outside the terminal windows: a rising turbine whine swells into deep roaring thrust, passes and fades away, heard through thick glass.',
    6,
    0.8,
    'event',
    DEVICE,
  ),

  cue(
    'ambience.terminal',
    'Departure hall',
    'Ambience',
    `A large busy airport departure hall: a steady distant murmur of travellers, faint rolling suitcase wheels, soft footsteps on stone and a far muffled public address echo, under a high glass roof. ${LOOP}`,
    'ambience',
    24,
    true,
    0.55,
  ),
  cue(
    'ambience.apron',
    'Jets outside the windows',
    'Ambience',
    `The airport apron heard through thick terminal windows: idling jet engines, a steady low turbine hum and rumble, a distant aircraft slowly taxiing, muffled by glass. ${LOOP}`,
    'ambience',
    24,
    true,
    0.45,
  ),
  cue(
    'ambience.security',
    'Security conveyor',
    'Ambience',
    `An airport security X-ray baggage conveyor running: a steady electric motor hum, a rubber belt rolling over metal rollers and plastic trays softly sliding and bumping. No beeps. ${LOOP}`,
    'ambience',
    24,
    true,
    0.45,
  ),
  cue(
    'ambience.wheels',
    'Rolling carry-on',
    'Ambience',
    `Close hard plastic suitcase spinner wheels rolling steadily over polished stone tiles: a continuous smooth rumble with a light rhythmic tick at each tile joint, no footsteps. ${LOOP}`,
    'ambience',
    20,
    true,
    0.55,
  ),
  cue(
    'ambience.strain',
    'Straining seams',
    'Ambience',
    `An overstuffed fabric suitcase under heavy pressure: slow continuous creaking of stretched seams, tight fabric groaning, zipper teeth ticking under strain and a bent frame squeaking. No bangs. ${LOOP}`,
    'ambience',
    20,
    true,
    0.5,
  ),

  ...MUSIC.map(([id, name, mood, duration, loop]) =>
    cue(
      `music.${id}`,
      name,
      'Music',
      `${MUSIC_IDENTITY} ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short resolution with a clean ending, no loop.'}`,
      'music',
      duration,
      loop,
      0.55,
    ),
  ),

  ...NARRATOR.map(([id, name, text, direction]) => ({
    ...cue(
      `speech.${id}`,
      name,
      'Chaos Commentator',
      direction,
      'speech',
      5,
      false,
      0.85,
    ),
    text,
  })),

  effect(
    'event.ui',
    'Button press',
    'Interface',
    'One small tactile plastic button click, like a luggage tag clip snapping shut; quiet, precise and dry.',
    0.5,
    0.35,
  ),
];
