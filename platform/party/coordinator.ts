import { RoomError, type RoomStore } from '../../shared/rooms/types';
import {
  boundedPose,
  spawnPose,
  validPose,
  PLAZA_SPEED,
} from '../../shared/plaza/world';
import type { Look } from '../../shared/wardrobe/look';
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
  sharedRoundPoints,
  type RoundReports,
} from './scoring';
import type {
  PartyPass,
  PartyPlayer,
  PartyRoomState,
  RoundResult,
} from './types';
import {
  beginBriefing,
  progressBriefing,
  roundAssignments,
  PARTY_OFFLINE_MS,
  PARTY_RECONNECT_MS,
} from './flow';

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
type Accounts = Record<string, string | null>;
type StoredParty = PartyRoomState & { passes?: Passes; accounts?: Accounts };

function readParty(raw: string): {
  room: PartyRoomState;
  passes?: Passes;
  accounts?: Accounts;
} {
  const { passes, accounts, ...room } = JSON.parse(raw) as StoredParty;
  return { room, passes, accounts };
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
    seenAt: now,
    connected: true,
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newPartyCode();
    const playlist = generatePlaylist(6);
    const roomState: PartyRoomState = {
      code,
      hostId: playerId,
      status: 'lobby',
      format: 'classic',
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
  return intermissionDue(room, now) ||
    progressPresence(room, now) !== room ||
    progressBriefing(room, now) !== room
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
  updater: (
    current: PartyRoomState,
    passes?: Passes,
    accounts?: Accounts,
  ) => PartyRoomState,
  now = Date.now(),
): Promise<PartyRoomState> {
  const storageCode = partyStorageKey(code.toUpperCase());
  const hash = actor ? await passHash(actor.token) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await store.get(storageCode);
    if (!row) throw new RoomError('Party room not found.', 404);
    const { room, passes, accounts } = readParty(row.state);
    const nextAccounts = { ...accounts };
    if (actor) checkPass(passes, actor.id, hash);
    const nextPasses = passes && { ...passes };
    const present = actor
      ? {
          ...room,
          players: room.players.map((p) =>
            p.id === actor.id ? { ...p, seenAt: now, connected: true } : p,
          ),
        }
      : room;
    const current = progressBriefing(
      progressIntermission(progressPresence(present, now), now),
      now,
    );
    const next = {
      ...progressBriefing(
        progressIntermission(updater(current, nextPasses, nextAccounts), now),
        now,
      ),
      updated: now,
    };
    for (const id of Object.keys(nextAccounts))
      if (!next.players.some((p) => p.id === id)) delete nextAccounts[id];
    const stored: StoredParty = {
      ...next,
      ...(nextPasses ? { passes: nextPasses } : {}),
      accounts: nextAccounts,
    };

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
    seenAt: now,
    connected: true,
  };

  const state = await updatePartyRoom(
    store,
    code,
    null,
    (room, passes) => {
      room = { ...room, players: room.players.filter((p) => !p.isBot) };
      if (room.players.length >= 4) {
        throw new Error('This party room is already full (maximum 4 players).');
      }
      if (room.status !== 'lobby') {
        throw new Error('This party has already started.');
      }
      if (passes) passes[playerId] = hash;
      if (room.players.some((p) => p.color === player.color))
        player.color =
          [0, 1, 2, 3].find((c) => room.players.every((p) => p.color !== c)) ??
          player.color;
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
      if (room.status !== 'lobby')
        throw new Error('Ready can only change in the lobby.');
      if (ready && room.players.find((p) => p.id === player.id)?.browsing)
        throw new RoomError('Close the wardrobe before getting ready.', 409);
      const players = room.players.map((p) =>
        p.id === player.id ? { ...p, ready } : p,
      );
      return { ...room, players };
    },
    now,
  );
}

