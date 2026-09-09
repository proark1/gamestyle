import { playerName, hashToken as hash } from '../rooms/identity';
import type { RoomStore } from '../rooms/types';
import { isGameId } from '../audio/types';
import { newCheckpointKey } from './crypto';
import { changeNpcSlots, type NpcRoster } from '../rooms/npc-slots';
import {
  HOST_LEASE_MS,
  MEMBER_TTL_MS,
  MAX_CHECKPOINT,
  MAX_SIGNAL_BYTES,
  PeerError,
  type Member,
  type DeliveredSignal,
  type SealedCheckpoint,
  type PeerReply,
  type PeerView,
  type Signal,
} from './types';

type Room = {
  host: string;
  epoch: number;
  key: string;
  members: Member[];
  tokens: Record<string, string>;
  nextOrder: number;
  serial: number;
  signals: DeliveredSignal[];
  open: boolean;
  checkpoint?: SealedCheckpoint & { key: string };
  receipts: string[];
  npcs?: NpcRoster;
  npcReceipts?: string[];
};
export const peerStorageCode = (game: string, code: string) =>
  `peer:${game}:${code}`;
const nameOf = (value: unknown) => playerName(value, 'Player');
const supportsNpcRoster = (game: string) =>
  game === 'uphill-delivery' || game === 'four-brain-cells';
