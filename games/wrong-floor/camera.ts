import * as T from 'three';
import { clamp } from '../../shared/math/clamp';

export type HotelCameraMode = 'first-person' | 'follow';
export const DEFAULT_CAMERA: HotelCameraMode = 'first-person';
export const CAMERA_NAMES = {
  'first-person': 'First person',
  follow: 'Follow guest',
} as const;
export const EYE_HEIGHT = 1.82;

/** Walking follows the horizontal gaze even while inspecting the floor or ceiling. */
export class HotelLook {
  yaw = 0;
  pitch = -0.08;
  turn(dx: number, dy: number) {
    this.yaw = Math.atan2(
      Math.sin(this.yaw - dx * 0.004),
      Math.cos(this.yaw - dx * 0.004),
    );
    this.pitch = clamp(this.pitch - dy * 0.004, -1.25, 1.25);
  }
  reset(exit = false) {
    this.yaw = exit ? Math.PI : 0;
    this.pitch = -0.08;
  }
  walk(x: number, z: number) {
    return {
      x: x * Math.cos(this.yaw) + z * Math.sin(this.yaw),
      z: z * Math.cos(this.yaw) - x * Math.sin(this.yaw),
    };
  }
  direction(target: T.Vector3) {
    return target.set(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }
}

/** The short follow boom stops at walls, elevator jambs, doors and the ceiling. */
export class HotelCameraBoom {
  private ray = new T.Raycaster();
  private direction = new T.Vector3();
  private hits: T.Intersection[] = [];
  position(
    eye: T.Vector3,
    yaw: number,
    environment: T.Object3D,
    target: T.Vector3,
  ) {
    this.direction.set(Math.sin(yaw) * 2.4, 0.8, Math.cos(yaw) * 2.4);
    const distance = this.direction.length();
    this.direction.divideScalar(distance);
    this.ray.set(eye, this.direction);
    this.ray.near = 0;
    this.ray.far = distance + 0.24;
    this.hits.length = 0;
    this.ray.intersectObject(environment, true, this.hits);
    const wall = this.hits.find((hit) => hit.object instanceof T.Mesh);
    return target
      .copy(eye)
      .addScaledVector(
        this.direction,
        wall ? clamp(wall.distance - 0.24, 0, distance) : distance,
      );
  }
}
