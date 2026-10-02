import { cleanInput, idleInput, type Input } from './types';

/** Keyboard, touch and the shared gamepad key mapping feed the same input. */
export class CastleControls {
  private keys = new Set<string>();
  private touch = idleInput();
  key(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }
  patch(input: Partial<Input>) {
    Object.assign(this.touch, input);
  }
  clear() {
    this.keys.clear();
    this.touch = idleInput();
  }
  read(): Input {
    const held = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    return cleanInput({
      x:
        this.touch.x +
        Number(held('KeyD', 'ArrowRight')) -
        Number(held('KeyA', 'ArrowLeft')),
      z:
        this.touch.z +
        Number(held('KeyS', 'ArrowDown')) -
        Number(held('KeyW', 'ArrowUp')),
      brace: this.touch.brace || held('ShiftLeft', 'ShiftRight'),
      pump: this.touch.pump || held('KeyE'),
    });
  }
}
