import type { Cue } from '../../../shared/audio/types';

/** Where every effect happens: a steel cradle on the face of a glass tower. */
const site =
  'On a steel window-cleaning cradle hanging 80 floors up a glass skyscraper, open air. High-quality real Foley, close and clear. No music, voices or beeps.';
/** The same place for the cues that are meant to ring or tick. */
const signal =
  'On a steel window-cleaning cradle hanging 80 floors up a glass skyscraper, open air. High-quality real recording, clear with a short open-air decay. No music or voices.';
const seamless =
  'Seamless loop with a steady level, no distinct foreground events, voices or music.';
const identity =
  'A skyscraper window-cleaning caper 80 floors up. Bouncy mid-century swing combo: muted trumpet, clarinet, walking upright bass, brushed snare, vibraphone and pizzicato strings. Sunny, cheeky and a little vertiginous.';

function cue(
  id: string,
  name: string,
  group: string,
  prompt: string,
  category: Cue['category'],
  duration: number,
  volume: number,
  loop = false,
  text = '',
): Cue {
  return { id, name, group, prompt, category, duration, volume, loop, text };
}

const fx = (
  id: string,
  name: string,
  group: string,
  action: string,
  duration: number,
  volume: number,
  place = site,
) => cue(id, name, group, `${action} ${place}`, 'event', duration, volume);

/** A frequent sound gets three recorded takes: `id`, `id.2` and `id.3`. */
const takes = (
  id: string,
  name: string,
  group: string,
  action: string,
  details: readonly [string, string, string],
  duration: number,
  volume: number,
) =>
  details.map((detail, index) =>
    fx(
      index ? `${id}.${index + 1}` : id,
      `${name} · take ${index + 1}`,
      group,
      `${action} ${detail}`,
      duration,
      volume,
    ),
  );

const bed = (id: string, name: string, action: string, volume: number) =>
  cue(
    id,
    name,
    'Ambience',
    `${action} ${seamless}`,
    'ambience',
    id === 'ambience.sky' || id === 'ambience.city' ? 24 : 20,
    volume,
    true,
  );

const music = (
  id: string,
  name: string,
  mood: string,
  duration: number,
  loop: boolean,
  volume: number,
) =>
  cue(
    id,
    name,
    'Music',
    `${identity} ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short phrase with a clean ending, no loop.'}`,
    'music',
    duration,
    volume,
    loop,
  );

const line = (id: string, name: string, direction: string, text: string) =>
  cue(
    `speech.${id}`,
    name,
    'Chaos Commentator',
    direction,
    'speech',
    5,
    0.85,
    false,
    text,
  );

