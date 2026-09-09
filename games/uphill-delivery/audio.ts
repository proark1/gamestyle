import { audioProfile as deliveryAudioProfile } from './audio/profile';
import { Footsteps, type AudioEvent } from '../../shared/audio/world';
import { SiteAudio } from '../../shared/audio/player';
import { DOOR, GATE, GOATS, goatPose } from './level';
import type { DeliverySnapshot, Vec } from './types';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const distance = (a: Vec, b: Vec) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
// Same planted pines as the mountain scenery; canopy height gives birds a real source.
const pines = Array.from({ length: 24 }, (_, i) => ({
  x: (i % 2 ? -1 : 1) * (16.5 + Math.sin(i * 4.2) * 3),
  y: 2,
  z: 20 - i * 2.1,
}));

export function deliverySurface(support?: string | null) {
  if (support === 'sofa') return 'fabric';
  if (support === 'bottom') return 'grass';
  if (support?.startsWith('ice-')) return 'ice';
  if (support?.startsWith('bridge-') || support === 'customer-floor')
    return 'wood';
  return 'stone';
}
export function deliveryAudioDiscontinuity(
  old: DeliverySnapshot,
  next: DeliverySnapshot,
) {
  return (
    old.code !== next.code ||
    old.you !== next.you ||
    old.world.started !== next.world.started ||
    next.world.clock < old.world.clock ||
    next.world.clock - old.world.clock > 2500
  );
}
export type DeliveryAudioFrame = {
  reset: boolean;
  events: (AudioEvent & { variant?: boolean })[];
  loops: { channel: string; id: string | null; strength: number }[];
};

