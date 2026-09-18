import type { GameId } from '../../shared/audio/types';
import type { PartyResult } from '../../shared/ui/party-round';

export type PartyPlayer = {
  id: string;
  name: string;
  color: number;
  ready: boolean;
  score: number;
  isHost: boolean;
  isBot?: boolean;
};

export type PartyStatus =
  | 'lobby'
  | 'countdown'
  | 'in_game'
  | 'intermission'
  | 'finished';

export type RoundResult = {
  round: number;
  game: GameId;
  scores: Record<string, number>;
  pointsAwarded: Record<string, number>;
  winnerId?: string;
  /** What each human reported; null for one who gave up or never did. */
  reports?: Record<string, PartyResult | null>;
  /** The two sides of a team round. */
  teams?: [string[], string[]];
};

export type PartyRoomState = {
  code: string;
  hostId: string;
  status: PartyStatus;
  players: PartyPlayer[];
  playlist: GameId[];
  currentRound: number; // 0-indexed: 0..5 for a 6-game match
  roundResults: RoundResult[];
  /**
   * Results reported for the current round so far, by player id. Every human
   * plays their own match, so the round is scored once all of them are in, or
   * when the host closes it. null means the player gave up.
   */
  reports?: Record<string, PartyResult | null>;
  countdownUntil?: number;
  updated: number;
};

/**
 * A human's proof of their seat: their player id and the secret token the
 * server handed out when they created or joined the party.
 */
export type PartyPass = { id: string; token: string };

/** Every action taken as a player carries that player's party pass token. */
export type PartyAction =
  | { op: 'create'; hostName: string; color: number }
  | { op: 'join'; code: string; name: string; color: number }
  | { op: 'leave'; code: string; playerId: string; token: string }
  | {
      op: 'ready';
      code: string;
      playerId: string;
      token: string;
      ready: boolean;
    }
  | { op: 'add_bot'; code: string; hostId: string; token: string }
  | {
      op: 'remove_player';
      code: string;
      hostId: string;
      token: string;
      targetId: string;
    }
  | { op: 'start'; code: string; hostId: string; token: string }
  | {
      op: 'report_result';
      code: string;
      round: number;
      playerId: string;
      token: string;
      /** The game's result, or null to give up the round. */
      result: PartyResult | null;
    }
  | {
      op: 'close_round';
      code: string;
      round: number;
      hostId: string;
      token: string;
    }
  | { op: 'next_round'; code: string; hostId: string; token: string }
  | { op: 'rematch'; code: string; hostId: string; token: string }
  | { op: 'get'; code: string };
