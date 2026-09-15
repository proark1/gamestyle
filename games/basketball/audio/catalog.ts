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
  fx(
    'event.crowd_cheer',
    'Crowd roar and cheer',
    'Outdoor streetball crowd erupting with ecstatic roars, cheers and celebratory whistles.',
    2.5,
    0.95,
  ),
  fx(
    'event.crowd_gasp',
    'Crowd gasp (Ankle breaker)',
    'Loud collective crowd gasp OHHH! after a vicious crossover or broken ankles.',
    1.2,
    0.9,
  ),
  fx(
    'event.crossover',
    'Crossover double squeak',
    'Sharp rapid double sneaker squeak and athletic cut across the court surface.',
    0.7,
    0.8,
  ),
  fx(
    'event.spin',
    '360 spin whoosh',
    'Fast aerodynamic air whoosh as a player performs a 360 spin move past defenders.',
    0.8,
    0.85,
  ),
  fx(
    'event.stepback',
    'Step-back jumper slide',
    'Athletic shoe slide and squeak creating separation for a step-back jump shot.',
    0.7,
    0.75,
  ),
  fx(
    'event.rimhang',
    'Rim spring & chain rattle',
    'Metallic spring vibration and rattling iron rim as a player hangs after a power slam.',
    1.4,
    0.9,
  ),
  fx(
    'event.fire',
    'Fire burst roar',
    'Explosive arcade fireball roar as a player heats up and enters on-fire state.',
    1.5,
    0.95,
  ),
  fx(
    'event.alleyoop',
    'Alley-oop lob slam',
    'High-flying lob whoosh followed by an explosive two-handed slam dunk.',
    1.8,
    1.0,
  ),
  bed(
    'ambience.court',
    'Streetball playground breeze',
    'Gentle playground outdoor breeze and distant city ambiance.',
    12.0,
    0.3,
  ),
];
