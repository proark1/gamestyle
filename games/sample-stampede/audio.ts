import type { Cue } from '../../shared/audio/types';
import type { StampedeEvent } from './types';

export const sampleStampedeCatalog: Cue[] = [
  {
    id: 'stampede.squeaky_wheel',
    name: 'Squeaky Caster Wheel',
    group: 'stampede',
    category: 'material',
    prompt:
      'Loud rhythmic squeaking, metallic chirp and rattling of a wobbly grocery store shopping cart wheel speeding on concrete',
    text: 'squeak',
    duration: 2.0,
    loop: true,
    volume: 0.8,
  },
  {
    id: 'stampede.cart_crash',
    name: 'Cart Derby Crash',
    group: 'stampede',
    category: 'material',
    prompt:
      'Heavy clattering collision of tubular steel shopping carts and metal warehouse shelves with tumbling items',
    text: 'crash',
    duration: 1.2,
    loop: false,
    volume: 0.9,
  },
  {
    id: 'stampede.sample_bell',
    name: 'Sample Announcement Chime',
    group: 'stampede',
    category: 'event',
    prompt:
      'Warm resonant supermarket PA system two-tone announcement chime ding-dong',
    text: 'ding-dong',
    duration: 1.8,
    loop: false,
    volume: 0.85,
  },
  {
    id: 'stampede.sugar_rush',
    name: 'Sample Nitrous Rush',
    group: 'stampede',
    category: 'event',
    prompt:
      'High speed turbo whoosh with glittering sugar rush shimmer and accelerating shopping cart screech',
    text: 'whoosh',
    duration: 1.5,
    loop: false,
    volume: 0.8,
  },
  {
    id: 'stampede.plate_slip',
    name: 'Paper Plate Slip Whistle',
    group: 'stampede',
    category: 'event',
    prompt:
      'Comical cartoon slide whistle and rubber skid spinout across slippery grocery floor',
    text: 'slip',
    duration: 1.0,
    loop: false,
    volume: 0.85,
  },
  {
    id: 'stampede.shelf_tumble',
    name: 'Cereal Pyramid Collapse',
    group: 'stampede',
    category: 'material',
    prompt:
      'Tumbling cascade of falling cardboard cereal boxes and soft packaged goods thumping onto floor',
    text: 'tumble',
    duration: 1.6,
    loop: false,
    volume: 0.75,
  },
  {
    id: 'stampede.receipt_approved',
    name: 'Receipt Checkout Cha-Ching',
    group: 'stampede',
    category: 'music',
    prompt:
      'Vintage brass cash register cha-ching bell with cheerful electronic checkout approval chime',
    text: 'cha-ching',
    duration: 1.4,
    loop: false,
    volume: 0.9,
  },
  {
    id: 'stampede.receipt_rejected',
    name: 'Receipt Checker Buzzer',
    group: 'stampede',
    category: 'event',
    prompt:
      'Harsh low game show rejection buzzer with receipt checker rubber stamp thud',
    text: 'buzz',
    duration: 1.2,
    loop: false,
    volume: 0.85,
  },
];

export class SampleStampedeAudio {
  private ctx: AudioContext | null = null;
  private squeakOsc: OscillatorNode | null = null;
  private squeakGain: GainNode | null = null;
  private squeakTimer = 0;

  public unlock() {
    if (!this.ctx && typeof window !== 'undefined') {
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

  public updateSqueak(speed: number, wobbleIntensity: number, dt: number) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // Squeak chirps periodically based on wheel rotation speed
    this.squeakTimer += dt * (10 + speed * 2.5);
    const triggerChirp = speed > 0.6 && Math.sin(this.squeakTimer) > 0.85;

    if (triggerChirp && Math.random() < 0.28) {
      this.playSqueakChirp(speed);
    }
  }

  private playSqueakChirp(speed: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // High frequency metallic squeak (1800Hz to 2600Hz)
    const baseFreq = 1800 + Math.min(speed, 12) * 60;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq + 350, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playAnnouncementBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Two-tone warehouse PA chime: D5 (587.33Hz) -> A4 (440Hz)
    const playTone = (freq: number, startTime: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.28, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.7);
    };

    playTone(587.33, now);
    playTone(440.0, now + 0.35);
  }

  public playCrash(intensity = 1.0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.4 * intensity, 0.5), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  public playSugarRush() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.45);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playSlip() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Downward cartoon slide whistle
    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.35);

    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playReceiptApproved() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Classic Cha-Ching bell arpeggio
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });
  }

  public playReceiptRejected() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Harsh low buzzer
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.setValueAtTime(115, now + 0.22);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.48);
  }

  public playGrabber() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playEvent(event: StampedeEvent) {
    switch (event.type) {
      case 'sample_announcement':
        this.playAnnouncementBell();
        break;
      case 'cart_crash':
        this.playCrash(event.intensity || 1.0);
        break;
      case 'sugar_rush':
        this.playSugarRush();
        break;
      case 'plate_slip':
        this.playSlip();
        break;
      case 'receipt_approved':
        this.playReceiptApproved();
        break;
      case 'receipt_rejected':
        this.playReceiptRejected();
        break;
      case 'grabber_whack':
      case 'item_snagged':
        this.playGrabber();
        break;
      case 'shelf_tumble':
        this.playCrash(0.6);
        break;
    }
  }

  public destroy() {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
