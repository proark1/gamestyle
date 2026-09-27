import type { AdventureSnapshot } from './types';

export class VoyageAudio {
  enabled = true;
  private context?: AudioContext;
  private master?: GainNode;
  private ambience?: GainNode;
  private hum?: OscillatorNode;
  private lastEvent = 0;
  private phase = '';

  unlock() {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.18 : 0;
      this.master.connect(this.context.destination);
      this.ambience = this.context.createGain();
      this.ambience.gain.value = 0.025;
      this.ambience.connect(this.master);
      this.hum = this.context.createOscillator();
      this.hum.type = 'sine';
      this.hum.frequency.value = 72;
      this.hum.connect(this.ambience);
      this.hum.start();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        enabled ? 0.18 : 0,
        this.context.currentTime,
        0.03,
      );
  }

  private tone(
    frequency: number,
    duration = 0.22,
    gain = 0.18,
    type: OscillatorType = 'sine',
  ) {
    if (!this.enabled || !this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    envelope.gain.setValueAtTime(0.0001, this.context.currentTime);
    envelope.gain.exponentialRampToValueAtTime(
      gain,
      this.context.currentTime + 0.018,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      this.context.currentTime + duration,
    );
    oscillator.connect(envelope).connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration + 0.03);
  }

  private chord(frequencies: number[]) {
    frequencies.forEach((frequency, index) =>
      window.setTimeout(
        () => this.tone(frequency, 1.1, 0.07, 'sine'),
        index * 55,
      ),
    );
  }

  update(snapshot: AdventureSnapshot) {
    if (!this.context) return;
    const { world } = snapshot;
    if (world.phase !== this.phase) {
      this.phase = world.phase;
      const frequency =
        world.phase === 'fishing'
          ? 49
          : world.phase === 'returning'
            ? 96
            : world.phase === 'finished'
              ? 120
              : 72;
      this.hum?.frequency.setTargetAtTime(
        frequency,
        this.context.currentTime,
        1.2,
      );
      if (this.ambience)
        this.ambience.gain.setTargetAtTime(
          world.phase === 'fishing' ? 0.05 : 0.028,
          this.context.currentTime,
          0.8,
        );
    }
    for (const event of world.events) {
      if (event.id <= this.lastEvent) continue;
      this.lastEvent = event.id;
      if (event.kind === 'item-placed') this.tone(280, 0.16, 0.11, 'triangle');
      else if (event.kind === 'cast') this.tone(230, 0.18, 0.08, 'triangle');
      else if (event.kind === 'bite') this.tone(392, 0.24, 0.16, 'triangle');
      else if (event.kind === 'hooked') this.chord([196, 294, 392]);
      else if (event.kind === 'incident-started' || event.kind === 'damage')
        this.tone(58, 0.45, 0.22, 'sawtooth');
      else if (event.kind === 'repair') this.tone(240, 0.12, 0.13, 'square');
      else if (event.kind === 'rescue') this.chord([262, 330, 392]);
      else if (event.kind === 'fish-landed') this.chord([110, 165, 220, 330]);
      else if (event.kind === 'fish-secured') this.chord([220, 330, 440]);
      else if (event.kind === 'line-snapped')
        this.tone(82, 0.3, 0.16, 'sawtooth');
      else if (event.kind === 'docked') this.chord([196, 247, 294, 392]);
    }
  }

  dispose() {
    this.hum?.stop();
    void this.context?.close();
    this.context = undefined;
  }
}
