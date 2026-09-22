import { loadAudioPreferences } from '@/shared/audio/preferences';

let context: AudioContext | undefined;
/** Quiet cues, created only after a gesture; never compete with voice or background music. */
export function unlockPartyAudio() {
  try {
    context ??= new AudioContext();
    void context.resume();
  } catch {
    /* Audio is optional. */
  }
}
export function partyCue(kind: 'vote' | 'countdown' | 'result' | 'victory') {
  const volume = loadAudioPreferences().volume;
  if (!context || context.state !== 'running' || volume === 0) return;
  const notes =
    kind === 'victory'
      ? [440, 554, 659]
      : kind === 'result'
        ? [440, 554]
        : [kind === 'vote' ? 520 : 360];
  notes.forEach((frequency, index) => {
    const osc = context!.createOscillator(),
      gain = context!.createGain();
    const start = context!.currentTime + index * 0.11;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.035 * volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    osc.connect(gain);
    gain.connect(context!.destination);
    osc.start(start);
    osc.stop(start + 0.16);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}
