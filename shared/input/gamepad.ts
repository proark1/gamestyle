import { gameActive } from '../browser/game-lifecycle';

export const GAMEPAD_BUTTONS = [
  'A / Cross',
  'B / Circle',
  'X / Square',
  'Y / Triangle',
  'LB / L1',
  'RB / R1',
  'LT / L2',
  'RT / R2',
] as const;
export const DEFAULT_KEYS = [
  'Space',
  'KeyQ',
  'KeyE',
  'KeyF',
  'ShiftLeft',
  'KeyV',
  'KeyR',
  'KeyC',
];
export const deadzone = (value: number, threshold = 0.2) =>
  Math.abs(value) <= threshold
    ? 0
    : (Math.sign(value) * (Math.abs(value) - threshold)) / (1 - threshold);
export function gamepadKeys(
  axes: readonly number[],
  buttons: readonly { pressed: boolean }[],
  mapping: readonly string[],
) {
  const keys = new Set<string>();
  const x = deadzone(axes[0] ?? 0),
    y = deadzone(axes[1] ?? 0);
  if (x < -0.1) keys.add('KeyA');
  if (x > 0.1) keys.add('KeyD');
  if (y < -0.1) keys.add('KeyW');
  if (y > 0.1) keys.add('KeyS');
  mapping.forEach((key, i) => {
    if (key && buttons[i]?.pressed) keys.add(key);
  });
  return keys;
}
const keyOf = (code: string) =>
  code === 'Space'
    ? ' '
    : code.startsWith('Key')
      ? code.slice(3).toLowerCase()
      : code.startsWith('Digit')
        ? code.slice(5)
        : code.replace(/Left$/, '');
export function controllerMapping(): string[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`gamepad:${location.pathname}`) ?? 'null',
    );
    if (
      Array.isArray(value) &&
      value.length === 8 &&
      value.every(
        (k) =>
          typeof k === 'string' &&
          /^(Key[A-Z]|Digit[0-9]|Space|ShiftLeft|Arrow(Up|Down|Left|Right)|Tab)$/.test(
            k,
          ),
      )
    )
      return value;
  } catch {
    /* Storage is optional. */
  }
  return [...DEFAULT_KEYS];
}

/** Keyboard adapter keeps existing game rules intact; mappings are saved per game. */
export function bindGamepad() {
  let mapping = controllerMapping();
  const mappingChanged = () => {
    mapping = controllerMapping();
  };
  window.addEventListener('game:controller-mapping', mappingChanged);
  let frame = 0,
    held = new Set<string>(),
    previousButtons: boolean[] = [],
    connected = false,
    menu = true,
    last = 0;
  const target = () => document.querySelector('canvas') ?? window;
  const emit = (code: string, down: boolean) =>
    target().dispatchEvent(
      new KeyboardEvent(down ? 'keydown' : 'keyup', {
        code,
        key: keyOf(code),
        bubbles: true,
        cancelable: true,
      }),
    );
  const clear = () => {
    for (const code of held) emit(code, false);
    held.clear();
  };
  const notify = () =>
    window.dispatchEvent(
      new CustomEvent('game:controller', { detail: { connected, menu } }),
    );
  const focusable = () =>
    [
      ...(
        document.querySelector(
          'dialog[open], [role="dialog"][aria-modal="true"]',
        ) ?? document
      ).querySelectorAll<HTMLElement>(
        'button, a[href], input, textarea, select, summary',
      ),
    ].filter(
      (e) =>
        e.getClientRects().length &&
        !e.closest('[inert]') &&
        !e.matches(':disabled'),
    );
  const menuChange = (event: Event) => {
    menu = (event as CustomEvent<boolean>).detail;
    clear();
    notify();
  };
  window.addEventListener('game:controller-mode', menuChange);
  const poll = (time: number) => {
    frame = requestAnimationFrame(poll);
    const dt = Math.min(0.05, (time - last) / 1000);
    last = time;
    const pad = [...(navigator.getGamepads?.() ?? [])].find(
      (p) => p?.connected,
    );
    if (!!pad !== connected) {
      connected = !!pad;
      menu = true;
      clear();
      notify();
    }
    if (!pad || !gameActive()) {
      clear();
      previousButtons = [];
      return;
    }
    const pressed = pad.buttons.map((b) => b.pressed),
      edge = (i: number) => pressed[i] && !previousButtons[i];
    if (edge(9)) {
      menu = !menu;
      clear();
      notify();
    }
    const editable = document.activeElement?.matches('input,textarea,select');
    const ui =
      menu ||
      !document.querySelector('canvas') ||
      !!document.querySelector('dialog[open]') ||
      editable;
    if (ui) {
      clear();
      if (edge(12) || edge(13) || edge(14) || edge(15)) {
        const step = edge(12) || edge(14) ? -1 : 1;
        const active = document.activeElement;
        if (active instanceof HTMLSelectElement && (edge(14) || edge(15))) {
          active.selectedIndex = Math.max(
            0,
            Math.min(active.options.length - 1, active.selectedIndex + step),
          );
          active.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const elements = focusable(),
            index = elements.indexOf(active as HTMLElement);
          elements[
            index < 0 ? 0 : (index + step + elements.length) % elements.length
          ]?.focus();
        }
      }
      if (edge(0)) (document.activeElement as HTMLElement | null)?.click();
      if (edge(1))
        document.activeElement?.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
          }),
        );
    } else {
      const next = gamepadKeys(pad.axes, pad.buttons, mapping);
      for (const key of held) if (!next.has(key)) emit(key, false);
      for (const key of next) if (!held.has(key)) emit(key, true);
      held = next;
      const x = deadzone(pad.axes[2] ?? 0) * 600 * dt,
        y = deadzone(pad.axes[3] ?? 0) * 600 * dt;
      if (x || y)
        target().dispatchEvent(
          new MouseEvent('mousemove', {
            movementX: x,
            movementY: y,
            bubbles: true,
          }),
        );
    }
    previousButtons = pressed;
  };
  frame = requestAnimationFrame(poll);
  window.addEventListener('blur', clear);
  return () => {
    cancelAnimationFrame(frame);
    clear();
    window.removeEventListener('blur', clear);
    window.removeEventListener('game:controller-mode', menuChange);
    window.removeEventListener('game:controller-mapping', mappingChanged);
  };
}
