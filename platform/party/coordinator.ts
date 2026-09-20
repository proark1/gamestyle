import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  hashToken,
  newRoomCode,
  playerName,
} from '../../shared/rooms/identity';
import { parsePartyResult } from '../../shared/ui/party-round';
import { generatePlaylist, getPartyGameInfo } from './playlist';
import { intermissionDue, progressIntermission } from './intermission';
import type { GameId } from '../../shared/audio/types';
import {
  calculateRoundPoints,
  roundTeams,
  scoreGoalRound,
  scoreTeamRound,
  type RoundReports,
} from './scoring';
import type {
  PartyPass,
  PartyPlayer,
  PartyRoomState,
  RoundResult,
} from './types';

export const partyStorageKey = (code: string) => `party:${code}`;

export const newPartyCode = newRoomCode;

const safeName = (val: unknown, fallback: string) => playerName(val, fallback);
const safeColor = (val: unknown) => {
  const n = Number(val);
  return Number.isInteger(n) ? Math.max(0, Math.min(3, n)) : 0;
};

const BOT_NAMES = ['Gizmo', 'Widget', 'Bolt', 'Sprocket', 'Rusty', 'Pixel'];

/** The SHA-256 of each human's party pass, by player id. */
type Passes = Record<string, string>;

/**
 * What the store holds: the public room plus the pass hashes, which never
 * leave the server. Parties created before passes existed have none and stay
 * open until they expire.
 */
type StoredParty = PartyRoomState & { passes?: Passes };

function readParty(raw: string): { room: PartyRoomState; passes?: Passes } {
  const { passes, ...room } = JSON.parse(raw) as StoredParty;
  return { room, passes };
}

async function newPass() {
  const token = crypto.randomUUID() + crypto.randomUUID();
  return { token, hash: await hashToken(token) };
}

async function passHash(token: unknown) {
  return typeof token === 'string' && token && token.length <= 100
    ? hashToken(token)
    : null;
}

function checkPass(
  passes: Passes | undefined,
  id: string,
  hash: string | null,
) {
  if (passes && (!hash || passes[id] !== hash)) {
    throw new RoomError(
      'This party does not recognise you. Rejoin from the party page.',
      401,
    );
  }
}

export async function createPartyRoom(
  store: RoomStore,
  hostName: string,
  color: number,
  now = Date.now(),
): Promise<{ state: PartyRoomState; playerId: string; token: string }> {
  const playerId = crypto.randomUUID();
  const { token, hash } = await newPass();
  const host: PartyPlayer = {
    id: playerId,
    name: safeName(hostName, 'Party Leader'),
    color: safeColor(color),
    ready: true,
    score: 0,
    isHost: true,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPartyCode();
    const playlist = generatePlaylist(6);
    const roomState: PartyRoomState = {
      code,
      hostId: playerId,
      status: 'lobby',
      players: [host],
      playlist,
      currentRound: 0,
      roundResults: [],
      updated: now,
    };

    const stored: StoredParty = {
      ...roomState,
      passes: { [playerId]: hash },
    };
    const row = {
      code: partyStorageKey(code),
      state: JSON.stringify(stored),
      version: 1,
      updated: now,
    };

    if (await store.insert(row)) {
      return { state: roomState, playerId, token };
    }
  }

  throw new Error('Could not generate a unique party room code. Please retry.');
}

export async function getPartyRoom(
  store: RoomStore,
  code: string,
  now = Date.now(),
): Promise<PartyRoomState | null> {
  const row = await store.get(partyStorageKey(code.toUpperCase()));
  if (!row) return null;
  const room = readParty(row.state).room;
  return intermissionDue(room, now)
    ? updatePartyRoom(store, code, null, (current) => current, now)
    : { ...room, serverNow: now, revision: row.version };
}

/**
 * Applies `updater` to the stored room. `actor`, when given, must hold the
 * pass of the player acting. The updater may edit the pass hashes it is
 * handed, and never sees them in the room.
 */