const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
function remove(room: Room, id: string) {
  room.members = room.members.filter((m) => m.id !== id);
  delete room.tokens[id];
  room.signals = room.signals.filter((s) => s.from !== id && s.to !== id);
}
function elect(room: Room, now: number) {
  const host = room.members.find((m) => m.id === room.host);
  if (host && now - host.seen < HOST_LEASE_MS) return;
  if (host) remove(room, host.id);
  room.host =
    room.members
      .filter((m) => m.instance && now - m.seen < HOST_LEASE_MS)
      .sort((a, b) => a.order - b.order)[0]?.id ?? '';
  room.epoch++;
  room.key = newCheckpointKey();
}
export function peerIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
  const urls = process.env.PEER_TURN_URLS?.split(',')
    .map((v) => v.trim())
    .filter((v) => /^turns?:[^\s]+$/.test(v));
  if (
    urls?.length &&
    process.env.PEER_TURN_USERNAME &&
    process.env.PEER_TURN_CREDENTIAL
  ) {
    servers.push({
      urls,
      username: process.env.PEER_TURN_USERNAME,
      credential: process.env.PEER_TURN_CREDENTIAL,
    });
  }
  return servers;
}
function view(
  room: Room,
  code: string,
  game: PeerView['game'],
  id: string,
  cursor: number,
  now: number,
  recover: boolean,
): PeerView {
  const self = room.members.find((m) => m.id === id);
  const signals = room.signals.filter(
    (s) => s.to === id && s.instance === self?.instance && s.serial > cursor,
  );
  const iceServers = peerIceServers();
  return {
    code,
    game,
    host: room.host,
    epoch: room.epoch,
    members: room.members,
    ...(supportsNpcRoster(game)
      ? { npcs: room.npcs ?? { revision: 0, slots: [] } }
      : {}),
    now,
    leaseUntil:
      (room.members.find((m) => m.id === room.host)?.seen ??
        now - HOST_LEASE_MS) + HOST_LEASE_MS,
    open: room.open,
    signals,
    cursor: signals.at(-1)?.serial ?? cursor,
    iceServers,
    relayConfigured: iceServers.length > 1,
    ...(id === room.host
      ? {
          key: room.key,
          ...(recover && room.checkpoint
            ? { checkpoint: room.checkpoint }
            : {}),
        }
      : {}),
  };
}
function validateSignal(value: unknown): Signal {
  if (!value || typeof value !== 'object')
    throw new PeerError('Invalid connection signal.');
  const s = value as Signal;
  if (!uuid(s.id) || !uuid(s.to) || !uuid(s.instance) || !uuid(s.link))
    throw new PeerError('Invalid connection signal.');
  if (s.description) {
    if (
      !['offer', 'answer'].includes(s.description.type) ||
      typeof s.description.sdp !== 'string' ||
      s.description.sdp.length > 16000
    )
      throw new PeerError('Invalid connection description.');
    return {
      id: s.id,
      to: s.to,
      instance: s.instance,
      link: s.link,
      description: { type: s.description.type, sdp: s.description.sdp },
    };
  } else if (s.candidate) {
    if (
      typeof s.candidate.candidate !== 'string' ||
      s.candidate.candidate.length > 2000 ||
      (s.candidate.sdpMid != null &&
        (typeof s.candidate.sdpMid !== 'string' ||
          s.candidate.sdpMid.length > 256)) ||
      (s.candidate.usernameFragment != null &&
        (typeof s.candidate.usernameFragment !== 'string' ||
          s.candidate.usernameFragment.length > 256)) ||
      (s.candidate.sdpMLineIndex != null &&
        (!Number.isInteger(s.candidate.sdpMLineIndex) ||
          s.candidate.sdpMLineIndex < 0 ||
          s.candidate.sdpMLineIndex > 65535))
    )
      throw new PeerError('Invalid connection candidate.');
    return {
      id: s.id,
      to: s.to,
      instance: s.instance,
      link: s.link,
      candidate: {
        candidate: s.candidate.candidate,
        sdpMid: s.candidate.sdpMid ?? null,
        sdpMLineIndex: s.candidate.sdpMLineIndex ?? null,
        usernameFragment: s.candidate.usernameFragment ?? null,
      },
    };
  } else throw new PeerError('Missing connection signal.');
}
export async function handlePeerRoom(
  store: RoomStore,
  body: Record<string, unknown>,
  now = Date.now(),
): Promise<PeerReply> {
  const game = body.game;
  if (!isGameId(game)) throw new PeerError('Unknown game.');
  const op = body.op;
  if (
    ![
      'create',
      'join',
      'hello',
      'poll',
      'signal',
      'checkpoint',
      'lock',
      'leave',
      'npc',
    ].includes(String(op))
  )
    throw new PeerError('Unknown room operation.');
  if (op === 'create') {
    const id = crypto.randomUUID(),
      token = crypto.randomUUID() + crypto.randomUUID();
    for (let attempt = 0; attempt < 8; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from(
        crypto.getRandomValues(new Uint8Array(6)),
        (b) => alphabet[b % alphabet.length],
      ).join('');
      const color = Number.isInteger(body.color)
        ? Math.max(0, Math.min(3, Number(body.color)))
        : 0;
      const room: Room = {
        host: id,
        epoch: 1,
        key: newCheckpointKey(),
        members: [
          {
            id,
            name: nameOf(body.name),
            order: 0,
            color,
            instance: '',
            seen: now,
          },
        ],
        tokens: { [id]: await hash(token) },
        nextOrder: 1,
        serial: 0,
        signals: [],
        open: true,
        receipts: [],
      };
      if (
        await store.insert({
          code: peerStorageCode(game, code),
          state: JSON.stringify(room),
          version: 0,
          updated: now,
        })
      )
        return {
          session: { game, code, id, token, peer: true },
          view: view(room, code, game, id, 0, now, true),
        };
    }
    throw new PeerError('Could not create a room. Try again.', 503);
  }
  const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
  if (!/^[A-Z2-9]{6}$/.test(code))
    throw new PeerError('Enter the six-character room code.');
  const joining = op === 'join';
  const id = joining ? crypto.randomUUID() : body.id,
    token = joining ? crypto.randomUUID() + crypto.randomUUID() : body.token;
  if (!uuid(id) || typeof token !== 'string' || !token || token.length > 100)
    throw new PeerError('Rejoin with your room code.', 401);
  const tokenHash = await hash(token);
  const cursor =
    Number.isSafeInteger(body.cursor) && Number(body.cursor) >= 0
      ? Number(body.cursor)
      : 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    const row = await store.get(peerStorageCode(game, code));
    if (!row || now - row.updated > 86400000)
      throw new PeerError(
        'Room not found. Check the code or create a new room.',
        404,
      );
    const room = JSON.parse(row.state) as Room;
    if (!joining && room.tokens[id] !== tokenHash)
      throw new PeerError(
        'Your room pass expired. Rejoin with the room code.',
        401,
      );
    const oldEpoch = room.epoch;
    // Expire authority before refreshing the caller: an old host cannot revive a dead lease.
    elect(room, now);
    for (const m of room.members)
      if (now - m.seen >= MEMBER_TTL_MS) remove(room, m.id);
    if (joining) {
      if (!room.host)
        throw new PeerError('This room has ended. Create a new room.', 404);
      if (room.members.length + (room.npcs?.slots.length ?? 0) >= 4)
        throw new PeerError('This room already has four players.', 409);
      if (!room.open)
        throw new PeerError('A round is in progress. Join after it ends.', 409);
      const color =
        [0, 1, 2, 3].find(
          (c) =>
            ![...room.members, ...(room.npcs?.slots ?? [])].some(
              (m) => m.color === c,
            ),
        ) ?? 0;
      room.members.push({
        id,
        name: nameOf(body.name),
        order: room.nextOrder++,
        color,
        instance: '',
        seen: now,
      });
      room.tokens[id] = tokenHash;
    } else {
      const member: Member | undefined = room.members.find((m) => m.id === id);
      if (!member) {
        // Persist election even when the expired host is the first caller after a timeout.
        if (
          await store.compareAndSwap(
            {
              ...row,
              state: JSON.stringify(room),
              updated: now,
              version: row.version + 1,
            },
            row.version,
          )
        )
          throw new PeerError(
            'Your connection expired. Rejoin with the room code.',
            401,
          );
        continue;
      }
      if (op === 'hello') {
        if (!uuid(body.instance))
          throw new PeerError('Invalid browser session.');
        if (
          member.instance !== body.instance &&
          member.id === room.host &&
          member.instance
        ) {
          room.epoch++;
          room.key = newCheckpointKey();
        }
        member.instance = body.instance;
      } else if (
        typeof body.instance !== 'string' ||
        body.instance !== member.instance
      )
        throw new PeerError(
          'This game is open in another tab. Rejoin here to continue.',
          401,
        );
      member.seen = now;
      if (op === 'npc') {
        if (!supportsNpcRoster(game))
          throw new PeerError('NPC slots are not supported by this game.');
        if (room.host !== id || body.epoch !== room.epoch)
          throw new PeerError(
            'Only the current crew leader can manage NPCs.',
            403,
          );
        if (!uuid(body.requestId))
          throw new PeerError('Missing NPC request identifier.');
        const receipt = `${id}:${body.requestId}`;
        if (!(room.npcReceipts ?? []).includes(receipt)) {
          if (!room.open)
            throw new PeerError(
              game === 'four-brain-cells'
                ? 'Finish this breakfast before changing NPCs.'
                : 'Finish this delivery before changing NPCs.',
              409,
            );
          try {
            room.npcs = {
              revision: (room.npcs?.revision ?? 0) + 1,
              slots: changeNpcSlots(
                room.npcs?.slots ?? [],
                room.members,
                body.action,
              ),
            };
          } catch (error) {
            throw new PeerError(
              error instanceof Error ? error.message : 'Invalid NPC request.',
            );
          }
          room.npcReceipts = [...(room.npcReceipts ?? []), receipt].slice(-128);
        }
      }
      if (op === 'leave') {
        remove(room, id);
        elect(room, now);
      }
      if (op === 'checkpoint' || op === 'lock') {
        if (room.host !== id || body.epoch !== room.epoch)
          throw new PeerError('The room has a new host. Reconnecting…', 409);
        if (op === 'lock') {
          room.open = false;
          if (supportsNpcRoster(game))
            room.npcs = {
              revision: (room.npcs?.revision ?? 0) + 1,
              slots: room.npcs?.slots ?? [],
            };
        } else {
          if (
            supportsNpcRoster(game) &&
            (body.rosterRevision ?? 0) !== (room.npcs?.revision ?? 0)
          )
            throw new PeerError(
              'The crew changed. Synchronize before saving.',
              409,
            );
          const cp = body.checkpoint as SealedCheckpoint;
          if (
            !cp ||
            cp.epoch !== room.epoch ||
            !Number.isSafeInteger(cp.seq) ||
            cp.seq < 0 ||
            typeof cp.iv !== 'string' ||
            !/^[A-Za-z0-9+/]{16}$/.test(cp.iv) ||
            typeof cp.data !== 'string' ||
            cp.data.length > MAX_CHECKPOINT ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(cp.data)
          )
            throw new PeerError('Invalid recovery checkpoint.');
          if (
            !room.checkpoint ||
            cp.epoch > room.checkpoint.epoch ||
            cp.seq > room.checkpoint.seq
          ) {
            room.checkpoint = {
              epoch: cp.epoch,
              seq: cp.seq,
              iv: cp.iv,
              data: cp.data,
              key: room.key,
            };
            room.open = body.open === true;
          }
        }
      }
      const outgoing = body.signals;
      if (outgoing !== undefined) {
        if (!Array.isArray(outgoing) || outgoing.length > 32)
          throw new PeerError('Too many connection signals.');
        for (const value of outgoing) {
          const signal = validateSignal(value);
          const target = room.members.find(
            (m) => m.id === signal.to && m.instance === signal.instance,
          );
          if (
            !target ||
            target.id === id ||
            room.receipts.includes(`${id}:${signal.id}`)
          )
            continue;
          room.signals.push({
            id: signal.id,
            to: signal.to,
            instance: signal.instance,
            link: signal.link,
            ...(signal.description
              ? { description: signal.description }
              : { candidate: signal.candidate }),
            from: id,
            fromInstance: member.instance,
            serial: ++room.serial,
            at: now,
          });
          room.receipts.push(`${id}:${signal.id}`);
        }
      }
      room.signals = room.signals
        .filter(
          (s) => now - s.at < 20000 && !(s.to === id && s.serial <= cursor),
        )
        .slice(-192);
      room.receipts = room.receipts.slice(-384);
      if (
        new TextEncoder().encode(JSON.stringify(room.signals)).byteLength >
        MAX_SIGNAL_BYTES
      )
        throw new PeerError(
          'Connection signal queue is full. Please retry shortly.',
          429,
        );
    }
    const next = {
      ...row,
      state: JSON.stringify(room),
      version: row.version + 1,
      updated: now,
    };
    if (await store.compareAndSwap(next, row.version))
      return {
        ...(joining
          ? { session: { game, code, id, token, peer: true as const } }
          : {}),
        view: view(
          room,
          code,
          game,
          id,
          cursor,
          now,
          op === 'hello' ||
            room.epoch !== oldEpoch ||
            body.epoch !== room.epoch ||
            body.recover === true,
        ),
      };
  }
  throw new PeerError('The room is busy. Reconnecting…', 503);
}
