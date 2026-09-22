import type { GameId } from '../../shared/audio/types';
import type { PartyResult } from '../../shared/ui/party-round';
import type { Look } from '../../shared/wardrobe/look';
import type { PlazaPose } from '../../shared/plaza/world';

export type PartyPlayer = {
  id: string;
  name: string;
  color: number;
  ready: boolean;
  score: number;
  isHost: boolean;
  isBot?: boolean;
  seenAt?: number;
  connected?: boolean;
  look?: Look;
  lobbyPose?: PlazaPose;
  lobbySeenAt?: number;
  browsing?: boolean;
  fullGame?: boolean;
};

export type PartyStatus =
  | 'lobby'
  | 'briefing'
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
  scoring?: 'team' | 'individual' | 'cooperative';
  outcome?: 'completed' | 'failed' | 'skipped';
};

export type PartyRoomState = {
  format?: 'quick' | 'classic';
  practice?: boolean;
  briefing?: { startedAt: number; ready: string[] };
  pausedAt?: number;
  rematchVotes?: string[];
  runId?: string;
  intermission?: PartyIntermission;
  /** Response-only server clock reference. */
  serverNow?: number;
  /** Response-only store version, for ordering concurrent client responses. */
  revision?: number;
  code: string;
  hostId: string;
  status: PartyStatus;
  players: PartyPlayer[];
  playlist: GameId[];
  currentRound: number; // 0-indexed: 0..5 for a 6-game match
  roundResults: RoundResult[];
  /**
   * Results from the shared game, by human seat. null means a forfeit.
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

export type PartyIntermission = {
  phase: 'podium' | 'voting' | 'tie-break' | 'reveal';
  startedAt: number;
  endsAt: number;
  candidates: GameId[];
  votes: Record<string, GameId>;
  tied: GameId[];
  winner?: GameId;
  locked?: string[];
};

/** Every action taken as a player carries that player's party pass token. */
export type PartyAction =
  | {
      op: 'lobby_presence';
      code: string;
      playerId: string;
      token: string;
      pose: PlazaPose;
      look: Look;
      browsing: boolean;
    }
  | {
      op: 'heartbeat' | 'briefing_ready' | 'vote_lock' | 'rematch_interest';
      code: string;
      playerId: string;
      token: string;
      round?: number;
    }
  | {
      op: 'format';
      code: string;
      hostId: string;
      token: string;
      format: 'quick' | 'classic';
    }
  | {
      op: 'pause';
      code: string;
      playerId: string;
      token: string;
      paused: boolean;
    }
  | {
      op: 'game_session';
      code: string;
      playerId: string;
      token: string;
      round: number;
    }
  | {
      op: 'vote';
      code: string;
      round: number;
      playerId: string;
      token: string;
      game: GameId;
    }
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
