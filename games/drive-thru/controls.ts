import { idleInput, type PlayerInput, type RoleId } from './types';

export function keyboardInput(
  keys: ReadonlySet<string>,
  role: RoleId,
): PlayerInput {
  const has = (...codes: string[]) => codes.some((code) => keys.has(code));
  const x =
    Number(has('KeyD', 'ArrowRight')) - Number(has('KeyA', 'ArrowLeft'));
  const z = Number(has('KeyS', 'ArrowDown')) - Number(has('KeyW', 'ArrowUp'));
  return {
    ...idleInput(),
    x,
    z,
    action1: role === 'driver' ? z < 0 : has('Space'),
    action2: role === 'driver' ? z > 0 : has('KeyR', 'ShiftLeft'),
    jump: role === 'driver' && has('Space'),
    action3: has('KeyE', 'KeyH'),
  };
}
