import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const site =
  'Busy outdoor demolition site. Steel chain, hard hats, scaffolding, rubble dust, comic slapstick timing, clean punchy mix, no speech, no music unless asked.';

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
    'Chain of Fools',
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
  volume = 0.4,
) =>
  cue(
    id,
    name,
    'Chain of Fools',
    `${prompt} ${site}`,
    'ambience',
    duration,
    true,
    volume,
  );

export const chainOfFoolsCatalog: Cue[] = [
  fx(
    'event.start',
    'Shift whistle',
    'A foreman blowing a sharp two-tone site whistle to start the shift.',
    1.4,
  ),
  fx(
    'move.jump',
    'Boot hop',
    'A worker in heavy steel-toe boots pushing off a steel girder with a short grunt of effort and a jingle of chain.',
    0.5,
    0.55,
  ),
  fx(
    'move.land',
    'Boot landing',
    'Heavy work boots landing on a steel deck with a dull clang and a small puff of grit.',
    0.5,
    0.6,
  ),
  fx(
    'chain.yank',
    'Chain snaps taut',
    'A heavy steel chain suddenly snapping taut with a loud metallic clank and rattle.',
    0.8,
    0.85,
  ),
  fx(
    'chain.dangle',
    'Harness catch',
    'A worker dropping off a ledge and being caught by a chain harness: a rattling chain whip, a jolt, and a comic yelp-free gasp of air.',
    1.2,
    0.9,
  ),
  fx(
    'chain.haul',
    'Hand-over-hand haul',
    'Gloved hands hauling a steel chain hand over hand, links clinking over a steel edge.',
    1.4,
    0.75,
  ),
  fx(
    'chain.saved',
    'Back on deck',
    'A worker scrambling back onto a steel deck, boots scraping, followed by a relieved bright metallic ding.',
    1.0,
    0.8,
  ),
  fx(
    'chain.clip',
    'Carabiner clip',
    'A heavy steel carabiner snapping shut onto a steel anchor ring with a crisp click.',
    0.6,
    0.8,
  ),
  fx(
    'hazard.limp',
    'Hard landing',
    'A worker landing flat on packed dirt from a height: a heavy thud, a hard hat bouncing away, a dazed groan-free silence.',
    1.0,
    0.85,
  ),
  fx(
    'hazard.wrecking',
    'Wrecking ball hit',
    'A swinging steel wrecking ball smacking into a worker: a deep hollow boom and a cartoon whoosh.',
    1.2,
    0.9,
  ),
  fx(
    'hazard.plank',
    'Plank tips',
    'A long wooden scaffold plank tipping on a steel drum with a loud creak and a knock.',
    1.0,
    0.8,
  ),
  fx(
    'event.checkpoint',
    'Checkpoint flag',
    'A cheerful bright bell ding and a flag snapping in the wind.',
    1.0,
    0.8,
  ),
  fx(
    'event.wipe',
    'Whole crew over',
    'A whole chain of workers falling off a structure together: a long descending chain rattle, then a distant dusty crash.',
    1.8,
    0.85,
  ),
  fx(
    'event.ping',
    'Crew whistle',
    'A short two-finger whistle calling the crew over.',
    0.6,
    0.65,
  ),
  fx(
    'event.win',
    'Clocked in',
    'A punch clock stamping a card, then a short triumphant brass fanfare.',
    2.6,
    0.9,
  ),
  fx(
    'event.fail',
    'End of shift horn',
    'A long low end-of-shift site horn, deflated and comic.',
    2.2,
    0.85,
  ),
  bed(
    'ambience.site',
    'Demolition site',
    'Distant excavators, a far-off jackhammer, trickling rubble, wind across an open site.',
    8.0,
    0.35,
  ),
];
