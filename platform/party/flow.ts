import { getPartyGameInfo } from './playlist';
import { roundTeams } from './scoring';
import type { PartyRoomState } from './types';

export const BRIEFING_MIN_MS = 5000;
export const PARTY_OFFLINE_MS = 20000;
export const PARTY_RECONNECT_MS = 60000;

export function beginBriefing(
  room: PartyRoomState,
  now: number,
): PartyRoomState {
  return {
    ...room,
    status: 'briefing',
    briefing: { startedAt: now, ready: [] },
    countdownUntil: undefined,
    reports: undefined,
    intermission: undefined,
  };
}

/** Alternating insertion order is what the team adapters use to assign sides. */
export function roundSeats(room: PartyRoomState) {
  const humans = room.players.filter((p) => !p.isBot);
  if (getPartyGameInfo(room.playlist[room.currentRound])?.teams) {
    const [a, b] = roundTeams(
      humans.map((p) => p.id),
      room.currentRound,
    );
    const ids = a.flatMap((id, index) => [id, b[index]]).filter(Boolean);
    // Odd-sized groups keep their third seat and rotate the solo side.
    const ordered = ids.map((id) => humans.find((p) => p.id === id)!);
    if (humans.length === 3)
      return humans.map(
        (_, i) => humans[(i + room.currentRound) % humans.length],
      );
    return Math.floor(room.currentRound / 3) % 2 ? ordered.reverse() : ordered;
  }
  return humans.map((_, i) => humans[(i + room.currentRound) % humans.length]);
}

export function roundAssignments(room: PartyRoomState): [string[], string[]] {
  const seats = roundSeats(room);
  return [
    seats.filter((_, i) => i % 2 === 0).map((p) => p.id),
    seats.filter((_, i) => i % 2 === 1).map((p) => p.id),
  ];
}

export function partyRole(
  room: PartyRoomState,
  id: string,
  de: boolean,
): string {
  const seat = roundSeats(room).findIndex((p) => p.id === id);
  switch (room.playlist[room.currentRound]) {
    case 'crane-clash':
      return seat < 2
        ? de
          ? 'Kranführer'
          : 'Crane operator'
        : de
          ? 'Schwinger'
          : 'Swinger';
    case 'sample-stampede':
      return seat < 2 ? (de ? 'Fahrer' : 'Driver') : de ? 'Greifer' : 'Grabber';
    case 'panic-curling':
      return seat < 2
        ? de
          ? 'Werfer'
          : 'Deliverer'
        : de
          ? 'Feger'
          : 'Sweeper';
    case 'drive-thru':
      return (
        (de
          ? ['Fahrer', 'Beifahrer', 'Grill', 'Barista']
          : ['Driver', 'Passenger', 'Grill', 'Barista'])[seat] ?? ''
      );
    case 'four-brain-cells': {
      const limb =
        ((room.players.find((p) => p.id === id)?.color ?? 0) +
          room.currentRound) %
        4;
      return (
        de
          ? ['Linke Hand', 'Rechte Hand', 'Linker Fuß', 'Rechter Fuß']
          : ['Left hand', 'Right hand', 'Left foot', 'Right foot']
      )[limb];
    }
    case 'act-natural':
      return seat === 0
        ? de
          ? 'Bauer · Finde die menschlichen Kühe'
          : 'Farmer · Find the human cows'
        : de
          ? 'Kuh · Tarne dich und entkomme'
          : 'Cow · Blend in and escape';
    default:
      return de ? `Crew-Platz ${seat + 1}` : `Crew seat ${seat + 1}`;
  }
}

export function progressBriefing(
  room: PartyRoomState,
  now: number,
): PartyRoomState {
  if (
    room.status !== 'briefing' ||
    !room.briefing ||
    room.pausedAt !== undefined
  )
    return room;
  const humans = room.players.filter((p) => !p.isBot && p.connected !== false);
  if (
    !humans.length ||
    now < room.briefing.startedAt + BRIEFING_MIN_MS ||
    humans.some((p) => !room.briefing!.ready.includes(p.id))
  )
    return room;
  return { ...room, status: 'countdown', countdownUntil: now + 3000 };
}
