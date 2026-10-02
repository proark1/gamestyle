import { idleInput, type Input } from './types';

/** Key and pointer sources stay separate so releasing one does not cancel another. */
export class BoxingControls {
  private keys = new Set<string>();
  private pointer = idleInput();
  private punchUntil = 0;
  private tagUntil = 0;
  private cancelled = false;
  key(code: string, down: boolean) {
    if (down) {
      this.keys.add(code);
      if (code === 'Space') this.punchUntil = performance.now() + 85;
      if (code === 'KeyE') this.tagUntil = performance.now() + 120;
    } else this.keys.delete(code);
  }
  patch(patch: Partial<Input>) {
    Object.assign(this.pointer, patch);
    if (patch.punch) this.punchUntil = performance.now() + 85;
    if (patch.tag) this.tagUntil = performance.now() + 120;
  }
  clear() {
    this.keys.clear();
    this.pointer = idleInput();
    this.punchUntil = 0;
    this.tagUntil = 0;
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
      dodge: this.pointer.dodge || has('KeyQ'),
      tag: this.pointer.tag || has('KeyE') || performance.now() < this.tagUntil,
      assist: this.pointer.assist || has('KeyF'),
      cancel: this.cancelled,
    };
    this.cancelled = false;
    return result;
  }
}
