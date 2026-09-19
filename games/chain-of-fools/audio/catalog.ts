import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

/**
 * Chain of Fools sound workshop. Four workers on one steel safety line cross a
 * half-demolished site: dirt yard, rusty girders, scaffold boards, a concrete
 * ledge under a swinging wrecking load, a steel pipe crawl and a cargo net.
 * Every cue here is played by `audio-events.ts` or `ChainOfFoolsSound`.
 */

const site =
  'Open-air demolition site, faint slap-back off concrete shells. Real high-quality Foley, natural weight, short decay. No music, speech or beeps.';
const underfoot =
  'Close perspective, one footfall only, real high-quality Foley with a short natural decay. No music, speech or beeps.';
const loopBed =
  'Seamless stereo loop at a steady level, no sudden foreground events. No music, speech or beeps.';

const fx = (
  id: string,
  name: string,
  group: string,
  action: string,
  duration: number,
  volume = 0.7,
) =>
  cue(id, name, group, `${action} ${site}`, 'event', duration, false, volume);

/** Frequent actions: three recorded takes, played in turn by `variant()`. */
const takes = (
  id: string,
  name: string,
  group: string,
  actions: [string, string, string],
  duration: number,
  volume = 0.7,
) =>
  actions.map((action, index) =>
    fx(
      index === 0 ? id : `${id}.${index + 1}`,
      index === 0 ? name : `${name} · take ${index + 1}`,
      group,
      action,
      duration,
      volume,
    ),
  );

const surfaces: [string, string, string][] = [
  [
    'dirt',
    'Dirt yard',
    'One steel-toe work-boot footfall on packed dirt with loose gravel, a dull crunch and a few small stones scattering.',
  ],
  [
    'steel',
    'Steel girder',
    'One steel-toe work-boot footfall on a rusty steel I-beam girder, a dull solid clank with a short low ring through the metal.',
  ],
  [
    'timber',
    'Scaffold board',
    'One steel-toe work-boot footfall on a thick wooden scaffold board, a hollow woody knock and a faint flexing creak.',
  ],
  [
    'concrete',
    'Concrete ledge',
    'One steel-toe work-boot footfall on a dusty concrete slab, a hard flat tap with a gritty scuff.',
  ],
  [
    'pipe',
    'Inside the pipe',
    'One steel-toe work-boot footfall inside a huge hollow steel pipe, a round metallic boom with a short tunnel echo.',
  ],
];
const stride = [
  'Even heel-to-toe contact.',
  'Lighter, quicker toe-first contact.',
  'Heavier planted step with a tiny scrape.',
];

