import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from 'livekit-server-sdk';
import { roomStore } from '@/db/rooms';
import { voiceConfig } from './config';
import {
  authorizeVoice,
  parseVoiceRoomName,
  storageCode,
  type VoiceRoom,
} from './membership';
import type { VoiceSession } from './types';

function service() {
  const c = voiceConfig();
  return c.url && c.key && c.secret && !c.disabled && c.sweep
    ? new RoomServiceClient(c.url.replace(/^ws/, 'http'), c.key, c.secret, {
        requestTimeout: 2,
      })
    : null;
}
let sweeping = false;
export async function sweepVoice() {
  const api = service();
  if (!api || sweeping) return;
  sweeping = true;
  try {
    for (const live of await api.listRooms()) {
      const match = parseVoiceRoomName(live.name);
      if (!match) continue;
      try {
        const row = await roomStore().get(storageCode(match.game, match.code));
        if (!row || Date.now() - row.updated > 60000) {
          await api.deleteRoom(live.name);
          continue;
        }
        const state = JSON.parse(row.state) as VoiceRoom;
        const allowed = new Set(
          state.world.players
            .filter((p) => state.members[p.id] && Date.now() - p.seen < 30000)
            .map((p) => p.id),
        );
        for (const peer of await api.listParticipants(live.name))
          if (!allowed.has(peer.identity))
            await api.removeParticipant(live.name, peer.identity);
      } catch {
        /* Retry provider cleanup on the next sweep. */
      }
    }
  } finally {
    sweeping = false;
  }
}
let timer: ReturnType<typeof setInterval> | undefined;
function startSweep() {
  if (!timer && service()) {
    timer = setInterval(() => void sweepVoice().catch(() => {}), 15000);
    (timer as unknown as { unref?: () => void }).unref?.();
  }
}
startSweep();
export async function voiceToken(body: VoiceSession & { op?: string }) {
  const { player, name } = await authorizeVoice(roomStore(), body);
  const c = voiceConfig(),
    api = service();
  if (!api)
    return {
      configured: false,
      message:
        'Voice chat is unavailable on this server. You can keep playing and try voice again later.',
    };
  if (body.op === 'leave') {
    await api.removeParticipant(name, player.id).catch(() => {});
    return { configured: true };
  }
  const token = new AccessToken(c.key!, c.secret!, {
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
  await api.createRoom({
    name,
    maxParticipants: 4,
    emptyTimeout: 120,
    departureTimeout: 20,
  });
  return { configured: true, url: c.url, token: await token.toJwt() };
}