export const scaffoldScrambleCatalog: Cue[] = [
  cue(
    'event.ui',
    'Button click',
    'Interface',
    'One small tactile plastic button click, dry, quiet and precise. No music, voices or beeps.',
    'event',
    0.5,
    0.35,
  ),

  fx(
    'event.start',
    'Shift start whistle',
    'Shift',
    'A foreman blows one bright brass whistle blast, then the cradle brake releases with a heavy steel clunk and the cables take the load.',
    2.2,
    0.8,
  ),
  fx(
    'event.tick',
    'Countdown tick',
    'Shift',
    'One crisp mechanical stopwatch tick, a dry hard click with a tiny metallic ring.',
    0.5,
    0.6,
    signal,
  ),
  fx(
    'event.milestone',
    'Five more windows',
    'Shift',
    'A bright three-note brass handbell chime rings once, cheerful and clear, like a lift arriving at its floor.',
    1.5,
    0.7,
    signal,
  ),
  fx(
    'event.win',
    'Job done',
    'Shift',
    'Office workers behind thick glass burst into muffled applause and whistles while a rooftop air horn gives two triumphant toots. No words.',
    3,
    0.85,
    signal,
  ),
  fx(
    'event.fail',
    'Shift over horn',
    'Shift',
    'A long low factory shift-end air horn blares once and fades, deflated and final, echoing between skyscrapers.',
    2.5,
    0.8,
    signal,
  ),

  ...takes(
    'crank.ratchet',
    'Winch ratchet',
    'Winch',
    'A gloved hand turns a steel hand-winch crank one notch: the pawl clicks over the ratchet teeth and the drum winds in taut steel cable.',
    [
      'Even, firm notch.',
      'A lighter, quicker notch with two crisp pawl clicks.',
      'A heavier notch with a deeper clack and a faint cable twang.',
    ],
    0.6,
    0.6,
  ),
  ...takes(
    'crank.lower',
    'Lower the winch',
    'Winch',
    'A hand winch pays out steel cable: the pawl is held open, the drum spins briefly and a brake band squeaks before catching.',
    [
      'Even, controlled release.',
      'A short smooth release with a soft brake hiss.',
      'A jerkier release with a rattling drum and a firm brake grab.',
    ],
    0.8,
    0.55,
  ),

  fx(
    'hazard.tilt_warning',
    'Tilt alarm',
    'Cradle',
    "The cradle's mechanical tilt alarm: a small brass bell clangs rapidly four times while the suspension cables groan under uneven load.",
    1.6,
    0.75,
    signal,
  ),
  fx(
    'cradle.lurch',
    'Cradle lurches',
    'Cradle',
    'The whole steel cradle lurches and drops a few centimetres: a heavy structural clunk, cables snapping taut and railings rattling.',
    1.2,
    0.85,
  ),

  ...takes(
    'step.deck',
    'Deck footstep',
    'Footsteps',
    'One rubber work-boot step on a perforated steel grating deck: a hollow metallic tap with a slight grille rattle.',
    [
      'Even heel contact.',
      'Lighter toe-first contact.',
      'Heavier planted step with a small scuff.',
    ],
    0.5,
    0.45,
  ),
  ...takes(
    'step.suds',
    'Soapy footstep',
    'Footsteps',
    'One rubber work-boot step on a steel grating deck slick with soapy water: a wet squelch and a squeak of rubber.',
    [
      'Even heel contact.',
      'Lighter toe-first contact with a few drips.',
      'Heavier planted step that skids a little.',
    ],
    0.6,
    0.45,
  ),

  ...takes(
    'hazard.slip',
    'Worker slips',
    'Crew',
    'Rubber boots skid out on a wet sloping steel deck: a squeaky slide and a body bumping down onto the grating. No voice.',
    [
      'A medium skid and one thump.',
      'A shorter skid ending in a sitting thump.',
      'A longer skid with a flailing arm clattering the railing.',
    ],
    1,
    0.8,
  ),
  fx(
    'hazard.dangle',
    'Caught by the harness',
    'Crew',
    'A worker drops off the cradle edge and a nylon safety lanyard snaps taut: a shock-absorber rip, a carabiner clank and a slow creaking swing. No voice.',
    1.5,
    0.85,
  ),
  fx(
    'crew.recover',
    'Back on their feet',
    'Crew',
    'A worker scrambles up from a slide on a steel grating deck: boots find grip with two squeaks and a gloved hand slaps the railing. No voice.',
    0.9,
    0.55,
  ),
  fx(
    'crew.climbed',
    'Hauled back aboard',
    'Crew',
    'A worker hauls themselves back over the cradle railing: harness webbing creaks, gloved hands grip steel, then boots land on the grating deck. No voice.',
    1.2,
    0.7,
  ),
  fx(
    'tool.sponge',
    'Grab the sponge',
    'Crew',
    'A big soapy sponge is plunged into a bucket of water and lifted out: a wet dunk, a squelch and trickling drips.',
    0.8,
    0.5,
  ),
  fx(
    'tool.squeegee',
    'Grab the squeegee',
    'Crew',
    'A metal squeegee is unclipped from a tool-belt holster: a plastic buckle click and a light flick of the rubber blade.',
    0.7,
    0.5,
  ),

  ...takes(
    'soap.foam',
    'Soap the window',
    'Cleaning',
    'A big soapy sponge slaps onto a window pane and scrubs in circles: a wet foamy squelch against glass.',
    [
      'A medium slap and two scrubs.',
      'A lighter dab with a frothy fizz.',
      'A heavier slap with a splash of drips.',
    ],
    0.8,
    0.7,
  ),
  ...takes(
    'squeegee.wipe',
    'Squeegee wipe',
    'Cleaning',
    'A rubber squeegee blade draws one long stroke across wet glass: a smooth rubbery glide ending in a crisp squeak.',
    [
      'An even, steady stroke.',
      'A faster stroke with a higher squeak.',
      'A slower firm stroke with water flicked off the end.',
    ],
    0.9,
    0.75,
  ),
  fx(
    'window.clean',
    'Spotless window',
    'Cleaning',
    'A spotless window pane rings once: a bright crystalline glass ping, like a fingertip flicking thick clean glass, with a soft shimmer.',
    1.2,
    0.7,
    signal,
  ),

  ...takes(
    'bucket.slide',
    'Bucket slides',
    'Buckets',
    'A metal bucket half full of soapy water slides across a tilted steel grating: a scraping rattle and water sloshing inside.',
    [
      'A medium scrape and slosh.',
      'A shorter scrape with a light slosh.',
      'A faster grinding scrape with a heavy slosh.',
    ],
    1,
    0.65,
  ),
  fx(
    'bucket.spill',
    'Bucket spills',
    'Buckets',
    'A metal bucket slams into the end railing and tips over: a loud clang and a big gush of soapy water splashing across the steel deck.',
    1.6,
    0.9,
  ),
  fx(
    'bucket.bump',
    'Bucket knocks the rail',
    'Buckets',
    'A metal bucket of water knocks into a steel railing: one dull clank and a small slosh.',
    0.8,
    0.55,
  ),
  fx(
    'bucket.bonk',
    'Bucket to the shins',
    'Buckets',
    "A sliding metal bucket clonks into a worker's boots: a hollow bonk, a sloshing wobble and a stumbling scuff. No voice.",
    0.8,
    0.8,
  ),
  fx(
    'bucket.refill',
    'Fresh bucket',
    'Buckets',
    'A fresh bucket of soapy water is set down on a steel deck: a handle clank, a heavy base thud and a gentle slosh.',
    1.2,
    0.55,
  ),

  fx(
    'hazard.pigeon',
    'Shoo the pigeon',
    'Pigeons',
    'A worker swats at a pigeon and it bursts into flight: sharp wing claps, frantic flapping and one indignant squawk.',
    1.2,
    0.8,
  ),
  fx(
    'pigeon.land',
    'Pigeon lands',
    'Pigeons',
    'A plump city pigeon flutters in and lands on a taut steel cable: a few wing beats, small claws gripping metal and a smug coo.',
    1.3,
    0.7,
  ),
  fx(
    'pigeon.flyoff',
    'Pigeon flies away',
    'Pigeons',
    'A pigeon calmly takes off from a steel railing: a few unhurried wing beats fading up and away into open air.',
    1.2,
    0.55,
  ),
  fx(
    'pigeon.coo',
    'Pigeon coos',
    'Pigeons',
    'A single pigeon perched on a cable gives one throaty, self-satisfied rolling coo.',
    1.4,
    0.5,
  ),

  fx(
    'hazard.wind',
    'Wind gust',
    'Weather',
    'A strong high-altitude gust sweeps across the tower face: a rising wind roar, whistling through steel cables and a swaying cradle creak, then easing.',
    4.5,
    0.7,
  ),

  fx(
    'helicopter.flyby',
    'CEO helicopter circles',
    'Helicopter',
    'A private helicopter sweeps past close overhead: the rotor thump builds, passes and banks away with a turbine whine.',
    4,
    0.8,
  ),
  fx(
    'helicopter.land',
    'Helicopter touches down',
    'Helicopter',
    'A helicopter settles onto the rooftop helipad right above: skids thud on concrete, rotor wash roars, then the turbine starts winding down.',
    3.5,
    0.85,
  ),

  bed(
    'ambience.sky',
    'High above the city',
    'Open air 80 floors up a glass skyscraper: steady wind rushing past the facade, a faint whistle in steel cables and a gently swaying cradle.',
    0.5,
  ),
  bed(
    'ambience.city',
    'City far below',
    'A big city heard from far above: a distant muffled wash of traffic, very faint car horns and a low urban hum, soft and spacious.',
    0.45,
  ),
  bed(
    'ambience.helicopter',
    'Helicopter approaching',
    'A helicopter hovering some distance above: a steady deep rotor thump and turbine whine, even and continuous.',
    0.5,
  ),
  bed(
    'ambience.creak',
    'Cradle cables strain',
    'Heavy steel suspension cables and a hanging steel cradle creak and groan under shifting load: slow irregular metal stress creaks and faint railing rattles.',
    0.5,
  ),
  bed(
    'ambience.winch',
    'Winch cable running',
    'A hand-cranked winch drum turning steadily: taut steel cable winding over a pulley, a low gear whir and a cable hum. No distinct clicks.',
    0.45,
  ),

  music(
    'music.menu',
    'Lobby swing',
    'Relaxed and welcoming, 96 BPM, a light clarinet hook with lots of space between phrases.',
    48,
    true,
    0.55,
  ),
  music(
    'music.play',
    'On the cradle',
    'A busy, cheerful working groove, 122 BPM: bouncing bass, brushes and playful muted-trumpet stabs, leaving room for sound effects.',
    60,
    true,
    0.5,
  ),
  music(
    'music.tension',
    'Helicopter incoming',
    'Final-stretch urgency, 144 BPM: a driving bass ostinato, rising trumpet stabs and quick ticking hi-hat. Tense but still fun, no alarms or sirens.',
    48,
    true,
    0.55,
  ),
  music(
    'music.win',
    'Spotless',
    'A triumphant big-band finish: a bright brass fanfare, a drum fill and a cheeky final chord.',
    8,
    false,
    0.65,
  ),
  music(
    'music.fail',
    'Dirty windows',
    'A deflated comic trombone phrase sliding down over pizzicato, then a sympathetic final chord. Gentle, never tragic.',
    7,
    false,
    0.6,
  ),

  line(
    'start',
    'The shift begins',
    '[dryly]',
    'Eighty floors up, thirty filthy windows and one helicopter. Try not to look down.',
  ),
  line(
    'halfway',
    'Halfway through the shift',
    '[encouragingly]',
    'Halfway through the shift. Keep those squeegees squeaking, you magnificent daredevils.',
  ),
  line(
    'first-clean',
    'First spotless window',
    '[pleased]',
    'One sparkling window. Only twenty-nine to go. Pace yourselves.',
  ),
  line(
    'almost',
    'Five windows left',
    '[excited]',
    'Five windows left! Squeegee like your pension depends on it.',
  ),
  line(
    'tilt',
    'The cradle tilts',
    '[alarmed]',
    'That cradle is not a slide. Level it out, please!',
  ),
  line(
    'dangle',
    'A worker dangles',
    '[deadpan]',
    'Someone is dangling eighty floors up. The harness is earning its keep.',
  ),
  line(
    'spill',
    'Soap everywhere',
    '[laughing]',
    'Soap everywhere. The deck is now an ice rink with a view.',
  ),
  line(
    'pigeon',
    'A pigeon jams the winch',
    '[dryly]',
    'A pigeon has seized the winch. Negotiations are not going well.',
  ),
  line(
    'wind',
    'A big gust',
    '[urgent]',
    'Big gust! Hold on to something. Ideally not each other.',
  ),
  line(
    'minute',
    'One minute left',
    '[urgent]',
    'One minute until the CEO lands. Look busy. Actually, be busy.',
  ),
  line(
    'ten',
    'Ten seconds left',
    '[urgent] [shouting]',
    'Ten seconds! Wipe anything! Wipe everything!',
  ),
  line(
    'win',
    'All windows spotless',
    '[excited]',
    'Thirty spotless windows before the helicopter landed. The CEO is almost impressed.',
  ),
  line(
    'fail',
    'The helicopter lands first',
    '[deadpan]',
    'The helicopter has landed. The windows have not. Awkward.',
  ),
];
