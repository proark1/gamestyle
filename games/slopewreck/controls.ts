import { cleanInput, idleInput, type RaceInput } from './types';

export class SlopeControls {
  private keys = new Set<string>();
  private touch = idleInput();
  key(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }
  patch(input: Partial<RaceInput>) {
    Object.assign(this.touch, input);
  }
  clear() {
    this.keys.clear();
    this.touch = idleInput();
  }
  read(): RaceInput {
    const held = (...codes: string[]) =>
      codes.some((code) => this.keys.has(code));
    return cleanInput({
      steer:
        this.touch.steer +
        Number(held('KeyD', 'ArrowRight')) -
        Number(held('KeyA', 'ArrowLeft')),
      tuck:
        this.touch.tuck || held('KeyW', 'ArrowUp', 'ShiftLeft', 'ShiftRight'),
      brake: this.touch.brake || held('KeyS', 'ArrowDown'),
    });
  }
}
