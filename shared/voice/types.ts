import type { Game } from '../games/identity';
export type VoiceSession = {
  peer?: true;
  game: Game | 'party';
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

export type VoiceState = {
  status: string;
  connected: boolean;
  mic: boolean;
  speaking: string[];
  level: number;
  error?: string;
  audioBlocked?: boolean;
  connectionInfo?: string;
  ready?: boolean;
  mode?: 'open' | 'push';
};
