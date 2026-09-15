import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const court =
  'Bungee doubles tennis tournament sound. Outdoor championship court, energetic crowd, tennis racket thwack, bouncy felt ball, rubber cord stretch, comical and punchy.';

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
    'Bungee Doubles',
    `${prompt} ${court}`,
    'event',
    Math.max(0.5, duration),
    false,
    volume,
  );

export const bungeeDoublesCatalog: Cue[] = [
  fx(
    'event.racket_hit',
    'Tennis Racket Volley',
    'A crisp, high-string-tension tennis racket volley hit on a felt ball with bright resonance.',
    0.5,
    0.85,
  ),
  fx(
    'event.smash_hit',
    'Power Overhead Smash',
    'An explosive, heavy overhead smash sound with a whoosh and thunderous tennis ball thwack.',
    0.7,
    0.95,
  ),
  fx(
    'event.ball_bounce',
    'Tennis Ball Bounce',
    'A hollow, punchy tennis ball bounce on hardcourt surface.',
    0.4,
    0.75,
  ),
  fx(
    'event.net_hit',
    'Net Cord Hit',
    'A tennis ball clipping the net tape with vibrating cord rattle and slight wobble.',
    0.6,
    0.8,
  ),
  fx(
    'event.bungee_stretch',
    'Bungee Cord Tension Strain',
    'A comical groaning, stretching thick rubber bungee cord under high tension.',
    0.8,
    0.8,
  ),
  fx(
    'event.bungee_snap',
    'Bungee Slingshot Snap',
    'A cartoonish spring twang, snappy rubber release and energetic whoosh.',
    0.7,
    0.85,
  ),
  fx(
    'event.partner_bonk',
    'Partner Head-on Collision',
    'A comical cartoon bonk sound followed by dizzy bird chimes and funny stumble thud.',
    0.9,
    0.9,
  ),
  fx(
    'event.point_scored',
    'Umpire Call & Cheer',
    'A sharp umpire whistle, crowd applause and celebratory cheer.',
    1.2,
    0.8,
  ),
  fx(
    'event.game_won',
    'Championship Match Point Win',
    'Umpire announcing game set and match with roaring standing ovation and stadium horn.',
    2.5,
    0.9,
  ),
  fx(
    'event.dive',
    'Court Dive Slide',
    'Shoes and knees sliding along a smooth tennis court with squeak and grass scrape.',
    0.5,
    0.7,
  ),
];