async function updatePartyRoom(
  store: RoomStore,
  code: string,
  actor: PartyPass | null,
  updater: (current: PartyRoomState, passes?: Passes) => PartyRoomState,
  now = Date.now(),
): Promise<PartyRoomState> {
  const storageCode = partyStorageKey(code.toUpperCase());
  const hash = actor ? await passHash(actor.token) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await store.get(storageCode);
    if (!row) throw new Error('Party room not found.');
    const { room, passes } = readParty(row.state);
    if (actor) checkPass(passes, actor.id, hash);
    const nextPasses = passes && { ...passes };
    const current = progressIntermission(room, now);
    const next = {
      ...progressIntermission(updater(current, nextPasses), now),
      updated: now,
    };
    const stored: StoredParty = nextPasses
      ? { ...next, passes: nextPasses }
      : next;

    const ok = await store.compareAndSwap(
      {
        code: storageCode,
        state: JSON.stringify(stored),
        version: row.version + 1,
        updated: now,
      },
      row.version,
    );

    if (ok) return { ...next, serverNow: now, revision: row.version + 1 };
  }
  throw new Error('Party room update conflict. Please retry.');
}

export async function joinPartyRoom(
  store: RoomStore,
  code: string,
  name: string,
  color: number,
  now = Date.now(),
): Promise<{ state: PartyRoomState; playerId: string; token: string }> {
  const playerId = crypto.randomUUID();
  const { token, hash } = await newPass();
  const player: PartyPlayer = {
    id: playerId,
    name: safeName(name, `Guest ${Math.floor(Math.random() * 900) + 100}`),
    color: safeColor(color),
    ready: false,
    score: 0,
    isHost: false,
  };

  const state = await updatePartyRoom(
    store,
    code,
    null,
    (room, passes) => {
      if (room.players.length >= 4) {
        throw new Error('This party room is already full (maximum 4 players).');
      }
      if (room.status !== 'lobby') {
        throw new Error('This party has already started.');
      }
      if (passes) passes[playerId] = hash;
      return {
        ...room,
        players: [...room.players, player],
      };
    },
    now,
  );

  return { state, playerId, token };
}

export async function leavePartyRoom(
  store: RoomStore,
  code: string,
  player: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  const playerId = player.id;
  return updatePartyRoom(
    store,
    code,
    player,
    (room, passes) => {
      if (passes) delete passes[playerId];
      const remaining = room.players.filter((p) => p.id !== playerId);
      if (remaining.length === 0) {
        return { ...room, players: [] };
      }
      let hostId = room.hostId;
      if (room.hostId === playerId) {
        const nextHuman = remaining.find((p) => !p.isBot) ?? remaining[0];
        nextHuman.isHost = true;
        nextHuman.ready = true;
        hostId = nextHuman.id;
      }
      return finishIfAllReported({
        ...room,
        hostId,
        players: remaining,
      });
    },
    now,
  );
}

export async function toggleReady(
  store: RoomStore,
  code: string,
  player: PartyPass,
  ready: boolean,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    player,
    (room) => {
      const players = room.players.map((p) =>
        p.id === player.id ? { ...p, ready } : p,
      );
      return { ...room, players };
    },
    now,
  );
}

export async function addBotToParty(
  store: RoomStore,
  code: string,
  host: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can add bots.');
      }
      if (room.status !== 'lobby')
        throw new Error('Bots can only join in the lobby.');
      if (room.players.length >= 4) {
        throw new Error('The party room is already full.');
      }
      const existingNames = new Set(room.players.map((p) => p.name));
      const botName =
        BOT_NAMES.find((n) => !existingNames.has(n)) ??
        `Bot ${room.players.length + 1}`;
      const usedColors = new Set(room.players.map((p) => p.color));
      let botColor = 0;
      for (let c = 0; c <= 3; c++) {
        if (!usedColors.has(c)) {
          botColor = c;
          break;
        }
      }

      const botPlayer: PartyPlayer = {
        id: `bot-${crypto.randomUUID().slice(0, 8)}`,
        name: botName,
        color: botColor,
        ready: true,
        score: 0,
        isHost: false,
        isBot: true,
      };

      return {
        ...room,
        players: [...room.players, botPlayer],
      };
    },
    now,
  );
}

