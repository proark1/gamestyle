import { cleanInput, idleInput, type Input } from './types';

export class FlipControls {
  private keys = new Set<string>();
  private pointer = idleInput();
  key(code: string, down: boolean) {
    if (down) {
      this.keys.add(code);
      this.pointer.aimX = this.pointer.aimZ = null;
    } else this.keys.delete(code);
  }
  aim(x: number, z: number) {
    this.pointer.aimX = x;
    this.pointer.aimZ = z;
  }
  clear() {
    this.keys.clear();
    this.pointer = idleInput();
  }
  read(): Input {
    const held = (...codes: string[]) => codes.some((c) => this.keys.has(c));
    return cleanInput({
      ...this.pointer,
      x: Number(held('KeyD', 'ArrowRight')) - Number(held('KeyA', 'ArrowLeft')),
      z: Number(held('KeyS', 'ArrowDown')) - Number(held('KeyW', 'ArrowUp')),
    });
  }
}
