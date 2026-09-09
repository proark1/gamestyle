/**
 * Listener preferences shared by every game. Each game keeps its own mute flag
 * next to its other saved settings; these two are site-wide, so the level a
 * player picks in one game still holds in the next.
 */
export type AudioPreferences = { volume: number; music: boolean };

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  volume: 1,
  music: true,
};

const KEY = 'jumbleyard-audio-v1';
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function loadAudioPreferences(): AudioPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!saved || typeof saved !== 'object')
      return { ...DEFAULT_AUDIO_PREFERENCES };
    const { volume, music } = saved as Partial<AudioPreferences>;
    return {
      volume:
        typeof volume === 'number' && Number.isFinite(volume)
          ? clamp(volume)
          : DEFAULT_AUDIO_PREFERENCES.volume,
      music:
        typeof music === 'boolean' ? music : DEFAULT_AUDIO_PREFERENCES.music,
    };
  } catch {
    // No storage during server rendering or private browsing.
    return { ...DEFAULT_AUDIO_PREFERENCES };
  }
}

export function saveAudioPreferences(preferences: AudioPreferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // The choice still applies for this session.
  }
}

type AudioListener = { applyPreferences(preferences: AudioPreferences): void };
const live = new Set<AudioListener>();
const subscribers = new Set<() => void>();
let current: AudioPreferences | null = null;

/** Stable between changes, so useSyncExternalStore does not loop. */
export function audioPreferencesSnapshot(): AudioPreferences {
  if (!current) current = loadAudioPreferences();
  return current;
}

/** Server and hydration both see the defaults, so the first paint matches. */
export function defaultAudioPreferences() {
  return DEFAULT_AUDIO_PREFERENCES;
}

export function subscribeAudioPreferences(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/** Players register on construction so the toolbar can reach the mounted game. */
export function registerAudioListener(listener: AudioListener) {
  live.add(listener);
  return () => {
    live.delete(listener);
  };
}

export function applyAudioPreferences(preferences: AudioPreferences) {
  current = preferences;
  saveAudioPreferences(preferences);
  for (const listener of live) listener.applyPreferences(preferences);
  for (const notify of subscribers) notify();
}
