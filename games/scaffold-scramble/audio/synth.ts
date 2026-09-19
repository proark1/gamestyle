type Tone = {
  /** `noise` is band-passed white noise, for water, wind, foam and scrapes. */
  wave: OscillatorType | 'noise';
  from: number;
  to: number;
  length: number;
  level: number;
  delay?: number;
};

const tone = (
  wave: Tone['wave'],
  from: number,
  to: number,
  length: number,
  level: number,
  delay = 0,
): Tone => ({ wave, from, to, length, level, delay });

/**
 * Small synthesized stand-ins, so the game is not silent before anyone has
 * generated its recordings in Admin. Each plays only while no take of that cue
 * has been recorded; music, ambience and the narrator have none.
 */
export const SCAFFOLD_SYNTH: Record<string, Tone[]> = {
  'event.start': [
    tone('sine', 2100, 2150, 0.22, 0.12),
    tone('sine', 2450, 2500, 0.3, 0.12, 0.22),
    tone('sine', 120, 60, 0.18, 0.3, 0.55),
  ],
  'event.tick': [tone('triangle', 1250, 1000, 0.05, 0.16)],
  'event.milestone': [
    tone('triangle', 660, 660, 0.14, 0.16),
    tone('triangle', 880, 880, 0.14, 0.16, 0.11),
    tone('triangle', 1320, 1320, 0.3, 0.16, 0.22),
  ],
  'event.win': [
    tone('triangle', 392, 392, 0.16, 0.2),
    tone('triangle', 523, 523, 0.16, 0.2, 0.14),
    tone('triangle', 659, 659, 0.16, 0.2, 0.28),
    tone('triangle', 784, 784, 0.55, 0.22, 0.42),
  ],
  'event.fail': [
    tone('sawtooth', 220, 150, 1.2, 0.12),
    tone('sawtooth', 165, 110, 1.2, 0.09),
  ],
  'crank.ratchet': [
    tone('square', 1500, 900, 0.025, 0.05),
    tone('square', 1300, 800, 0.025, 0.05, 0.07),
  ],
  'crank.lower': [tone('noise', 1400, 600, 0.2, 0.07)],
  'hazard.tilt_warning': [
    tone('square', 880, 880, 0.1, 0.07),
    tone('square', 660, 660, 0.1, 0.07, 0.14),
    tone('square', 880, 880, 0.1, 0.07, 0.28),
    tone('square', 660, 660, 0.1, 0.07, 0.42),
  ],
  'cradle.lurch': [
    tone('sine', 130, 50, 0.35, 0.4),
    tone('noise', 500, 200, 0.25, 0.12),
  ],
  'hazard.slip': [tone('sawtooth', 700, 180, 0.3, 0.08)],
  'hazard.dangle': [
    tone('sawtooth', 600, 160, 0.3, 0.08),
    tone('sine', 150, 70, 0.2, 0.35, 0.3),
    tone('triangle', 300, 520, 0.25, 0.1, 0.34),
  ],
  'crew.climbed': [
    tone('triangle', 380, 620, 0.1, 0.1),
    tone('sine', 150, 70, 0.12, 0.3, 0.12),
  ],
  'soap.foam': [tone('noise', 1300, 600, 0.18, 0.14)],
  'squeegee.wipe': [
    tone('noise', 2500, 1800, 0.2, 0.05),
    tone('sine', 1800, 2600, 0.12, 0.06, 0.16),
  ],
  'window.clean': [
    tone('triangle', 1568, 1568, 0.16, 0.12),
    tone('triangle', 2093, 2093, 0.3, 0.12, 0.1),
  ],
  'bucket.slide': [tone('noise', 2600, 1800, 0.35, 0.05)],
  'bucket.spill': [
    tone('triangle', 520, 470, 0.2, 0.14),
    tone('noise', 900, 250, 0.7, 0.22, 0.05),
  ],
  'bucket.bonk': [
    tone('triangle', 520, 480, 0.15, 0.14),
    tone('sine', 190, 90, 0.15, 0.3),
  ],
  'hazard.pigeon': [
    tone('noise', 1600, 1400, 0.05, 0.12),
    tone('noise', 1600, 1400, 0.05, 0.12, 0.09),
    tone('noise', 1600, 1400, 0.05, 0.12, 0.18),
    tone('sine', 900, 1300, 0.1, 0.07, 0.1),
  ],
  'pigeon.land': [
    tone('noise', 1500, 1300, 0.05, 0.1),
    tone('noise', 1500, 1300, 0.05, 0.1, 0.1),
    tone('sine', 520, 420, 0.28, 0.08, 0.25),
  ],
  'hazard.wind': [tone('noise', 300, 900, 1.6, 0.12)],
  'helicopter.land': [
    tone('sine', 95, 55, 0.3, 0.4),
    tone('noise', 500, 180, 1.2, 0.12, 0.05),
  ],
};

export class ScaffoldSynth {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private recent = new Map<string, number>();
  muted = false;
  level = 1;

  unlock() {
    if (typeof window === 'undefined' || document.hidden) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended')
        void this.context.resume().catch(() => {});
    } catch {
      /* Browser audio is optional. */
    }
  }

  private whiteNoise(context: AudioContext) {
    if (!this.noise) {
      this.noise = context.createBuffer(
        1,
        context.sampleRate,
        context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  play(id: string, strength = 1, pan = 0) {
    const tones = SCAFFOLD_SYNTH[id];
    const context = this.context;
    if (
      !tones ||
      !context ||
      this.muted ||
      context.state !== 'running' ||
      document.hidden
    )
      return;
    const now = performance.now();
    if (now - (this.recent.get(id) ?? -1000) < 70) return;
    this.recent.set(id, now);
    const out = context.createStereoPanner();
    out.pan.value = Math.max(-0.85, Math.min(0.85, pan));
    out.connect(context.destination);
    let playing = tones.length;
    const start = context.currentTime;
    for (const part of tones) {
      const at = start + (part.delay ?? 0);
      const end = at + part.length;
      const gain = context.createGain();
      const peak = Math.max(
        0.0002,
        part.level * Math.max(0, Math.min(1, strength)) * this.level * 0.8,
      );
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      gain.connect(out);
      let source: AudioScheduledSourceNode;
      let filter: BiquadFilterNode | null = null;
      if (part.wave === 'noise') {
        const noise = context.createBufferSource();
        noise.buffer = this.whiteNoise(context);
        noise.loop = true;
        filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 1.2;
        filter.frequency.setValueAtTime(part.from, at);
        filter.frequency.exponentialRampToValueAtTime(part.to, end);
        noise.connect(filter).connect(gain);
        source = noise;
      } else {
        const oscillator = context.createOscillator();
        oscillator.type = part.wave;
        oscillator.frequency.setValueAtTime(part.from, at);
        oscillator.frequency.exponentialRampToValueAtTime(part.to, end);
        oscillator.connect(gain);
        source = oscillator;
      }
      source.onended = () => {
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
        if (--playing === 0) out.disconnect();
      };
      source.start(at);
      source.stop(end + 0.02);
    }
  }

  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
