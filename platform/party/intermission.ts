import type { GameId } from '../../shared/audio/types';
import { PARTY_GAMES } from './playlist';
import type { PartyIntermission, PartyRoomState } from './types';
import { beginBriefing } from './flow';

export const PODIUM_MS = 4000;
export const VOTE_MS = 15000;
export const TIE_MS = 4000;
export const REVEAL_MS = 2000;

export function voteCandidates(
  room: PartyRoomState,
  random = Math.random,
): GameId[] {
  const played = new Set(room.roundResults.map((result) => result.game));
  const previous = PARTY_GAMES.find(
    (g) => g.id === room.playlist[room.currentRound],
  );
  const pool = PARTY_GAMES.filter(
    (g) =>
      (room.format !== 'quick' || g.quick) &&
      (previous?.complexity !== 'tricky' || g.complexity !== 'tricky'),
  )
    .map((game) => game.id)
    .filter((id) => !played.has(id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

export function voteCounts(ballot: PartyIntermission): number[] {
  return ballot.candidates.map(
    (id) => Object.values(ballot.votes).filter((vote) => vote === id).length,
  );
}

/** Reads need a write only when a phase is due or a legacy intermission needs setup. */
export function intermissionDue(room: PartyRoomState, now: number): boolean {
  return (
    room.status === 'intermission' &&
    room.pausedAt === undefined &&
    (!room.intermission || now >= room.intermission.endsAt)
  );
}

/** Pure transition; the coordinator persists its outcome with compare-and-swap. */
export function progressIntermission(
  room: PartyRoomState,
  now: number,
  random = Math.random,
): PartyRoomState {
  if (room.status !== 'intermission' || room.pausedAt !== undefined)
    return room;
  let ballot = room.intermission;
  if (!ballot) {
    return {
      ...room,
      intermission: {
        phase: 'podium',
        startedAt: now,
        endsAt: now + (room.format ? 6000 : PODIUM_MS),
        candidates:
          room.currentRound < room.playlist.length - 1
            ? voteCandidates(room, random)
            : [],
        votes: {},
        tied: [],
      },
    };
  }
  // Drop departed voters only before resolution.
  if (ballot.phase === 'podium' || ballot.phase === 'voting') {
    const votes = Object.fromEntries(
      Object.entries(ballot.votes).filter(([id]) =>
        room.players.some((player) => player.id === id && !player.isBot),
      ),
    );
    if (Object.keys(votes).length !== Object.keys(ballot.votes).length) {
      ballot = { ...ballot, votes };
      room = { ...room, intermission: ballot };
    }
  }
  const voters = room.players.filter((p) => !p.isBot && p.connected !== false);
  const allLocked =
    ballot.phase === 'voting' &&
    now >= ballot.startedAt + 5000 &&
    voters.length > 0 &&
    voters.every((p) => ballot!.locked?.includes(p.id) && ballot!.votes[p.id]);
  if (now < ballot.endsAt && !allLocked) return room;
  const startedAt = now;
  // Start each newly visible phase at the resolving request, so a room that
  // reconnects after a long idle still gets a full voting window and reveal.
  if (ballot.phase === 'podium') {
    if (room.currentRound >= room.playlist.length - 1)
      return { ...room, status: 'finished', intermission: undefined };
    const votes = { ...ballot.votes };
    return {
      ...room,
      intermission: {
        ...ballot,
        votes,
        phase: 'voting',
        startedAt,
        endsAt: now + VOTE_MS,
      },
    };
  }
  if (ballot.phase === 'voting') {
    const counts = voteCounts(ballot);
    const top = Math.max(...counts);
    const tied = ballot.candidates.filter((_, index) => counts[index] === top);
    const winner = tied[Math.floor(random() * tied.length)];
    if (room.format) {
      const playlist = [...room.playlist];
      playlist[room.currentRound + 1] = winner;
      return beginBriefing(
        { ...room, playlist, currentRound: room.currentRound + 1 },
        now,
      );
    }
    return {
      ...room,
      intermission: {
        ...ballot,
        tied,
        winner,
        phase: tied.length > 1 ? 'tie-break' : 'reveal',
        startedAt,
        endsAt: now + (tied.length > 1 ? TIE_MS : REVEAL_MS),
      },
    };
  }
  if (ballot.phase === 'tie-break') {
    return {
      ...room,
      intermission: {
        ...ballot,
        phase: 'reveal',
        startedAt,
        endsAt: now + REVEAL_MS,
      },
    };
  }
  const playlist = [...room.playlist];
  playlist[room.currentRound + 1] = ballot.winner!;
  return {
    ...room,
    playlist,
    currentRound: room.currentRound + 1,
    status: 'countdown',
    reports: undefined,
    intermission: undefined,
    countdownUntil: now + 4000,
  };
}

/** Same decelerating sequence on every device, finishing on the stored winner. */
export function highlightedCandidate(
  ballot: PartyIntermission,
  now: number,
): GameId | undefined {
  if (ballot.phase !== 'tie-break')
    return ballot.phase === 'reveal' ? ballot.winner : undefined;
  const progress = Math.max(
    0,
    Math.min(1, (now - ballot.startedAt) / (ballot.endsAt - ballot.startedAt)),
  );
  const steps = ballot.tied.length * 5 + ballot.tied.indexOf(ballot.winner!);
  const step = Math.floor(steps * (1 - (1 - progress) ** 3));
  return ballot.tied[step % ballot.tied.length];
}
