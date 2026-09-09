import type { AudioEvent } from '../../shared/audio/world';
import type { GiantPlayer, GiantSnapshot, GiantWorld, Vec } from './types';
import { escapeWarning } from './urgency';

export function giantSurface(player: GiantPlayer, world: GiantWorld): string {
  const support = player.support ?? '';
  if (support.startsWith('book-')) return 'paper';
  if (support === 'chandelier') return 'metal';
  const item = world.items.find((item) => `item:${item.id}` === support);
  if (item?.kind === 'spoon') return 'metal';
  if (item?.kind === 'pillow') return 'fabric';
  if (['feet', 'head', 'arm'].includes(support)) return 'skin';
  if (['knees', 'belly', 'chest', 'bed', 'slipper'].includes(support))
    return 'fabric';
  return 'wood';
}

export function giantAudioDiscontinuity(
  previous: GiantSnapshot,
  next: GiantSnapshot,
) {
  return (
    previous.code !== next.code ||
    previous.you !== next.you ||
    previous.world.started !== next.world.started ||
    next.world.clock < previous.world.clock ||
    next.world.clock - previous.world.clock > 2500
  );
}

/** Confirmed changes only: snapshots received on joining/reconnecting never replay old events. */
export function giantAudioEvents(
  previous: GiantSnapshot | null,
  next: GiantSnapshot,
): AudioEvent[] {
  const w = next.world;
  if (!previous || giantAudioDiscontinuity(previous, next)) {
    return w.phase === 'playing' &&
      w.clock - w.started >= 0 &&
      w.clock - w.started < 750
      ? [{ id: 'speech.start' }]
      : [];
  }
  const old = previous.world;
  const tickle = w.events.find(
    (event) =>
      event.id > old.serial &&
      w.clock - event.at <= 1500 &&
      event.kind === 'noise' &&
      event.text.includes('tickled his foot'),
  );
  const events: AudioEvent[] = [];
  const play = (id: string, position?: Vec, strength = 1) =>
    events.push({ id, position, strength });
  // Put urgent dialogue first; the common player permits only one speaker at a time.
  if (w.phase !== old.phase) {
    if (w.phase === 'ended')
      play(w.banked >= w.target ? 'speech.win' : 'speech.fail');
    else if (w.phase === 'escape') {
      play('speech.giant-wake');
      play('giant.wake');
    } else if (w.phase === 'playing') play('speech.start');
  }
  if (escapeWarning(w) && !escapeWarning(old)) {
    play('speech.escape-warning');
    play('event.escape-warning');
  }
  if (
    w.pending &&
    (w.pending.kind !== old.pending?.kind || w.pending.at !== old.pending.at) &&
    !(tickle && w.pending.kind === 'sneeze') &&
    !escapeWarning(w)
  )
    play(`speech.${w.pending.kind}-warning`);
  if (w.sneezeAt !== old.sneezeAt && w.sneezeAt > 0) play('giant.sneeze');
  if (w.armAt !== old.armAt && w.armAt > 0) play('giant.roll');
  if (w.banked > old.banked) {
    play(
      old.banked < w.target && w.banked >= w.target
        ? 'speech.target'
        : 'speech.bank',
    );
    play('event.bank', { x: -11.7, y: 0, z: 8.5 });
  }
  for (const item of w.items) {
    const before = old.items.find((candidate) => candidate.id === item.id);
    if (!before || item.banked) continue;
    if (item.heldBy && item.heldBy !== before.heldBy) {
      play(
        `item.${item.kind}.grab`,
        w.players.find((p) => p.id === item.heldBy) ?? item,
      );
      if (item.value > 0) play('speech.treasure');
    }
    if (!item.heldBy && item.support && (!before.support || before.heldBy))
      play(`item.${item.kind}.place`, item);
    if (
      item.kind === 'spoon' &&
      item.heldBy &&
      item.rotation !== before.rotation
    )
      play('item.spoon.rotate', item);
  }
  for (const player of w.players) {
    const before = old.players.find((p) => p.id === player.id);
    if (!before) continue;
    if (player.escaped && !before.escaped) {
      play('event.exit', player);
      play('speech.exit');
    }
    if (player.downUntil > w.clock && before.downUntil <= old.clock) {
      play('event.dazed', player);
      play('speech.dazed');
    } else if (before.downUntil > w.clock && player.downUntil === 0) {
      play('event.rescue', player);
      play('speech.rescue');
    }
    if (
      !before.grounded &&
      player.grounded &&
      before.velocity.y < -5 &&
      ['wood', 'paper'].includes(giantSurface(player, w))
    )
      play('event.impact', player, Math.min(1, -before.velocity.y / 12));
  }
  if (tickle) {
    play('event.tickle', tickle);
    play('speech.tickle');
  }
  return events;
}
