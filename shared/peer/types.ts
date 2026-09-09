import type { GameId } from '../audio/types';
import type { Session } from '../rooms/session';
import type { NpcRoster } from '../rooms/npc-slots';

export const HOST_LEASE_MS = 8000;
export const MEMBER_TTL_MS = 15000;
export const MAX_CHECKPOINT = 240_000;
export const MAX_SIGNAL_BYTES = 128_000;
export type PeerSession = Session & { game: GameId; peer: true };
export type Member = {
  id: string;
  name: string;
  order: number;
  color: number;
  instance: string;
  seen: number;
};
export type Signal = {
  id: string;
  to: string;
  instance: string;
  link: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};
export type DeliveredSignal = Signal & {
  from: string;
  fromInstance: string;
  serial: number;
  at: number;
};
export type SealedCheckpoint = {
  epoch: number;
  seq: number;
  iv: string;
  data: string;
};
export type PeerView = {
  code: string;
  game: GameId;
  host: string;
  epoch: number;
  members: Member[];
  npcs?: NpcRoster;
  now: number;
  leaseUntil: number;
  open: boolean;
  signals: DeliveredSignal[];
  cursor: number;
  iceServers: RTCIceServer[];
  relayConfigured: boolean;
  // Only the currently elected host receives checkpoint keys or recovery state.
  key?: string;
  checkpoint?: SealedCheckpoint & { key: string };
};
export type PeerReply = { session?: PeerSession; view: PeerView };
export class PeerError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
