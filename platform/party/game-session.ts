import type { RoomStore } from '../../shared/rooms/types';
import { RoomError } from '../../shared/rooms/types';
import { hashToken, newRoomCode } from '../../shared/rooms/identity';
import { reservePartyPeerRoom } from '../../shared/peer/coordinator';
import type { PartyRoomState } from './types';
import type { PeerSession } from '../../shared/peer/types';

/** Assignment is inserted once; races use the winner's room, never create duplicate seats. */
export async function partyGameSession(
  store: RoomStore,
  code: string,
  id: string,
  token: string,
  round: number,
  now = Date.now(),
): Promise<PeerSession> {
  const row = await store.get(`party:${code}`);
  if (!row || now - row.updated > 86400000)
    throw new RoomError('Party not found.', 404);
  const party = JSON.parse(row.state) as PartyRoomState & {
    passes?: Record<string, string>;
  };
  if (
    typeof token !== 'string' ||
    typeof id !== 'string' ||
    !token ||
    token.length > 100 ||
    party.passes?.[id] !== (await hashToken(token)) ||
    !party.players.some((p) => p.id === id && !p.isBot)
  )
    throw new RoomError('Rejoin the party to play.', 401);
  if (
    party.currentRound !== round ||
    party.status !== 'countdown' ||
    party.reports?.[id] !== undefined
  )
    throw new RoomError('This party round is no longer available.', 409);
  const game = party.playlist[round];
  const run = party.runId ?? String(party.countdownUntil);
  const key = `party-round:${code}:${run}:${round}`;
  let assignment = await store.get(key);
  if (!assignment) {
    await store.insert({
      code: key,
      state: JSON.stringify({ code: newRoomCode() }),
      version: 0,
      updated: now,
    });
    assignment = await store.get(key);
  }
  if (!assignment)
    throw new RoomError('Preparing the round. Retry shortly.', 503);
  const gameCode = (JSON.parse(assignment.state) as { code: string }).code;
  await reservePartyPeerRoom(
    store,
    game,
    gameCode,
    party.players.filter((p) => !p.isBot),
    party.passes!,
    { code, round, run },
    now,
    id,
  );
  return { game, code: gameCode, id, token, peer: true };
}
