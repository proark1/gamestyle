import type { RoomStore } from '../rooms/types';
import { isGameId, type GameId } from '../audio/types';
import type { VoiceSession } from './types';
export type VoiceRoom = {
  members: Record<string, string>;
  world: { players: { id: string; name: string; seen: number }[] };
};
export const voiceRoomName = (game: GameId, code: string) =>
  `gamestyle-${game}-${code}`;
export function parseVoiceRoomName(name: string) {
  const match = /^gamestyle-(.+)-([A-Z2-9]{6})$/.exec(name);
  return match && isGameId(match[1])
    ? { game: match[1], code: match[2] }
    : null;
}
export const storageCode = (game: GameId, code: string) =>
  game === 'act-natural'
    ? `act:${code}`
    : game === 'uphill-delivery'
      ? `delivery:${code}`
      : game === 'dont-wake-the-giant'
        ? `giant:${code}`
        : code;
export async function authorizeVoice(
  store: RoomStore,
  body: VoiceSession,
  now = Date.now(),
) {
  if (
    !body ||
    !isGameId(body.game) ||
    typeof body.code !== 'string' ||
    !/^[A-Z2-9]{6}$/.test(body.code) ||
    typeof body.id !== 'string' ||
    body.id.length > 100 ||
    typeof body.token !== 'string' ||
    body.token.length > 100 ||
    !body.token
  )
    throw new Error('Invalid game pass.');
  const row = await store.get(storageCode(body.game, body.code));
  if (!row || now - row.updated > 60000) throw new Error('Room expired.');
  const room = JSON.parse(row.state) as VoiceRoom;
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(body.token),
      ),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  const player = room.world.players.find(
    (p) => p.id === body.id && now - p.seen < 30000,
  );
  if (!player || room.members[body.id] !== hash)
    throw new Error('Game pass expired.');
  return { player, name: voiceRoomName(body.game, body.code) };
}
