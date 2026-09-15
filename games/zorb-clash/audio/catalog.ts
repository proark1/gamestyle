import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const arena =
  'Bubble soccer and sumo derby arena. Large transparent inflatable spheres colliding, elastic rubber impulses, cheering crowds, bouncy soccer pitch.';

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
    'Zorb Clash',
    `${prompt} ${arena}`,
    'event',
    Math.max(0.5, duration),
    false,
    volume,
  );

export const zorbClashCatalog: Cue[] = [
  fx(
    'event.zorb_bonk',
    'Explosive Zorb Collision',
    'A hyper-bouncy, comical rubber impact of two giant inflatable bumper balls colliding with resonant thud and cartoon boing.',
    0.6,
    0.9,
  ),
  fx(
    'event.dash_burst',
    'Bumper Dash Whoosh',
    'An explosive compressed air burst and rocket propulsion whoosh.',
    0.7,
    0.85,
  ),
  fx(
    'event.brace_thud',
    'Sumo Anchor Brace',
    'A heavy grounded thud as a bumper ball digs into the turf to brace against impact.',
    0.5,
    0.8,
  ),
  fx(
    'event.spring_recoil',
    'Boundary Spring Cushion',
    'A twanging mechanical accordion spring rebound launched at high velocity.',
    0.6,
    0.8,
  ),
  fx(
    'event.turtle_slide',
    'Turtle Flip Whistle',
    'A comical downward slide whistle as a bumper ball flips completely upside down.',
    0.8,
    0.75,
  ),
  fx(
    'event.ball_kick',
    'Beach Ball Slam',
    'A hollow, resonant boom of an oversized beach soccer ball being kicked across the field.',
    0.5,
    0.8,
  ),
  fx(
    'event.goal_cheer',
    'Stadium Goal Fanfare',
    'A loud stadium airhorn blast followed by energetic crowd cheer.',
    1.5,
    0.95,
  ),
  fx(
    'event.referee_whistle',
    'Referee Whistle',
    'A crisp, double-chirp referee whistle starting the match.',
    0.5,
    0.85,
  ),
];
