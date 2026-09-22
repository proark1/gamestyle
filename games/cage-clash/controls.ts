import { idleInput, type Input } from './types';

/** Key and pointer sources stay separate so releasing one does not cancel another. */
export class CageControls {
  private keys = new Set<string>();
  private pointer = idleInput();
  private punchUntil = 0;
  private grappleUntil = 0;
  private kickUntil = 0;
  private dodgeUntil = 0;
  private cancelled = false;
  key(code: string, down: boolean) {
    if (down) {
      if (this.keys.has(code)) return;
      this.keys.add(code);
      if (code === 'Space') this.punchUntil = performance.now() + 85;
      if (code === 'KeyE') this.grappleUntil = performance.now() + 120;
      if (code === 'KeyF') this.kickUntil = performance.now() + 100;
      if (code === 'KeyQ') this.dodgeUntil = performance.now() + 100;
    } else this.keys.delete(code);
  }
  patch(patch: Partial<Input>) {
    Object.assign(this.pointer, patch);
    if (patch.punch) this.punchUntil = performance.now() + 85;
    if (patch.grapple) this.grappleUntil = performance.now() + 120;
    if (patch.kick) this.kickUntil = performance.now() + 100;
    if (patch.dodge) this.dodgeUntil = performance.now() + 100;
  }
  clear() {
    this.keys.clear();
    this.pointer = idleInput();
    this.punchUntil = 0;
    this.grappleUntil = 0;
    this.kickUntil = this.dodgeUntil = 0;
    this.cancelled = true;
  }
  read(): Input {
    const has = (a: string, b?: string) =>
      this.keys.has(a) || (!!b && this.keys.has(b));
    const x =
      this.pointer.x +
      Number(has('KeyD', 'ArrowRight')) -
      Number(has('KeyA', 'ArrowLeft'));
    const z =
      this.pointer.z +
      Number(has('KeyS', 'ArrowDown')) -
      Number(has('KeyW', 'ArrowUp'));
    const length = Math.max(1, Math.hypot(x, z));
    const result = {
      x: x / length,
      z: z / length,
      punch:
        this.pointer.punch ||
        has('Space') ||
        performance.now() < this.punchUntil,
      guard: this.pointer.guard || has('ShiftLeft', 'ShiftRight'),
      dodge:
        this.pointer.dodge ||
        has('KeyQ') ||
        performance.now() < this.dodgeUntil,
      grapple:
        this.pointer.grapple ||
        has('KeyE') ||
        performance.now() < this.grappleUntil,
      kick:
        this.pointer.kick || has('KeyF') || performance.now() < this.kickUntil,
      cancel: this.cancelled,
    };
    this.cancelled = false;
    return result;
  }
}
