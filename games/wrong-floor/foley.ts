import { hotelAcoustics, type HotelPoint } from './horror';

type Layer = {
  at?: number;
  length: number;
  gain: number;
  frequency: number;
  noise?: boolean;
  attack?: number;
  endFrequency?: number;
};
const hit = (
  frequency: number,
  length: number,
  gain: number,
  at = 0,
): Layer => ({ frequency, length, gain, at });
const rub = (
  frequency: number,
  length: number,
  gain: number,
  at = 0,
  attack = 0.008,
): Layer => ({ frequency, length, gain, at, noise: true, attack });

/** Layered impacts, friction and resonant bodies; playable without a provider or network. */
const recipes = {
  step: [
    rub(850, 0.13, 0.5),
    hit(78, 0.09, 0.34),
    rub(1900, 0.12, 0.18, 0.065),
  ],
  'step-metal': [
    rub(2600, 0.08, 0.42),
    hit(145, 0.19, 0.38),
    hit(430, 0.28, 0.2),
  ],
  'step-wood': [
    rub(1600, 0.06, 0.45),
    hit(125, 0.15, 0.5),
    hit(290, 0.1, 0.16),
  ],
  'wet-step': [
    rub(1300, 0.2, 0.6),
    rub(3200, 0.14, 0.36, 0.08),
    hit(68, 0.13, 0.28),
  ],
  'door-knock': [
    rub(1500, 0.035, 0.32),
    hit(118, 0.16, 0.65),
    hit(263, 0.085, 0.25),
  ],
  knock: [
    hit(118, 0.16, 0.65),
    hit(118, 0.16, 0.65, 0.3),
    hit(118, 0.16, 0.65, 0.6),
  ],
  handle: [
    rub(3300, 0.16, 0.22),
    hit(870, 0.08, 0.17),
    rub(2400, 0.17, 0.27, 0.32),
  ],
  clock: [
    rub(4900, 0.025, 0.25),
    hit(1450, 0.025, 0.13),
    hit(920, 0.02, 0.13, 0.045),
  ],
  light: [
    rub(3200, 0.075, 0.44),
    hit(100, 0.34, 0.18),
    rub(4500, 0.05, 0.18, 0.18),
  ],
  creak: [
    { ...hit(180, 1.1, 0.22), endFrequency: 64, attack: 0.12 },
    rub(1100, 0.8, 0.2, 0.1, 0.15),
  ],
  breath: [rub(640, 1.65, 0.36, 0, 0.5), rub(1600, 0.8, 0.13, 0.4, 0.25)],
  'ghost-step': [
    hit(52, 0.32, 0.75),
    rub(760, 0.24, 0.45),
    rub(1200, 0.35, 0.26, 0.16),
  ],
  slam: [
    rub(1600, 0.18, 0.7),
    hit(63, 0.7, 0.8),
    hit(177, 0.32, 0.26),
    rub(2100, 0.16, 0.2, 0.3),
  ],
  doors: [
    rub(900, 1.05, 0.36, 0, 0.18),
    { ...hit(170, 0.95, 0.16), endFrequency: 110, attack: 0.15 },
    hit(95, 0.22, 0.5, 0.95),
  ],
  motor: [
    { ...hit(56, 2.5, 0.42), endFrequency: 82, attack: 0.25 },
    rub(460, 2.5, 0.33, 0, 0.35),
  ],
  inspect: [rub(2900, 0.22, 0.24), rub(2200, 0.15, 0.17, 0.13)],
  heartbeat: [hit(49, 0.13, 0.6), hit(62, 0.11, 0.36, 0.2)],
  caught: [rub(950, 0.55, 0.7), hit(45, 0.9, 0.65), rub(380, 0.65, 0.22, 0.25)],
  pipe: [hit(210, 0.3, 0.26), hit(530, 0.65, 0.1), rub(700, 0.19, 0.18)],
  start: [hit(740, 0.9, 0.36), hit(1481, 0.4, 0.12), hit(590, 0.9, 0.3, 0.25)],
  report: [rub(3000, 0.035, 0.3), rub(1800, 0.1, 0.16, 0.06)],
  vote: [rub(2400, 0.04, 0.4), hit(420, 0.08, 0.2)],
  correct: [hit(740, 0.6, 0.36), hit(590, 0.8, 0.3, 0.25)],
  alarm: [hit(91, 1.4, 0.5), hit(97, 1.2, 0.38), rub(900, 0.5, 0.35)],
  safe: [hit(104, 0.2, 0.5), rub(1800, 0.14, 0.32)],
  finish: [
    hit(880, 0.9, 0.3),
    hit(660, 0.7, 0.2, 0.22),
    hit(990, 1.1, 0.26, 0.48),
  ],
} satisfies Record<string, Layer[]>;
export type HotelCue = keyof typeof recipes;

