export type GameId =
  | 'wrong-floor'
  | 'stack-or-sink'
  | 'act-natural'
  | 'uphill-delivery'
  | 'reel-problems'
  | 'one-more-button'
  | 'four-brain-cells'
  | 'siege-and-desist'
  | 'dont-wake-the-giant'
  | 'load-bearing';
export type AudioCategory =
  | 'material'
  | 'speech'
  | 'ambience'
  | 'music'
  | 'event';
export type Cue = {
  id: string;
  name: string;
  group: string;
  category: AudioCategory;
  prompt: string;
  text: string;
  duration: number;
  loop: boolean;
  volume: number;
};
export type CueRecord = Cue & {
  file: string | null;
  bundledUrl?: string;
  generated: number | null;
  error: string;
  stale: boolean;
};
export type AudioSettings = {
  effects: number;
  speech: number;
  ambience: number;
  music: number;
  voiceId: string;
};
export type VoiceOption = {
  id: string;
  name: string;
  description: string;
  labels: Record<string, string>;
  previewUrl: string | null;
};
export const DEFAULT_SETTINGS: AudioSettings = {
  effects: 0.75,
  speech: 0.85,
  ambience: 0.25,
  music: 0.18,
  voiceId: '',
};
export const GAME_NAMES: Record<GameId, string> = {
  'wrong-floor': 'Wrong Floor',
  'stack-or-sink': 'Stack or Sink',
  'act-natural': 'Blend Business',
  'uphill-delivery': 'Uphill Delivery',
  'reel-problems': 'Reel Problems',
  'one-more-button': 'One More Button',
  'four-brain-cells': 'Four Brain Cells',
  'siege-and-desist': 'Siege and Desist',
  'dont-wake-the-giant': 'Tiptoe Thieves',
  'load-bearing': 'Load Bearing',
};
export const isGameId = (v: unknown): v is GameId =>
  v === 'wrong-floor' ||
  v === 'stack-or-sink' ||
  v === 'act-natural' ||
  v === 'uphill-delivery' ||
  v === 'reel-problems' ||
  v === 'one-more-button' ||
  v === 'four-brain-cells' ||
  v === 'siege-and-desist' ||
  v === 'dont-wake-the-giant' ||
  v === 'load-bearing';
/** Reused clips keep their original immutable storage path. */
export function audioFileUrl(file: string) {
  const [game, name] = file.split('/');
  return `/api/audio/${game}/file/${name}`;
}
export type AudioLibrary = {
  game: GameId;
  settings: AudioSettings;
  keySaved: boolean;
  keyAvailable: boolean;
  busy: boolean;
  cues: CueRecord[];
};
export type AudioManifest = {
  settings: AudioSettings;
  cues: Record<
    string,
    { url: string; volume: number; loop: boolean; category: AudioCategory }
  >;
};
