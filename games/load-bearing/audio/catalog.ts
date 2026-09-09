import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const site =
  'Original demolition site sound. Dry outdoor air, dusty masonry, weighty but playful, clean mix, no speech.';
const fx = (
  id: string,
  name: string,
  prompt: string,
  duration: number,
  volume = 0.75,
) =>
  cue(
    id,
    name,
    'Demolition',
    `${prompt} ${site}`,
    'event',
    Math.max(0.5, duration),
    false,
    volume,
  );
const bed = (
  id: string,
  name: string,
  prompt: string,
  duration: number,
  volume = 0.5,
) =>
  cue(
    id,
    name,
    'Demolition',
    `${prompt} ${site}`,
    'ambience',
    duration,
    true,
    volume,
  );

export const loadBearingCatalog: Cue[] = [
  fx(
    'event.start',
    'Site briefing',
    'A short air-horn blast over a rolling site drum, brisk and workmanlike.',
    2,
  ),
  fx(
    'event.hammer',
    'Sledgehammer',
    'A heavy steel head striking brick, dull thud with a bright chip of masonry.',
    0.9,
    0.85,
  ),
  fx(
    'event.crack',
    'Giving way',
    'Timber and mortar cracking under strain, splintering fibres, a low groan.',
    1.4,
  ),
  fx(
    'event.break',
    'Panel down',
    'A wall panel breaking loose and slapping the ground, grit and dust settling.',
    1.6,
    0.9,
  ),
  fx(
    'event.collapse',
    'Progressive collapse',
    'A multi-stage masonry collapse, heavy slabs pancaking with a deep rolling rumble.',
    3.2,
    1,
  ),
  fx(
    'event.ball',
    'Ball contact',
    'An enormous steel wrecking ball smashing concrete, metallic ring and debris scatter.',
    2.2,
    1,
  ),
  fx(
    'event.piano',
    'Piano insult',
    'An upright piano taking a heavy knock, strings jangling in ugly protest.',
    1.8,
    0.9,
  ),
  fx(
    'event.piano-lost',
    'Piano finished',
    'An upright piano destroyed outright, soundboard splitting and every string ringing at once.',
    3,
    1,
  ),
  fx(
    'event.down',
    'Buried',
    'A body-sized thump under falling rubble, a winded grunt of dust.',
    1.2,
  ),
  fx(
    'event.help',
    'Dug out',
    'Debris shifted aside quickly, boots on gravel, a relieved breath.',
    1.2,
  ),
  fx(
    'event.mark',
    'Spray paint',
    'A short aerosol hiss marking a cross on masonry.',
    0.8,
    0.6,
  ),
  fx(
    'event.win',
    'Signed off',
    'A satisfied site whistle and a warm brass tag over settling dust.',
    2.6,
  ),
  fx(
    'event.lose',
    'Call the client',
    'A deflating comic trombone under a last piece of falling rubble.',
    2.4,
  ),
  bed(
    'ambience.yard',
    'Site air',
    'Open demolition yard, distant traffic, wind over broken brick, faint machinery.',
    12,
    0.35,
  ),
  bed(
    'ambience.crane',
    'Crane motor',
    'A steady diesel crane motor with cable tension creak.',
    8,
    0.45,
  ),
];
