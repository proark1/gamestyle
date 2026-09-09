import type { GameId } from '../audio/types';
export type VoiceSession = {
  peer?: true;
  game: GameId;
  code: string;
  id: string;
  token: string;
};
export type VoicePeer = { id: string; name: string; x?: number; z?: number };
export type VoiceSnapshot = { players: VoicePeer[]; nearby: boolean };
