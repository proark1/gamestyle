import { bindJoystick as bind } from '../../shared/input/bind-joystick';
import { joystickVector, touchSprint } from './touch';
export function bindJoystick(
  pad: HTMLElement,
  onMove: (x: number, z: number, sprint: boolean) => void,
) {
  let sprint = false;
  return bind(
    pad,
    (x, z) => {
      sprint = touchSprint(Math.hypot(x, z), sprint);
      if (sprint) pad.setAttribute('data-sprinting', 'true');
      else pad.removeAttribute('data-sprinting');
      onMove(x, z, sprint);
    },
    joystickVector,
  );
}