export class HotelFoley {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private room: GainNode | null = null;
  private ducked = false;
  private roomPower = 1;
  private buffers = new Map<HotelCue, AudioBuffer>();
  private sources = new Map<
    AudioBufferSourceNode,
    {
      position?: HotelPoint;
      gain: GainNode;
      pan: StereoPannerNode;
      strength: number;
    }
  >();
  private enabled = true;
  private active = false;
  private disposed = false;
  private level = 0;
  listener: HotelPoint = { x: 0, z: 3 };
  yaw = 0;
  listen(position: HotelPoint, yaw: number) {
    this.listener = position;
    this.yaw = yaw;
    if (!this.context) return;
    for (const voice of this.sources.values()) {
      if (!voice.position) continue;
      const mix = hotelAcoustics(voice.position, position, yaw);
      voice.gain.gain.setTargetAtTime(
        mix.gain * voice.strength,
        this.context.currentTime,
        0.04,
      );
      voice.pan.pan.setTargetAtTime(mix.pan, this.context.currentTime, 0.04);
    }
  }
  constructor() {
    document.addEventListener('visibilitychange', this.visibility);
  }
  private visibility = () => {
    if (!this.context || this.disposed) return;
    if (document.hidden) {
      this.stopEffects();
      void this.context.suspend().catch(() => {});
    } else if (this.enabled && this.active)
      void this.context.resume().catch(() => {});
  };
  unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const ctx = new AudioContext();
        this.context = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? 0.36 : 0;
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.ratio.value = 5;
        this.master.connect(compressor).connect(ctx.destination);
        const impulse = ctx.createBuffer(
          2,
          ctx.sampleRate * 0.85,
          ctx.sampleRate,
        );
        for (let c = 0; c < 2; c++) {
          const data = impulse.getChannelData(c);
          for (let i = 0; i < data.length; i++)
            data[i] =
              i < ctx.sampleRate * 0.045
                ? 0
                : (Math.random() * 2 - 1) *
                  Math.pow(1 - i / data.length, 3) *
                  0.4;
        }
        this.reverb = ctx.createConvolver();
        this.reverb.buffer = impulse;
        const wet = ctx.createGain();
        wet.gain.value = 0.17;
        this.reverb.connect(wet).connect(this.master);
        this.room = ctx.createGain();
        this.room.gain.value = 0;
        this.room.connect(this.master);
        const hum = ctx.createOscillator();
        hum.frequency.value = 50;
        const humGain = ctx.createGain();
        humGain.gain.value = 0.045;
        hum.connect(humGain).connect(this.room);
        hum.start();
        const air = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let low = 0;
        for (let i = 0; i < data.length; i++) {
          low += 0.04 * (Math.random() * 2 - 1 - low);
          data[i] = low * 0.45;
        }
        air.buffer = buffer;
        air.loop = true;
        air.connect(this.room);
        air.start();
      }
      if (this.enabled && !document.hidden)
        void this.context.resume().catch(() => {});
    } catch {
      /* Visual evidence and reports remain available without audio. */
    }
  }
  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) this.stopEffects();
    else if (this.context && !document.hidden)
      void this.context.resume().catch(() => {});
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        value ? 0.36 : 0,
        this.context.currentTime,
        0.025,
      );
  }
  duck(active: boolean) {
    this.ducked = active;
    this.ambience(this.active, this.roomPower);
  }
  ambience(active: boolean, power = 1) {
    this.roomPower = power;
    this.active = active;
    if (this.context && this.room) {
      const level = active ? power * (this.ducked ? 0.35 : 1) : 0;
      if (level !== this.level)
        this.room.gain.setTargetAtTime(level, this.context.currentTime, 0.2);
      this.level = level;
    }
  }
  private buffer(kind: HotelCue) {
    const ctx = this.context!;
    const cached = this.buffers.get(kind);
    if (cached) return cached;
    const layers: Layer[] = recipes[kind];
    const rate = 22050;
    const duration = Math.max(...layers.map((l) => (l.at ?? 0) + l.length));
    const buffer = ctx.createBuffer(
      1,
      Math.ceil((duration + 0.03) * rate),
      rate,
    );
    const data = buffer.getChannelData(0);
    for (const l of layers) {
      const start = Math.floor((l.at ?? 0) * rate);
      const count = Math.floor(l.length * rate);
      let low = 0,
        phase = 0;
      const alpha = 1 - Math.exp((-Math.PI * 2 * l.frequency) / rate);
      for (let i = 0; i < count; i++) {
        const t = i / rate,
          progress = i / count;
        const envelope =
          Math.min(1, t / (l.attack ?? 0.002)) *
          Math.exp(-progress * 5) *
          Math.min(1, (1 - progress) * 30);
        const frequency =
          l.frequency +
          ((l.endFrequency ?? l.frequency) - l.frequency) * progress;
        low += alpha * (Math.random() * 2 - 1 - low);
        phase += (Math.PI * 2 * frequency) / rate;
        data[start + i] +=
          (l.noise ? low : Math.sin(phase)) * envelope * l.gain;
      }
    }
    for (let i = 0; i < data.length; i++) data[i] = Math.tanh(data[i]);
    this.buffers.set(kind, buffer);
    return buffer;
  }
  play(kind: HotelCue, position?: HotelPoint, strength = 1) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.master ||
      !this.enabled ||
      this.disposed ||
      document.hidden ||
      ctx.state !== 'running' ||
      this.sources.size >= 24
    )
      return;
    const mix = position
      ? hotelAcoustics(position, this.listener, this.yaw)
      : { gain: 1, pan: 0 };
    if (mix.gain < 0.015) return;
    this.master.gain.setTargetAtTime(0.36, ctx.currentTime, 0.025);
    const source = ctx.createBufferSource(),
      gain = ctx.createGain(),
      pan = ctx.createStereoPanner();
    source.buffer = this.buffer(kind);
    source.playbackRate.value = 0.96 + Math.random() * 0.08;
    gain.gain.value = mix.gain * strength;
    pan.pan.value = mix.pan;
    source.connect(gain).connect(pan).connect(this.master);
    if (position && this.reverb) pan.connect(this.reverb);
    this.sources.set(source, { position, gain, pan, strength });
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      pan.disconnect();
      this.sources.delete(source);
    };
    source.start();
  }
  stopEffects() {
    for (const source of this.sources.keys()) source.stop();
  }
  reset() {
    this.stopEffects();
    this.ambience(false);
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.025);
  }
  dispose() {
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.visibility);
    this.reset();
    void this.context?.close().catch(() => {});
    this.buffers.clear();
  }
}
