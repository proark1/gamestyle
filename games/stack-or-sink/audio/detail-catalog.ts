import type { Cue } from '../../../shared/audio/types';
import { salvageCues } from '../../../shared/audio/salvage-prompts';

const dry =
  ' Real outdoor Foley, natural weight, clear onset and short decay. No voices, music, cartoon effects, clipping or exaggerated reverb.';
function variations(
  id: string,
  name: string,
  action: string,
  duration: number,
  volume: number,
): Cue[] {
  return [1, 2, 3].map((v) => ({
    id: `${id}.${v}`,
    name: `${name} · ${v}`,
    group: 'Coastal details',
    category: 'event',
    prompt: `${action} ${['Soft, brief contact.', 'Slightly fuller texture with a different rhythm.', 'Restrained heavier texture and a short natural tail.'][v - 1]}${dry}`,
    duration,
    volume,
    loop: false,
    text: '',
  }));
}

const surfaces = {
  sand: 'Two work boots land on compact beach sand; a cushioned low thud and loose grains scattering.',
  wood: 'Two work boots land on solid stacked timber; a weighty board knock and short joint flex, intact wood.',
  metal:
    'Two work boots land on a salvaged steel appliance; a low panel thunk and brief hollow metal vibration.',
  fabric:
    'Two work boots compress a sofa cushion; padded weight, upholstery friction and a tiny real spring creak.',
  water:
    'Two work boots land in shallow seawater; a rounded splash, low displaced water and short falling droplets.',
};

export const stackDetailCatalog: Cue[] = [
  ...variations(
    'coast.gull',
    'Distant gull',
    'One coastal gull calls briefly from across the shore, open airy distance, no flock or foreground wingbeats.',
    2.5,
    0.42,
  ),
  ...variations(
    'coast.palm',
    'Palm fronds',
    'A passing sea breeze bends a palm frond; broad dry leaf rub and delicate fibrous flutter, no microphone rumble.',
    3,
    0.42,
  ),
  ...variations(
    'water.drip',
    'Lifted salvage drains',
    'Seawater drains from a lifted object; a brief thin stream breaks into scattered droplets falling into water.',
    2,
    0.46,
  ),
  ...variations(
    'strain.wood',
    'Timber shifts',
    'Stacked salvage timber shifts slightly under weight; a short low joint creak and restrained grain friction, no breakage.',
    1.4,
    0.5,
  ),
  ...variations(
    'strain.metal',
    'Appliance settles',
    'An intact salvaged appliance rocks against its support; a subdued steel panel flex and tiny internal shelf rattle.',
    1.3,
    0.5,
  ),
  ...variations(
    'strain.fabric',
    'Sofa frame flexes',
    'An old sofa shifts under load; upholstery pulls against its intact timber frame with a muffled spring creak.',
    1.4,
    0.45,
  ),
  ...variations(
    'crane.cable',
    'Loaded crane cable',
    'A loaded yard crane cable tightens while its winch moves; short steel rope tension creak and pulley friction, no snapping or motor.',
    1.7,
    0.52,
  ),
  ...Object.entries(surfaces).flatMap(([surface, action]) =>
    variations(
      `land.${surface}`,
      `${surface} landing`,
      action,
      surface === 'water' ? 1.5 : 0.9,
      0.72,
    ).map((cue) => ({ ...cue, group: 'Landings' })),
  ),
  ...salvageCues()
    .filter((cue) => cue.id.endsWith('.impact'))
    .flatMap((cue) =>
      [2, 3].map(
        (v): Cue => ({
          ...cue,
          id: `${cue.id}.${v}`,
          name: `${cue.name} · alternate ${v}`,
          prompt: `${cue.prompt} ${v === 2 ? 'Softer off-centre contact.' : 'Heavier planted contact.'}`,
        }),
      ),
    ),
  ...(
    [
      [
        'build',
        'Cinematic building',
        'Warm adventurous teamwork. Plucked acoustic guitar, felt piano, expressive low strings and a steady brushed drum pulse. A memorable hopeful motif with space between phrases.',
        60,
        true,
      ],
      [
        'challenge',
        'Cinematic rising water',
        'The same hopeful coastal adventure motif grows urgent. Low bowed strings, tight acoustic percussion and deeper restrained toms. Strong forward momentum, human scale, no horror or sirens.',
        60,
        true,
      ],
      [
        'rescue',
        'A helping hand',
        'One short uplifting acoustic and string accent for helping a teammate to safety. A warm rising phrase resolving naturally, no big fanfare or drum hit. Begin promptly and finish cleanly.',
        5,
        false,
      ],
    ] as const
  ).map(
    ([id, name, mood, duration, loop]): Cue => ({
      id: `music.cinematic.${id}`,
      name,
      group: 'Cinematic music',
      category: 'music',
      prompt: `Coastal cooperative survival film score. ${mood} D major, 104 BPM, 4/4. Instrumental only, no singing, speech or sound effects. Broad warm dynamics, clear midrange and controlled bass. ${loop ? 'Start on the downbeat with no intro, stable energy, exactly 26 bars suitable for a seamless gameplay loop, no fade-out.' : ''}`,
      duration,
      loop,
      volume: id === 'rescue' ? 0.7 : 0.82,
      text: '',
    }),
  ),
];