export async function removePlayerFromParty(
  store: RoomStore,
  code: string,
  host: PartyPass,
  targetId: string,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room, passes) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can remove players.');
      }
      if (targetId === host.id) {
        throw new Error('Host cannot kick themselves.');
      }
      if (passes) delete passes[targetId];
      return finishIfAllReported({
        ...room,
        players: room.players.filter((p) => p.id !== targetId),
      });
    },
    now,
  );
}

export async function startPartyTournament(
  store: RoomStore,
  code: string,
  host: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can start the tournament.');
      }
      if (room.status !== 'lobby') return room;
      if (room.players.length < 2) {
        throw new Error('Need at least 2 players to start a party tournament.');
      }
      // Fill remaining seats with bots if needed to make 4 players
      const players = [...room.players];
      while (players.length < 4) {
        const existingNames = new Set(players.map((p) => p.name));
        const botName =
          BOT_NAMES.find((n) => !existingNames.has(n)) ??
          `Bot ${players.length + 1}`;
        const usedColors = new Set(players.map((p) => p.color));
        let botColor = 0;
        for (let c = 0; c <= 3; c++) {
          if (!usedColors.has(c)) {
            botColor = c;
            break;
          }
        }
        players.push({
          id: `bot-${crypto.randomUUID().slice(0, 8)}`,
          name: botName,
          color: botColor,
          ready: true,
          score: 0,
          isHost: false,
          isBot: true,
        });
      }

      // Ensure playlist has 6 games
      const playlist =
        room.playlist.length === 6 ? room.playlist : generatePlaylist(6);

      return {
        ...room,
        players,
        playlist,
        currentRound: 0,
        reports: undefined,
        status: 'countdown',
        countdownUntil: now + 4000,
      };
    },
    now,
  );
}

/**
 * Scores a round from per-player scores and moves on to the standings. A
 * round is only ever scored once.
 */
function finishRound(
  room: PartyRoomState,
  round: number,
  scores: Record<string, number>,
  detail: Pick<RoundResult, 'reports' | 'teams'> = {},
): PartyRoomState {
  if (
    room.currentRound !== round ||
    room.roundResults.some((result) => result.round === round)
  ) {
    return room; // Already recorded or out of sync
  }

  const currentGameId = room.playlist[round];
  const gameInfo = currentGameId ? getPartyGameInfo(currentGameId) : undefined;
  const isTeam = gameInfo?.teams ?? false;

  const scoreEntries = room.players.map((p) => ({
    playerId: p.id,
    score: scores[p.id] ?? 0,
  }));

  const pointsAwarded = calculateRoundPoints(scoreEntries, isTeam);

  // Find round winner
  let highestPts = -1;
  let winnerId: string | undefined;
  for (const [pId, pts] of Object.entries(pointsAwarded)) {
    if (pts > highestPts) {
      highestPts = pts;
      winnerId = pId;
    }
  }
  if (
    Object.values(pointsAwarded).filter((pts) => pts === highestPts).length > 1
  ) {
    winnerId = undefined;
  }

  const result: RoundResult = {
    round,
    game: currentGameId,
    scores,
    pointsAwarded,
    winnerId,
    ...detail,
  };

  // Accumulate scores
  const updatedPlayers = room.players.map((p) => ({
    ...p,
    score: p.score + (pointsAwarded[p.id] ?? 0),
  }));

  return {
    ...room,
    players: updatedPlayers,
    roundResults: [...room.roundResults, result],
    reports: undefined,
    status: 'intermission',
    intermission: undefined,
  };
}

/** Players are off playing the current round and may report results. */
const roundInPlay = (room: PartyRoomState) =>
  room.status === 'countdown' || room.status === 'in_game';

const humansOf = (room: PartyRoomState) => room.players.filter((p) => !p.isBot);

/**
 * Scores the current round from the humans' reports. A human who has not
 * reported yet counts as having given up.
 */
function scoreReportedRound(room: PartyRoomState): PartyRoomState {
  const round = room.currentRound;
  const reports: RoundReports = {};
  for (const human of humansOf(room)) {
    reports[human.id] = room.reports?.[human.id] ?? null;
  }
  const ids = room.players.map((p) => p.id);
  const game = getPartyGameInfo(room.playlist[round]);
  if (game?.teams) {
    const teams = roundTeams(ids, round);
    return finishRound(room, round, scoreTeamRound(teams, reports), {
      reports,
      teams,
    });
  }
  return finishRound(room, round, scoreGoalRound(ids, reports), { reports });
}

