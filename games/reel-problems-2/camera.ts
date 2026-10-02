export const CAMERA_MODES = ['isometric', 'first-person'] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export const DEFAULT_CAMERA_MODE: CameraMode = 'isometric';
export const CAMERA_MODE_NAMES: Record<CameraMode, string> = {
  isometric: 'Isometric',
  'first-person': 'First-person',
};

export function parseCameraMode(value: unknown): CameraMode {
  return value === 'first-person' || value === 'isometric'
    ? value
    : DEFAULT_CAMERA_MODE;
}

export function nextCameraMode(mode: CameraMode): CameraMode {
  return mode === 'isometric' ? 'first-person' : 'isometric';
}

type Point3 = { x: number; y: number; z: number };
type Quaternion = Point3 & { w: number };

function rotate(point: Point3, quaternion: Quaternion): Point3 {
  const { x, y, z, w } = quaternion;
  const ix = w * point.x + y * point.z - z * point.y;
  const iy = w * point.y + z * point.x - x * point.z;
  const iz = w * point.z + x * point.y - y * point.x;
  const iw = -x * point.x - y * point.y - z * point.z;
  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}

/** Camera pose derived from the already-interpolated rendered angler transform. */
export function firstPersonPose(
  origin: Point3,
  rotation: Quaternion,
  eyeHeight = 1.52,
  lookDistance = 6,
) {
  const eyeOffset = rotate({ x: 0, y: eyeHeight, z: 0 }, rotation);
  const forward = rotate({ x: 0, y: 0, z: lookDistance }, rotation);
  const eye = {
    x: origin.x + eyeOffset.x,
    y: origin.y + eyeOffset.y,
    z: origin.z + eyeOffset.z,
  };
  return {
    eye,
    look: {
      x: eye.x + forward.x,
      y: eye.y + forward.y,
      z: eye.z + forward.z,
    },
  };
}
