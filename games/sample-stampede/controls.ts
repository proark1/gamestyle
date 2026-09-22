import type { PlayerInput } from './types';

export const neutralInput = (): PlayerInput => ({
  x: 0,
  z: 0,
  steer: 0,
  throttle: 0,
  drift: false,
  grabberAction: false,
});
export const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyE',
  'ShiftLeft',
  'ShiftRight',
]);

/** Keep physical keys independent from the thumb controls on hybrid devices. */
export class StampedeControls {
  keys = new Set<string>();
  touch = neutralInput();
  enabled = false;

  reset() {
    this.keys.clear();
    this.touch = neutralInput();
  }
  read(): PlayerInput {
    if (!this.enabled) return neutralInput();
    const has = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    const steer =
      Number(has('KeyA', 'ArrowLeft')) - Number(has('KeyD', 'ArrowRight')) ||
      this.touch.steer;
    const throttle =
      Number(has('KeyW', 'ArrowUp')) - Number(has('KeyS', 'ArrowDown')) ||
      this.touch.throttle;
    return {
      x: steer,
      z: throttle,
      steer,
      throttle,
      drift: has('ShiftLeft', 'ShiftRight') || this.touch.drift,
      grabberAction: has('Space', 'KeyE') || this.touch.grabberAction,
    };
  }
}

export function displayedSpeed(vx: number, vz: number, language: string) {
  return Math.round(Math.hypot(vx, vz) * (language === 'de' ? 3.6 : 2.236936));
}

/** Never allow the follow camera to pass through the warehouse walls. */
export function cameraTarget(
  x: number,
  z: number,
  angle: number,
  aspect: number,
) {
  const distance = aspect < 1 ? 12 : 10;
  return {
    x: Math.max(-24.5, Math.min(24.5, x - Math.cos(angle) * distance)),
    y: aspect < 1 ? 12 : 9,
    z: Math.max(-32.5, Math.min(32.5, z + Math.sin(angle) * distance)),
  };
}
