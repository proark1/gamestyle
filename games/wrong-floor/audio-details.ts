import { cue } from '../../shared/audio/catalog-helpers';

const fx = (
  id: string,
  name: string,
  prompt: string,
  duration = 1,
  volume = 0.5,
) =>
  cue(
    id,
    name,
    'Hotel details',
    `${prompt} Isolated physical Foley with short indoor decay, no speech or music.`,
    'event',
    duration,
    false,
    volume,
  );
export const hotelDetails = [
  fx(
    'event.ui',
    'Reception control',
    'One brass reception switch depresses with a soft mechanical click.',
    0.5,
    0.28,
  ),
  fx(
    'event.join',
    'Guest checked in',
    'A brass room key is set gently on a wooden reception desk.',
    0.8,
    0.42,
  ),
  fx(
    'event.leave',
    'Guest checked out',
    'A brass key is lifted off a wooden reception desk and rings briefly against its fob.',
    0.8,
    0.38,
  ),
  fx(
    'event.fail',
    'The hotel keeps you',
    'A heavy deadbolt slides slowly into a thick wooden hotel door with a final dull clunk.',
    2,
    0.65,
  ),
  ...(['step', 'step-metal', 'step-wood'] as const).flatMap((surface) =>
    [1, 2, 3].map((v) =>
      fx(
        `event.${surface}.${v}`,
        `${surface === 'step' ? 'Carpet' : surface === 'step-metal' ? 'Elevator' : 'Floorboard'} footstep · take ${v}`,
        `${['One careful shoe heel then sole lands', 'One measured rubber-soled shoe plants', 'One slow shoe step transfers weight'][v - 1]} ${surface === 'step' ? 'on thick hotel carpet, soft fabric compression and muted friction' : surface === 'step-metal' ? 'on a resonant steel elevator floor, restrained hollow tap' : 'on an old intact wooden hallway floorboard, a short low board knock'}.`,
        0.65,
        0.55,
      ),
    ),
  ),
  cue(
    'ambience.hotel',
    'The hotel is listening',
    'Hotel atmosphere',
    'Quiet old hotel corridor room tone, distant ventilation and a faint sustained electrical hum. Sparse, restrained, steady seamless loop. No footsteps, knocks, voices, scares or music.',
    'ambience',
    16,
    true,
    0.48,
  ),
  cue(
    'ambience.elevator',
    'Between floors',
    'Hotel atmosphere',
    'Inside a slowly moving old elevator: steady low machinery rumble, subdued cable vibration and metal enclosure resonance. Seamless constant loop, no bell, start, stop, voices or music.',
    'ambience',
    12,
    true,
    0.5,
  ),
  ...(
    [
      [
        'menu',
        'A reservation for four',
        'Very restrained uneasy anticipation with a sparse soft piano motif.',
        32,
        true,
      ],
      [
        'tension',
        'Compare your stories',
        'Very quiet suspended tones and occasional muted piano, no pulse that resembles footsteps or knocking.',
        40,
        true,
      ],
      [
        'escape',
        'Hold the elevator',
        'A restrained low urgent string pulse, escalating motion without loud stabs or screams.',
        40,
        true,
      ],
      [
        'win',
        'Checked out',
        'Brief quiet relief and a warm resolved piano chord.',
        7,
        false,
      ],
      [
        'fail',
        'Still a guest',
        'Brief unresolved low bowed note fading into a soft mechanical texture.',
        6,
        false,
      ],
    ] as const
  ).map(([id, name, direction, duration, loop]) =>
    cue(
      `music.${id}`,
      name,
      'Hotel score',
      `Original subtle instrumental mystery hotel score. Muted felt piano, soft bowed bass and airy sustained strings. ${direction} No vocals, speech, jump-scare impacts or literal sound effects. ${loop ? 'Seamless loop-friendly beginning and ending.' : ''}`,
      'music',
      duration,
      loop,
      0.42,
    ),
  ),
];
