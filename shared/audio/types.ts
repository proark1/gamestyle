import {
  BORROWED_AUDIO,
  GAME_IDS,
  isGame,
  isHandwerkerGame,
  type Game,
  type HandwerkerGame,
} from '../games/identity';

/**
 * Games with their own standard sound workshop: the collection minus the Handwerker
 * titles, which build their sounds in the construction workshop, and minus games
 * that borrow another game's recordings. Derived from the collection list so an
 * audio registry can never name a game the collection does not have.
 */
export type GameId = Exclude<
  Game,
  HandwerkerGame | keyof typeof BORROWED_AUDIO
>;

export const GAME_IDS_WITH_AUDIO: readonly GameId[] = GAME_IDS.filter(
  (game): game is GameId =>
    !isHandwerkerGame(game) && !(game in BORROWED_AUDIO),
);
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
  'on-the-ropes': 'On the Ropes',
  'wrong-floor': 'Wrong Floor',
  'stack-or-sink': 'Stack or Sink',
  'act-natural': 'Blend Business',
  'uphill-delivery': 'Uphill Delivery',
  'reel-problems-2': 'Reel Problems 2',
  'reel-problems': 'Reel Problems',
  'one-more-button': 'One More Button',
  'four-brain-cells': 'Four Brain Cells',
  'siege-and-desist': 'Siege and Desist',
  'dont-wake-the-giant': 'Tiptoe Thieves',
  'load-bearing': 'Load Bearing',
  'crane-clash': 'Crane Clash',
  basketball: 'Court Clash',
  'bungee-doubles': 'Bungee Doubles',
  'panic-curling': 'Panic Curling',
  'zorb-clash': 'Zorb Clash',
  'carry-on-carnage': 'Carry-On Carnage',
  'sample-stampede': 'Sample Stampede',
  'drive-thru': 'Drive-Thru Static',
  'scaffold-scramble': 'Scaffold Scramble',
  'chain-of-fools': 'Chain of Fools',
};
export const isGameId = (v: unknown): v is GameId =>
  isGame(v) && !isHandwerkerGame(v) && !(v in BORROWED_AUDIO);
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
