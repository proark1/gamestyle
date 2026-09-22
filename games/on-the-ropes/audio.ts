import { SiteAudio } from '../../shared/audio/player';
import { cue } from '../../shared/audio/catalog-helpers';
import { audioPreferencesSnapshot } from '../../shared/audio/preferences';
import type { BoxingEvent, World } from './types';

const sounds = {
  punch: ['Glove whoosh', 'Short padded boxing glove swoosh through air.'],
  hit: [
    'Clean punch',
    'Punchy soft leather boxing glove impact, playful low thump, no voices.',
  ],
  block: [
    'Guard',
    'Two padded leather gloves clap together, short muted slap.',
  ],
  parry: [
    'Timed parry',
    'Bright padded glove tap with a crisp short high accent.',
  ],
  counter: [
    'Counter punch',
    'Strong clean padded boxing impact with a short bass accent.',
  ],
  'guard-break': [
    'Guard break',
    'Two boxing gloves knocked apart with a soft emphatic double thump.',
  ],
  miss: ['Wild swing', 'Comical airy swing and brief shoe squeak on canvas.'],
  rope: [
    'Rope rebound',
    'Elastic boxing ring rope stretches and rebounds with a warm boing.',
  ],
  down: [
    'Knockdown',
    'Soft full body tumble onto a padded canvas, short crowd gasp.',
  ],
  tag: [
    'Tag slap',
    'Sharp friendly high five clap with a small sneaker squeak.',
  ],
  towel: [
    'Towel',
    'A fluffy towel flaps through the air, light fabric swishes.',
  ],
  launch: [
    'Corner launch',
    'A taut elastic rope releases into a rising comic whoosh.',
  ],
  bell: [
    'Ring bell',
    'Warm bright metallic boxing bell, three quick strikes and a short decay.',
  ],
};
export const boxingCatalog = Object.entries(sounds).map(
  ([id, [name, prompt]]) =>
    cue(`boxing.${id}`, name, 'On the Ropes', prompt, 'event', 1, false, 0.7),
);

/** Workshop recordings override the small procedural stand-ins one cue at a time. */
export class BoxingAudio extends SiteAudio {
  private synth: AudioContext | null = null;
  private bus: GainNode | null = null;
  private lastEvent = 0;
  private baseline = false;
  constructor() {
    super('on-the-ropes', { effectLimit: 16, range: () => 30 });
  }
  override unlock() {
    super.unlock();
    if (!this.synth) {
      try {
        this.synth = new AudioContext();
        this.bus = this.synth.createGain();
        this.bus.connect(this.synth.destination);
      } catch {
        return;
      }
    }
    void this.synth.resume().catch(() => {});
  }
  resetEvents() {
    this.baseline = false;
    this.lastEvent = 0;
  }
  update(w: World) {
    if (!this.baseline) {
      this.lastEvent = w.nextEvent;
      this.baseline = true;
      return;
    }
    const prefs = audioPreferencesSnapshot();
    if (this.bus)
      this.bus.gain.value =
        this.enabled && !document.hidden ? prefs.volume * 0.25 : 0;
    for (const e of w.events) {
      if (e.id <= this.lastEvent) continue;
      this.lastEvent = e.id;
      if (!this.enabled || document.hidden) continue;
      const id = `boxing.${e.kind}`;
      if (this.preferredCue(id, ''))
        this.play(id, e.strength, { x: e.x, z: e.z });
      else this.fallback(e);
    }
  }
  setMuted(muted: boolean) {
    this.enabled = !muted;
    if (this.bus && muted) this.bus.gain.value = 0;
  }
  private fallback(e: BoxingEvent) {
    if (!this.synth || !this.bus) return;
    const ctx = this.synth,
      time = ctx.currentTime;
    const bell = e.kind === 'bell',
      down = e.kind === 'down';
    const start = bell
      ? 880
      : e.kind === 'parry'
        ? 660
        : e.kind === 'block' || e.kind === 'tag'
          ? 420
          : e.kind === 'rope'
            ? 220
            : e.kind === 'towel'
              ? 600
              : 160;
    const duration = bell ? 0.85 : down ? 0.38 : 0.16;
    for (let i = 0; i < (bell ? 3 : 1); i++) {
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = bell
        ? 'sine'
        : e.kind === 'miss' || e.kind === 'punch'
          ? 'triangle'
          : 'sine';
      osc.frequency.setValueAtTime(start * (bell ? 1 + i * 0.48 : 1), time);
      if (!bell)
        osc.frequency.exponentialRampToValueAtTime(
          down ? 30 : 65,
          time + duration,
        );
      gain.gain.setValueAtTime((bell ? 0.25 : 0.65) * e.strength, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      osc.connect(gain);
      gain.connect(this.bus);
      osc.start(time);
      osc.stop(time + duration);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }
  override dispose() {
    super.dispose();
    void this.synth?.close();
    this.synth = null;
    this.bus = null;
  }
}
