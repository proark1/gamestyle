import type { FarmSnapshot } from './types';
import { SHOCK_STUN_MS } from './fence';
import type { AudioEvent, Point } from '../../shared/audio/world';
export function farmEvents(
  previous: FarmSnapshot['world'],
  next: FarmSnapshot['world'],
): AudioEvent[] {
  if (
    next.round !== previous.round ||
    next.started !== previous.started ||
    next.clock - previous.clock > 2500 ||
    next.clock < previous.clock
  )
    return [];
  const events: AudioEvent[] = [];
  const play = (id: string, position?: Point) => events.push({ id, position });
  if (next.clues) {
    for (const clue of next.clues)
      if (
        clue.clock >= previous.clock &&
        next.clock - clue.clock < 1000 &&
        !previous.clues?.some((old) => old.id === clue.id)
      )
        play(clue.sound, { x: clue.x, z: clue.z });
  }
  // Older clients still derive item sounds from their unfiltered item list.
  for (const item of next.clues ? [] : next.items) {
    const old = previous.items.find((i) => i.id === item.id);
    if (!old) continue;
    const position =
      next.cows.find((c) => c.id === (item.holder || old.holder)) ?? item;
    if (item.delivered && !old.delivered)
      play(
        `item.${item.kind}.${item.kind === 'key' ? 'unlock' : 'place'}`,
        position,
      );
    else if (item.holder !== old.holder)
      play(`item.${item.kind}.${item.holder ? 'grab' : 'drop'}`, position);
  }
  if (next.powerOff && !previous.powerOff) {
    play('event.power-off', { x: -9, z: 2 });
    play('speech.power-off');
  }
  if (previous.keysDelivered < 2 && next.keysDelivered === 2)
    play('event.gate', { x: 0, z: 10 });
  if (next.inspections < previous.inspections) {
    play('event.inspect', next.farmer);
    play('speech.inspect');
  }
  for (const cow of next.cows) {
    const old = previous.cows.find((c) => c.id === cow.id);
    if (
      cow.shockedAt &&
      cow.shockedAt > (old?.shockedAt ?? 0) &&
      cow.shockedAt > previous.clock &&
      next.clock - cow.shockedAt < SHOCK_STUN_MS
    ) {
      events.push({ id: 'event.fence-shock', position: cow, sourceId: cow.id });
    }
    if (!old) continue;
    if (!old.captured && cow.captured) {
      play('event.capture', cow);
      play('speech.capture');
    }
    if (!old.escaped && cow.escaped) {
      if (cow.x > 7) play('event.climb', cow);
      play('speech.escape');
    }
  }
  if (next.phase !== previous.phase && next.phase === 'cows-win')
    play('speech.win');
  if (next.phase !== previous.phase && next.phase === 'farmer-win')
    play('speech.fail');
  return events;
}
