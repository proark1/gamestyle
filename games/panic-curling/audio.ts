import type { Cue } from '../../shared/audio/types';
import type { GameEvent } from './types';

export const panicCurlingCatalog: Cue[] = [
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
    category: 'music',
    prompt:
      'Enthusiastic winter arena crowd cheering with referee whistle and horn',
    text: 'cheer',
    duration: 2.5,
    loop: false,
    volume: 0.85,
  },
];

/** Procedural Web Audio synthesizer for immediate, zero-latency curling effects. */
export class CurlingAudio {
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

  public playEvent(event: GameEvent) {
    if (!this.ctx) return;
    try {
      switch (event.type) {
        case 'stone_delivered':
          this.playStoneLaunch(event.speed);
          break;
        case 'stone_clack':
          this.playStoneClack(event.volume);
          break;
        case 'sweep_burst':
          this.playSweepBurst();
          break;
        case 'banana_slip':
          this.playBananaSlip();
          break;
        case 'end_scored':
          this.playScoreFanfare();
          break;
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  private playStoneLaunch(speed: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80 + speed * 15, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }

  private playStoneClack(volume: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.5 * volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  private playSweepBurst() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.08;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.18;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
  }

  private playIceCreak() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }

  private playIceBreak() {
    if (!this.ctx) return;
    // Low snap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  private playWaterSplash() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  private playBananaSlip() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      180,
      this.ctx.currentTime + 0.45,
    );

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  private playScoreFanfare() {
    if (!this.ctx) return;
    const notes = [261.63, 329.63, 392.0, 523.25]; // C chord
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.ctx.currentTime + idx * 0.1 + 0.6,
      );

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.1);
      osc.stop(this.ctx.currentTime + idx * 0.1 + 0.6);
    });
  }
}
