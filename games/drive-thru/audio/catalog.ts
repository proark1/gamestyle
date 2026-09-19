import type { Cue } from '../../../shared/audio/types';

/**
 * Drive-Thru Static sound library for the Admin sound workshop. Every cue here
 * is played by `DriveThruSound` (see `../audio-events.ts` for when). Takes of
 * one sound share an id with a `.2` / `.3` suffix and are picked at random.
 */

type Space = 'lane' | 'kitchen' | 'cabin';

const SPACES: Record<Space, string> = {
  lane: 'Outdoors in a concrete fast-food drive-thru lane, short slapback echo off the building. Realistic high-quality Foley, no music, no speech.',
  kitchen:
    'Inside a cramped fast-food kitchen of stainless steel and tile, short bright reflections. Realistic high-quality Foley, no music, no speech.',
  cabin:
    'Inside a small old sedan with the passenger window open, close and slightly boxy. Realistic high-quality Foley, no music, no speech.',
};

function sfx(
  id: string,
  name: string,
  group: string,
  action: string,
  space: Space,
  duration: number,
  volume = 0.65,
): Cue {
  return {
    id,
    name,
    group,
    category: 'event',
    prompt: `${action} ${SPACES[space]}`,
    text: '',
    duration,
    loop: false,
    volume,
  };
}

/** Several takes of one frequent sound: `id`, `id.2`, `id.3`. */
function takes(
  id: string,
  name: string,
  group: string,
  space: Space,
  volume: number,
  variants: readonly (readonly [action: string, duration: number])[],
): Cue[] {
  return variants.map(([action, duration], index) =>
    sfx(
      index ? `${id}.${index + 1}` : id,
      index ? `${name} · take ${index + 1}` : name,
      group,
      action,
      space,
      duration,
      volume,
    ),
  );
}

function bed(id: string, name: string, scene: string, volume: number): Cue {
  return {
    id,
    name,
    group: 'Ambience',
    category: 'ambience',
    prompt: `${scene} Steady layered stereo bed, smooth seamless loop with no fade, no distinct foreground events, no voices or music.`,
    text: '',
    duration: 24,
    loop: true,
    volume,
  };
}

/** A line for the collection narrator, The Chaos Commentator. */
function line(id: string, name: string, direction: string, text: string): Cue {
  return {
    id,
    name,
    group: 'Chaos Commentator',
    category: 'speech',
    prompt: direction,
    text,
    duration: 4,
    loop: false,
    volume: 0.85,
  };
}

const MUSIC_IDENTITY =
  'Retro fast-food drive-thru comedy score: twangy surf guitar, bouncy slap bass, cheesy combo organ and tight brushed drums, like a 1960s diner jukebox with a mischievous wink. Musical and warm, never shrill.';

function score(
  id: string,
  name: string,
  mood: string,
  duration: number,
  loop: boolean,
  volume = 0.55,
): Cue {
  return {
    id,
    name,
    group: 'Music',
    category: 'music',
    prompt: `${MUSIC_IDENTITY} ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short resolution that ends cleanly, no loop.'}`,
    text: '',
    duration,
    loop,
    volume,
  };
}

