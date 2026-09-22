import { authorizeVoice } from './membership';
import type { VoiceSession } from './types';
import type { RoomStore } from '../rooms/types';
import { peerIceServers, validateSignal } from '../peer/coordinator';
import {
  PeerError,
  MAX_SIGNAL_BYTES,
  type Member,
  type DeliveredSignal,
  type PeerReply,
} from '../peer/types';

type VoiceRoom = {
  members: Member[];
  fences?: Record<string, { instance: string; order: number }>;
  signals: DeliveredSignal[];
  serial: number;
  nextOrder: number;
  receipts: string[];
};
const validInstance = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);

/** Only signaling is stored here. Audio uses the same browser PeerMesh as gameplay rooms. */
export async function handleVoicePeer(
  store: RoomStore,
  membership: Pick<RoomStore, 'get'>,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<PeerReply> {
  if (!['hello', 'poll', 'signal', 'leave'].includes(String(body.op)))
    throw new PeerError('Unknown voice operation.');
  let auth;
  try {
    auth = await authorizeVoice(membership, body as VoiceSession, now);
  } catch {
    throw new PeerError(
      'Your game session expired. Rejoin the game to use voice.',
      401,
    );
  }
  if (!validInstance(body.instance))
    throw new PeerError('Invalid browser session.');
  const session = body as VoiceSession;
  const code = `voice-peer:${session.game}:${session.code}`;
  const allowed = new Set(
    auth.room.world.players
      .filter((p) => auth.room.members[p.id] && now - p.seen < 30000)
      .map((p) => p.id),
  );
  const cursor =
    Number.isSafeInteger(body.cursor) && Number(body.cursor) >= 0
      ? Number(body.cursor)
      : 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    const row = await store.get(code);
    const state: VoiceRoom =
      row && now - row.updated < 86400000
        ? JSON.parse(row.state)
        : { members: [], signals: [], serial: 0, nextOrder: 0, receipts: [] };
    state.fences ??= Object.fromEntries(
      state.members.map((m) => [
        m.id,
        { instance: m.instance, order: m.order },
      ]),
    );
    for (const id of Object.keys(state.fences))
      if (!allowed.has(id)) delete state.fences[id];
    state.members = state.members.filter(
      (m) => allowed.has(m.id) && now - m.seen < 15000,
    );
    let member = state.members.find((m) => m.id === session.id);
    const recovered =
      body.op === 'poll' &&
      !member &&
      state.fences[session.id]?.instance === body.instance;
    if (body.op === 'hello' || recovered) {
      if (!member) {
        member = {
          id: session.id,
          name: auth.player.name,
          color: 0,
          order: recovered ? state.fences[session.id].order : state.nextOrder++,
          instance: body.instance,
          seen: now,
        };
        state.members.push(member);
      }
      member.instance = body.instance;
      state.fences[session.id] = {
        instance: body.instance,
        order: member.order,
      };
    } else if (!member || member.instance !== body.instance) {
      throw new PeerError(
        'Voice session expired. Leave voice and join again.',
        401,
      );
    }
    member!.seen = now;
    if (body.op === 'leave') {
      state.members = state.members.filter((m) => m.id !== session.id);
      delete state.fences[session.id];
    }
    if (body.signals !== undefined) {
      if (
        body.op !== 'signal' ||
        !Array.isArray(body.signals) ||
        body.signals.length > 32
      )
        throw new PeerError('Invalid voice signals.');
      for (const value of body.signals) {
        const signal = validateSignal(value);
        if (
          !state.members.some(
            (m) => m.id === signal.to && m.instance === signal.instance,
          ) ||
          signal.to === session.id ||
          state.receipts.includes(`${session.id}:${signal.id}`)
        )
          continue;
        state.signals.push({
          ...signal,
          from: session.id,
          fromInstance: body.instance,
          serial: ++state.serial,
          at: now,
        });
        state.receipts.push(`${session.id}:${signal.id}`);
      }
    }
    state.signals = state.signals.filter(
      (s) =>
        now - s.at < 20000 &&
        !(s.to === session.id && s.serial <= cursor) &&
        state.members.some(
          (m) => m.id === s.from && m.instance === s.fromInstance,
        ) &&
        state.members.some((m) => m.id === s.to && m.instance === s.instance),
    );
    state.receipts = state.receipts.slice(-384);
    if (
      state.signals.length > 192 ||
      new TextEncoder().encode(JSON.stringify(state.signals)).byteLength >
        MAX_SIGNAL_BYTES
    )
      throw new PeerError('Voice signal queue is full. Retry shortly.', 429);
    const next = {
      code,
      state: JSON.stringify(state),
      version: (row?.version ?? -1) + 1,
      updated: now,
    };
    if (
      row
        ? await store.compareAndSwap(next, row.version)
        : await store.insert(next)
    ) {
      const signals = state.signals.filter(
        (s) =>
          s.to === session.id &&
          s.instance === body.instance &&
          s.serial > cursor,
      );
      const iceServers = peerIceServers();
      return {
        view: {
          game: session.game,
          code: session.code,
          host: '',
          epoch: 1,
          members: state.members,
          now,
          leaseUntil: now + 15000,
          open: true,
          signals,
          cursor: signals.at(-1)?.serial ?? cursor,
          iceServers,
          relayConfigured: iceServers.length > 1,
          relayOnly: process.env.PEER_RELAY_ONLY === '1',
          voiceRecovered: recovered,
        },
      };
    }
  }
  throw new PeerError('Voice room is busy. Retry shortly.', 503);
}
