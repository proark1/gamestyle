import { applyScenePlan } from '../../shared/audio/apply-scene-plan';
import { breakfastDetails } from './audio/details';
import { BreakfastAudioDirector } from './audio/director';
import { SiteAudio } from '../../shared/audio/player';
import type { Cue } from '../../shared/audio/types';
import type { BrainEvent, BrainWorld } from './types';

const sounds: Record<BrainEvent['kind'], [string, string, number]> = {
  start: [
    'Breakfast bell',
    'A cheerful kitchen service bell rings twice.',
    510,
  ],
  step: [
    'Robot footstep',
    'A small clumsy tin robot foot clunks on kitchen tiles.',
    130,
  ],
  grab: [
    'Utensil grabbed',
    'A metal robot gripper clicks around a kitchen utensil handle.',
    340,
  ],
  flip: [
    'Pancake flip',
    'A pancake swishes into the air and softly slaps into a frying pan.',
    430,
  ],
  pour: [
    'Coffee pouring',
    'A gentle short stream of hot coffee trickles into a ceramic mug.',
    280,
  ],
  serve: [
    'Breakfast served',
    'A soft plate clink followed by a cheerful service bell.',
    660,
  ],
  spill: [
    'Kitchen spill',
    'A small splash of coffee spatters across a tile floor.',
    120,
  ],
  kick: [
    'Table kicked',
    'A wooden kitchen table scrapes away with a comical mug rattle.',
    90,
  ],
  fan: [
    'Ceiling fan incident',
    'A metal gripper rattles against a ceiling fan and a pan clangs away.',
    180,
  ],
  fall: [
    'Robot tumble',
    'A small tin robot falls with three hollow kitchen clanks.',
    100,
  ],
  finish: [
    'Order complete',
    'A friendly short triumphant kitchen bell flourish.',
    780,
  ],
};
export const breakfastCatalog: Cue[] = [
  ...Object.entries(sounds).map(([id, [name, prompt]]) => ({
    id: `event.${id}`,
    name,
    group: 'Breakfast shift',
    category: 'event' as const,
    prompt: `${prompt} Playful physical Foley. No speech or music.`,
    text: '',
    duration: 2,
    loop: false,
    volume: 0.6,
  })),
  ...breakfastDetails,
];
export class BreakfastSound {
  private clips: SiteAudio;
  private available = new Set<string>();
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private director = new BreakfastAudioDirector();
  private on = true;
  constructor() {
    this.clips = new SiteAudio('four-brain-cells', {
      preload: () => true,
      availableVariants: true,
      crossfadeMusic: true,
      bufferLimit: 48,
      warmLimit: 48,
      cooldownKey: (id, source) => `${id}:${source ?? ''}`,
      prepareManifest: (manifest) => {
        this.available = new Set(Object.keys(manifest.cues));
        return manifest;
      },
    });
    this.update(null);
  }
  duck(active: boolean) {
    this.clips.duck(active);
  }
  set enabled(v: boolean) {
    this.on = v;
    this.clips.enabled = v;
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        v ? 0.1 : 0,
        this.context.currentTime,
        0.03,
      );
  }
  unlock() {
    this.clips.unlock();
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.on ? 0.1 : 0;
        this.gain.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Visual events also explain every cue. */
    }
  }
  update(world: BrainWorld | null) {
    applyScenePlan(
      this.clips,
      this.director.update(world),
      this.available,
      (id) => this.fallback(id),
    );
  }
  private fallback(id: string) {
    const kind = id.slice(6) as BrainEvent['kind'];
    if (!id.startsWith('event.') || !(kind in sounds)) return;
    if (!this.context || !this.gain || !this.on || document.hidden) return;
    const t = this.context.currentTime,
      frequency = sounds[kind][2],
      osc = this.context.createOscillator(),
      envelope = this.context.createGain();
    const happy = ['serve', 'finish', 'flip'].includes(kind);
    osc.type = happy ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(
      frequency * (happy ? 1.5 : 0.4),
      t + 0.2,
    );
    envelope.gain.setValueAtTime(0.001, t);
    envelope.gain.linearRampToValueAtTime(0.65, t + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + 0.27);
    osc.connect(envelope);
    envelope.connect(this.gain);
    osc.start(t);
    osc.stop(t + 0.3);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
    };
  }
  reset() {
    this.update(null);
  }
  dispose() {
    this.clips.dispose();
    void this.context?.close().catch(() => {});
  }
}
