import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const style =
  'Original toy-scale medieval siege sound. Wood, rope, stone and cloth, warm and tactile, comic weight, clean mix, no speech.';

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
    'Siege engine',
    `${prompt} ${style}`,
    'event',
    Math.max(0.5, duration),
    false,
    volume,
  );

const bed = (id: string, name: string, prompt: string, volume: number) =>
  cue(
    id,
    name,
    'Siege field',
    `${prompt} ${style}`,
    'ambience',
    8,
    true,
    volume,
  );

export const siegeCatalog: Cue[] = [
  fx(
    'event.start',
    'Call the assault',
    'A single low war horn over a distant camp drum roll.',
    2.4,
    0.85,
  ),
  fx(
    'event.wind',
    'Winch bites',
    'A heavy wooden winch drum ratchets, rope creaks under load.',
    1.4,
    0.6,
  ),
  fx(
    'event.load',
    'Payload in the sling',
    'A heavy stone settles into a leather pouch with a rope slap.',
    1,
  ),
  fx(
    'event.loose',
    'Release',
    'A timber pin snaps free, a huge counterweight drops, rope whips and a beam groans through its arc.',
    2,
    0.95,
  ),
  fx(
    'event.impact',
    'Stone on stone',
    'A boulder smashes into a masonry wall, deep crack and tumbling rubble.',
    2.2,
    0.95,
  ),
  fx(
    'event.rubble',
    'Course collapses',
    'A run of stone blocks slides and topples onto packed earth.',
    2.4,
    0.85,
  ),
  fx(
    'event.squash',
    'Flattened',
    'A comic wooden thud with a short pained oof and a helmet rattling on the ground.',
    1.2,
  ),
  fx(
    'event.pot',
    'Clay pot answer',
    'A clay pot arcs down and shatters on dry ground.',
    1.1,
  ),
  fx(
    'event.bees',
    'The bees arrive',
    'An angry swarm of bees rises and spreads, with distant scrambling footsteps.',
    2.6,
    0.8,
  ),
  fx(
    'event.banner',
    'The banner falls',
    'A tall banner pole cracks and topples, cloth flapping, followed by a triumphant short horn.',
    3,
    1,
  ),
  fx(
    'event.finish',
    'Siege over',
    'A slow ceremonial drum and horn cadence closing a battle.',
    3,
    0.85,
  ),
  bed(
    'ambience.camp',
    'Camp and wind',
    'A dry hillside wind with a distant camp: low voices, canvas snapping, a far-off drum.',
    0.5,
  ),
  bed(
    'ambience.fire',
    'Timber burning',
    'Close crackling timber fire with occasional pops and settling embers.',
    0.6,
  ),
  cue(
    'music.siege',
    'Siege theme',
    'Siege field',
    `A driving medieval Anatolian instrumental loop: frame drum, ney flute and plucked strings, determined and playful, no vocals. ${style}`,
    'music',
    24,
    true,
    0.55,
  ),
];