export const driveThruCatalog: Cue[] = [
  // Interface
  sfx(
    'event.ui',
    'Button press',
    'Interface',
    'One small tactile plastic button click on a fast-food register, crisp and quiet with a very short dry decay. No beep.',
    'kitchen',
    0.5,
    0.35,
  ),

  // Intercom
  sfx(
    'event.speaker-crackle',
    'Drive-thru speaker crackle',
    'Intercom',
    'A cheap outdoor drive-thru intercom speaker box bursts into crackling static and a squelchy distorted squawk of garbled noise, then cuts out. No intelligible words.',
    'lane',
    1.5,
    0.6,
  ),
  sfx(
    'event.lane-chime',
    'Car arrival chime',
    'Intercom',
    'A drive-thru vehicle-detector chime: one clean two-tone ding-dong from a small ceiling speaker, a short natural ring-out and nothing else.',
    'kitchen',
    1.5,
    0.55,
  ),

  // Sedan
  ...takes('event.car-horn', 'Sedan car horn', 'Sedan', 'lane', 0.7, [
    [
      'A beat-up old sedan horn honks twice impatiently, a tinny slightly flat blat-blat.',
      1.2,
    ],
    [
      'A beat-up old sedan horn gives one short polite tinny beep, slightly flat.',
      0.8,
    ],
    [
      'A beat-up old sedan horn is held for one long annoyed honk, tinny and wheezy, sagging in pitch as it lets go.',
      1.5,
    ],
  ]),
  sfx(
    'event.engine-rev',
    'Engine revs away',
    'Sedan',
    'A tired four-cylinder sedan engine revs up from idle as the driver stamps the throttle, raspy exhaust and a rattling heat shield as it pulls away slowly.',
    'lane',
    1.8,
    0.6,
  ),
  sfx(
    'event.fan-belt',
    'Screeching alternator belt',
    'Sedan',
    'A loose alternator fan belt under an old sedan hood shrieks in rhythmic rubbery squeals as the engine revs, then fades as the revs drop.',
    'lane',
    2,
    0.5,
  ),
  sfx(
    'event.tyre-screech',
    'Tyre squeal',
    'Sedan',
    'The tyres of an old sedan chirp and squeal briefly on dusty asphalt under hard braking, then the car rocks to a stop on soft springs.',
    'lane',
    1.2,
    0.6,
  ),
  sfx(
    'event.curb-scrape',
    'Hubcap scrapes the curb',
    'Sedan',
    'A sedan tyre sidewall and plastic hubcap grind along a concrete curb, gritty rubber scrub and a rattling hubcap.',
    'lane',
    1.2,
    0.55,
  ),
  sfx(
    'event.pole-bump',
    'Bumper taps the speaker pole',
    'Sedan',
    'A plastic car bumper bonks a steel drive-thru speaker pole at walking pace, a hollow metal clang and the speaker box rattling on its bracket. No crash.',
    'lane',
    1.2,
    0.65,
  ),

  // Cabin
  sfx(
    'event.toddler-toy',
    'Squeaky toddler toy',
    'Cabin',
    'A toddler squeezes a rubber squeaky duck in a car back seat, three quick frantic high-pitched squeaks. No voice.',
    'cabin',
    1.2,
    0.5,
  ),
  sfx(
    'event.distraction-swat',
    'Toy confiscated',
    'Cabin',
    'A hand snatches a rubber squeaky toy away mid-squeeze, one strangled last squeak, and the toy is shoved into a plastic glovebox that snaps shut.',
    'cabin',
    1.2,
    0.55,
  ),
  ...takes('event.wiper-sweep', 'Wiper sweep', 'Cabin', 'cabin', 0.5, [
    [
      'A windshield wiper blade drags through thick milkshake on the glass, a wet squelchy rubber smear and a soft thump at the end of the stroke.',
      1.1,
    ],
    [
      'A windshield wiper squeaks across half-clean glass, rubber chatter over a thin smear of foam and a soft thump at the end of the stroke.',
      1.1,
    ],
  ]),
  sfx(
    'event.passenger-lean',
    'Passenger leans out',
    'Cabin',
    'A passenger leans out of an open car window: seatbelt webbing stretching, a jacket rubbing along the door frame and the seat creaking. No voice.',
    'cabin',
    1.2,
    0.5,
  ),
  sfx(
    'event.short-stop-reach',
    'Short Stop reach',
    'Cabin',
    'A passenger strains to reach far out of a car window: seatbelt webbing pulled taut, fabric scraping the door sill and one comic effortful grunt. No words.',
    'cabin',
    1.5,
    0.65,
  ),
  sfx(
    'event.balance-wobble',
    'Car rocks on its springs',
    'Cabin',
    'An old sedan rocks as a passenger throws their weight against the door, tired suspension springs groaning and the body creaking.',
    'cabin',
    1.2,
    0.55,
  ),

  // Grill
  sfx(
    'event.grill-sizzle',
    'Burger patty sizzling',
    'Grill',
    'A raw beef patty takes the heat on a commercial flat-top grill, a sudden flare of crackling spitting fat that settles into a steady sizzle.',
    'kitchen',
    2.5,
    0.55,
  ),
  ...takes('event.patty-flip', 'Spatula burger flip', 'Grill', 'kitchen', 0.6, [
    [
      'A steel spatula scrapes under a burger patty on a flat-top grill and flicks it into the air with a quick whoosh.',
      0.8,
    ],
    [
      'A steel spatula slides lightly under a burger patty and flips it up with a small spit of grease and a soft whoosh.',
      0.8,
    ],
    [
      'A steel spatula scrapes hard under a stuck burger patty, a sticky rip as it peels off the grill, then a quick flick into the air.',
      1,
    ],
  ]),
  ...takes('event.patty-land', 'Patty lands', 'Grill', 'kitchen', 0.6, [
    [
      'A flipped beef patty slaps back down onto a hot flat-top grill, a wet smack followed by a loud burst of sizzle.',
      1.2,
    ],
    [
      'A flipped beef patty lands a little off-centre on a hot flat-top grill, a softer slap and a crackling spit of grease.',
      1.2,
    ],
  ]),
  sfx(
    'event.patty-burnt',
    'Patty scorching',
    'Grill',
    'A burger patty scorches on a flat-top grill, the fat crackling harder with sharp pops and a thin hiss of acrid smoke.',
    'kitchen',
    2,
    0.6,
  ),
  sfx(
    'event.spatula-scrape',
    'Spatula scrape',
    'Grill',
    'A metal spatula blade scrapes once across a greasy steel flat-top grill, a short gritty scrape with a faint ring.',
    'kitchen',
    0.6,
    0.4,
  ),

  // Fryer
  sfx(
    'event.fryer-splash',
    'Fries go into the fryer',
    'Fryer',
    'A wire basket of frozen fries is lowered into a deep fryer, the hot oil erupts into a roaring bubbly boil and settles into steady frying.',
    'kitchen',
    2,
    0.55,
  ),
  sfx(
    'event.fryer-lift',
    'Fryer basket lifted',
    'Fryer',
    'A wire fry basket is hauled out of hot oil and hooked onto its rail, the bubbling dies down, oil drips and the metal handle clinks.',
    'kitchen',
    1.6,
    0.6,
  ),

  // Shake machine and drinks
  ...takes(
    'event.shake-vent',
    'Milkshake pressure release',
    'Shake Machine',
    'kitchen',
    0.6,
    [
      [
        'A pressurised stainless steel milkshake machine vents through its release valve, a sharp pneumatic hiss that tapers off.',
        1.2,
      ],
      [
        'A milkshake machine release valve gives a short relieved puff of air with a small gurgle of cream.',
        0.9,
      ],
      [
        'A milkshake machine vents a long high-pressure hiss through its valve, the steel cap rattling as it fades.',
        1.5,
      ],
    ],
  ),
  sfx(
    'event.shake-strain',
    'Shake machine straining',
    'Shake Machine',
    'An overfilled milkshake machine strains under pressure: the steel lid rattling, the motor groaning and a thin steam whistle rising.',
    'kitchen',
    2,
    0.6,
  ),
  sfx(
    'event.soda-pour',
    'Soda poured',
    'Shake Machine',
    'A soda fountain lever is pressed and fizzy cola gushes into a waxed paper cup over ice, then stops with a drip.',
    'kitchen',
    1.4,
    0.5,
  ),

  // Tray and window
  sfx(
    'event.stack-bun',
    'Bun on the stack',
    'Tray and Window',
    'A soft sesame burger bun is dropped onto a burger on a paper-lined plastic tray, a light padded pat.',
    'kitchen',
    0.6,
    0.45,
  ),
  sfx(
    'event.stack-patty',
    'Patty on the stack',
    'Tray and Window',
    'A hot cooked beef patty is slapped onto a burger bun, a greasy wet thud with a tiny sizzle.',
    'kitchen',
    0.7,
    0.5,
  ),
  sfx(
    'event.stack-topping',
    'Cheese or lettuce on the stack',
    'Tray and Window',
    'A slice of cheese and a crisp lettuce leaf are laid on a burger, a soft tacky pat and a crunchy leafy rustle.',
    'kitchen',
    0.7,
    0.45,
  ),
  sfx(
    'event.burger-wrap',
    'Burger wrapped',
    'Tray and Window',
    'A finished burger is wrapped in greaseproof paper, quick crinkly folds and one firm press.',
    'kitchen',
    1,
    0.5,
  ),
  sfx(
    'event.tray-slide',
    'Tray pushed to the window',
    'Tray and Window',
    'A plastic fast-food tray loaded with paper cups slides across a stainless steel pickup counter, cups rattling and ice shifting.',
    'kitchen',
    1.2,
    0.55,
  ),
  sfx(
    'event.window-slide',
    'Pickup window opens',
    'Tray and Window',
    'An aluminium drive-thru pickup window slides open on its track, a rattly glass shudder and a latch clack.',
    'lane',
    1.2,
    0.55,
  ),
  sfx(
    'event.tray-grab',
    'Tray grabbed',
    'Tray and Window',
    'Hands grab a loaded fast-food tray off a window ledge, a paper bag crinkling, cups sloshing and ice clinking.',
    'lane',
    1.2,
    0.6,
  ),

  // Disasters
  sfx(
    'event.shake-explode',
    'Violent milkshake blowout',
    'Disasters',
    'A pressurised milkshake machine bursts with a loud wet pop, thick shake erupting and splattering across steel counters and tiles, then dripping.',
    'kitchen',
    2.2,
    0.85,
  ),
  sfx(
    'event.windshield-splat',
    'Windshield milkshake splatter',
    'Disasters',
    'A heavy blob of thick milkshake splatters across a car windshield, a big wet gloopy slap and goo dribbling down the glass.',
    'cabin',
    1.6,
    0.8,
  ),
  sfx(
    'event.grease-fire',
    'Kitchen grease fire eruption',
    'Disasters',
    'Hot fryer oil bursts into flame with a deep fiery whoosh and a crackling roar of burning grease.',
    'kitchen',
    2.5,
    0.85,
  ),
  sfx(
    'event.pole-crash',
    'Speaker pole impact',
    'Disasters',
    'A sedan reverses hard into a steel drive-thru intercom pole: a crunching bumper, hollow denting metal, the pole groaning over and a fizzing electrical short from the speaker box.',
    'lane',
    2.2,
    0.9,
  ),
  sfx(
    'event.curb-plop',
    'Drink tray dropped down the drain',
    'Disasters',
    'A tray of four paper soda cups and a burger bag tumbles off a car door into a concrete street drain, splashing, cups bouncing and a hollow clunk of the grate.',
    'lane',
    2,
    0.8,
  ),

  // Round
  sfx(
    'event.order-served',
    'Order served bell',
    'Round',
    'A bright double ding of a chrome service bell on a counter, followed by a cheerful cash register drawer chime.',
    'kitchen',
    1.6,
    0.75,
  ),
  sfx(
    'event.ticket-print',
    'Order ticket prints',
    'Round',
    'A kitchen order printer chatters out a paper ticket and the paper is torn off with a snap.',
    'kitchen',
    1.5,
    0.5,
  ),
  sfx(
    'event.countdown-tick',
    'Final seconds tick',
    'Round',
    'One sharp tick of a mechanical kitchen timer, a dry plastic click with no ring.',
    'kitchen',
    0.5,
    0.5,
  ),

  // Ambience
  bed(
    'ambience.drive-thru-lane',
    'Drive-thru lane',
    'A suburban fast-food drive-thru lane at lunchtime: a few cars idling in the queue, distant road traffic, a buzzing neon sign and a flapping promo banner.',
    0.45,
  ),
  bed(
    'ambience.kitchen-chaos',
    'Fast-food kitchen',
    'A busy fast-food kitchen: a steady flat-top sizzle, fryer oil bubbling, a humming fridge compressor and extractor fan, utensils clattering far off.',
    0.45,
  ),
  bed(
    'ambience.sedan-engine',
    'Sedan idling',
    'An old four-cylinder sedan idling unevenly, heard from just outside the car: a lumpy exhaust burble, a loose heat shield ticking and a faint cooling fan. No revving or horn.',
    0.5,
  ),
  bed(
    'ambience.intercom-static',
    'Intercom static',
    'A broken drive-thru intercom speaker left open: continuous crackling radio static, a faint electrical hum and occasional squelchy garbled bursts with no intelligible words.',
    0.4,
  ),
  bed(
    'ambience.grease-fire',
    'Grease fire burning',
    'A grease fire burning in a small fast-food kitchen: roaring flames, spitting popping oil and a fire alarm bell ringing in the next room.',
    0.55,
  ),

  // Music
  score(
    'music.menu',
    'Lunch break',
    'Relaxed lunch-break swing, 96 BPM, a hummable little organ motif with plenty of space between phrases.',
    48,
    true,
  ),
  score(
    'music.drive-thru-rush',
    'Drive-thru rush',
    'Upbeat busy lunch-rush groove, 128 BPM, choppy guitar and a walking slap bass, playful and bouncy but never frantic, leaving room for sound effects and friends talking.',
    60,
    true,
  ),
  score(
    'music.tension',
    'Kitchen panic',
    'Urgent kitchen-panic surf rock, 150 BPM, driving floor toms, tremolo guitar and nervous organ stabs. Tense but fun, controlled dynamics, no alarm tones.',
    45,
    true,
  ),
  score(
    'music.win',
    'Order served',
    'A triumphant little jukebox flourish, a bright guitar run up to a big happy final chord with a cymbal swell.',
    8,
    false,
    0.6,
  ),
  score(
    'music.fail',
    'Intercom meltdown',
    'A comic deflating phrase, a wobbly organ slide down and a lazy guitar twang into a sheepish final chord. Never sad or punishing.',
    7,
    false,
    0.6,
  ),

  // The Chaos Commentator
  line(
    'speech.welcome',
    'Round start',
    '[dryly]',
    "Welcome to Jumble Burger. The intercom's broken, the fryer's angry, and you're all hired.",
  ),
  line(
    'speech.intercom-scramble',
    'Still at the speaker',
    '[deadpan]',
    'Nobody understands the intercom. Nobody ever has. Just drive to the window.',
  ),
  line(
    'speech.encourage',
    'Nothing on fire yet',
    '[warmly]',
    "Twelve seconds in and nothing's on fire. Honestly, a personal best.",
  ),
  line(
    'speech.order-ready',
    'Tray at the window',
    '[pleased]',
    'Order up at the window. Mind the gap, the curb and the drain.',
  ),
  line(
    'speech.short-stop',
    'Short Stop',
    '[urgent]',
    'Short stop! Lean out, passenger. Further. Trust the seatbelt.',
  ),
  line(
    'speech.shake-warning',
    'Shake machine warning',
    '[concerned]',
    'The milkshake machine is making a noise. Vent it before it vents you.',
  ),
  line(
    'speech.fryer-warning',
    'Fryer warning',
    '[concerned]',
    "The fryer is smoking. Lift the basket, unless we're serving charcoal fries.",
  ),
  line(
    'speech.shake-explode',
    'Milkshake blowout',
    '[laughing]',
    'And the milkshake machine has exploded. Wipers, anyone? Anyone?',
  ),
  line(
    'speech.ten-seconds',
    'Ten seconds left',
    '[urgent] [shouting]',
    'Ten seconds! Somebody do something competent!',
  ),
  line(
    'speech.fire-alert',
    'Grease fire',
    '[urgent] [shouting]',
    'Grease fire! That is not a cooking technique! Everybody out!',
  ),
  line(
    'speech.pole-crash',
    'Speaker pole down',
    '[deadpan]',
    'You reversed into the speaker. The one thing that could hear us.',
  ),
  line(
    'speech.curb-plop',
    'Sodas down the drain',
    '[dryly]',
    'Four sodas, straight down the drain. Gravity has taken their order.',
  ),
  line(
    'speech.win',
    'Order served',
    '[excited]',
    "Order served! Hot, whole and mostly upright. I'm genuinely moved.",
  ),
  line(
    'speech.fail',
    'Shift over',
    '[dryly]',
    "Shift over. We'll tell head office it was a fire drill.",
  ),
];
