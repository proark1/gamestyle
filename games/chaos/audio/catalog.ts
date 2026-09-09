import type { Cue } from '../../../shared/audio/construction/types';
import {
  dry,
  cue,
  common,
} from '../../../shared/audio/construction/catalog-helpers';
import { materialPrompt } from '../../../shared/audio/construction/material-prompts';
import { CATALOG, SAYINGS as CHAOS_SAYINGS } from '../catalog';
import { chaosMaterial } from './material-prompts';
import { partyCatalog, variations } from './party-catalog';
const actions = [
  ['grab', 'Pick up'],
  ['place', 'Place'],
  ['drop', 'Put down'],
  ['remove', 'Remove'],
  ['throw', 'Throw'],
  ['impact', 'Impact'],
] as const;
function materialCues() {
  return CATALOG.flatMap((item) =>
    actions.map(([action, label]) =>
      cue(
        `material.${item.id}.${action}`,
        `${item.name} · ${label}`,
        item.name,
        materialPrompt(chaosMaterial[item.id][action]),
        'material',
        action === 'impact' ? 2.5 : 1.8,
      ),
    ),
  );
}
function speechCues() {
  const sayings = CHAOS_SAYINGS;
  const extras = [
    [
      'job.0',
      'Mrs. Fixit',
      'Small and cozy. And please put the toilet indoors.',
    ],
    ['job.1', 'Mr. Clockoff', 'A bed. A table. And absolutely no more work.'],
    [
      'job.2',
      'The Cushion family',
      'There are six of us. We like to sit down.',
    ],
    [
      'win',
      'Inspection passed',
      'Inspection passed! With reservations. But with style.',
    ],
    [
      'fail',
      'Time is up',
      'Built with good intentions! The inspector is looking the other way today.',
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
      'event.wind',
      'Wind gust',
      'Site events',
      'A sudden realistic outdoor wind gust across a construction site, rising air rush, loose tarp flutter and faint leaf rustling, fading naturally. No music or voices.',
      'event',
      4,
    ),
    cue(
      'event.bonk',
      'Collision',
      'Site events',
      `${dry} A harmless padded bump into a worker wearing a hard hat, damped clothing thump and light helmet tap. No violent crunch, scream or cartoon effect.`,
      'event',
      1,
    ),
    cue(
      'event.join',
      'Builder arrived',
      'Site events',
      'A friendly short double tap of a work glove against a wooden door frame, realistic dry sound, no voice or music.',
      'event',
      1,
    ),
    cue(
      'event.photo',
      'Evidence photo',
      'Controls',
      'One compact camera mechanical shutter click, clean isolated sound, no voice or music.',
      'event',
      0.5,
    ),
    cue(
      'ambience.crane',
      'Crane · Hook and cable',
      'Crane',
      'A hanging steel crane hook and tensioned cable gently creak in a light outdoor breeze. Sparse quiet metallic ticks, no operating motor or lifting action, no speech or music. Seamless ambient loop.',
      'ambience',
      15,
      true,
    ),
  ];
  const style =
    'Lighthearted cooperative construction game, playful plucked acoustic bass, marimba, acoustic guitar and brushed percussion, human groove.';
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
    ...partyCatalog(),
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
  return [...described, ...variations(described)];
}
