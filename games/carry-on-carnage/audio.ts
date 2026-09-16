import type { Cue } from '../../shared/audio/types';
import type { CarryOnEvent } from './types';

export const carryOnCarnageCatalog: Cue[] = [
  {
    id: 'carryon.airport_chime',
    name: 'Airport Chime',
    group: 'terminal',
    category: 'event',
    prompt:
      'Two-tone bright airport paging chime ding-dong over public terminal speakers',
    text: 'ding-dong',
    duration: 1.5,
    loop: false,
    volume: 0.8,
  },
  {
    id: 'carryon.zipper_pull',
    name: 'Zipper Pull',
    group: 'luggage',
    category: 'material',
    prompt:
      'Fast metal luggage zipper teeth sliding quickly along fabric seam with tight zip sound',
    text: 'zip',
    duration: 0.8,
    loop: false,
    volume: 0.75,
  },
  {
    id: 'carryon.compress_groan',
    name: 'Suitcase Compression',
    group: 'luggage',
    category: 'material',
    prompt:
      'Overstuffed bulging suitcase fabric groaning and squeaking under heavy human weight',
    text: 'squish',
    duration: 1.2,
    loop: false,
    volume: 0.7,
  },
  {
    id: 'carryon.burst_pinata',
    name: 'Piñata Luggage Burst',
    group: 'luggage',
    category: 'event',
    prompt:
      'Violent explosive pop of overstuffed suitcase bursting open launching items with party horn confetti',
    text: 'pop',
    duration: 1.8,
    loop: false,
    volume: 1.0,
  },
  {
    id: 'carryon.tsa_alarm',
    name: 'TSA Metal Detector Alarm',
    group: 'terminal',
    category: 'event',
    prompt:
      'Urgent high-pitched electronic security gate alarm beeping rapidly',
    text: 'beep-beep',
    duration: 2.0,
    loop: false,
    volume: 0.85,
  },
  {
    id: 'carryon.sizer_reject',
    name: 'Sizer Box Rejection Buzzer',
    group: 'gate',
    category: 'event',
    prompt:
      'Harsh low electronic game show buzzer signaling failed oversized baggage',
    text: 'buzzer',
    duration: 1.2,
    loop: false,
    volume: 0.9,
  },
  {
    id: 'carryon.sizer_pass',
    name: 'Sizer Box Approval Chime',
    group: 'gate',
    category: 'event',
    prompt:
      'Cheerful sparkling major chord chime signaling approved carry-on luggage',
    text: 'ding',
    duration: 1.5,
    loop: false,
    volume: 0.85,
  },
  {
    id: 'carryon.lobster_pinch',
    name: 'Lobster Claw Snap',
    group: 'items',
    category: 'material',
    prompt:
      'Sharp organic wooden claw snap of a lively lobster pincers clicking',
    text: 'snap',
    duration: 0.5,
    loop: false,
    volume: 0.75,
  },
];

/** Procedural Web Audio synthesizer for immediate, zero-latency airport effects */
export class CarryOnAudio {
  private ctx: AudioContext | null = null;

  public unlock() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public playEvent(event: CarryOnEvent) {
    if (!this.ctx) return;
    try {
      switch (event.type) {
        case 'pack':
          this.playPackThump();
          break;
        case 'compress':
          this.playCompressGroan();
          break;
        case 'zip':
          this.playZipperPull();
          break;
        case 'burst':
          this.playBurstExplosion();
          break;
        case 'tsa_alarm':
        case 'tsa_distracted':
          this.playTsaAlarm();
          break;
        case 'tsa_caught':
          this.playTsaBuzzer();
          break;
        case 'sizer_passed':
          this.playSizerPass();
          break;
        case 'sizer_rejected':
          this.playSizerReject();
          break;
        case 'flight_departed':
          this.playAirportChime();
          break;
      }
    } catch {
      // Ignore audio synthesis errors on locked audio devices
    }
  }

  /** Pleasant two-tone airport chime */
  private playAirportChime() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440.0, now + 0.35); // A4
    gain2.gain.setValueAtTime(0.3, now + 0.35);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.35);
    osc2.stop(now + 1.2);
  }

  /** Zipper sliding pull sound */
  private playZipperPull() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.linearRampToValueAtTime(860, now + 0.18);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /** Soft thump when dropping item into suitcase */
  private playPackThump() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Suitcase springy compression groan */
  private playCompressGroan() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.12);
    osc.frequency.linearRampToValueAtTime(75, now + 0.28);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  /** Violent piñata burst pop! */
  private playBurstExplosion() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Deep punchy bass pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // Spring ping
    const spring = this.ctx.createOscillator();
    const sGain = this.ctx.createGain();
    spring.type = 'triangle';
    spring.frequency.setValueAtTime(520, now + 0.05);
    spring.frequency.linearRampToValueAtTime(1200, now + 0.25);
    sGain.gain.setValueAtTime(0.3, now + 0.05);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    spring.connect(sGain);
    sGain.connect(this.ctx.destination);
    spring.start(now + 0.05);
    spring.stop(now + 0.3);
  }

  /** High pitched TSA metal detector beeps */
  private playTsaAlarm() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.18;

      osc.type = 'square';
      osc.frequency.setValueAtTime(1320, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  /** Harsh TSA caught buzzer */
  private playTsaBuzzer() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Sizer box approval chime (triumphant major chord) */
  private playSizerPass() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.7);
    });
  }

  /** Sizer box rejection buzzer (harsh dual sawtooth buzzer) */
  private playSizerReject() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [110, 116]; // dissonant beat

    freqs.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    });
  }
}