/** Pure snapshot director: no browser, network or paid generation dependencies. */
export class DeliveryAudioDirector {
  private previous: DeliverySnapshot | null = null;
  private footsteps = new Footsteps();
  private goatSteps = new Footsteps();
  private due = new Map<string, number>();
  constructor(private random = Math.random) {}
  reset() {
    this.previous = null;
    this.footsteps.reset();
    this.goatSteps.reset();
    this.due.clear();
  }
  private ready(
    id: string,
    now: number,
    minimum: number,
    spread: number,
    active = true,
  ) {
    const at = this.due.get(id);
    if (!active || at === undefined || now >= at) {
      this.due.set(id, now + minimum + this.random() * spread);
      return active && at !== undefined && now >= at;
    }
    return false;
  }
  update(next: DeliverySnapshot): DeliveryAudioFrame {
    if (
      this.previous?.code === next.code &&
      this.previous.you === next.you &&
      this.previous.world.started === next.world.started &&
      next.world.clock < this.previous.world.clock
    )
      return { reset: false, events: [], loops: [] };
    const reset =
      !this.previous || deliveryAudioDiscontinuity(this.previous, next);
    if (reset) this.reset();
    const old = this.previous?.world;
    const w = next.world;
    const frame: DeliveryAudioFrame = { reset, events: [], loops: [] };
    const play = (id: string, position?: Vec, strength = 1, variant = false) =>
      frame.events.push({ id, position, strength, variant });
    const loop = (channel: string, id: string | null, strength = 1) =>
      frame.loops.push({ channel, id, strength });
    const me = w.players.find((p) => p.id === next.you) ?? w.sofa;
    const active = w.phase === 'playing';
    const indoor =
      clamp(
        Math.min(me.x + 8.85, -3.25 - me.x, me.z + 26.15, -19.85 - me.z) * 1.5,
      ) * clamp(1 - Math.abs(me.y - 22) / 2);
    const outside = 1 - indoor * 0.92;
    const treeDistance = Math.min(...pines.map((tree) => distance(me, tree)));
    const exposure =
      clamp(me.y / 22) * 0.6 +
      (deliverySurface('support' in me ? me.support : null) === 'wood' &&
      me.y < 10
        ? 0.3
        : 0);
    const ambience = w.phase !== 'lobby';
    loop(
      'music',
      `music.${active ? 'build' : w.phase === 'delivered' ? 'win' : 'menu'}`,
      active ? 0.65 : 0.85,
    );
    loop(
      'mountain',
      ambience ? 'ambience.mountain' : null,
      outside * (0.7 - exposure * 0.3),
    );
    loop(
      'pines',
      ambience ? 'ambience.pines' : null,
      outside * clamp(1 - treeDistance / 15) * 0.7,
    );
    loop('ridge', ambience ? 'ambience.ridge' : null, outside * exposure * 0.7);
    loop('room', ambience ? 'ambience.room' : null, indoor * 0.8);

    if (
      active &&
      ((old && old.phase !== 'playing') || (reset && w.clock - w.started < 750))
    )
      play('speech.start');
    if (old && w.phase === 'delivered' && old.phase !== 'delivered')
      play('speech.win');
    if (old && active) {
      if (w.gateTarget !== old.gateTarget) play('event.gate', GATE, 0.7);
      if (w.doorTarget !== old.doorTarget && w.doorTarget > 0) {
        play('event.door', DOOR, 0.7);
        if (distance(me, DOOR) < 12) play('speech.door');
      }
      if (w.gateTarget === 0 && old.gate > 0.025 && w.gate <= 0.025)
        play('event.latch', GATE);
      if (w.doorTarget === 0 && old.door > 0.025 && w.door <= 0.025)
        play('event.door-close', DOOR);
      const impact = w.sofaImpact;
      if (
        impact &&
        impact.id !== old.sofaImpact?.id &&
        w.clock - impact.at < 400 &&
        impact.at <= w.clock
      )
        play(
          impact.speed > 3.5 ? 'event.drop' : 'material.sofa.impact',
          impact.position,
          clamp(impact.speed / 5) * 0.8 + 0.2,
        );
    }
    if (active) {
      for (const p of w.players) {
        const before = old?.players.find((v) => v.id === p.id);
        const surface = deliverySurface(p.support);
        const local = p.id === next.you;
        for (const cue of this.footsteps.update(
          p.id,
          p,
          p.grounded,
          surface,
          w.clock,
        )) {
          if (!cue.id.startsWith('step.')) continue;
          // Icy sliding is friction, not a rapid succession of walking steps.
          if (surface === 'ice' && Math.hypot(p.input.x, p.input.z) < 0.05)
            continue;
          play(cue.id, p, p.grip === null ? 0.65 : 0.78, true);
          if (local && this.ready('clothing', w.clock, 2200, 2500))
            play('clothing.move', p, 0.45, true);
        }
        if (!before) continue;
        if (p.grip !== null && before.grip === null)
          play('event.grab', p, 0.65);
        if (p.grip === null && before.grip !== null)
          play('event.release', p, 0.55);
        if (p.stumble > before.stumble) play('event.goat', p, 0.65);
        if (
          before.grounded &&
          !p.grounded &&
          p.velocity.y > 2 &&
          p.stumble <= w.clock
        )
          play('event.jump', p, 0.5);
        if (!before.grounded && p.grounded && before.velocity.y < -0.8)
          play(
            surface === 'fabric' ? 'event.bounce' : 'event.land',
            p,
            clamp(Math.abs(before.velocity.y) / 7) * 0.6 + 0.25,
          );
        if (
          p.support === 'sofa' &&
          before.velocity.y < -2.2 &&
          p.velocity.y > 5
        )
          play('event.bounce', p, 0.8);
      }
      const moving = Math.hypot(w.sofa.velocity.x, w.sofa.velocity.z) > 0.3;
      const carrying = w.players.some((p) => p.grip !== null);
      if (
        this.ready(
          'carry',
          w.clock,
          2200,
          3000,
          carrying &&
            (moving ||
              Math.hypot(w.sofa.angular.x, w.sofa.angular.y, w.sofa.angular.z) >
                0.2),
        )
      )
        play('sofa.carry', w.sofa, 0.6, true);
      const surface = deliverySurface(w.sofaSurface);
      if (this.ready('scrape', w.clock, 750, 300, moving && !!w.sofaSurface))
        play(
          surface === 'wood'
            ? 'sofa.scrape-wood'
            : surface === 'ice'
              ? 'sofa.scrape-ice'
              : surface === 'grass'
                ? 'sofa.scrape-grass'
                : 'sofa.scrape',
          w.sofa,
          clamp(Math.hypot(w.sofa.velocity.x, w.sofa.velocity.z) / 3),
          true,
        );
      const bridgeLoad =
        w.players.find((p) => p.support?.startsWith('bridge-')) ??
        (w.sofaSurface?.startsWith('bridge-') ? w.sofa : null);
      if (this.ready('bridge', w.clock, 2500, 4000, !!bridgeLoad))
        play('bridge.creak', bridgeLoad!, 0.6, true);
      GOATS.forEach((_, i) => {
        const goat = goatPose(i, w.clock - w.started);
        for (const cue of this.goatSteps.update(
          `goat-${i}`,
          goat,
          true,
          'hoof',
          w.clock,
        ))
          if (cue.id.startsWith('step.')) play('goat.hoof', goat, 0.55, true);
        if (this.ready(`bell-${i}`, w.clock, 7000, 9000))
          play('goat.bell', goat, 0.5, true);
      });
      if (this.ready('bird', w.clock, 9000, 14000, indoor < 0.5)) {
        const nearby = pines.filter((tree) => distance(me, tree) < 22);
        if (nearby.length)
          play(
            'bird.call',
            nearby[Math.floor(this.random() * nearby.length)],
            0.65,
            true,
          );
      }
    }
    // Callers may mutate local practice worlds between snapshots.
    this.previous = structuredClone(next);
    return frame;
  }
}

export class DeliverySound extends SiteAudio {
  private director = new DeliveryAudioDirector();
  constructor() {
    super('uphill-delivery', deliveryAudioProfile);
    this.setLoop('music', 'music.menu', 0.85);
  }
  update(next: DeliverySnapshot, yaw?: number) {
    const frame = this.director.update(next);
    if (!frame.reset && !frame.loops.length) return;
    if (frame.reset) super.reset();
    this.listen(
      next.world.players.find((p) => p.id === next.you) ?? next.world.sofa,
      yaw,
    );
    for (const cue of frame.events) {
      if (cue.variant) this.variant(cue.id, cue.strength, cue.position);
      else this.play(cue.id, cue.strength, cue.position);
    }
    for (const loop of frame.loops)
      this.setLoop(loop.channel, loop.id, loop.strength);
  }
}
