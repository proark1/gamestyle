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

export type Point3 = { x: number; y: number; z: number };
export type Quaternion = Point3 & { w: number };

const IDENTITY_ROTATION: Quaternion = { x: 0, y: 0, z: 0, w: 1 };

const finite = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

function safeRotation(rotation: Quaternion): Quaternion {
  const candidate = {
    x: finite(rotation.x),
    y: finite(rotation.y),
    z: finite(rotation.z),
    w: finite(rotation.w, 1),
  };
  const length = Math.hypot(candidate.x, candidate.y, candidate.z, candidate.w);
  if (length < 1e-6) return IDENTITY_ROTATION;
  return {
    x: candidate.x / length,
    y: candidate.y / length,
    z: candidate.z / length,
    w: candidate.w / length,
  };
}

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

/** Horizontal movement heading with pitch and roll removed for a calm horizon. */
export function horizontalForward(rotation: Quaternion): Point3 {
  const safe = safeRotation(rotation);
  const forward = rotate({ x: 0, y: 0, z: 1 }, safe);
  const length = Math.hypot(forward.x, forward.z);
  if (length >= 1e-5) {
    return { x: forward.x / length, y: 0, z: forward.z / length };
  }
  // A prone model can point almost straight up or down. Its right axis still
  // carries the movement heading, so use that rather than snapping north.
  const right = rotate({ x: 1, y: 0, z: 0 }, safe);
  const rightLength = Math.hypot(right.x, right.z);
  if (rightLength < 1e-5) return { x: 0, y: 0, z: 1 };
  return {
    x: -right.z / rightLength,
    y: 0,
    z: right.x / rightLength,
  };
}

export function dampingAlpha(rate: number, dt: number) {
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(dt) || dt <= 0)
    return 0;
  return 1 - Math.exp(-rate * Math.min(dt, 0.1));
}

export function firstPersonEyeHeight({
  swimming,
  clinging = false,
  downed = false,
}: {
  swimming: boolean;
  clinging?: boolean;
  downed?: boolean;
}) {
  if (!swimming) return 1.52;
  if (downed) return 0.7;
  if (clinging) return 1.08;
  return 0.82;
}

export function cameraShakeScale(mode: CameraMode) {
  return mode === 'first-person' ? 0.18 : 1;
}

/** Camera pose derived from the already-interpolated rendered angler transform. */
export function firstPersonPose(
  origin: Point3,
  rotation: Quaternion,
  eyeHeight = 1.52,
  lookDistance = 6,
  minimumEyeY = Number.NEGATIVE_INFINITY,
) {
  const safeOrigin = {
    x: finite(origin.x),
    y: finite(origin.y),
    z: finite(origin.z),
  };
  const height = finite(eyeHeight, 1.52);
  const distance = Math.max(0.1, finite(lookDistance, 6));
  const floor = finite(minimumEyeY, Number.NEGATIVE_INFINITY);
  const forward = horizontalForward(rotation);
  const eye = {
    x: safeOrigin.x,
    y: Math.max(safeOrigin.y + height, floor),
    z: safeOrigin.z,
  };
  return {
    eye,
    look: {
      x: eye.x + forward.x * distance,
      y: eye.y,
      z: eye.z + forward.z * distance,
    },
  };
}
