export type GraphicsPreferences = {
  quality: 'auto' | 'low' | 'high';
  fps: 30 | 60 | 120;
};
const defaults: GraphicsPreferences = { quality: 'auto', fps: 60 };
let current: GraphicsPreferences | undefined;
export const defaultGraphicsPreferences = () => defaults;
export function graphicsPreferences() {
  if (current) return current;
  if (typeof window === 'undefined') return defaults;
  try {
    const value = JSON.parse(
      localStorage.getItem('jumbleyard:graphics') ?? 'null',
    ) as Partial<GraphicsPreferences> | null;
    current = {
      quality:
        value && ['auto', 'low', 'high'].includes(value.quality ?? '')
          ? value.quality!
          : 'auto',
      fps: value && [30, 60, 120].includes(value.fps ?? 0) ? value.fps! : 60,
    };
  } catch {
    current = { ...defaults };
  }
  return current;
}
export function setGraphicsPreferences(value: GraphicsPreferences) {
  current = value;
  try {
    localStorage.setItem('jumbleyard:graphics', JSON.stringify(value));
  } catch {
    /* Private browsing. */
  }
  window.dispatchEvent(new Event('game:graphics'));
}
export function subscribeGraphicsPreferences(callback: () => void) {
  window.addEventListener('game:graphics', callback);
  return () => window.removeEventListener('game:graphics', callback);
}
