import type { AudioEvent } from './world';

/** Pure game directors describe audio without opening browser or provider connections. */
export type SceneAudioPlan = {
  reset: boolean;
  listener?: { x: number; z: number };
  hits: (AudioEvent & { variant?: boolean })[];
  loops: { channel: string; id: string | null; strength: number }[];
};
