import { applyScenePlan } from '../../shared/audio/apply-scene-plan';
import { reelDetails } from './audio/details';
import { ReelAudioDirector } from './audio/director';
import { SiteAudio } from '../../shared/audio/player';
import type { Cue } from '../../shared/audio/types';
import type { ReelEvent, ReelWorld } from './types';

const effects = {
  cast: [
    'Cast a line',
    'A fishing rod swishes through the air followed by a tiny lake splash.',
  ],
  bite: [
    'Fish on',
    'A fishing float dips, a quick watery plop and a wooden fishing rod creak.',
  ],
  catch: [
    'Catch landed',
    'A wet fish flops twice onto a wooden boat deck. A happy short bell flourish.',
  ],
  splash: [
    'Overboard',
    'One comically large body splash into a quiet lake, followed by water dripping.',
  ],
  tangle: [
    'Tangled lines',
    'Fishing reels rattle and nylon lines squeak as a knot pulls tight.',
  ],
  snap: [
    'Line snapped',
    'A nylon fishing line stretches then snaps with a sharp twang.',
  ],
  rescue: [
    'Back aboard',
    'Water drips onto wood as a person climbs into a small wooden boat.',
  ],
  start: [
    'Tournament starts',
    'A short friendly outdoor boat horn signals a fishing tournament start.',
  ],
  finish: [
    'Tournament ends',
    'Three short happy brass horn notes signal the end of a fishing tournament.',
  ],
  weather: [
    'Wind and rain arrive',
    'A gust of wind whistles over lake water with pattering rain on wood.',
  ],
  thunder: [
    'Thunder cracks',
    'A sharp thunder crack followed by a low rolling rumble over open water.',
  ],
  shark: [
    'Shark bump',
    'A large fin slices the water followed by a hollow wooden boat hull thump.',
  ],
  chomp: [
    'Shark bite',
    'A huge jaw snaps shut twice underwater with a heavy wet crunch and a thrashing splash.',
  ],
  jellyfish: [
    'Jellyfish snag',
    'A wobbly wet squelch with a tiny electric fizz and nylon line squeak.',
  ],
  sting: [
    'Jellyfish sting',
    'A crackling electric zap fizzes over wet skin and rises into a stinging burn.',
  ],
} as const;
/**
 * Filtered-noise stand-ins used until the workshop generates real clips, so a
 * shark or a jellyfish is never silent on a fresh deployment.
 */
const textures: Partial<
  Record<
    ReelEvent['kind'],
    {
      duration: number;
      from: number;
      to: number;
      filter: BiquadFilterType;
      peak: number;
      hits: number;
    }
  >
> = {
  thunder: {
    duration: 2.1,
    from: 700,
    to: 90,
    filter: 'lowpass',
    peak: 1.2,
    hits: 1,
  },
  weather: {
    duration: 1.4,
    from: 450,
    to: 90,
    filter: 'lowpass',
    peak: 0.65,
    hits: 1,
  },
  shark: {
    duration: 0.55,
    from: 450,
    to: 90,
    filter: 'lowpass',
    peak: 0.65,
    hits: 1,
  },
  jellyfish: {
    duration: 0.55,
    from: 1800,
    to: 90,
    filter: 'lowpass',
    peak: 0.65,
    hits: 1,
  },
  chomp: {
    duration: 0.9,
    from: 1500,
    to: 70,
    filter: 'lowpass',
    peak: 1.1,
    hits: 2,
  },
  sting: {
    duration: 0.7,
    from: 900,
    to: 3400,
    filter: 'bandpass',
    peak: 0.85,
    hits: 5,
  },
};
export const reelCatalog: Cue[] = [
  ...Object.entries(effects).map(([id, [name, prompt]]) => ({
    id: `event.${id}`,
    name,
    group: 'On the lake',
    category: 'event' as const,
    prompt: `${prompt} Clear playful physical Foley, no speech or background music.`,
    text: '',
    duration: 2,
    loop: false,
    volume: 0.65,
  })),
  ...reelDetails,
];
export class ReelSound {
  private clips: SiteAudio;
  private available = new Set<string>();
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private enabledValue = true;
  private director = new ReelAudioDirector();
  constructor() {
    this.clips = new SiteAudio('reel-problems', {
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
  set enabled(value: boolean) {
    this.enabledValue = value;
    this.clips.enabled = value;
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        value ? 0.12 : 0,
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
        this.gain.gain.value = this.enabledValue ? 0.12 : 0;
        this.gain.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Visual cues remain usable when audio is unavailable. */
    }
  }
  update(world: ReelWorld | null, localId?: string) {
    applyScenePlan(
      this.clips,
      this.director.update(world, localId),
      this.available,
      (id) => this.fallback(id),
    );
  }
  private fallback(id: string) {
    const kind = id.slice(6) as ReelEvent['kind'];
    if (!id.startsWith('event.') || !(kind in effects)) return;
    if (!this.context || !this.gain || !this.enabledValue || document.hidden)
      return;
    const ctx = this.context,
      t = ctx.currentTime;
    const shaped = textures[kind];
    if (shaped) {
      const buffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * shaped.duration),
        ctx.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(),
        filter = ctx.createBiquadFilter(),
        envelope = ctx.createGain();
      source.buffer = buffer;
      filter.type = shaped.filter;
      filter.Q.value = shaped.filter === 'bandpass' ? 6 : 1;
      filter.frequency.setValueAtTime(shaped.from, t);
      filter.frequency.exponentialRampToValueAtTime(
        shaped.to,
        t + shaped.duration,
      );
      // One hump is a rumble; repeats are jaws closing or a current crackling.
      const beat = shaped.duration / shaped.hits;
      envelope.gain.setValueAtTime(0.001, t);
      for (let i = 0; i < shaped.hits; i++) {
        envelope.gain.linearRampToValueAtTime(
          shaped.peak * (1 - (i / shaped.hits) * 0.45),
          t + i * beat + 0.045,
        );
        envelope.gain.exponentialRampToValueAtTime(0.001, t + (i + 1) * beat);
      }
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.gain);
      source.start(t);
      source.stop(t + shaped.duration);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      return;
    }
    const frequency =
      kind === 'catch'
        ? 660
        : kind === 'bite'
          ? 500
          : kind === 'splash'
            ? 110
            : kind === 'snap'
              ? 220
              : kind === 'tangle'
                ? 180
                : 350;
    const oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = kind === 'splash' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === 'catch' ? frequency * 1.7 : frequency * 0.5,
      t + 0.22,
    );
    envelope.gain.setValueAtTime(0.001, t);
    envelope.gain.linearRampToValueAtTime(0.7, t + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    oscillator.connect(envelope);
    envelope.connect(this.gain);
    oscillator.start(t);
    oscillator.stop(t + 0.3);
    oscillator.onended = () => {
      oscillator.disconnect();
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
