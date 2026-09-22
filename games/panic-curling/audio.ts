import { SiteAudio } from '../../shared/audio/player';
import { bundledProfile } from '../../shared/audio/bundled-profile';
import { CurlingAudioDirector } from './audio/director';
import type { PanicCurlingWorld } from './types';
import type { Cue } from '../../shared/audio/types';
import { expansion } from './audio/expansion';

export const panicCurlingCatalog: Cue[] = [
  ...expansion,
  {
    id: 'curling.stone_slide',
    name: 'Stone Sliding',
    group: 'curling',
    category: 'material',
    prompt:
      'Granite curling stone gliding smoothly over pebbled ice sheet with subtle friction whoosh',
    text: 'whoosh',
    duration: 3.5,
    loop: true,
    volume: 0.65,
  },
  {
    id: 'curling.stone_clack',
    name: 'Stone Impact',
    group: 'curling',
    category: 'material',
    prompt:
      'Solid ceramic granite curling stones knocking together with dense acoustic clack',
    text: 'clack',
    duration: 0.8,
    loop: false,
    volume: 0.9,
  },
  {
    id: 'curling.sweep_scrub',
    name: 'Rapid Sweeping',
    group: 'curling',
    category: 'event',
    prompt: 'Brisk curling broom scrubbing vigorously against frosty ice sheet',
    text: 'scrub',
    duration: 1.2,
    loop: true,
    volume: 0.7,
  },
  {
    id: 'curling.ice_creak',
    name: 'Thin Ice Groan',
    group: 'curling',
    category: 'ambience',
    prompt:
      'Ominous strained creaking and groan of stressed thin pond ice bending',
    text: 'creak',
    duration: 1.5,
    loop: false,
    volume: 0.75,
  },
  {
    id: 'curling.ice_break',
    name: 'Ice Sheet Fracture',
    group: 'curling',
    category: 'event',
    prompt:
      'Loud sharp crack and collapsing fracture of frozen ice sheet plunging into water',
    text: 'crack',
    duration: 1.4,
    loop: false,
    volume: 1.0,
  },
  {
    id: 'curling.water_splash',
    name: 'Freezing Plunge',
    group: 'curling',
    category: 'event',
    prompt:
      'Heavy splash of person falling into freezing winter lake water with icy ripples',
    text: 'splash',
    duration: 1.6,
    loop: false,
    volume: 0.85,
  },
  {
    id: 'curling.banana_slip',
    name: 'Banana Slide Whistle',
    group: 'curling',
    category: 'event',
    prompt: 'Comical cartoon downward slide whistle with rubber shoe screech',
    text: 'slip',
    duration: 0.9,
    loop: false,
    volume: 0.8,
  },
  {
    id: 'curling.crowd_cheer',
    name: 'House Score Cheer',
    group: 'curling',
    category: 'event',
    prompt:
      'Enthusiastic winter arena crowd cheering with referee whistle and horn',
    text: 'cheer',
    duration: 2.5,
    loop: false,
    volume: 0.85,
  },
];

export class CurlingAudio extends SiteAudio {
  private director = new CurlingAudioDirector();
  constructor() {
    super(
      'panic-curling',
      bundledProfile('panic-curling', panicCurlingCatalog),
    );
  }
  update(world: PanicCurlingWorld | null, localId?: string) {
    const plan = this.director.update(world);
    this.listen(
      world?.players.find((p) => p.id === localId) ?? { x: 0, z: 15 },
      0,
    );
    this.setLoop('rink', plan.playing ? 'ambience.rink' : null, 0.6);
    this.setLoop('music', plan.playing ? 'music.play' : null, 0.6);
    this.setLoop(
      'slide',
      plan.slide > 0.02 ? 'curling.stone_slide' : null,
      plan.slide,
    );
    this.setLoop(
      'sweep',
      plan.sweep > 0.02 ? 'curling.sweep_scrub' : null,
      plan.sweep,
    );
    for (const hit of plan.hits)
      this.play(hit.cue, hit.strength, hit.position, hit.source);
  }
  override reset() {
    super.reset();
    this.director.reset();
  }
}
