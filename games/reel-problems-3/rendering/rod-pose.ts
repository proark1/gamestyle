import type { FishingLine } from '../types';

export type RodPoseInput = {
  state?: FishingLine['state'];
  charge?: number;
  cast?: number;
  tension?: number;
  reeling?: boolean;
  timeSeconds: number;
};

export type RodPose = {
  bend: number;
  backswing: number;
  forward: number;
  twitch: number;
  reel: number;
};

export function sampleRodPose({
  state,
  charge = 0,
  cast = 0,
  tension = 0,
  reeling = false,
  timeSeconds,
}: RodPoseInput): RodPose {
  const safeCharge = Math.max(0, Math.min(1, charge));
  const safeTension = Math.max(0, Math.min(1.25, tension));
  const bite = state === 'biting' ? Math.max(0, Math.sin(timeSeconds * 17)) : 0;
  const castPulse =
    state === 'casting'
      ? Math.sin(Math.max(0, Math.min(1, cast)) * Math.PI)
      : 0;
  return {
    bend: Math.min(
      1.18,
      0.12 + safeCharge * 0.42 + safeTension * 0.72 + bite * 0.18,
    ),
    backswing: safeCharge * 0.62,
    forward: castPulse * 0.48,
    twitch: bite * 0.12 + (state === 'hooked' ? safeTension * 0.025 : 0),
    reel: reeling && state === 'hooked' ? timeSeconds * 9.5 : 0,
  };
}
