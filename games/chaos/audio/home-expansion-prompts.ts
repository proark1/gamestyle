// Each object supplies its own contact material and loose internal parts.
function furniture(
  name: string,
  grip: string,
  contact: string,
  movement: string,
) {
  return {
    grab: `Gloved hands lift ${name}: ${grip}, then ${movement}. End when the feet clear the floor.`,
    place: `${name} is carefully aligned on a wooden floor: ${contact}, a small adjustment scrape, then ${movement}.`,
    drop: `${name} is lowered abruptly onto concrete: ${contact}, two uneven contacts and ${movement}.`,
    remove: `${name} rocks out of its position: a short foot scrape, ${grip} and ${movement}.`,
    throw: `A worker heaves and releases ${name}: ${grip} and ${movement}. End at release; no landing or airborne whoosh.`,
    impact: `${name} lands on its side on concrete: ${contact}, a smaller second knock and ${movement}. The object remains intact.`,
  };
}
export const homeExpansionMaterial = {
  bookshelf: furniture(
    'a loaded wooden bookcase',
    'glove friction on varnished oak',
    'a hollow wooden frame thump',
    'paperbacks sliding and softly flapping',
  ),
  wardrobe: furniture(
    'a painted wooden wardrobe',
    'dry wooden joint creaks',
    'two weighty wooden foot knocks',
    'closed doors rattling against their magnetic catches',
  ),
  counter: furniture(
    'a wooden kitchen cabinet with a stone countertop',
    'cabinet joint strain',
    'a dense heavy base thud',
    'a drawer sliding a few millimetres and stopping',
  ),
  sink: furniture(
    'a kitchen sink cabinet',
    'gloves scraping an enamel edge',
    'a wooden base clonk',
    'the stainless steel basin resonating briefly',
  ),
  stove: furniture(
    'a compact enamel cooker',
    'a thin metal panel creak',
    'a heavy metal cabinet thud',
    'burner rings ticking and an oven rack rattling',
  ),
  bathtub: furniture(
    'a freestanding enamel bathtub',
    'glove rub on smooth enamel',
    'a deep hollow enamel knock',
    'four metal feet vibrating with short metallic ticks',
  ),
  tv: furniture(
    'a television on a wooden stand',
    'a plastic housing creak',
    'a wooden stand thump',
    'the screen mount and remote control rattling without glass breaking',
  ),
  piano: furniture(
    'a small upright piano',
    'strained wooden case joints',
    'a deep solid wooden case thud',
    'a few internal strings ringing softly from the movement',
  ),
  bench: furniture(
    'a wooden garden bench',
    'rough wooden slat friction',
    'two dry wooden leg knocks',
    'the long slats flexing with a short creak',
  ),
  aquarium: furniture(
    'a small filled aquarium on its wooden cabinet',
    'gloves squeaking on the glass rim',
    'a damped wooden cabinet thud',
    'water sloshing against intact glass and a lid ticking',
  ),
  easel: furniture(
    'a wooden painting easel',
    'dry pine rail friction',
    'light uneven wooden foot taps',
    'a stretched canvas tapping its support ledge',
  ),
  doghouse: furniture(
    'a small timber dog house',
    'rough timber panel creaks',
    'a hollow wooden box thump',
    'roof boards chattering against the frame',
  ),
};
export const homeUseSounds = [
  [
    'sink',
    'Run the tap',
    'A kitchen tap turns with a small metal click; water splashes into a stainless steel basin and stops with two final drips.',
    3.5,
  ],
  [
    'stove',
    'Cook dinner',
    'A saucepan lid lifts, vegetables sizzle briefly in a pan, a wooden spoon stirs twice and the lid settles with a light metal clink.',
    4.5,
  ],
  [
    'bathtub',
    'Bubble bath',
    'A short gentle burst of bathwater bubbling, small foamy pops and a quiet water slosh in an enamel bathtub.',
    4.5,
  ],
  [
    'tv',
    'Television',
    'An old television power switch clicks, followed by a brief soft analog tuning rustle and another small switch click. No program audio or voices.',
    3,
  ],
  [
    'piano',
    'Play the piano',
    'Four isolated acoustic upright piano key strikes, ascending gently with soft felt hammer contacts and short natural string decay. A brief instrument test, no song.',
    4,
  ],
  [
    'aquarium',
    'Feed the fish',
    'A small aquarium lid opens, dry fish flakes rustle from a paper packet, the water ripples softly and the lid closes with a light plastic tick.',
    3.5,
  ],
  [
    'easel',
    'Paint a picture',
    'A bristle brush is dipped in water and then makes three textured wet strokes across stretched canvas, ending with a quiet wooden handle tap.',
    4,
  ],
] as const;
