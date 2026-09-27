import type { FishingLine } from '../types';

export type LinePoint = { x: number; y: number; z: number };

export function fillFishingLine(
  output: Float32Array,
  start: LinePoint,
  end: LinePoint,
  state: FishingLine['state'],
  tension: number,
  timeSeconds: number,
  landingProgress = 0,
) {
  const count = output.length / 3;
  const safeTension = Math.max(0, Math.min(1.2, tension));
  const horizontal = Math.hypot(end.x - start.x, end.z - start.z);
  const castLift = state === 'casting' ? Math.max(1.2, horizontal * 0.2) : 0;
  const landingLift =
    landingProgress > 0 ? 1.8 * Math.sin(landingProgress * Math.PI) : 0;
  const sag =
    state === 'waiting' || state === 'biting'
      ? Math.min(2.2, 0.25 + horizontal * 0.055)
      : state === 'hooked'
        ? Math.max(0.04, 0.72 * (1 - Math.min(1, safeTension)))
        : 0.12;
  const twitch =
    state === 'biting' ? 0.09 : state === 'hooked' ? safeTension * 0.025 : 0;
  for (let index = 0; index < count; index++) {
    const t = count <= 1 ? 0 : index / (count - 1);
    const arc = Math.sin(t * Math.PI);
    const vibration = Math.sin(timeSeconds * 24 + t * 18) * twitch * arc;
    const offset = index * 3;
    output[offset] = start.x + (end.x - start.x) * t + vibration;
    output[offset + 1] =
      start.y +
      (end.y - start.y) * t +
      arc * (castLift + landingLift - sag) +
      vibration * 0.5;
    output[offset + 2] = start.z + (end.z - start.z) * t - vibration;
  }
  if (count > 0) {
    output[0] = start.x;
    output[1] = start.y;
    output[2] = start.z;
    const endOffset = (count - 1) * 3;
    output[endOffset] = end.x;
    output[endOffset + 1] = end.y;
    output[endOffset + 2] = end.z;
  }
  return output;
}
