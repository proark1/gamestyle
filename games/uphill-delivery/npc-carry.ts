import {
  GRIPS,
  type DeliveryPlayer,
  type DeliveryWorld,
  type Vec,
} from './types';
import { angleDelta, clamp, distanceXZ } from './navigation';

/** Keep the workers' walking velocity consistent with a single moving cargo frame. */
export function carryDeliveryInput(
  w: DeliveryWorld,
  p: DeliveryPlayer,
  start: Vec,
  goal: Vec,
  targetYaw: number,
) {
  const q = w.sofa.quaternion;
  const yaw = Math.atan2(
    2 * (q.w * q.y + q.x * q.z),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );
  const error = angleDelta(targetYaw, yaw);
  const turning = Math.abs(error) > 0.3;
  const distance = distanceXZ(w.sofa, goal);
  const pace = turning
    ? 0
    : Math.min(start.y === 16 ? 1.5 : 2.2, 0.55 + distance * 0.8);
  const vx = ((goal.x - w.sofa.x) / Math.max(distance, 0.1)) * pace;
  const vz = ((goal.z - w.sofa.z) / Math.max(distance, 0.1)) * pace;
  const corner = turning && distanceXZ(w.sofa, start) < 2;
  const centerX = corner
    ? start.x
    : clamp(w.sofa.x, Math.min(start.x, goal.x), Math.max(start.x, goal.x));
  const centerZ = corner
    ? start.z
    : clamp(w.sofa.z, Math.min(start.z, goal.z), Math.max(start.z, goal.z));
  const grip = GRIPS[p.grip!];
  const radial = Math.hypot(grip.x, grip.z);
  const lx = grip.x * (1 + 0.65 / radial),
    lz = grip.z * (1 + 0.65 / radial);
  const rx = lx * Math.cos(yaw) + lz * Math.sin(yaw);
  const rz = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
  const omega = clamp(error * 1.3, -0.85, 0.85);
  return {
    x: clamp(
      (vx + omega * rz + (w.sofa.x + rx - p.x) * 1.8 + (centerX - w.sofa.x)) /
        2.65,
      -1,
      1,
    ),
    z: clamp(
      (vz - omega * rx + (w.sofa.z + rz - p.z) * 1.8 + (centerZ - w.sofa.z)) /
        2.65,
      -1,
      1,
    ),
  };
}
