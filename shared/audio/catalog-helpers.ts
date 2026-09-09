import type { Cue, GameId } from './types';
export const dry =
  'Real outdoor Foley, close perspective, natural weight and short decay. No music, speech, beeps, cartoon effects, distortion or exaggerated reverb.';

export function cue(
  id: string,
  name: string,
  group: string,
  prompt: string,
  category: Cue['category'] = 'event',
  duration = 1.5,
  loop = false,
  volume = 0.7,
): Cue {
  return {
    id,
    name,
    group,
    prompt,
    category,
    duration,
    loop,
    volume,
    text: '',
  };
}

export function effect(
  id: string,
  name: string,
  group: string,
  action: string,
  duration = 1.5,
  volume = 0.7,
) {
  return cue(
    id,
    name,
    group,
    `${action} ${dry}`,
    'event',
    duration,
    false,
    volume,
  );
}

export function bed(id: string, name: string, action: string, volume = 0.7) {
  return cue(
    `ambience.${id}`,
    name,
    'Environment',
    `${action} Consistent quiet stereo bed, smooth seamless loop, no foreground events, voices or music. Natural outdoor recording, no dramatic swells.`,
    'ambience',
    24,
    true,
    volume,
  );
}

export function speech(
  id: string,
  name: string,
  text: string,
  direction = '[warmly]',
) {
  return {
    ...cue(
      `speech.${id}`,
      name,
      'Character voices',
      direction,
      'speech',
      5,
      false,
      0.8,
    ),
    text,
  };
}

export const stepTextures: Record<string, string> = {
  sand: 'One work-boot footfall on compact coastal sand; soft granular crunch and a little loose grit displaced by the sole.',
  grass:
    'One rubber farm-boot footfall on damp meadow turf; restrained low soil contact and flattened grass blades, no squelch.',
  wood: 'One work-boot footfall on an intact wooden pallet or crate; solid woody tap with a faint short board creak.',
  metal:
    'One work-boot footfall on a salvaged steel appliance; low sheet-metal thud and a short light panel vibration.',
  fabric:
    'One work-boot footfall onto an old upholstered sofa; dull padded contact, cloth friction and tiny restrained spring creak.',
  water:
    'One work-boot wading step through ankle-deep seawater; small rounded splash, sole pressing sand, a few short droplets.',
  hoof: 'One adult cow hoof striking meadow turf; rounded cloven-hoof contact, damp earth compression and faint grass rustle. A single footfall, no animal call.',
};

export function steps(surfaces: string[]) {
  return surfaces.flatMap((surface) =>
    [1, 2, 3].map((variant) =>
      effect(
        `step.${surface}.${variant}`,
        `${surface[0].toUpperCase() + surface.slice(1)} · footstep ${variant}`,
        'Footsteps',
        `${stepTextures[surface]} ${['Even balanced weight on the heel.', 'Slightly softer toe-first contact.', 'Slightly heavier planted step with a tiny scrape.'][variant - 1]}`,
        0.65,
        surface === 'hoof' ? 0.5 : 0.6,
      ),
    ),
  );
}

export function music(game: GameId) {
  const identity =
    game === 'stack-or-sink'
      ? 'Coastal cooperative survival. Warm muted plucked guitar, felt piano, low brushed hand percussion, spacious acoustic texture.'
      : game === 'uphill-delivery'
        ? 'Alpine cooperative furniture delivery. Warm plucked acoustic strings, soft clarinet, restrained brushed percussion and an amiable lopsided walking rhythm. Playful human teamwork, never slapstick.'
        : 'Quiet countryside hide-and-seek. Muted pizzicato strings, wooden marimba, breathy low flute, soft brushed percussion, subtle mischievous warmth.';
  return (
    [
      [
        'menu',
        'Menu',
        'Welcoming, curious and relaxed, 82 BPM. A small memorable motif and much space between notes.',
        48,
        true,
      ],
      [
        'build',
        'Play',
        'Calm focused play, 94 BPM. Gentle repeating motif, understated pulse, leave space for environmental sounds and friends talking.',
        60,
        true,
      ],
      [
        'challenge',
        'Rising tension',
        'Controlled urgency, 112 BPM. Slightly tighter pulse and restrained low tension, no panic, huge drums or alarm-like tones.',
        60,
        true,
      ],
      [
        'win',
        'Round won',
        'A warm earned resolution, brief rising acoustic motif and natural final chord. End cleanly, no looping.',
        8,
        false,
      ],
      [
        'fail',
        'Round lost',
        'Gentle sympathetic descending phrase, hopeful final chord. Never punitive or tragic. End cleanly, no looping.',
        7,
        false,
      ],
    ] as const
  ).map(([id, label, mood, duration, loop]) =>
    cue(
      `music.${id}`,
      label,
      'Music',
      `${identity} ${mood} Instrumental only, no singing, speech or sound effects. Clear soft dynamics, no harsh high frequencies, modest bass. ${loop ? 'Stable opening and ending suitable for a seamless repeating gameplay bed, no intro or fade-out.' : ''}`,
      'music',
      duration,
      loop,
      0.65,
    ),
  );
}

export const common = [
  effect(
    'event.ui',
    'Button press',
    'Interface',
    'One small tactile wooden control click; warm and quiet, precise dry contact.',
    0.5,
    0.35,
  ),
];
