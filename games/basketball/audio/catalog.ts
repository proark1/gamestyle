import { cue } from '../../../shared/audio/catalog-helpers';
import type { Cue } from '../../../shared/audio/types';

const court =
  'Streetball court party sound. Outdoor playground, asphalt and hardwood, basketball bounce, net rustle, cheerful and punchy, clean mix, no speech.';

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
    'Court Clash',
    `${prompt} ${court}`,
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
    'Court Clash',
    `${prompt} ${court}`,
    'ambience',
    duration,
    true,
    volume,
  );

export const basketballCatalog: Cue[] = [
  fx(
    'event.bounce',
    'Basketball bounce',
    'A solid, rhythmic basketball bounce on a clean playground surface with deep rubber resonance.',
    0.5,
    0.8,
  ),
  fx(
    'event.rim',
    'Rim clang & rattle',
    'A sharp, metallic clank and vibrating iron ring as a basketball hits the rim.',
    0.8,
    0.85,
  ),
  fx(
    'event.backboard',
    'Backboard impact',
    'A heavy solid wooden/acrylic backboard thud as the ball banks in.',
    0.7,
    0.8,
  ),
  fx(
    'event.swish',
    'Net swish',
    'A clean, satisfying, crisp swish of a basketball passing smoothly through a nylon net.',
    0.9,
    0.95,
  ),
  fx(
    'event.dunk',
    'Slam dunk',
    'An explosive rim-rocking slam dunk, heavy iron rattle and rim shake.',
    1.2,
    0.95,
  ),
  fx(
    'event.superdunk',
    'Super jump dunk explosion',
    'A fiery, powerful arcade super dunk with a fiery whoosh and explosive impact.',
    1.6,
    1.0,
  ),
  fx(
    'event.squeak',
    'Sneaker squeak',
    'A sharp athletic rubber sneaker squeak on clean court flooring during a fast cut.',
    0.6,
    0.65,
  ),
  fx(
    'event.steal',
    'Steal swipe',
    'A quick athletic hand swipe stealing the basketball cleanly.',
    0.6,
    0.75,
  ),
  fx(
    'event.pass',
    'Air pass whoosh',
    'A fast, crisp chest pass whooshing through the air.',
    0.6,
    0.7,
  ),
  fx(
    'event.whistle',
    'Referee whistle',
    'A crisp, loud referee whistle blowing sharply for tip-off or timeout.',
    1.5,
    0.85,
  ),
  fx(
    'event.buzzer',
    'Shot clock buzzer',
    'An electronic stadium game buzzer horn sounding with authority.',
    2.0,
    0.9,
  ),
  fx(
    'event.win',
    'Game victory fanfare',
    'An upbeat celebratory arcade victory whistle and triumphant chord.',
    3.0,
    0.9,
  ),
  bed(
    'ambience.court',
    'Streetball playground breeze',
    'Gentle playground outdoor breeze and distant city ambiance.',
    12.0,
    0.3,
  ),
];
