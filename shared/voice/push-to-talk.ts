/** One transmission gate shared by keyboard, pointer and touch holds. */
export function bindPushToTalk(
  target: Window,
  code: string,
  talk: (active: boolean) => void,
) {
  const held = new Set<string>();
  const press = (source: string) => {
    if (held.has(source)) return;
    const wasActive = held.size > 0;
    held.add(source);
    if (!wasActive) talk(true);
  };
  const release = (source: string) => {
    if (held.delete(source) && !held.size) talk(false);
  };
  const reset = () => {
    held.clear();
    talk(false);
  };
  const down = (event: KeyboardEvent) => {
    const element = event.target as HTMLElement | null;
    const buttonKey =
      element?.closest?.('[data-voice-hold]') &&
      ['Space', 'Enter'].includes(event.code);
    if (event.code !== code && !buttonKey) return;
    if (
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey ||
      event.isComposing ||
      element?.closest?.(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) press(`key:${event.code}`);
  };
  const up = (event: KeyboardEvent) => {
    if (!held.has(`key:${event.code}`)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    release(`key:${event.code}`);
  };
  const hidden = () => {
    if (target.document.hidden) reset();
  };
  target.addEventListener('keydown', down, true);
  target.addEventListener('keyup', up, true);
  target.addEventListener('blur', reset);
  target.document.addEventListener('visibilitychange', hidden);
  return {
    press,
    release,
    reset,
    dispose() {
      reset();
      target.removeEventListener('keydown', down, true);
      target.removeEventListener('keyup', up, true);
      target.removeEventListener('blur', reset);
      target.document.removeEventListener('visibilitychange', hidden);
    },
  };
}