const footsteps = surfaces.flatMap(([surface, label, texture]) =>
  stride.map((detail, index) =>
    cue(
      index === 0 ? `step.${surface}` : `step.${surface}.${index + 1}`,
      `${label} · footstep ${index + 1}`,
      'Footsteps',
      `${texture} ${detail} ${underfoot}`,
      'event',
      0.6,
      false,
      0.5,
    ),
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
    `ambience.${id}`,
    name,
    'Ambience',
    `${action} ${loopBed}`,
    'ambience',
    duration,
    true,
    volume,
  );

const score =
  'Chain of Fools, a comic construction-site party game about four workers on one safety chain. Bouncy tuba bass, plucky banjo, honky-tonk upright piano, muted trumpet and brushed snare, with light tuned percussion on steel pipes and a small anvil. Warm, good-natured teamwork slapstick, clear soft dynamics, no harsh high frequencies.';

const music = (
  id: string,
  name: string,
  mood: string,
  duration: number,
  loop: boolean,
) =>
  cue(
    `music.${id}`,
    name,
    'Music',
    `${score} ${mood} Instrumental only, no vocals or sound effects. ${loop ? 'Stable seamless loop, no intro or fade-out.' : 'One short phrase that ends cleanly, no loop.'}`,
    'music',
    duration,
    loop,
    0.6,
  );

const line = (id: string, name: string, direction: string, text: string) => ({
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
});

export const chainOfFoolsCatalog: Cue[] = [
  // Crew
  ...takes(
    'move.jump',
    'Boot hop',
    'Crew',
    [
      'A construction worker in heavy steel-toe boots pushes off hard for a hop, one boot scuff, a short effort breath and harness buckles and a safety chain jingling.',
      'A quick springy hop in work boots, a soft scuff, a canvas tool belt flapping and a couple of chain links clinking.',
      'A big worker heaves into a jump, boots scraping grit, a loose hard hat rattling on its strap and a heavy chain swinging up with him.',
    ],
    0.7,
    0.55,
  ),
  ...takes(
    'move.land',
    'Boot landing',
    'Crew',
    [
      'Heavy work boots land together after a short drop, knees taking the weight, a dull body thud, a hi-vis vest rustle and harness buckles jangling.',
      'A light landing in work boots, two quick contacts and a small stumble step, a soft jangle of harness buckles.',
      'A big worker drops onto both boots with a hard thump, his hard hat knocking forward on its strap and a steel chain slapping down beside him.',
    ],
    0.7,
    0.6,
  ),
  fx(
    'crew.brace',
    'Dig in and brace',
    'Crew',
    'A worker plants his boots and braces against a pull, two hard boot scuffs digging in and leather gloves clamping round a steel chain with a tight creak.',
    0.9,
    0.6,
  ),
  fx(
    'crew.exhausted',
    'Grip gives out',
    'Crew',
    'A braced worker loses his grip, leather gloves sliding along a steel chain in a fast rattling zip, boots skidding on grit, one winded exhale.',
    1.2,
    0.7,
  ),
  fx(
    'event.ping',
    'Crew whistle',
    'Crew',
    'A worker whistles through two fingers to call the crew over, one short loud rising two-note whistle carried across an open site.',
    0.8,
    0.6,
  ),

  // Footsteps
  ...footsteps,
  cue(
    'step.net',
    'Cargo net · climb',
    'Footsteps',
    `Gloved hands and a boot shifting down a hanging rope cargo net, taut hemp rope creaking, knots tightening and a soft sway. ${underfoot}`,
    'event',
    0.8,
    false,
    0.5,
  ),

  // Chain
  ...takes(
    'chain.yank',
    'Dragged off his feet',
    'Chain',
    [
      'A heavy steel safety chain snaps taut with a violent jerk, links clashing, and yanks a worker off his feet, a harness jolt and a boot skid.',
      'A steel chain whips tight with a sharp clank and rattle and a worker stumbles, boots sliding quickly across grit.',
      'A thick steel chain wrenches tight with a deep grinding clank, a body lurches forward, boots drag and a hard hat bounces loose.',
    ],
    0.9,
    0.85,
  ),
  fx(
    'chain.taut',
    'Line pulls tight',
    'Chain',
    'A slack steel safety chain between two workers pulls tight in one go, a quick rattle of sliding links, then one firm metallic clink as it goes straight.',
    0.7,
    0.6,
  ),
  fx(
    'chain.dangle',
    'Harness catch',
    'Chain',
    'A worker slips off a high edge and his safety harness catches him, a fast rattling chain run-out, a hard harness jolt, straps creaking as he swings, one startled gasp.',
    1.3,
    0.9,
  ),
  fx(
    'chain.haul',
    'Hand-over-hand haul',
    'Chain',
    'Gloved hands haul a heavy steel chain hand over hand with steady effort, links grinding over a steel edge in three strong pulls.',
    1.5,
    0.75,
  ),
  fx(
    'chain.saved',
    'Back on deck',
    'Chain',
    'A worker is hauled back onto a deck and up on his feet, boots scrabbling, a knee thumping down, the chain going slack, one relieved exhale.',
    1.2,
    0.8,
  ),
  fx(
    'chain.clip',
    'Carabiner clip',
    'Chain',
    'A heavy steel carabiner snaps shut onto a steel anchor ring, a crisp spring-gate click and a short bright ring.',
    0.6,
    0.8,
  ),
  fx(
    'chain.unclip',
    'Carabiner unclip',
    'Chain',
    'A worker twists open a heavy steel screw-gate carabiner and lifts it off an anchor ring, a gritty threaded turn, a gate click and chain links dropping free.',
    0.8,
    0.7,
  ),

  // Hazards
  fx(
    'hazard.limp',
    'Hard landing',
    'Hazards',
    'A worker falls a long way and lands flat on packed dirt, a heavy body thud with the wind knocked out, and a hard hat bouncing and rolling away.',
    1.2,
    0.85,
  ),
  fx(
    'hazard.wrecking',
    'Wrecking ball hit',
    'Hazards',
    'A swinging steel wrecking ball clobbers a worker, a deep hollow metal boom against a padded body, a big thump and a chain rattling as he is flung.',
    1.3,
    0.9,
  ),
  fx(
    'hazard.swing',
    'Wrecking ball sweeps past',
    'Hazards',
    'A heavy steel wrecking ball on a crane cable sweeps past close by, a deep rushing whoosh of air and a low steel cable creak.',
    1.6,
    0.6,
  ),
  fx(
    'hazard.hook',
    'Grab the crane hook',
    'Hazards',
    'A worker leaps and grabs a huge steel crane hook, gloves slapping onto cold steel, the hook clanking against its block and the cable groaning under the weight.',
    1.2,
    0.75,
  ),
  fx(
    'hazard.plank',
    'Plank tips',
    'Hazards',
    'A long wooden scaffold plank see-saws on a steel drum, a loud timber creak, the drum rolling a little and the plank end knocking down hard as boots skid.',
    1.3,
    0.8,
  ),

  // Shift
  fx(
    'event.start',
    'Shift whistle',
    'Shift',
    'A site foreman blows a sharp, bright two-tone brass whistle to start the shift, carrying across an open yard.',
    1.4,
    0.75,
  ),
  fx(
    'event.checkpoint',
    'Checkpoint flag',
    'Shift',
    'A steel flag pole thunks into its socket, a canvas flag snapping in the wind, and one bright ding of a brass hand bell.',
    1.2,
    0.75,
  ),
  fx(
    'event.clockin',
    'Worker clocks in',
    'Shift',
    'A worker punches in at a site office time clock, a heavy mechanical stamp on a card, a small bell ding and a tin office door banging shut.',
    1.3,
    0.75,
  ),
  fx(
    'event.wipe',
    'Whole crew over',
    'Shift',
    'Four workers chained together tumble off a structure, a long descending steel chain rattle, then a heavy dusty crash onto rubble far below.',
    2.0,
    0.85,
  ),
  fx(
    'event.tick',
    'Last seconds tick',
    'Shift',
    'One loud tick of a big mechanical site clock, a dry metallic clack with a short ring.',
    0.5,
    0.55,
  ),
  fx(
    'event.win',
    'Whole crew clocked in',
    'Shift',
    'A steel roller shutter rattles up at the site office, a brass hand bell rung hard three times and four workers clapping and cheering without words.',
    2.4,
    0.85,
  ),
  fx(
    'event.fail',
    'End of shift horn',
    'Shift',
    'A long low end-of-shift air horn blares across the site, then sags in pitch as it runs out of air, comically deflated.',
    2.4,
    0.8,
  ),

  // Interface
  cue(
    'event.ui',
    'Button press',
    'Interface',
    'One small tactile click of a chunky rubberised site-radio button, dry and quiet. Close perspective, no music, speech or beeps.',
    'event',
    0.5,
    false,
    0.35,
  ),

  // Ambience
  bed(
    'site',
    'Demolition site',
    'A busy demolition site heard from its middle, excavators rumbling in the distance, a far-off jackhammer in short bursts, rubble trickling down a chute and a light breeze.',
    24,
    0.45,
  ),
  bed(
    'wind',
    'Wind at height',
    'High-altitude wind across open steel scaffolding and girders, steady gusts, a soft whistle through tubes and cables and loose hazard tape fluttering.',
    24,
    0.5,
  ),
  bed(
    'crane',
    'Tower crane at work',
    'A tower crane working nearby, a steady diesel engine idle, the slow hum of slewing gear, a cable winch creaking and an occasional heavy block rattle.',
    24,
    0.45,
  ),
  bed(
    'chain',
    'Chain on the move',
    'A heavy steel safety chain dragged along by four walking workers, continuous rhythmic link jingling and scraping over steel and gravel at a steady walking pace.',
    20,
    0.45,
  ),
  bed(
    'strain',
    'Chain under load',
    'A heavy steel chain holding a dangling weight, slow deep creaks, links grinding under load, tense metallic groans and a harness strap stretching.',
    20,
    0.5,
  ),

  // Music
  music(
    'menu',
    'Clocking on',
    'Menu: relaxed and welcoming, 92 BPM, a catchy four-bar tuba and banjo work-song motif with plenty of space.',
    48,
    true,
  ),
  music(
    'play',
    'On the chain',
    'Gameplay: a steady bouncy walk, 108 BPM, a hummable muted-trumpet melody over a lopsided tuba and banjo groove. Leave space for sound effects and friends talking.',
    60,
    true,
  ),
  music(
    'tension',
    'Last minute of the shift',
    'Final minute: urgent but still comic, 132 BPM, a driving tuba ostinato, tight banjo chops, ticking pipe percussion and rising piano stabs. No alarms or harsh brass.',
    56,
    true,
  ),
  music(
    'win',
    'Shift complete',
    'Victory: a proud bouncy brass-band flourish with a banjo strum and a big warm final chord, about eight seconds.',
    8,
    false,
  ),
  music(
    'fail',
    'Horn went early',
    'Defeat: a sympathetic, gently comic descending tuba and trombone phrase with a hopeful final piano chord, never sad or harsh, about seven seconds.',
    7,
    false,
  ),

  // Chaos Commentator
  line(
    'start',
    'Shift starts',
    '[dryly]',
    'Four fools, one chain, one site office. Try to arrive together.',
  ),
  line(
    'encourage',
    'Halfway through the shift',
    '[warmly]',
    'Halfway through the shift. Keep the chain slack and your ambitions modest.',
  ),
  line(
    'checkpoint',
    'Checkpoint banked',
    '[pleased]',
    'Checkpoint banked. Nobody fell off. Well, nobody important.',
  ),
  line(
    'dangle',
    'Someone went over',
    '[deadpan]',
    "Someone's gone over. That's what the chain is for, apparently.",
  ),
  line(
    'haul',
    'Hauled back up',
    '[warmly]',
    'Hauled back up. Teamwork, or a very convincing impression of it.',
  ),
  line(
    'limp',
    'Came down hard',
    '[deadpan]',
    'That landing was mostly face. Somebody pick them up.',
  ),
  line(
    'wrecking',
    'Hit by the wrecking ball',
    '[laughing]',
    'Direct hit from the wrecking ball. It does exactly what it says.',
  ),
  line(
    'plank',
    'The plank tips',
    '[dryly]',
    'Everyone on one end of the plank. Physics would like a word.',
  ),
  line(
    'wipe',
    'Whole crew over',
    '[excited]',
    'The entire crew, over the edge, together. Admirable commitment.',
  ),
  line(
    'minute',
    'One minute left',
    '[urgent]',
    'One minute until the horn. Walk faster. Fall less.',
  ),
  line(
    'ten',
    'Ten seconds left',
    '[urgent] [shouting]',
    'Ten seconds! Run! Drag them if you must!',
  ),
  line(
    'win',
    'Whole crew clocked in',
    '[excited]',
    'Whole crew clocked in! Health and safety are weeping with joy.',
  ),
  line(
    'fail',
    'The horn went',
    '[deadpan]',
    "That's the horn. The site office remains a beautiful rumour.",
  ),
];
