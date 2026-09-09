import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from 'livekit-server-sdk';
import { getBinding } from '@/db/index';
import { voiceConfig } from '../../../shared/voice/config';
import type { World } from '../model';
type Credentials = { code: string; id: string; token: string };
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
let sweeping = false;
let timer: ReturnType<typeof setInterval> | undefined;
function service() {
  const c = voiceConfig();
  return c.url && c.key && c.secret && !c.disabled
    ? new RoomServiceClient(c.url.replace(/^ws/, 'http'), c.key, c.secret, {
        requestTimeout: 2,
      })
    : null;
}
export async function sweepVoice() {
  if (sweeping) return;
  const api = service();
  if (!api) return;
  sweeping = true;
  try {
    // Discover provider rooms too: revocation must survive a game-server restart.
    const live = (await api.listRooms()).filter((room) =>
      /^handwerker-chaos-[a-f0-9-]{36}$/.test(room.name),
    );
    if (!live.length) return;
    const stored = await getBinding()
      .prepare('SELECT code, world FROM handwerker_rooms WHERE updated > ?')
      .bind(Date.now() - 86400000)
      .all<{ code: string; world: string }>();
    const codes = new Map<string, string>(
      stored.results.flatMap((row) => {
        const world = JSON.parse(row.world) as World;
        return world.party
          ? [[`handwerker-chaos-${world.party.roomId}`, row.code] as const]
          : [];
      }),
    );
    for (const { name } of live) {
      const code = codes.get(name);
      if (!code) {
        await api.deleteRoom(name);
        continue;
      }
      const { results } = await getBinding()
        .prepare(
          'SELECT id FROM handwerker_players WHERE room = ? AND seen > ?',
        )
        .bind(code, Date.now() - 60000)
        .all<{ id: string }>();
      const allowed = new Set(results.map((p) => p.id));
      try {
        const members = await api.listParticipants(name);
        for (const p of members)
          if (!allowed.has(p.identity))
            await api.removeParticipant(name, p.identity);
      } catch {
        /* A room can close between discovery and membership lookup. */
      }
    }
  } finally {
    sweeping = false;
  }
}
export async function leaveVoice(code: string, id: string) {
  const api = service();
  if (!api) return;
  const row = await getBinding()
    .prepare('SELECT world FROM handwerker_rooms WHERE code = ?')
    .bind(code)
    .first<{ world: string }>();
  const world = row ? (JSON.parse(row.world) as World) : null;
  if (world?.party)
    await api
      .removeParticipant(`handwerker-chaos-${world.party.roomId}`, id)
      .catch(() => {});
}
export async function voiceToken(body: Credentials) {
  if (
    !body ||
    typeof body.code !== 'string' ||
    typeof body.id !== 'string' ||
    typeof body.token !== 'string' ||
    body.token.length > 100
  )
    throw new Error('A valid site pass is required.');
  const code = body.code.toUpperCase();
  const player = await getBinding()
    .prepare(
      'SELECT id, name FROM handwerker_players WHERE room = ? AND id = ? AND token_hash = ? AND seen > ?',
    )
    .bind(code, body.id, await hash(body.token), Date.now() - 60000)
    .first<{ id: string; name: string }>();
  if (!player) throw new Error('Your site pass has expired. Rejoin the game.');
  const row = await getBinding()
    .prepare('SELECT world FROM handwerker_rooms WHERE code = ?')
    .bind(code)
    .first<{ world: string }>();
  const world = row ? (JSON.parse(row.world) as World) : null;
  if (!world?.party) throw new Error('Start a new crew site to use voice.');
  const c = voiceConfig();
  if (!c.url || !c.key || !c.secret || c.disabled || !c.sweep)
    return {
      configured: false as const,
      message: 'Voice is being prepared. Building and crew jobs are available.',
    };
  const name = `handwerker-chaos-${world.party.roomId}`;
  const token = new AccessToken(c.key, c.secret, {
    identity: player.id,
    name: player.name,
    ttl: 120,
  });
  token.addGrant({
    room: name,
    roomJoin: true,
    canPublish: true,
    canPublishSources: [TrackSource.MICROPHONE],
    canSubscribe: true,
    canPublishData: false,
  });
  startSweep();
  await service()!.createRoom({
    name,
    maxParticipants: 4,
    emptyTimeout: 120,
    departureTimeout: 20,
  });
  return { configured: true as const, url: c.url, token: await token.toJwt() };
}
function startSweep() {
  const c = voiceConfig();
  if (c.sweep && service() && !timer) {
    timer = setInterval(() => void sweepVoice().catch(() => {}), 15000);
    (timer as unknown as { unref?: () => void }).unref?.();
  }
}
startSweep();
