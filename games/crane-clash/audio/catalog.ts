import { expansion } from './expansion';
import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const yard =
  'Construction crane party sound. Outdoor air, mechanical whines, heavy wood impacts, cheerful and punchy, clean mix, no speech.';

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
    'Crane Clash',
    `${prompt} ${yard}`,
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
    'Crane Clash',
    `${prompt} ${yard}`,
    'ambience',
    duration,
    true,
    volume,
  );

export const craneClashCatalog: Cue[] = [
  ...expansion,
  fx(
    'event.start',
    'Match start siren',
    'A roaring industrial airhorn signal starting the construction competition.',
    2.2,
  ),
  fx(
    'event.grab',
    'Crate latch click',
    'Heavy magnetic clamp and metal hook locking onto a wooden crate with a crisp snap.',
    0.8,
    0.85,
  ),
  fx(
    'event.place',
    'Crate release / drop',
    'A quick mechanical unlatch sound as a crate is released into free fall.',
    0.7,
    0.75,
  ),
  fx(
    'event.impact',
    'Crate impact',
    'Heavy wooden crate slamming onto another block or platform, solid thud with splinter vibration.',
    1.1,
    0.8,
  ),
  fx(
    'event.bonk',
    'Mid-air player collision',
    'Comic cartoon bonk and springy collision sound between two swinging workers.',
    1.2,
    0.9,
  ),
  fx(
    'event.topple',
    'Tower collapse',
    'Multiple wooden boxes and heavy blocks toppling over and crashing down in sequence.',
    2.4,
    0.95,
  ),
  fx(
    'event.height',
    'Height record chime',
    'Bright upbeat industrial achievement bell for reaching a new tower height milestone.',
    1.4,
    0.8,
  ),
  fx(
    'event.win',
    'Victory whistle & celebration',
    'Triumphant factory whistle blowing with a celebratory chord flourish.',
    3.0,
    0.9,
  ),
  bed(
    'ambience.yard',
    'Crane yard breeze & generator',
    'Steady low hum of diesel generator and wind through crane lattice girders.',
    12.0,
    0.35,
  ),
  bed(
    'ambience.crane',
    'Crane winch electric motor',
    'Electric hoist motor whining smoothly while hoisting cable.',
    6.0,
    0.4,
  ),
];