/** Appearance and account identity must be resolved by the route, not supplied by the player. */
export async function updateLobbyPresence(
  store: RoomStore,
  code: string,
  player: PartyPass,
  presence: {
    pose: unknown;
    browsing: boolean;
    look: Look;
    fullGame: boolean;
    accountId: string | null;
  },
  now = Date.now(),
) {
  if (!validPose(presence.pose) || typeof presence.browsing !== 'boolean')
    throw new RoomError('Invalid lobby position.');
  const requested = boundedPose(presence.pose);
  return updatePartyRoom(
    store,
    code,
    player,
    (room, _passes, accounts) => {
      const me = room.players.find((p) => p.id === player.id && !p.isBot);
      if (!me)
        throw new RoomError('Join the party before entering the plaza.', 401);
      if (room.status !== 'lobby') return room;
      const previous = me.lobbyPose ?? spawnPose(me.color);
      const distance = Math.hypot(
        requested.x - previous.x,
        requested.z - previous.z,
      );
      const maximum =
        Math.min(2, Math.max(0, (now - (me.lobbySeenAt ?? now - 350)) / 1000)) *
          PLAZA_SPEED +
        0.3;
      const ratio = distance > maximum ? maximum / distance : 1;
      const lobbyPose = {
        x: previous.x + (requested.x - previous.x) * ratio,
        z: previous.z + (requested.z - previous.z) * ratio,
        angle: requested.angle,
      };
      if (accounts) accounts[player.id] = presence.accountId;
      return {
        ...room,
        players: room.players.map((p) =>
          p.id === player.id
            ? {
                ...p,
                lobbyPose,
                lobbySeenAt: now,
                look: presence.look,
                fullGame: presence.fullGame,
                browsing: presence.browsing,
                ready: presence.browsing
                  ? false
                  : p.browsing && p.isHost
                    ? true
                    : p.ready,
              }
            : p,
        ),
      };
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
      const humans = room.players.filter((p) => !p.isBot);
      if (
        !humans.length ||
        humans.some((p) => p.connected === false || !p.ready || p.browsing)
      )
        throw new Error('Every player must be connected and ready.');
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

      const count = room.format === 'quick' ? 3 : 6;
      const playlist =
        room.playlist.length === count
          ? room.playlist
          : generatePlaylist(count, Math.random, room.format);

      return beginBriefing(
        {
          ...room,
          players,
          playlist,
          currentRound: 0,
          reports: undefined,
          status: 'countdown',
          runId: crypto.randomUUID(),
          practice: humans.length === 1,
          pausedAt: undefined,
          rematchVotes: [],
        },
        now,
      );
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

  const pointsAwarded =
    room.runId && detail.reports
      ? sharedRoundPoints(detail.reports, gameInfo?.scoring ?? 'cooperative')
      : calculateRoundPoints(scoreEntries, isTeam);

  // Find round winner
  let highestPts = -1;
  let winnerId: string | undefined;
  for (const [pId, pts] of Object.entries(pointsAwarded)) {
    if (pts > 0 && pts > highestPts) {
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
    ...(room.runId
      ? {
          scoring: gameInfo?.scoring,
          outcome: Object.values(detail.reports ?? {}).every((r) => r === null)
            ? ('skipped' as const)
            : Object.values(pointsAwarded).some((p) => p > 0)
              ? ('completed' as const)
              : ('failed' as const),
        }
      : {}),
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

function progressPresence(room: PartyRoomState, now: number): PartyRoomState {
  let changed = false;
  const players = room.players.map((p) => {
    if (
      p.isBot ||
      p.seenAt === undefined ||
      now - p.seenAt < PARTY_OFFLINE_MS ||
      p.connected === false
    )
      return p;
    changed = true;
    return { ...p, connected: false, ready: false };
  });
  const nextHost =
    players.find(
      (p) => p.id === room.hostId && p.connected !== false && !p.isBot,
    ) ?? players.find((p) => !p.isBot && p.connected !== false);
  let next =
    changed || (nextHost && nextHost.id !== room.hostId)
      ? {
          ...room,
          hostId: nextHost?.id ?? room.hostId,
          players: players.map((p) => ({
            ...p,
            isHost: p.id === (nextHost?.id ?? room.hostId),
            ready:
              room.status === 'lobby' && p.id === nextHost?.id ? true : p.ready,
          })),
        }
      : room;
  if (roundInPlay(next)) {
    const missing = players.filter(
      (p) =>
        !p.isBot &&
        p.seenAt !== undefined &&
        now - p.seenAt >= PARTY_RECONNECT_MS &&
        next.reports?.[p.id] === undefined,
    );
    if (missing.length)
      next = finishIfAllReported({
        ...next,
        reports: {
          ...next.reports,
          ...Object.fromEntries(missing.map((p) => [p.id, null])),
        },
      });
  }
  return next;
}

export async function partyPlayerAction(
  store: RoomStore,
  code: string,
  player: PartyPass,
  action: 'heartbeat' | 'briefing_ready' | 'vote_lock' | 'rematch_interest',
  round?: number,
  now = Date.now(),
) {
  return updatePartyRoom(
    store,
    code,
    player,
    (room) => {
      if (!room.players.some((p) => p.id === player.id && !p.isBot))
        throw new RoomError(
          'Your seat is no longer in this party. Join another party.',
          401,
        );
      if (action === 'heartbeat') return room;
      if (action === 'rematch_interest') {
        if (room.status !== 'finished')
          throw new Error('Finish the party first.');
        return {
          ...room,
          rematchVotes: [...new Set([...(room.rematchVotes ?? []), player.id])],
        };
      }
      if (room.currentRound !== round)
        throw new Error('This round has changed.');
      if (action === 'briefing_ready') {
        if (room.status !== 'briefing' || !room.briefing) return room;
        return {
          ...room,
          briefing: {
            ...room.briefing,
            ready: [...new Set([...room.briefing.ready, player.id])],
          },
        };
      }
      if (
        room.status !== 'intermission' ||
        room.intermission?.phase !== 'voting' ||
        !room.intermission.votes[player.id]
      )
        throw new Error('Choose a game before locking your vote.');
      return {
        ...room,
        intermission: {
          ...room.intermission,
          locked: [
            ...new Set([...(room.intermission.locked ?? []), player.id]),
          ],
        },
      };
    },
    now,
  );
}

export async function setPartyFormat(
  store: RoomStore,
  code: string,
  host: PartyPass,
  format: 'quick' | 'classic',
  now = Date.now(),
) {
  return updatePartyRoom(
    store,
    code,
    host,
    (room) => {
      if (room.hostId !== host.id || room.status !== 'lobby')
        throw new Error('Only the host can change the format in the lobby.');
      if (format !== 'quick' && format !== 'classic')
        throw new Error('Choose Quick Party or Classic Party.');
      return {
        ...room,
        format,
        playlist: generatePlaylist(
          format === 'quick' ? 3 : 6,
          Math.random,
          format,
        ),
        players: room.players.map((p) => ({
          ...p,
          ready: p.isHost || !!p.isBot,
        })),
      };
    },
    now,
  );
}

export async function pauseParty(
  store: RoomStore,
  code: string,
  player: PartyPass,
  paused: boolean,
  now = Date.now(),
) {
  return updatePartyRoom(
    store,
    code,
    player,
    (room) => {
      if (!room.players.some((p) => p.id === player.id && !p.isBot))
        throw new Error('Join the party first.');
      if (!['briefing', 'intermission'].includes(room.status))
        throw new Error('Take a break between rounds.');
      if (!paused && room.hostId !== player.id)
        throw new Error('The host resumes the party when everyone is back.');
      if (paused)
        return room.pausedAt === undefined ? { ...room, pausedAt: now } : room;
      if (room.pausedAt === undefined) return room;
      const delay = now - room.pausedAt;
      return {
        ...room,
        pausedAt: undefined,
        ...(room.briefing
          ? {
              briefing: {
                ...room.briefing,
                startedAt: room.briefing.startedAt + delay,
              },
            }
          : {}),
        ...(room.intermission
          ? {
              intermission: {
                ...room.intermission,
                startedAt: room.intermission.startedAt + delay,
                endsAt: room.intermission.endsAt + delay,
              },
            }
          : {}),
      };
    },
    now,
  );
}

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
  if (room.runId) {
    const scores = game?.teams
      ? Object.fromEntries(
          Object.entries(reports).map(([id, r]) => [
            id,
            r?.kind === 'versus'
              ? { won: 1, draw: 0.5, lost: 0 }[r.outcome]
              : -1,
          ]),
        )
      : Object.fromEntries(
          Object.entries(reports).map(([id, r]) => [
            id,
            r?.kind === 'goal' ? r.score : 0,
          ]),
        );
    return finishRound(room, round, scores, {
      reports,
      ...(game?.teams ? { teams: roundAssignments(room) } : {}),
    });
  }
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
        playlist: generatePlaylist(
          room.format === 'quick' ? 3 : 6,
          Math.random,
          room.format,
        ),
        currentRound: 0,
        roundResults: [],
        reports: undefined,
        intermission: undefined,
        status: 'lobby',
        countdownUntil: undefined,
        briefing: undefined,
        pausedAt: undefined,
        rematchVotes: [],
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
          locked: ballot.locked?.filter((id) => id !== player.id),
        },
      };
    },
    now,
  );
}
