import { bindJoystick as bind } from '../../shared/input/bind-joystick';
function joystickVector(x: number, z: number) {
  const length = Math.hypot(x, z);
  if (length < 0.12) return { x: 0, z: 0 };
  const divisor = Math.max(1, length);
  return { x: x / divisor, z: z / divisor };
}
export function bindJoystick(
  pad: HTMLElement,
  onMove: (x: number, z: number) => void,
) {
  return bind(pad, onMove, joystickVector);
}
