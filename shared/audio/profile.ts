import type { AudioManifest } from './types';

/** Optional playback policies supplied by a game; defaults suit simple sound effects. */
export type AudioProfile = {
  availableVariants?: boolean;
  crossfadeMusic?: boolean;
  trackSources?: boolean;
  musicVolume?: number;
  ambienceVolume?: number;
  bufferLimit?: number;
  warmLimit?: number;
  effectLimit?: number;
  prepareManifest?: (manifest: AudioManifest) => AudioManifest;
  seamless?: (id: string, cue: AudioManifest['cues'][string]) => boolean;
  preload?: (id: string) => boolean;
  range?: (id: string) => number;
  attenuation?: (id: string, distance: number) => number;
  recordingGain?: (id: string, buffer: AudioBuffer) => number;
  playbackRate?: (id: string) => number;
  natural?: (id: string) => boolean;
  cooldownKey?: (id: string, sourceId?: string) => string;
};
