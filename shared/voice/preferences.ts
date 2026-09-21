type Controls = { mode: 'open' | 'push'; shortcut: string };
const defaults: Controls = { mode: 'push', shortcut: 'KeyT' };
let cached = defaults;
let previous: string | null | undefined;
export const serverControls = () => defaults;
export function voiceControls() {
  try {
    const raw = localStorage.getItem('voice-controls-v1');
    if (raw !== previous) {
      previous = raw;
      const value = JSON.parse(raw || '{}');
      cached = {
        mode: value?.mode === 'open' ? 'open' : 'push',
        shortcut: ['KeyT', 'KeyV', 'KeyB'].includes(value?.shortcut)
          ? value.shortcut
          : 'KeyT',
      };
    }
  } catch {
    /* Use the current preferences if storage is unavailable. */
  }
  return cached;
}
export function saveControls(mode: Controls['mode'], shortcut: string) {
  cached = { mode, shortcut };
  try {
    const raw = JSON.stringify(cached);
    localStorage.setItem('voice-controls-v1', raw);
    previous = raw;
  } catch {
    /* Storage is optional. */
  }
  window.dispatchEvent(new Event('voice-controls-change'));
}
export function subscribeControls(changed: () => void) {
  window.addEventListener('voice-controls-change', changed);
  return () => window.removeEventListener('voice-controls-change', changed);
}
