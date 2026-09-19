import type { Cue } from '../../../shared/audio/types';

function cue(
  id: string,
  name: string,
  group: string,
  prompt: string,
  category: Cue['category'] = 'event',
  duration = 1.2,
  volume = 0.7,
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

/** One warehouse, one acoustic: every effect prompt ends with this setting. */
export const STORE_SETTING =
  'Real recording in a huge wholesale warehouse store: polished concrete floor, tall steel racks, roomy natural reverb with a short tail. No music, speech or cartoon effects.';

const effect = (
  id: string,
  name: string,
  group: string,
  action: string,
  duration = 1.2,
  volume = 0.7,
) =>
  cue(id, name, group, `${action} ${STORE_SETTING}`, 'event', duration, volume);

/** Frequent sounds get takes `id`, `id.2`, `id.3`; the player never repeats one twice. */
const takes = (
  id: string,
  name: string,
  group: string,
  actions: readonly string[],
  duration: number,
  volume: number,
) =>
  actions.map((action, index) =>
    effect(
      index ? `${id}.${index + 1}` : id,
      index ? `${name} · take ${index + 1}` : name,
      group,
      action,
      duration,
      volume,
    ),
  );

const bed = (
  id: string,
  name: string,
  action: string,
  duration: number,
  volume: number,
) =>
  cue(
    id,
    name,
    'Ambience',
    `${action} Smooth seamless loop at a steady level, no music, no clear words, no sudden foreground events.`,
    'ambience',
    duration,
    volume,
    true,
  );

const MUSIC_IDENTITY =
  'Wholesale warehouse cart derby. A retro in-store muzak combo: bright electric piano, bouncy walking bass, clean muted funk guitar, vibraphone and light brushed drums, with a playful game-show wink.';

const music = (
  id: string,
  name: string,
  mood: string,
  duration: number,
  loop: boolean,
  volume = 0.55,
) =>
  cue(
    id,
    name,
    'Music',
    `${MUSIC_IDENTITY} ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short resolution with a clean ending, no loop.'}`,
    'music',
    duration,
    volume,
    loop,
  );

/** The collection narrator, The Chaos Commentator: dry, fond, British, brief. */
const LINES = [
  [
    'start',
    'Doors open',
    'Doors are open. Please shop responsibly. Nobody ever does.',
    '[dryly]',
  ],
  [
    'sample',
    'Free samples announced',
    'Free samples! Somewhere, a queue is forming at terrifying speed.',
    '[excited]',
  ],
  [
    'sugar_rush',
    'Your sugar rush',
    'Sugar rush! That taquito is now doing the steering.',
    '[excited]',
  ],
  [
    'slip',
    'You slip on a plate',
    'A paper plate. The oldest trap in retail.',
    '[deadpan]',
  ],
  [
    'crash',
    'You crash',
    'Lovely crash. Some of that was even the shopping.',
    '[dryly]',
  ],
  [
    'teddy_gift',
    'You gift the rivals a teddy',
    'A ten-foot teddy, gifted to the rivals. Beautifully petty.',
    '[mischievously]',
  ],
  [
    'teddy_stuck',
    'You are gifted a teddy',
    'You have been gifted a giant teddy. The receipt checker will not be charmed.',
    '[deadpan]',
  ],
  [
    'list_complete',
    'Your list is complete',
    'List complete. Now for the small matter of the receipt checker.',
    '[playfully]',
  ],
  [
    'approved',
    'Your receipt is approved',
    'Receipt approved! Legally, that counts as shopping.',
    '[excited]',
  ],
  [
    'rejected',
    'Your receipt is rejected',
    'Rejected. The receipt checker has seen things, and that teddy was one of them.',
    '[sarcastic]',
  ],
  [
    'midround',
    'Halfway',
    'Halfway through. Plenty of time for worse decisions.',
    '[warmly]',
  ],
  [
    'one_minute',
    'One minute left',
    'One minute to closing. Grab the essentials. And the kibble.',
    '[urgent]',
  ],
  [
    'ten_seconds',
    'Ten seconds left',
    'Ten seconds! Everybody to the tills!',
    '[urgent] [shouting]',
  ],
  [
    'win',
    'Your team wins',
    'Store closed, and you have won. A triumph of bulk buying.',
    '[excited]',
  ],
  [
    'fail',
    'Your team loses',
    'Store closed. You lost, but think of all those free samples.',
    '[warmly]',
  ],
] as const;

export const sampleStampedeCatalog: Cue[] = [
  cue(
    'event.ui',
    'Button press',
    'Interface',
    'One small tactile plastic button click, like a price-tag gun trigger; quiet, dry and precise. Close studio recording, no reverb, music or speech.',
    'event',
    0.5,
    0.35,
  ),

  effect(
    'event.round_start',
    'Store opens',
    'Round and clock',
    'A motorised steel roller shutter door rattles up and open, its drive chain clanking, and stops with a solid metallic thunk.',
    3,
    0.75,
  ),
  effect(
    'event.closing_chime',
    'One minute to closing',
    'Round and clock',
    'A soft three-note descending closing-time chime plays through warehouse ceiling speakers, electric bell tones echoing down the aisles.',
    2.5,
    0.7,
  ),
  effect(
    'event.countdown',
    'Final ten seconds tick',
    'Round and clock',
    'One crisp checkout barcode scanner beep, short and clean, close to the listener.',
    0.5,
    0.6,
  ),
  effect(
    'event.time_up',
    'Store closes',
    'Round and clock',
    'A loud store-closing buzzer sounds once, then a heavy steel roller shutter rattles down and slams shut onto concrete.',
    3,
    0.8,
  ),

  effect(
    'event.list_tick',
    'Tick an item off the list',
    'Shopping list',
    'A felt-tip marker ticks one box on a paper shopping list: one quick squeaky stroke and a light paper flick.',
    0.6,
    0.5,
  ),
  effect(
    'event.list_complete',
    'Shopping list complete',
    'Shopping list',
    'A brass counter service bell is struck twice, bright and cheerful, ringing out with a clean decay.',
    1.2,
    0.6,
  ),

  effect(
    'stampede.sample_bell',
    'Sample announcement chime',
    'Store PA and shoppers',
    'A warm two-tone ding-dong announcement chime from the warehouse ceiling speakers, the notes echoing across the huge hall.',
    2,
    0.8,
  ),
  effect(
    'stampede.crowd_rush',
    'Shoppers rush the samples',
    'Store PA and shoppers',
    'A crowd of excited adult shoppers hurries toward a free sample stand: rising murmur, quick shoe scuffs and rattling carts converging; no clear words.',
    3,
    0.65,
  ),

  ...takes(
    'stampede.cart_crash',
    'Cart hits cart',
    'Cart',
    [
      'Two loaded steel wire shopping carts collide head-on: a bright tubular metal clang, rattling baskets and boxes bouncing inside.',
      'A glancing sideswipe between two steel shopping carts: scraping wire mesh, one sharp clank and a wobbling caster.',
      'A heavy full-speed shopping cart crash: crunching wire basket, clattering tins and a cardboard box thudding onto concrete.',
    ],
    1.2,
    0.85,
  ),
  ...takes(
    'cart.hit_shelf',
    'Cart hits a rack or wall',
    'Cart',
    [
      'A speeding shopping cart rams a steel pallet rack: a heavy dull thud, the upright rings briefly and boxes shudder on the shelves.',
      'A shopping cart bumps a warehouse rack upright: a short metallic bonk, basket rattle and a box wobbling on the shelf above.',
      'A loaded shopping cart smashes into a painted concrete wall: deep thump, crunching wire basket and goods rattling inside.',
    ],
    1.2,
    0.8,
  ),
  ...takes(
    'cart.skid',
    'Drift skid',
    'Cart',
    [
      'Hard rubber shopping cart casters skid sideways across polished sealed concrete: a sharp rubber squeal with wobbling wheel chatter.',
      'A short chirping rubber skid of a drifting shopping cart on a glossy warehouse floor, with a rattling wire basket.',
      'A long screeching sideways slide of a heavy shopping cart on polished concrete, casters juddering and goods shifting in the basket.',
    ],
    1.3,
    0.6,
  ),
  effect(
    'cart.near_miss',
    'Near miss with a shopper',
    'Cart',
    'A speeding shopping cart whooshes past very close, its rattling wire basket passing from left to right, and a startled shopper gasps; no words.',
    1.2,
    0.6,
  ),
  ...takes(
    'stampede.plate_slip',
    'Paper plate spin-out',
    'Cart',
    [
      'A shopping cart wheel crushes a flimsy paper plate and skids: a quick paper crinkle, then a fast rubber spin-out squeal on slick concrete.',
      'A shopping cart slides through a puddle of spilled soda: a wet splatter and a squealing rubber spin on polished concrete.',
      'A shopping cart spins out on a greasy paper sample plate: slippery swish, squealing casters and a rattling basket whirling around.',
    ],
    1.4,
    0.8,
  ),
  effect(
    'stampede.sugar_rush',
    'Sugar rush boost',
    'Cart',
    'A shopping cart surges forward in a sugar rush: a rising whoosh of rushing air, fizzing soda bubbles, a racing heartbeat thump and furious wheel rattle, sputtering out at the end.',
    4.5,
    0.75,
  ),

  ...takes(
    'grabber.swing',
    'Grabber pole swing',
    'Grabber pole',
    [
      'An aluminium reach-grabber pole extends fast and its plastic claw snaps shut on air: a sharp whoosh and a hollow plastic clack.',
      'A light quick swipe of a telescoping grabber pole: an airy swish and a small claw click.',
      'A big swing of a long grabber pole: a heavy whoosh, rattling telescopic joints and a loud claw snap.',
    ],
    0.8,
    0.55,
  ),
  ...takes(
    'grabber.snag',
    'Grabber snags a product',
    'Grabber pole',
    [
      'A plastic grabber claw clamps a packaged product and yanks it off a shelf: firm squeeze, cardboard scrape and a quick pull.',
      'A grabber claw snatches a small item from a counter: a quick pinch click and a light packaging rustle.',
      'A grabber claw strains to hook a heavy bulk pack: creaking plastic jaws, a dragging scrape and a thump as it comes free.',
    ],
    1,
    0.6,
  ),
  ...takes(
    'grabber.whack',
    'Grabber whacks a rival cart',
    'Grabber pole',
    [
      'A plastic grabber claw bonks the steel frame of a rival shopping cart: a hollow clonk, wire mesh rattle and a small wobble.',
      'A grabber pole smacks the handlebar of a shopping cart: a springy metallic thwack and a rattling basket.',
    ],
    0.9,
    0.75,
  ),

  effect(
    'item.paper_towels.grab',
    'Paper towels into the cart',
    'Products',
    'A huge plastic-wrapped bundle of paper towel rolls drops into a steel shopping cart basket: a soft bouncy thump and crinkling film.',
    1,
    0.6,
  ),
  effect(
    'item.kibble_50lb.grab',
    'Kibble sack into the cart',
    'Products',
    'A heavy fifty-pound sack of dry dog kibble slumps into a wire shopping cart: a deep paper-sack thud, shifting kibble and a basket creak.',
    1.2,
    0.7,
  ),
  effect(
    'item.mega_soda.grab',
    'Soda case into the cart',
    'Products',
    'A heavy cardboard case of soda cans lands in a steel shopping cart: a dull thump and a muffled clank of many aluminium cans.',
    1,
    0.7,
  ),
  effect(
    'item.cereal_box.grab',
    'Cereal box into the cart',
    'Products',
    'A big cardboard cereal box is tossed into a shopping cart: a light hollow knock and a quick rattle of cereal inside.',
    0.8,
    0.55,
  ),
  effect(
    'item.giant_teddy.grab',
    'Giant teddy into a cart',
    'Products',
    'An enormous plush teddy bear flops into a shopping cart: a soft heavy fabric whump, squashed stuffing and a creaking basket.',
    1,
    0.65,
  ),
  effect(
    'item.sample.grab',
    'Grab a free sample',
    'Products',
    'A small paper sample cup is plucked from a metal sample tray: a tiny paper crinkle, a toothpick tick and a light tray clink.',
    0.6,
    0.5,
  ),
  effect(
    'item.drop',
    'Product falls out of a cart',
    'Products',
    'A bulky packaged product bounces out of a moving shopping cart and thumps onto polished concrete, then slides to a stop.',
    1,
    0.65,
  ),

  ...takes(
    'stampede.shelf_tumble',
    'Shelf collapse',
    'Shelves',
    [
      'A tall pyramid of cardboard cereal boxes collapses off a warehouse shelf: cascading hollow box thumps and rattling cereal hitting concrete.',
      'A few big boxes topple from a high steel shelf: three heavy cardboard thuds and one box skidding away.',
      'A whole shelf of packaged goods avalanches down: a long tumbling cascade of boxes and plastic packs, ending with one rolling can.',
    ],
    2,
    0.75,
  ),

  effect(
    'stampede.receipt_approved',
    'Receipt approved',
    'Checkout',
    'A vintage brass cash register rings up a big sale: keys clack, the bell rings and the cash drawer slides open with a cheerful ka-ching.',
    1.5,
    0.8,
  ),
  effect(
    'stampede.receipt_rejected',
    'Receipt rejected',
    'Checkout',
    'A receipt checker slams a rubber stamp onto a paper receipt on a steel counter, followed by one low flat rejection buzzer.',
    1.3,
    0.8,
  ),
  effect(
    'stampede.receipt_print',
    'Receipt printer',
    'Checkout',
    'A checkout thermal receipt printer rapidly feeds out a long paper receipt, then the cutter snips it off.',
    1,
    0.6,
  ),

  ...takes(
    'step.concrete',
    'Running shopper footstep',
    'Footsteps',
    [
      'One sneaker footfall of a jogging shopper on polished sealed concrete: a light rubber squeak and a soft slap.',
      'One softer toe-first sneaker step on polished warehouse concrete with a faint rubber squeak.',
      'One heavier planted sneaker step on polished concrete with a tiny scuff and squeak.',
    ],
    0.5,
    0.45,
  ),

  bed(
    'ambience.warehouse',
    'Warehouse hall',
    'Inside a huge wholesale warehouse hall: steady ventilation hum, buzzing fluorescent lights, a far-off forklift reversing beeper and faint distant pallet clunks.',
    26,
    0.55,
  ),
  bed(
    'ambience.shoppers',
    'Crowd of shoppers',
    'A busy warehouse store crowd in a big reverberant hall: many shoppers murmuring at a distance, occasional far cart rattles and footsteps.',
    24,
    0.5,
  ),
  bed(
    'ambience.checkout',
    'Checkout lanes',
    'A row of warehouse checkout lanes at mid distance: scattered barcode scanner beeps, receipt printers, cash drawers and a conveyor belt hum.',
    24,
    0.5,
  ),
  bed(
    'ambience.cart_roll',
    'Cart rolling',
    'Close perspective: a shopping cart rolling steadily over polished warehouse concrete, continuous hard rubber caster rumble, wire basket rattle and gently shifting goods, no squeaks.',
    22,
    0.6,
  ),
  bed(
    'stampede.squeaky_wheel',
    'Squeaky caster wheel',
    'Close perspective: one wobbly front caster of a rolling shopping cart squeaks rhythmically on polished concrete, a steady chirping metal squeak with a light shimmy rattle.',
    20,
    0.5,
  ),

  music(
    'music.menu',
    'Store lounge (menu and results)',
    'Relaxed bossa nova store lounge, 88 BPM, warm and welcoming, sparse melody.',
    48,
    true,
  ),
  music(
    'stampede.store_muzak',
    'Store muzak (play)',
    'Upbeat shopping groove, 112 BPM, bouncy and cheeky, with space for crashes and commentary.',
    60,
    true,
  ),
  music(
    'music.tension',
    'Closing-time rush',
    'Closing-time rush for the final thirty seconds, 138 BPM, driving bass and urgent staccato piano, rising excitement without alarms or harsh tones.',
    50,
    true,
  ),
  music(
    'music.win',
    'Checkout triumph',
    'Triumphant checkout fanfare, bright ascending vibraphone and piano flourish with a big final chord.',
    8,
    false,
    0.6,
  ),
  music(
    'music.fail',
    'Store closed',
    'A gently comic deflating phrase, descending muted guitar and piano, with a hopeful final chord.',
    7,
    false,
  ),

  ...LINES.map(([id, name, text, direction]) => ({
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
];
