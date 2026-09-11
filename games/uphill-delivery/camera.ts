/** V cycles in this order; a delivery starts on the first, from outside. */
export const DELIVERY_CAMERAS = [
  'follow',
  'sofa',
  'overview',
  'first-person',
] as const;
export type DeliveryCameraMode = (typeof DELIVERY_CAMERAS)[number];
export const CAMERA_NAMES: Record<DeliveryCameraMode, string> = {
  'first-person': 'First person',
  follow: 'Follow you',
  sofa: 'Follow sofa',
  overview: 'Whole mountain',
};
export const EYE_HEIGHT = 1.65;

/** Eye direction and walking share a yaw; looking up never makes walking fly. */
export class DeliveryLook {
  yaw = 0.48;
  pitch = -0.12;
  turn(dx: number, dy: number) {
    this.yaw = Math.atan2(
      Math.sin(this.yaw - dx * 0.004),
      Math.cos(this.yaw - dx * 0.004),
    );
    this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - dy * 0.004));
  }
  walk(x: number, z: number) {
    return {
      x: x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: z * Math.cos(this.yaw) - x * Math.sin(this.yaw),
    };
  }
  direction(target = { x: 0, y: 0, z: 0 }) {
    target.x = -Math.sin(this.yaw) * Math.cos(this.pitch);
    target.y = Math.sin(this.pitch);
    target.z = -Math.cos(this.yaw) * Math.cos(this.pitch);
    return target;
  }
}
