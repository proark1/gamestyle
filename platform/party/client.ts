import type { PartyResult } from '../../shared/ui/party-round';
import type { PartyAction, PartyPass, PartyRoomState } from './types';

async function partyRequest<T>(action: PartyAction): Promise<T> {
  const res = await fetch('/api/party', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
    cache: 'no-store',
  });

  const data = (await res.json()) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error ?? 'Party request failed.');
  }
  return data;
}

type Seat = { state: PartyRoomState; playerId: string; token: string };

export async function createParty(
  hostName: string,
  color: number,
): Promise<Seat> {
  return partyRequest({ op: 'create', hostName, color });
}

export async function joinParty(
  code: string,
  name: string,
  color: number,
): Promise<Seat> {
  return partyRequest({ op: 'join', code, name, color });
}

export async function getParty(code: string): Promise<PartyRoomState | null> {
  try {
    const data = await partyRequest<{ state: PartyRoomState | null }>({
      op: 'get',
      code,
    });
    return data.state;
  } catch {
    return null;
  }
}

async function stateOf(action: PartyAction): Promise<PartyRoomState> {
  return (await partyRequest<{ state: PartyRoomState }>(action)).state;
}

export function togglePartyReady(
  code: string,
  player: PartyPass,
  ready: boolean,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'ready',
    code,
    playerId: player.id,
    token: player.token,
    ready,
  });
}

export function addPartyBot(
  code: string,
  host: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({ op: 'add_bot', code, hostId: host.id, token: host.token });
}

export function removePartyPlayer(
  code: string,
  host: PartyPass,
  targetId: string,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'remove_player',
    code,
    hostId: host.id,
    token: host.token,
    targetId,
  });
}

export function startParty(
  code: string,
  host: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({ op: 'start', code, hostId: host.id, token: host.token });
}

export function reportPartyResult(
  code: string,
  round: number,
  player: PartyPass,
  result: PartyResult | null,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'report_result',
    code,
    round,
    playerId: player.id,
    token: player.token,
    result,
  });
}

export function closePartyRound(
  code: string,
  round: number,
  host: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'close_round',
    code,
    round,
    hostId: host.id,
    token: host.token,
  });
}

export function nextPartyRound(
  code: string,
  host: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'next_round',
    code,
    hostId: host.id,
    token: host.token,
  });
}

export function rematchParty(
  code: string,
  host: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({ op: 'rematch', code, hostId: host.id, token: host.token });
}

export function leaveParty(
  code: string,
  player: PartyPass,
): Promise<PartyRoomState> {
  return stateOf({
    op: 'leave',
    code,
    playerId: player.id,
    token: player.token,
  });
}
