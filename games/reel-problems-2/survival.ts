import type { Angler, ReelEvent, ReelWorld, Vector } from './types';
import { idleInput } from './types';
import { distance, missionPosition } from './campaign';

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;
export type Survival = {
  stage: 'fight' | 'choice' | 'voyage' | 'escape';
  since: number;
  route: 'safe' | 'risk' | null;
  progress: number;
  departureZ: number;
  giant: number;
  caught: boolean;
  waveAt: number;
  warned: boolean;
  waves: number;
  hits: number;
  rescues: number;
  bonus: boolean;
  variant: number;
  wreck: Vector | null;
  gateReady: boolean;
  rockHits: number[];
};
export const ROCKS = [
  { x: -4, z: 10 },
  { x: 4, z: 17 },
  { x: -2, z: 24 },
];
export const GATE = { x: 0, z: 33.4 };
export function prepareSurvival(w: ReelWorld) {
  const m = w.mission!;
  m.id = 'last-boat-home';
  m.lessonDone = true;
  m.survival = {
    stage: 'fight',
    since: w.clock,
    route: null,
    progress: 0,
    departureZ: 2,
    giant: 0,
    caught: false,
    waveAt: 0,
    warned: false,
    waves: 0,
    hits: 0,
    rescues: 0,
    bonus: false,
    variant: Math.floor(w.clock / 1000) % 3,
    wreck: null,
    gateReady: false,
    rockHits: [],
  };
  Object.assign(w.boat, { x: 0, z: 2, yaw: Math.PI });
  w.fish = [];
  w.goal = 1;
}
export function surging(w: ReelWorld) {
  const a = w.mission?.survival;
  return !!a && a.stage === 'fight' && (w.clock - a.since) % 8000 >= 5500;
}
export function chooseRoute(w: ReelWorld, destination: unknown) {
  const a = w.mission?.survival;
  if (!a || a.stage !== 'choice') return;
  if (destination !== 'home' && destination !== 'fish')
    throw Error('Choose sheltered water or the storm shortcut.');
  a.departureZ = w.boat.z;
  a.route = destination === 'home' ? 'safe' : 'risk';
  a.stage = 'voyage';
  a.since = w.clock;
  a.waveAt = w.clock + 11000;
  a.progress = 0;
}
function damage(w: ReelWorld, amount: number, emit: Emit) {
  const a = w.mission!.survival!;
  a.hits++;
  w.boat.flood = Math.min(1, w.boat.flood + amount);
  if (!w.leak) {
    w.leak = { x: 1.2, z: -2.2, at: w.clock, patch: 0, warned: false };
    w.leaks++;
  }
  emit(
    w,
    'bump',
    'Hull hit! Hold C to bail and patch. Keep someone watching the water.',
  );
}
function rescue(w: ReelWorld, p: Angler) {
  Object.assign(p, {
    x: 0,
    z: 0,
    support: 'boat',
    swimming: false,
    clinging: false,
    health: 1,
    downedUntil: 0,
    stunUntil: 0,
    y: 0,
    vy: 0,
    climb: 0,
    slipX: 0,
    slipZ: 0,
    line: null,
    recoveredAt: w.clock,
  });
}
export function survivalWork(w: ReelWorld, p: Angler) {
  const a = w.mission?.survival;
  if (!a || w.mission?.status === 'recovering' || p.swimming) return null;
  const swimmer = w.players.find((q) => q.swimming && distance(q, w.boat) < 15);
  if (swimmer)
    return {
      id: `crew:${swimmer.id}`,
      label: 'Pull your friend aboard',
      seconds: 1,
    };
  const crate = w.mission!.cargo.find(
    (c) => c.location === 'water' && distance(c, w.boat) < 9,
  );
  if (crate)
    return { id: `salvage:${crate.id}`, label: 'Save the catch!', seconds: 1 };
  if (
    a.stage === 'escape' &&
    distance(w.boat, GATE) < 5 &&
    w.players.every((q) => !q.swimming)
  )
    return {
      id: 'escape',
      label: 'Get everyone through the gate!',
      seconds: 1.5,
    };
  if (w.boat.flood > 0.03 || w.leak)
    return { id: 'storm-repair', label: 'Bail and patch the hull', seconds: 2 };
  return null;
}
export function completeSurvivalWork(
  w: ReelWorld,
  p: Angler,
  target: string,
  emit: Emit,
) {
  const a = w.mission?.survival;
  if (!a) return false;
  if (target.startsWith('crew:')) {
    const friend = w.players.find((q) => q.id === target.slice(5));
    if (friend?.swimming && distance(friend, w.boat) < 15) {
      rescue(w, friend);
      a.rescues++;
      emit(w, 'rescue', `${p.name} pulled ${friend.name} back aboard!`);
    }
    return true;
  }
  if (target === 'storm-repair') {
    w.boat.flood = Math.max(0, w.boat.flood - 0.32);
    w.leak = null;
    emit(
      w,
      'patched',
      'Still floating! Hull patched and a bucket of water gone.',
    );
    return true;
  }
  if (
    target === 'escape' &&
    a.stage === 'escape' &&
    distance(w.boat, GATE) < 5 &&
    w.players.every((q) => !q.swimming)
  ) {
    w.mission!.status = 'completed';
    w.phase = 'won';
    a.gateReady = true;
    for (const c of w.mission!.cargo)
      if (c.location === 'boat') {
        c.location = 'delivered';
        w.mission!.delivered++;
      }
    w.score = w.mission!.delivered;
    emit(w, 'finish', 'Everybody made it home. That boat has earned a rest.');
    return true;
  }
  return false;
}
export function advanceSurvival(w: ReelWorld, dt: number, emit: Emit) {
  const m = w.mission!,
    a = m.survival!;
  if (m.status === 'recovering') return;
  const crew = w.players.filter((p) => !p.swimming),
    n = Math.max(1, crew.length);
  const human = crew.filter((p) => !p.bot);
  const steering =
    human.reduce((sum, p) => sum + p.input.x, 0) / Math.max(1, human.length);
  w.boat.x = Math.max(-9, Math.min(9, w.boat.x + steering * dt * 4));
  w.boat.vx *= 0.7;
  w.boat.vz *= 0.7;
  if (a.stage === 'fight') {
    const surge = surging(w),
      reeling = crew.filter((p) => p.input.reel && !p.input.brace).length;
    a.giant = Math.max(
      0,
      Math.min(
        1,
        a.giant +
          dt *
            (surge ? (-reeling * 0.025) / n : (reeling * 0.065) / Math.sqrt(n)),
      ),
    );
    if (surge && reeling)
      w.boat.flood = Math.min(1, w.boat.flood + (dt * 0.035 * reeling) / n);
    const age = (w.clock - a.since) / 1000;
    w.boat.z = Math.min(26, 2 + age * 0.55);
    for (const [i, r] of ROCKS.entries())
      if (
        !a.rockHits.includes(i) &&
        distance(w.boat, { x: r.x * (a.variant === 1 ? -1 : 1), z: r.z }) < 3
      ) {
        a.rockHits.push(i);
        damage(w, 0.19, emit);
      }
    w.boat.yaw = Math.PI + Math.sin(age) * 0.08;
    if (a.giant >= 1 || age >= 55) {
      a.caught = a.giant >= 1;
      if (a.caught) {
        m.cargo.push({
          id: `cargo-${++m.nextCargo}`,
          kind: 'monster',
          location: 'boat',
          x: 0,
          z: 0,
          until: 0,
        });
        m.caught++;
        w.haul.monster = (w.haul.monster ?? 0) + 1;
      }
      a.stage = 'choice';
      a.since = w.clock;
      emit(
        w,
        a.caught ? 'catch' : 'snap',
        a.caught
          ? 'GIANT ABOARD! Sheltered channel or storm shortcut?'
          : 'The giant escaped. Your crew matters more. Choose a way home.',
      );
    }
  } else if (a.stage === 'choice') {
    // A decision is meaningful, but an unattended choice cannot strand the crew.
    if (w.clock - a.since > 18000) chooseRoute(w, 'home');
  } else {
    const risk = a.route === 'risk',
      duration = risk ? 38 : 52;
    const rowers = crew.filter(
      (p) => p.input.reel && !p.input.brace && !p.input.work,
    ).length;
    const pace = 0.12 + (0.88 * rowers) / n;
    a.progress = Math.min(1, a.progress + (dt * pace) / duration);
    const targetZ = a.departureZ + a.progress * (GATE.z - a.departureZ);
    w.boat.z += (targetZ - w.boat.z) * Math.min(1, dt * 2);
    w.boat.yaw = Math.PI;
    w.weather.kind = a.stage === 'escape' ? 'storm' : 'rain';
    w.weather.rain = 0.75;
    w.weather.gust = 0.5;
    w.boat.rollVelocity += Math.sin(w.clock / 450) * dt * 0.07;
    if (!a.warned && w.clock >= a.waveAt - 3500) {
      a.warned = true;
      emit(w, 'weather', 'WAVE INCOMING! Release the reel and hold Brace.');
    }
    if (w.clock >= a.waveAt && a.waves < 3) {
      const exposed = crew.filter((p) => !p.input.brace && !p.bot);
      if (exposed.length) {
        damage(
          w,
          ((risk ? 0.35 : 0.22) * exposed.length) / Math.max(1, human.length),
          emit,
        );
        const cargo = m.cargo.find((c) => c.location === 'boat');
        if (cargo) {
          cargo.location = 'water';
          cargo.x = w.boat.x + 2;
          cargo.z = w.boat.z;
          cargo.until = w.clock + 45000;
        }
        if (a.waves === 1) {
          const p = exposed[0],
            pos = missionPosition(w, p);
          Object.assign(p, {
            ...pos,
            x: w.boat.x + 5,
            z: w.boat.z,
            swimming: true,
            support: 'water',
            overboardAt: w.clock,
            line: null,
          });
          p.splashes++;
        }
      } else
        emit(w, 'weather', 'Held together! The wave passes under the hull.');
      a.waves++;
      a.waveAt = a.waves < 3 ? w.clock + 14000 : Number.MAX_SAFE_INTEGER;
      a.warned = false;
    }
    if (risk && !a.bonus && a.progress > 0.45 && Math.abs(w.boat.x - 5) < 2) {
      a.bonus = true;
      m.cargo.push({
        id: `cargo-${++m.nextCargo}`,
        kind: 'salmon',
        location: 'boat',
        x: 0,
        z: 0,
        until: 0,
      });
      emit(w, 'catch', 'Shortcut salvage secured! Now get everyone home.');
    }
    if (a.progress >= 1 && a.stage !== 'escape') {
      a.stage = 'escape';
      a.waveAt = Number.MAX_SAFE_INTEGER;
      a.warned = false;
      emit(
        w,
        'weather',
        'THE HARBOUR! Steer into the yellow gate. Bring everyone aboard and hold C.',
      );
    }
    // Floating cargo drifts alongside briefly, leaving a real rescue decision.
    for (const c of m.cargo)
      if (c.location === 'water' && w.clock < c.until) {
        c.z += (w.boat.z - c.z) * dt * 0.4;
      }
  }
  if (w.boat.flood >= 1 && !w.boat.sunk) {
    w.boat.sunk = true;
    w.boat.sunkAt = w.clock;
    w.sinks++;
  }
}
export function survivalNpc(w: ReelWorld, p: Angler) {
  const a = w.mission?.survival;
  if (!a || w.mission?.status === 'recovering') return false;
  p.input = {
    ...idleInput(),
    seq: p.input.seq + 1,
    brace: surging(w) || (a.warned && a.waveAt - w.clock < 2000),
    reel: a.stage === 'fight' ? !surging(w) : !a.warned,
    work: !!survivalWork(w, p) && !w.mission!.latched.includes(p.id),
  };
  p.task = p.input.work
    ? 'Saving the crew'
    : p.input.brace
      ? 'Bracing!'
      : 'Helping with the giant';
  return true;
}
