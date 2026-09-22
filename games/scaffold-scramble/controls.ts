import { idleInput, type PlayerInput } from './types';

export type TouchControl =
  | 'left'
  | 'right'
  | 'crankLeftUp'
  | 'crankLeftDown'
  | 'crankRightUp'
  | 'crankRightDown'
  | 'action';

export function combineInput(
  keyboard: PlayerInput,
  held: Iterable<TouchControl>,
  enabled: boolean,
): PlayerInput {
  if (!enabled) return idleInput();
  const touch = new Set(held);
  return {
    ...keyboard,
    x: Math.max(
      -1,
      Math.min(
        1,
        keyboard.x + Number(touch.has('right')) - Number(touch.has('left')),
      ),
    ),
    crankLeftUp: keyboard.crankLeftUp || touch.has('crankLeftUp'),
    crankLeftDown: keyboard.crankLeftDown || touch.has('crankLeftDown'),
    crankRightUp: keyboard.crankRightUp || touch.has('crankRightUp'),
    crankRightDown: keyboard.crankRightDown || touch.has('crankRightDown'),
    action: keyboard.action || touch.has('action'),
    jump: keyboard.jump || touch.has('action'),
  };
}
