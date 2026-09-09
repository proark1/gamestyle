import type { Cue } from './types';
export const dry =
  'Realistic close-miked construction Foley outdoors. Physically accurate weight and texture. One isolated action with a clean transient and short natural decay. No music, voices, cartoon boing, synthetic beep, distortion or exaggerated reverb.';

export function cue(
  id: string,
  name: string,
  group: string,
  prompt: string,
  category: Cue['category'] = 'event',
  duration = 2,
  loop = false,
): Cue {
  return {
    id,
    name,
    group,
    prompt,
    category,
    duration,
    loop,
    volume: 1,
    text: '',
  };
}

export const common = [
  cue(
    'ambience.site',
    'Building site · Atmosphere',
    'Outdoors',
    'Natural daytime outdoor construction-site ambience, gentle wind, distant neighborhood birds, soft distant traffic. No nearby machinery, talking, music or alarms. Quiet consistent bed with no dramatic foreground events, seamless loop.',
    'ambience',
    20,
    true,
  ),
  cue(
    'ambience.trees',
    'Trees and fence · Wind',
    'Outdoors',
    'A light breeze gently rustling green leaves and passing a timber fence outdoors. Natural quiet field recording, no music, speech or dramatic gusts, seamless loop.',
    'ambience',
    15,
    true,
  ),
  cue(
    'step.concrete',
    'Footsteps · Concrete',
    'Movement',
    `${dry} One work boot footstep on rough solid concrete, firm rubber sole impact and faint gritty scuff.`,
    'event',
    0.5,
  ),
  cue(
    'step.dirt',
    'Footsteps · Dirt',
    'Movement',
    `${dry} One work boot footstep on compacted dry construction dirt and fine gravel, muted crunch and gritty scuff.`,
    'event',
    0.5,
  ),
  cue(
    'step.wood',
    'Footsteps · Wood',
    'Movement',
    `${dry} One work boot footstep on a wooden panel, short hollow timber knock and slight board creak.`,
    'event',
    0.5,
  ),
  cue(
    'step.brick',
    'Footsteps · Brick',
    'Movement',
    `${dry} One work boot footstep on solid fired clay masonry, firm dry clay tap and gritty sole scrape.`,
    'event',
    0.5,
  ),
  cue(
    'step.roof',
    'Footsteps · Roof panel',
    'Movement',
    `${dry} One work boot footstep on a rigid roof panel, low hollow panel knock and short rubber sole scuff.`,
    'event',
    0.5,
  ),
  cue(
    'event.jump',
    'Jump takeoff',
    'Movement',
    `${dry} Work boots push off the ground for a short jump, sole scuff and brief workwear rustle.`,
    'event',
    0.5,
  ),
  cue(
    'event.land',
    'Jump landing',
    'Movement',
    `${dry} Two work boots land from a small jump, grounded low thump, sole scuff and workwear rustle.`,
    'event',
    0.5,
  ),
  cue(
    'event.ui',
    'Menu · Select',
    'Controls',
    'One quiet tactile mechanical pushbutton click, short natural plastic switch snap. No electronic beep, speech or music.',
    'event',
    0.5,
  ),
  cue(
    'event.error',
    'Action unavailable',
    'Controls',
    'Two soft short muted wooden taps, subtle unobtrusive negative feedback, no harsh alarm, speech or music.',
    'event',
    0.5,
  ),
];
