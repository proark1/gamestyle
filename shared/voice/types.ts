import type { Game } from '../games/identity';
export type VoiceSession = {
  peer?: true;
  game: Game;
  code: string;
  id: string;
  token: string;
};
export type VoicePeer = { id: string; name: string; x?: number; z?: number };
export type VoiceSnapshot = {
  players: VoicePeer[];
  nearby: boolean;
  proximity?: { active: boolean; radio: Record<string, unknown> };
  audioConsent?: string[];
};
