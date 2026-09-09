export type GameId = 'chaos' | 'first-person';
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
  voiceId?: string;
  trigger?: string;
  priority?: 'core' | 'detail' | 'variation';
  variantOf?: string;
};
export type CueRecord = Cue & {
  file: string | null;
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
  chaos: 'PERMIT PENDING',
  'first-person': 'BRICK BY HAND',
};
export const isGameId = (v: unknown): v is GameId =>
  v === 'chaos' || v === 'first-person';
export type AudioLibrary = {
  game: GameId;
  settings: AudioSettings;
  keySaved: boolean;
  busy: boolean;
  cues: CueRecord[];
};
export type AudioManifest = {
  settings: AudioSettings;
  cues: Record<
    string,
    {
      url: string;
      volume: number;
      loop: boolean;
      category: AudioCategory;
      variantOf?: string;
    }
  >;
};
