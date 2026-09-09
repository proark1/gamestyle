import type { Cue } from '../../../shared/audio/construction/types';
import {
  cue,
  common,
} from '../../../shared/audio/construction/catalog-helpers';
import { materialPrompt } from '../../../shared/audio/construction/material-prompts';
import { SAYINGS as FP_SAYINGS } from '../sayings';
import { firstPersonMaterial } from './material-prompts';
function materialCues() {
  const names: Record<string, string> = {
    brick: 'Brick',
    beam: 'Timber beam',
    roof: 'Roof panel',
    cement: 'Cement',
    sand: 'Sand',
    water: 'Water',
    mortar: 'Mortar',
  };
  const labels: Record<string, string> = {
    grab: 'Pick up',
    place: 'Place',
    remove: 'Remove',
    drop: 'Return',
    pour: 'Pour into mixer',
    wet: 'Set in mortar',
  };
  return Object.entries(firstPersonMaterial).map(
    ([id, { sound, duration }]) => {
      const [material, action] = id.split('.');
      const label =
        id === 'mortar.grab'
          ? 'Fill bucket'
          : id === 'mortar.place'
            ? 'Spread'
            : labels[action];
      return cue(
        'material.' + id,
        names[material] + ' · ' + label,
        names[material],
        materialPrompt(sound),
        'material',
        duration,
      );
    },
  );
}
function speechCues() {
  const sayings = FP_SAYINGS;
  const extras = [
    [
      'race.start',
      'Roof-raising race begins',
      'Roof-raising in five minutes! Twelve bricks, two posts, two roof panels. All hands on trowels!',
    ],
    ['race.win', 'Roof-raising complete', 'The roof is up! Great work, team!'],
    [
      'race.fail',
      'Roof-raising: time is up',
      'Time is up. We can still keep building!',
    ],
    [
      'mixer.jam',
      'Mixer jammed',
      'The mixer is jammed. Anyone nearby? Give it a nudge!',
    ],
    [
      'mixer.fixed',
      'Mixer fixed',
      'The mixer is running again. A nudge counts as a repair!',
    ],
  ];
  return [
    ...sayings.map((text, i) => [`saying.${i}`, `Site shout ${i + 1}`, text]),
    ...extras,
  ].map(([id, label, text]) => ({
    ...cue(`speech.${id}`, label, 'Site voices', '[playfully]', 'speech', 5),
    text,
  }));
}
export function getCatalog(): Cue[] {
  const events = [
    cue(
      'event.horn',
      'Delivery van · Horn',
      'Delivery van',
      'Two short realistic honks of a parked small construction van outdoors, warm mechanical dual-tone car horn, short natural decay, no voices or music.',
      'event',
      2,
    ),
    cue(
      'mixer.start',
      'Mixer · Start',
      'Mortar mixer',
      'A small electric mortar mixer starts at arm length outdoors: one mechanical switch click, a low motor hum rises in pitch as the drive engages, the steel drum gives two gear ticks and wet sand-and-cement paste begins folding against the internal paddles with slow heavy gritty slops. Natural small machine, no gravel rocks, diesel engine, speech or music.',
      'event',
      2,
    ),
    cue(
      'mixer.run',
      'Mixer · Running',
      'Mortar mixer',
      'A small electric steel-drum mortar mixer turns steadily at arm length outdoors. Constant low electric motor hum beneath regular dull gear ticks; dense wet sandy mortar lifts on the internal paddles and folds back in slow gritty sticky slops once per rotation. Stable speed and distance throughout, seamless repeating sound with no start or stop. No large stones, diesel engine, voices or music.',
      'ambience',
      8,
      true,
    ),
    cue(
      'mixer.stop',
      'Mixer · Finished',
      'Mortar mixer',
      'A small electric mortar mixer switches off: switch snaps, the motor hum falls in pitch and fades, spaced gear ticks slow with the steel drum, and heavy wet sandy paste slides down inside with a final sticky slop. Natural deceleration, no alarm beep, voice or music.',
      'event',
      2,
    ),
    cue(
      'mixer.jam',
      'Mixer · Jammed',
      'Mortar mixer',
      'A rotating small electric mortar mixer abruptly jams: one dull drive-gear clunk, a short low strained electrical hum while the drum stops, then the motor cuts out and the wet sandy load settles. Close modest machinery sound, no explosion, grinding destruction, alarm, speech or music.',
      'event',
      2,
    ),
    cue(
      'mixer.fix',
      'Mixer · Nudge',
      'Mortar mixer',
      'A work-gloved palm firmly nudges the steel frame of a stalled mortar mixer: soft glove contact over one hollow frame knock, a small gear clack as the drum frees, then a brief motor pickup with wet paste moving inside. One nudge, no hammer blows, voices or music.',
      'event',
      2,
    ),
    cue(
      'mixer.empty',
      'Mixer · Empty',
      'Mortar mixer',
      'A stationary steel mortar mixer drum is tipped to empty its remaining thick wet sand-and-cement paste: a short pivot creak and metal lip scrape, then several heavy cohesive gritty slops sliding over the rim, ending with a sticky strand breaking free. Dense paste, not a stream of water or loose gravel. No running motor, speech or music.',
      'event',
      3,
    ),
  ];
  const style =
    'Calm hands-on masonry building game, warm acoustic guitar, soft piano and understated brushed percussion, patient human groove.';
  const music = [
    ['menu', 'Main menu', 'Welcoming relaxed anticipation, 90 BPM.', 40, true],
    [
      'build',
      'Free building',
      'Unobtrusive focused building, 96 BPM, space for Foley and speech.',
      60,
      true,
    ],
    [
      'challenge',
      'Job / Roof-raising race',
      'Gentle forward momentum and teamwork, 115 BPM, no stressful alarms.',
      60,
      true,
    ],
    [
      'win',
      'Success / Clocking off',
      'Brief satisfying celebratory resolution, warm and earned.',
      8,
      false,
    ],
    [
      'fail',
      'Time is up',
      'Short good-humored sympathetic ending, gentle descending phrase.',
      6,
      false,
    ],
  ] as const;
  const catalog: Cue[] = [
    ...materialCues(),
    ...speechCues(),
    ...common,
    ...events,
    ...music.map(([id, name, direction, duration, loop]) =>
      cue(
        `music.${id}`,
        name,
        'Background music',
        `${style} ${direction} Original instrumental music, no vocals or speech. ${loop ? 'Consistent texture, loop-friendly beginning and ending, no big intro or final cadence.' : ''}`,
        'music',
        duration,
        loop,
      ),
    ),
  ];
  const described = catalog.map(
    (c) =>
      ({
        ...c,
        priority:
          c.priority ??
          (c.category === 'ambience' || c.category === 'speech'
            ? 'detail'
            : 'core'),
        trigger:
          c.trigger ??
          (c.category === 'material'
            ? `${c.name}: successful physical action, heard by nearby players.`
            : c.category === 'speech'
              ? 'Matching site shout or round event; one game voice at a time.'
              : c.category === 'music'
                ? `${c.name} game phase; music volume follows the saved mix.`
                : `${c.name} game event or environment layer.`),
      }) satisfies Cue,
  );
  return described;
}
