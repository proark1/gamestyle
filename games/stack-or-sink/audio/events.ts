import { dimensions, type Player, type World } from '../types';
import { topOf } from '../physics';
import type { AudioEvent, Point } from '../../../shared/audio/world';
export function stackSurface(p: Player, w: World): string {
  if (w.water > p.y + 0.1) return 'water';
  const support = w.pieces
    .filter((piece) => {
      const d = dimensions(piece);
      return (
        !piece.heldBy &&
        Math.abs(topOf(piece) - p.y) < 0.3 &&
        Math.abs(piece.x - p.x) < d.w / 2 + 0.15 &&
        Math.abs(piece.z - p.z) < d.d / 2 + 0.15
      );
    })
    .sort((a, b) => topOf(b) - topOf(a))[0];
  return !support
    ? 'sand'
    : support.kind === 'sofa'
      ? 'fabric'
      : ['fridge', 'bathtub'].includes(support.kind)
        ? 'metal'
        : 'wood';
}

export function stackEvents(previous: World, next: World): AudioEvent[] {
  const events: AudioEvent[] = [];
  if (
    next.started !== previous.started ||
    next.clock - previous.clock > 2500 ||
    next.clock < previous.clock
  )
    return events;
  const play = (id: string, position?: Point, strength = 1) =>
    events.push({ id, position, strength });
  for (const p of next.pieces) {
    const old = previous.pieces.find((item) => item.id === p.id);
    if (!old) continue;
    if (p.heldBy !== old.heldBy) {
      if (p.heldBy === 'crane') play('event.crane-hook', p);
      else if (old.heldBy === 'crane') play('event.crane-release', p);
      else play(`material.${p.kind}.${p.heldBy ? 'grab' : 'place'}`, p);
    } else if (p.heldBy && p.rotation !== old.rotation)
      play(`material.${p.kind}.rotate`, p);
    if (!p.heldBy && !old.heldBy && old.vy < -0.7 && p.vy > old.vy + 0.6)
      events.push({
        id: `material.${p.kind}.impact`,
        position: p,
        strength: Math.min(1, Math.abs(old.vy) / 5),
        variant: true,
      });
    if (
      !p.heldBy &&
      old.y > previous.water &&
      p.y <= next.water &&
      p.y < old.y - 0.05
    )
      play(`material.${p.kind}.splash`, p);
  }
  if (previous.water <= 0 && next.water > 0) {
    play('event.flood');
    play('speech.flood');
  }
  for (const p of next.players) {
    const old = previous.players.find((v) => v.id === p.id);
    if (!old) continue;
    if (!old.down && p.down) play('speech.danger');
    if (old.down && !p.down) {
      play('event.rescue', p);
      play('speech.rescue');
    }
    if (old.y >= previous.water && p.y < next.water && p.y < old.y - 0.1)
      play('event.splash', p);
  }
  if (next.phase !== previous.phase && next.phase === 'won') play('speech.win');
  if (next.phase !== previous.phase && next.phase === 'lost')
    play('speech.fail');
  for (const event of next.events)
    if (
      !previous.events.some((old) => old.id === event.id) &&
      event.text.endsWith(': Over here!') &&
      next.clock - event.at < 2000
    )
      play('speech.wave');
  return events;
}