/** Scores the round as soon as the last human still playing has reported. */
function finishIfAllReported(room: PartyRoomState): PartyRoomState {
  const humans = humansOf(room);
  if (
    !roundInPlay(room) ||
    !humans.length ||
    humans.some((p) => room.reports?.[p.id] === undefined)
  ) {
    return room;
  }
  return scoreReportedRound(room);
}

/**
 * A human reports how their own match went, or gives up with a null result.
 * The first report stands, so a rematch after the round cannot improve it.
 */
export async function reportRoundResult(
  store: RoomStore,
  code: string,
  round: number,
  player: PartyPass,
  result: unknown,
  now = Date.now(),
): Promise<PartyRoomState> {
  const parsed = result === null ? null : parsePartyResult(result);
  if (result !== null && !parsed) {
    throw new Error('That round result could not be read.');
  }
  const playerId = player.id;
  return updatePartyRoom(
    store,
    code,
    player,
    (room) => {
      const player = room.players.find((p) => p.id === playerId);
      if (!player || player.isBot) {
        throw new Error('Only a player in this party can report a result.');
      }
      if (
        room.currentRound !== round ||
        !roundInPlay(room) ||
        room.reports?.[playerId] !== undefined
      ) {
        return room; // Late, early or already reported
      }
      const teams = getPartyGameInfo(room.playlist[round])?.teams ?? false;
      if (parsed && parsed.kind !== (teams ? 'versus' : 'goal')) {
        throw new Error('That result does not belong to this round.');
      }
      return finishIfAllReported({
        ...room,
        reports: { ...room.reports, [playerId]: parsed },
      });
    },
    now,
  );
}

/**
 * The host stops waiting and scores the round; anyone who has not reported
 * counts as having given up.
 */
export async function closePartyRound(
  store: RoomStore,
  code: string,
  round: number,
  host: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can close the round.');
      }
      if (room.currentRound !== round || !roundInPlay(room)) return room;
      return scoreReportedRound(room);
    },
    now,
  );
}

export async function advanceToNextRound(
  store: RoomStore,
  code: string,
  host: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can advance the round.');
      }
      // Compatibility for old clients: deadlines, not host clicks, advance.
      return room;
    },
    now,
  );
}

export async function rematchParty(
  store: RoomStore,
  code: string,
  host: PartyPass,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id) {
        throw new Error('Only the party host can trigger a rematch.');
      }
      if (room.status !== 'finished')
        throw new Error('Finish the tournament before starting a rematch.');
      const resetPlayers = room.players.map((p) => ({
        ...p,
        score: 0,
        ready: p.isHost,
      }));
      return {
        ...room,
        players: resetPlayers,
        playlist: generatePlaylist(6),
        currentRound: 0,
        roundResults: [],
        reports: undefined,
        intermission: undefined,
        status: 'lobby',
        countdownUntil: undefined,
      };
    },
    now,
  );
}

export async function voteForNextGame(
  store: RoomStore,
  code: string,
  round: number,
  player: PartyPass,
  game: GameId,
  now = Date.now(),
): Promise<PartyRoomState> {
  return updatePartyRoom(
    store,
    code,
    player,
    (room) => {
      const voter = room.players.find((seat) => seat.id === player.id);
      if (!voter || voter.isBot)
        throw new Error('Only a player in this party can vote.');
      const ballot = room.intermission;
      if (
        room.currentRound !== round ||
        room.status !== 'intermission' ||
        ballot?.phase !== 'voting' ||
        now >= ballot.endsAt
      ) {
        throw new Error('Voting is closed for this round.');
      }
      if (!ballot.candidates.includes(game))
        throw new Error('Choose one of the three games.');
      return {
        ...room,
        intermission: {
          ...ballot,
          votes: { ...ballot.votes, [player.id]: game },
        },
      };
    },
    now,
  );
}
