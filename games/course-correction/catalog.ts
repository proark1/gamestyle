import { cue } from '../../shared/audio/catalog-helpers';
import type { AudioManifest } from '../../shared/audio/types';

const sounds = [
  ['shot', 'Putter strike'],
  ['impact', 'Golf ball collision'],
  ['wall', 'Hinged wall rotation'],
  ['bridge', 'Tipping wooden bridge'],
  ['platform', 'Sliding cup platform'],
  ['cup', 'Ball drops into cup'],
  ['assist', 'Helpful ricochet'],
  ['recover', 'Ball recovery'],
  ['multi-cup', 'Course correction celebration'],
  ['hole', 'Hole result'],
  ['match', 'Mini-golf match result'],
] as const;

export const courseCorrectionCatalog = sounds.map(([id, name]) =>
  cue(
    `course.${id}`,
    name,
    'Course Correction',
    `${name}, tactile roadside mini-golf sound, playful and brief, no speech.`,
    'event',
    1,
    false,
    id === 'multi-cup' ? 0.9 : 0.68,
  ),
);

const reused = {
  shot: '/audio/panic-curling/curling.launch.wav',
  impact: '/audio/panic-curling/curling.stone_clack.wav',
  wall: '/audio/zorb-clash/event.zorb_bonk.wav',
  bridge: '/audio/zorb-clash/event.spring_recoil.wav',
  platform: '/audio/zorb-clash/event.turtle_slide.wav',
  cup: '/audio/zorb-clash/event.goal_cheer.wav',
  assist: '/audio/zorb-clash/event.dash_burst.wav',
  recover: '/audio/zorb-clash/event.recover.wav',
  'multi-cup': '/audio/panic-curling/curling.crowd_cheer.wav',
  hole: '/audio/panic-curling/curling.turn.wav',
  match: '/audio/zorb-clash/event.win.wav',
} as const;

export const COURSE_DEFAULT_AUDIO: AudioManifest['cues'] = Object.fromEntries(
  Object.entries(reused).map(([id, url]) => [
    `course.${id}`,
    {
      url,
      volume: id === 'multi-cup' ? 0.9 : 0.68,
      category: 'event',
      loop: false,
    },
  ]),
);
