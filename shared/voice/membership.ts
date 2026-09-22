import type { RoomStore } from '../rooms/types';
import { isGame, type Game } from '../games/identity';
import type { VoiceSession } from './types';
import { ROOM_CODE_PATTERN, isRoomCode } from '../rooms/identity';
export type VoiceRoom = {
  members: Record<string, string>;
  world: { players: { id: string; name: string; seen: number }[] };
};
export const voiceRoomName = (game: Game | 'party', code: string) =>
  `gamestyle-${game}-${code}`;
// The game id is greedy-matched, so the code shape is what terminates the name.
const VOICE_ROOM_NAME = new RegExp(`^gamestyle-(.+)-(${ROOM_CODE_PATTERN})$`);
export function parseVoiceRoomName(name: string) {
  const match = VOICE_ROOM_NAME.exec(name);
  return match && (isGame(match[1]) || match[1] === 'party')
    ? { game: match[1] as Game | 'party', code: match[2] }
    : null;
}
export const storageCode = (game: Game | 'party', code: string) =>
  game === 'party'
    ? `party:${code}`
    : game === 'act-natural'
      ? `act:${code}`
      : game === 'uphill-delivery'
        ? `delivery:${code}`
        : game === 'dont-wake-the-giant'
          ? `giant:${code}`
          : game === 'shelf-control'
            ? `shelf:${code}`
            : game === 'stack-or-sink' ||
                game === 'chaos' ||
                game === 'first-person'
              ? code
              : `${game}:${code}`;
export async function authorizeVoice(
  store: Pick<RoomStore, 'get'>,
  body: VoiceSession,
  now = Date.now(),
) {
  if (
    !body ||
    (!isGame(body.game) && body.game !== 'party') ||
    typeof body.code !== 'string' ||
    !isRoomCode(body.code) ||
    typeof body.id !== 'string' ||
    body.id.length > 100 ||
    typeof body.token !== 'string' ||
    body.token.length > 100 ||
    !body.token
  )
    throw new Error('Invalid game pass.');
  const row = await store.get(storageCode(body.game, body.code));
  if (!row || now - row.updated > (body.game === 'party' ? 86400000 : 60000))
    throw new Error('Room expired.');
  const stored = JSON.parse(row.state);
  const room: VoiceRoom =
    body.game === 'party'
      ? {
          members: stored.passes ?? {},
          world: {
            players: (stored.players ?? [])
              .filter((p: { isBot?: boolean }) => !p.isBot)
              .map((p: { id: string; name: string }) => ({ ...p, seen: now })),
          },
        }
      : stored;
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
  return { player, room, name: voiceRoomName(body.game, body.code) };
}
