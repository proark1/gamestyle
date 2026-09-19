/**
 * The original Web Audio stand-ins, kept so the store is never silent before
 * anyone records the workshop cues. The game asks for one only when that cue
 * has no recording, and the procedural muzak only while no score is recorded.
 */
export class StampedeSynth {
  private ctx: AudioContext | null = null;
  private squeakTimer = 0;
  private muzakInterval: ReturnType<typeof setInterval> | null = null;
  private muzakStep = 0;
  private muzakGain: GainNode | null = null;
  private muzakWanted = false;
  private muted = false;
  private recent = new Map<string, number>();

  unlock() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
    if (this.muzakWanted) this.startMuzak();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.muzakGain && this.ctx)
      this.muzakGain.gain.setValueAtTime(
        muted ? 0 : 0.045,
        this.ctx.currentTime,
      );
  }

  /** Procedural muzak plays only while no music recording exists. */
  setMuzak(on: boolean) {
    this.muzakWanted = on;
    if (on) this.startMuzak();
    else this.stopMuzak();
  }

  get muzakPlaying() {
    return this.muzakInterval !== null;
  }

  private live() {
    return (
      !!this.ctx &&
      this.ctx.state === 'running' &&
      !this.muted &&
      !(typeof document !== 'undefined' && document.hidden)
    );
  }

  /** Plays the stand-in for a cue id. Returns false when there is none. */
  play(id: string, strength = 1) {
    const level = Math.max(0, Math.min(1, strength));
    const key = id.startsWith('grabber.') ? 'grabber' : id;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - (this.recent.get(key) ?? -1000) < 80) return true;
    const known = [
      'stampede.sample_bell',
      'stampede.cart_crash',
      'cart.hit_shelf',
      'stampede.shelf_tumble',
      'stampede.sugar_rush',
      'stampede.plate_slip',
      'stampede.receipt_approved',
      'stampede.receipt_rejected',
      'stampede.receipt_print',
    ].includes(id);
    if (!known && key !== 'grabber') return false;
    this.recent.set(key, now);
    if (!this.live()) return true;
    switch (id) {
      case 'stampede.sample_bell':
        this.announcementBell(level);
        break;
      case 'stampede.cart_crash':
      case 'cart.hit_shelf':
        this.crash(level);
        break;
      case 'stampede.shelf_tumble':
        this.crash(0.6 * level);
        break;
      case 'stampede.sugar_rush':
        this.glide('triangle', 320, 1200, 0.45, 0.22 * level, 0.5);
        break;
      case 'stampede.plate_slip':
        // Downward slide whistle.
        this.glide('sine', 950, 260, 0.35, 0.26 * level, 0.38);
        break;
      case 'stampede.receipt_approved':
        // Cha-ching bell arpeggio: C5, E5, G5, C6.
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) =>
          this.glide('sine', freq, freq, 0.45, 0.25 * level, 0.5, index * 0.08),
        );
        break;
      case 'stampede.receipt_rejected':
        this.buzzer(level);
        break;
      case 'stampede.receipt_print':
        this.receiptPrint(level);
        break;
      default:
        this.glide('triangle', 450, 180, 0.12, 0.2 * level, 0.15);
    }
    return true;
  }

  updateSqueak(speed: number, wobbleIntensity: number, dt: number) {
    if (!this.live()) return;
    // Squeak chirps periodically based on wheel rotation speed.
    this.squeakTimer += dt * (10 + speed * 2.5);
    const chirp = speed > 0.6 && Math.sin(this.squeakTimer) > 0.85;
    if (chirp && Math.random() < 0.28 * (0.5 + wobbleIntensity / 2)) {
      // High metallic squeak, 1800 Hz rising with speed.
      const base = 1800 + Math.min(speed, 12) * 60;
      this.glide('sawtooth', base, base + 350, 0.08, 0.12, 0.1);
    }
  }

  private glide(
    wave: OscillatorType,
    from: number,
    to: number,
    length: number,
    level: number,
    stop: number,
    delay = 0,
  ) {
    const ctx = this.ctx;
    if (!ctx || level <= 0) return;
    const at = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from)
      osc.frequency.exponentialRampToValueAtTime(to, at + length);
    gain.gain.setValueAtTime(level, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + stop);
  }

  private announcementBell(level: number) {
    // Two-tone warehouse PA chime: D5 then A4.
    this.glide('sine', 587.33, 587.33, 0.65, 0.28 * level, 0.7);
    this.glide('sine', 440, 440, 0.65, 0.28 * level, 0.7, 0.35);
  }

  private crash(intensity: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const size = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.2));
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(1.5, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(
      Math.max(0.002, Math.min(0.4 * intensity, 0.5)),
      now,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  private buzzer(level: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Harsh low buzzer that drops a step.
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(115, now + 0.22);
    gain.gain.setValueAtTime(Math.max(0.002, 0.32 * level), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.48);
  }

  private receiptPrint(level: number) {
    for (let i = 0; i < 6; i++) {
      const freq = 1200 + (i % 2) * 400;
      this.glide('square', freq, freq, 0.035, 0.08 * level, 0.04, i * 0.05);
    }
  }

  private startMuzak() {
    if (this.muzakInterval || !this.ctx) return;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.muted ? 0 : 0.045, ctx.currentTime);
    gain.connect(ctx.destination);
    this.muzakGain = gain;

    // Chord progression Fmaj7, Gm7, Am7, Bbmaj7 over a walking root.
    const chords = [
      [349.23, 440.0, 523.25, 659.25],
      [392.0, 466.16, 587.33, 698.46],
      [440.0, 523.25, 659.25, 783.99],
      [466.16, 587.33, 698.46, 880.0],
    ];
    const bass = [174.61, 196.0, 220.0, 233.08];

    this.muzakInterval = setInterval(() => {
      if (!this.live()) return;
      const now = ctx.currentTime;
      const chordIdx = Math.floor(this.muzakStep / 4) % chords.length;
      const chord = chords[chordIdx];

      // Bass note on downbeats.
      if (this.muzakStep % 2 === 0) {
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bass[chordIdx], now);
        bGain.gain.setValueAtTime(0.06, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        bOsc.connect(bGain);
        bGain.connect(gain);
        bOsc.start(now);
        bOsc.stop(now + 0.38);
      }

      // Gentle electric piano arpeggio note.
      const pOsc = ctx.createOscillator();
      const pFilter = ctx.createBiquadFilter();
      const pGain = ctx.createGain();
      pOsc.type = 'triangle';
      pOsc.frequency.setValueAtTime(chord[this.muzakStep % chord.length], now);
      pFilter.type = 'lowpass';
      pFilter.frequency.setValueAtTime(1400, now);
      pGain.gain.setValueAtTime(0.04, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      pOsc.connect(pFilter);
      pFilter.connect(pGain);
      pGain.connect(gain);
      pOsc.start(now);
      pOsc.stop(now + 0.35);

      this.muzakStep = (this.muzakStep + 1) % 16;
    }, 450);
  }

  private stopMuzak() {
    if (this.muzakInterval) {
      clearInterval(this.muzakInterval);
      this.muzakInterval = null;
    }
    this.muzakGain?.disconnect();
    this.muzakGain = null;
  }

  destroy() {
    this.muzakWanted = false;
    this.stopMuzak();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
