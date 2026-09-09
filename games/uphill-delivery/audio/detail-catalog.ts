import type { Cue } from '../../../shared/audio/types';

const direction =
  'Real Foley, natural weight, clean onset, short decay. No music, speech, cartoon effects, distortion or exaggerated reverb.';
function effect(
  id: string,
  name: string,
  prompt: string,
  duration = 1.2,
  volume = 0.55,
): Cue {
  return {
    id,
    name,
    group: 'Mountain delivery',
    prompt: `${prompt} ${direction}`,
    category: 'event',
    duration,
    volume,
    loop: false,
    text: '',
  };
}
function takes(
  id: string,
  name: string,
  prompt: string,
  duration = 1.2,
  volume = 0.55,
): Cue[] {
  return [
    'Soft light contact.',
    'Balanced ordinary weight.',
    'Slightly firmer contact, still restrained.',
  ].map((take, i) =>
    effect(
      `${id}.${i + 1}`,
      `${name} · take ${i + 1}`,
      `${prompt} ${take}`,
      duration,
      volume,
    ),
  );
}
function bed(id: string, name: string, prompt: string, volume = 0.55): Cue {
  return {
    id: `ambience.${id}`,
    name,
    group: 'Mountain environment',
    prompt: `${prompt} Quiet stereo field recording. Seamless steady loop, no foreground calls, voices, music, dramatic gusts or audible loop seam.`,
    category: 'ambience',
    duration: 24,
    volume,
    loop: true,
    text: '',
  };
}

/** Additive IDs keep existing saved delivery clips and workshop edits intact. */
export const deliveryDetails: Cue[] = [
  ...takes(
    'step.stone',
    'Stone path footstep',
    'One work boot lands on worn rough mountain paving, a solid low sole tap and tiny loose grit scrape.',
    0.65,
    0.6,
  ),
  ...takes(
    'step.ice',
    'Icy stair footstep',
    'One careful rubber work-boot step on a thin glaze of ice over stone, close dry sole contact and a short fine gritty skid. No cracking lake ice.',
    0.65,
    0.52,
  ),
  effect(
    'event.jump',
    'Push off',
    'A worker pushes off the ground, brief boot scuff and soft trouser fabric movement. No voice.',
    0.65,
    0.4,
  ),
  effect(
    'event.land',
    'Boots settle',
    'Two work boots take body weight after a small jump onto firm ground, short low contact and a slight knee-level clothing rustle.',
    0.8,
    0.6,
  ),
  effect(
    'event.release',
    'Let go of the sofa',
    'Gloved hands slide away from coarse sofa upholstery, a brief soft cloth brush as tension releases. No impact or landing.',
    0.65,
    0.4,
  ),
  ...takes(
    'sofa.carry',
    'Loaded sofa frame',
    'A heavy upholstered sofa shifts gently in human hands, one brief low timber joint creak and muted cushion friction. Intact frame, no breaking.',
    1.2,
    0.42,
  ),
  ...takes(
    'sofa.scrape',
    'Sofa on stone',
    'Wooden sofa feet drag a short distance across rough paving, low uneven friction and a tiny rattle inside an intact padded frame.',
    0.75,
    0.5,
  ),
  ...takes(
    'sofa.scrape-wood',
    'Sofa on timber',
    'Wooden sofa feet slide briefly over a timber floor, a dull dry friction scrape and quiet board resonance.',
    0.75,
    0.46,
  ),
  ...takes(
    'sofa.scrape-ice',
    'Sofa on ice',
    'Heavy wooden furniture feet glide over thin frosty paving, a soft smooth hiss with fine grit underneath. No dramatic cracking.',
    0.75,
    0.4,
  ),
  ...takes(
    'sofa.scrape-grass',
    'Sofa on turf',
    'Heavy wooden furniture feet drag briefly through short grass, muted soil friction and flattened blades. No stone scrape.',
    0.75,
    0.4,
  ),
  ...takes(
    'bridge.creak',
    'Loaded rope bridge',
    'One short weathered timber plank flex under weight, with a small taut rope fibre creak. Secure wooden footbridge, no snapping or collapse.',
    1.6,
    0.48,
  ),
  ...takes(
    'clothing.move',
    'Work clothes shift',
    'A small close rustle of cotton work trousers and a canvas jacket during a careful walking step, dry soft fabric friction.',
    0.65,
    0.22,
  ),
  ...takes(
    'goat.hoof',
    'Goat hoof on stone',
    'One small goat hoof taps rough paving, dry hard cloven-hoof contact and a little grit. No bleat or bell.',
    0.55,
    0.38,
  ),
  ...takes(
    'goat.bell',
    'Quiet collar bell',
    'A small dull brass goat collar bell swings once, a delicate irregular clink with short natural decay. No animal call.',
    1.2,
    0.26,
  ),
  ...takes(
    'bird.call',
    'Distant mountain bird',
    'One small alpine songbird gives a brief natural chirp phrase from a tree several metres away. Quiet open air, no flock or background sound.',
    1.6,
    0.32,
  ),
  effect(
    'event.latch',
    'Gate latch settles',
    'A small iron latch settles into a timber gate, one dull metal click with a tiny wooden knock.',
    0.7,
    0.42,
  ),
  effect(
    'event.door-close',
    'Cottage door closes',
    'A solid timber cottage door comes gently to rest against its jamb, restrained wooden thud and latch click. No slam.',
    1.1,
    0.55,
  ),
  bed(
    'pines',
    'Pine needles in the breeze',
    'Gentle air moves through pine needles, soft airy foliage texture with slight organic variation.',
    0.5,
  ),
  bed(
    'ridge',
    'Exposed mountain air',
    'Open mountain air above a quiet valley, broad soft wind with slow small changes, no microphone buffeting or whistling.',
    0.52,
  ),
  bed(
    'room',
    'Quiet customer room',
    'Still air inside a small furnished wooden cottage, extremely soft room tone and distant outdoor air muffled through the walls.',
    0.35,
  ),
];
