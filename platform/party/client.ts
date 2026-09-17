import type { PartyAction, PartyRoomState } from './types';

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

export async function createParty(
  hostName: string,
  color: number,
): Promise<{ state: PartyRoomState; playerId: string }> {
  return partyRequest({ op: 'create', hostName, color });
}

export async function joinParty(
  code: string,
  name: string,
  color: number,
): Promise<{ state: PartyRoomState; playerId: string }> {
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

export async function togglePartyReady(
  code: string,
  playerId: string,
  ready: boolean,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'ready',
    code,
    playerId,
    ready,
  });
  return data.state;
}

export async function addPartyBot(
  code: string,
  hostId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'add_bot',
    code,
    hostId,
  });
  return data.state;
}

export async function removePartyPlayer(
  code: string,
  hostId: string,
  targetId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'remove_player',
    code,
    hostId,
    targetId,
  });
  return data.state;
}

export async function startParty(
  code: string,
  hostId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'start',
    code,
    hostId,
  });
  return data.state;
}

export async function recordPartyResult(
  code: string,
  round: number,
  scores: Record<string, number>,
  hostId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'record_result',
    code,
    round,
    scores,
    hostId,
  });
  return data.state;
}

export async function nextPartyRound(
  code: string,
  hostId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'next_round',
    code,
    hostId,
  });
  return data.state;
}

export async function rematchParty(
  code: string,
  hostId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'rematch',
    code,
    hostId,
  });
  return data.state;
}

export async function leaveParty(
  code: string,
  playerId: string,
): Promise<PartyRoomState> {
  const data = await partyRequest<{ state: PartyRoomState }>({
    op: 'leave',
    code,
    playerId,
  });
  return data.state;
}
