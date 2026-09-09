import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUDIO_PREFERENCES,
  applyAudioPreferences,
  audioPreferencesSnapshot,
  defaultAudioPreferences,
  loadAudioPreferences,
  subscribeAudioPreferences,
  registerAudioListener,
  saveAudioPreferences,
  type AudioPreferences,
} from './preferences';

const store = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
});
const KEY = 'jumbleyard-audio-v1';

void test('preferences survive a round trip and fall back when absent', () => {
  store.clear();
  assert.deepEqual(loadAudioPreferences(), DEFAULT_AUDIO_PREFERENCES);
  saveAudioPreferences({ volume: 0.4, music: false });
  assert.deepEqual(loadAudioPreferences(), { volume: 0.4, music: false });
});

void test('stored rubbish never reaches the mix', () => {
  for (const saved of [
    '{"volume":"loud","music":"yes"}',
    '{"volume":null}',
    'not json at all',
    '[]',
    '{"volume":4,"music":true}',
    '{"volume":-3,"music":false}',
  ]) {
    store.set(KEY, saved);
    const { volume, music } = loadAudioPreferences();
    assert.ok(volume >= 0 && volume <= 1, `volume out of range for ${saved}`);
    assert.equal(typeof music, 'boolean');
  }
});

void test('applying reaches every registered player and stops after release', () => {
  store.clear();
  const seen: AudioPreferences[] = [];
  const release = registerAudioListener({
    applyPreferences: (preferences) => seen.push(preferences),
  });
  applyAudioPreferences({ volume: 0.25, music: false });
  assert.deepEqual(seen, [{ volume: 0.25, music: false }]);
  // A change made in one game is what the next game loads.
  assert.deepEqual(loadAudioPreferences(), { volume: 0.25, music: false });
  release();
  applyAudioPreferences({ volume: 1, music: true });
  assert.equal(seen.length, 1, 'a disposed player is not called again');
});

void test('the snapshot is stable between changes and wakes subscribers', () => {
  // useSyncExternalStore re-renders forever if the snapshot identity churns.
  assert.equal(audioPreferencesSnapshot(), audioPreferencesSnapshot());
  assert.equal(defaultAudioPreferences(), defaultAudioPreferences());
  let woken = 0;
  const stop = subscribeAudioPreferences(() => {
    woken++;
  });
  const before = audioPreferencesSnapshot();
  applyAudioPreferences({ volume: 0.6, music: true });
  assert.equal(woken, 1);
  assert.notEqual(audioPreferencesSnapshot(), before, 'a change is observable');
  assert.deepEqual(audioPreferencesSnapshot(), { volume: 0.6, music: true });
  stop();
  applyAudioPreferences({ volume: 0.1, music: false });
  assert.equal(woken, 1, 'an unmounted toolbar is not woken');
});
