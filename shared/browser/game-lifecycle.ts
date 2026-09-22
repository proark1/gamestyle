/** One source for native and browser foreground state, also usable by simulations. */
let nativeActive = true;
export const gameActive = () =>
  nativeActive && (typeof document === 'undefined' || !document.hidden);

export function bindGameLifecycle(onChange: (active: boolean) => void) {
  const abort = new AbortController();
  const signal = abort.signal;
  const held = new Map<string, { target: EventTarget; key: string }>();
  const clear = () => {
    for (const [code, { target, key }] of held)
      target.dispatchEvent(
        new KeyboardEvent('keyup', { code, key, bubbles: true }),
      );
    held.clear();
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.target) held.set(e.code, { target: e.target, key: e.key });
    },
    { capture: true, signal },
  );
  window.addEventListener(
    'keyup',
    (e) => {
      held.delete(e.code);
    },
    { capture: true, signal },
  );
  window.addEventListener('blur', clear, { signal });
  const changed = () => {
    if (!gameActive()) clear();
    onChange(gameActive());
  };
  document.addEventListener('visibilitychange', changed, { signal });
  window.addEventListener(
    'game:app-state',
    (e) => {
      nativeActive = (e as CustomEvent<{ active: boolean }>).detail.active;
      changed();
    },
    { signal },
  );
  return () => {
    clear();
    abort.abort();
  };
}
