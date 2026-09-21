import type { Angler, CatchKind, ReelEvent, ReelWorld } from './types';
import { idleInput } from './types';
import { launchBoat } from './hull';
import {
  HARBOR,
  FIRST_DELIVERY,
  carriedCargo,
  cargoCapacity,
  componentHome,
  distance,
  missionPosition,
  type ComponentKind,
} from './campaign';

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;
export function storeCatch(w: ReelWorld, kind: CatchKind, emit: Emit) {
  const m = w.mission;
  if (!m) return false;
  if (kind !== 'perch' && kind !== 'salmon') return true;
  if (carriedCargo(w) >= cargoCapacity(w)) {
    emit(
      w,
      'catch',
      'Hold full! This fish swam free. Return to the café to unload.',
    );
    return true;
  }
  m.cargo.push({
    id: `cargo-${++m.nextCargo}`,
    kind,
    location: 'boat',
    x: 0,
    z: 0,
    until: 0,
  });
  m.caught++;
  w.haul[kind] = (w.haul[kind] ?? 0) + 1;
  if (m.caught >= 2 && !m.lessonDone && !m.lessonAt)
    m.lessonAt = w.clock + 5000;
  emit(
    w,
    'catch',
    `Fish aboard (${carriedCargo(w)}/${cargoCapacity(w)}). Deliver at the home dock.`,
  );
  return true;
}
export function setCourse(w: ReelWorld, destination: unknown) {
  if (!w.mission || w.mission.status !== 'sailing') return;
  if (
    destination !== 'fish' &&
    destination !== 'home' &&
    destination !== 'repair'
  )
    throw new Error('Choose a harbour destination.');
  w.mission.course = destination;
  for (const p of w.players) p.paddle = 0;
}
export function releaseMaterial(w: ReelWorld, id: string) {
  const m = w.mission;
  if (!m) return;
  const p = w.players.find((p) => p.id === id);
  for (const item of m.components)
    if (item.carrier === id) {
      item.carrier = null;
      item.droppedAt = w.clock;
      Object.assign(
        item,
        p?.support === 'dock'
          ? { x: p.x, z: p.z }
          : componentHome(m.components.indexOf(item)),
      );
    }
  delete m.holds[id];
  m.latched = m.latched.filter((x) => x !== id);
}
function ontoDock(w: ReelWorld, p: Angler) {
  const i = Math.max(0, w.players.indexOf(p));
  Object.assign(p, {
    x: 10 + i * 0.8,
    z: 26,
    support: 'dock',
    swimming: false,
    clinging: false,
    climb: 0,
    y: 0,
    vy: 0,
    slipX: 0,
    slipZ: 0,
    line: null,
    paddle: 0,
    health: 1,
    downedUntil: 0,
    stunUntil: 0,
    tumbleUntil: 0,
    shockedUntil: 0,
  });
  p.facing = 0;
}
export function beginRecovery(w: ReelWorld, emit: Emit) {
  const m = w.mission;
  if (!m || m.status === 'recovering') return;
  m.status = 'recovering';
  m.lessonDone = true;
  m.lessonAt = 0;
  m.recoveryStarted = w.clock;
  m.course = null;
  m.holds = {};
  m.latched = [];
  const kinds: ComponentKind[] = ['deck-a', 'deck-b', 'barrels', 'paddle'];
  m.components = kinds.map((id, i) => ({
    id,
    ...componentHome(i),
    carrier: null,
    installed: false,
    droppedAt: 0,
  }));
  for (const c of m.cargo)
    if (c.location === 'boat') {
      c.location = 'water';
      c.x = w.boat.x + Math.sin(m.nextCargo + m.cargo.indexOf(c)) * 3;
      c.z = w.boat.z + Math.cos(m.cargo.indexOf(c)) * 3;
      c.until = w.clock + 120_000;
    }
  w.wildlife = [];
  w.leak = null;
  w.pending = null;
  for (const p of w.players) {
    p.line = null;
    p.paddle = 0;
  }
  emit(
    w,
    'sink',
    'Boat lost! Swim to the yellow repair slip. A tow arrives in 12 seconds. Build a raft there.',
  );
}
export type WorkTarget = { id: string; label: string; seconds: number };
export function workTarget(w: ReelWorld, p?: Angler): WorkTarget | null {
  const m = w.mission;
  if (
    !m ||
    !p ||
    w.phase !== 'playing' ||
    p.swimming ||
    p.downedUntil > w.clock
  )
    return null;
  if (m.status === 'recovering') {
    if (p.support !== 'dock') return null;
    const item = m.components.find((c) => c.carrier === p.id);
    if (item) {
      const decks = m.components.filter(
        (c) => c.id.startsWith('deck') && c.installed,
      ).length;
      const valid =
        item.id.startsWith('deck') ||
        (item.id === 'barrels'
          ? decks === 2
          : m.components.some((c) => c.id === 'barrels' && c.installed));
      return valid && distance(p, HARBOR.frame) < 2.2
        ? { id: `install:${item.id}`, label: 'Attach component', seconds: 2 }
        : null;
    }
    if (
      m.components.every((c) => c.installed) &&
      distance(p, HARBOR.frame) < 2.5
    )
      return { id: 'launch', label: 'Push raft into the water', seconds: 2 };
    const next = m.components
      .filter((c) => !c.installed && !c.carrier && distance(c, p) < 1.5)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    return next
      ? {
          id: `take:${next.id}`,
          label: `Pick up ${next.id.startsWith('deck') ? 'planks' : next.id}`,
          seconds: 0.35,
        }
      : null;
  }
  if (p.line || p.paddle || p.y > 0) return null;
  if (distance(w.boat, HARBOR.home) < 4 && carriedCargo(w))
    return { id: 'unload', label: 'Unload fish at the café', seconds: 2 };
  if (distance(w.boat, HARBOR.repair) < 4 && (w.boat.flood > 0.01 || w.leak))
    return { id: 'repair', label: 'Service the hull', seconds: 3 };
  const pos = missionPosition(w, p);
  const crate = m.cargo.find(
    (c) =>
      c.location === 'water' &&
      distance(c, pos) < 5 &&
      carriedCargo(w) < cargoCapacity(w),
  );
  return crate
    ? {
        id: `salvage:${crate.id}`,
        label: 'Recover floating fish crate',
        seconds: 1,
      }
    : null;
}
function completeWork(w: ReelWorld, p: Angler, target: string, emit: Emit) {
  const m = w.mission!;
  if (target === 'unload') {
    for (const c of m.cargo)
      if (c.location === 'boat') {
        c.location = 'delivered';
        m.delivered++;
      }
    w.score = m.delivered;
    emit(
      w,
      'catch',
      `Delivered ${m.delivered}/${FIRST_DELIVERY.target} fish to the café.`,
    );
  } else if (target === 'repair') {
    w.boat.flood = 0;
    w.leak = null;
    w.leakDueAt = Number.MAX_SAFE_INTEGER;
    emit(w, 'patched', 'Hull serviced. Dry deck, clear water.');
  } else if (target.startsWith('salvage:')) {
    const c = m.cargo.find(
      (c) => c.id === target.slice(8) && c.location === 'water',
    );
    if (c && carriedCargo(w) < cargoCapacity(w)) c.location = 'boat';
  } else if (target.startsWith('take:')) {
    const item = m.components.find((c) => c.id === target.slice(5));
    if (
      item &&
      !item.carrier &&
      !item.installed &&
      !m.components.some((c) => c.carrier === p.id)
    )
      item.carrier = p.id;
  } else if (target.startsWith('install:')) {
    const item = m.components.find(
      (c) => c.id === target.slice(8) && c.carrier === p.id,
    );
    if (item) {
      item.installed = true;
      item.carrier = null;
      emit(w, 'patched', 'Component attached. The raft is taking shape!');
    }
  } else if (target === 'launch' && m.components.every((c) => c.installed)) {
    launchBoat(w);
    Object.assign(w.boat, HARBOR.repair);
    m.raft = true;
    m.rebuilds++;
    m.status = 'sailing';
    m.holds = {};
    m.course = null;
    w.leakDueAt = Number.MAX_SAFE_INTEGER;
    w.leakReadyAt = w.clock + 40_000;
    for (const [i, other] of w.players.entries())
      Object.assign(other, {
        support: 'boat',
        swimming: false,
        x: i % 2 ? 1.1 : -1.1,
        z: i < 2 ? 1 : -1,
        line: null,
        paddle: 0,
        y: 0,
        vy: 0,
        health: 1,
        downedUntil: 0,
        recoveredAt: w.clock,
        input: idleInput(),
      });
    emit(
      w,
      'launch',
      'Back in business! Your raft can carry three fish. Finish the delivery.',
    );
  }
}
/** Runs once per fixed step, after normal boat physics or recovery movement. */
export function advanceMission(w: ReelWorld, dt: number, emit: Emit) {
  const m = w.mission;
  if (!m || w.phase !== 'playing') return;
  if (w.boat.sunk && m.status !== 'recovering') beginRecovery(w, emit);
  if (m.status === 'sailing') {
    if (m.course && !w.boat.sunk) {
      if (w.players.some((p) => p.paddle)) m.course = null;
      else {
        const target = HARBOR[m.course],
          gap = distance(w.boat, target);
        if (gap < 0.5) {
          m.course = null;
          w.boat.vx = w.boat.vz = 0;
        } else {
          const stride = Math.min(gap, (m.raft ? 2.4 : 3.2) * dt);
          const dx = (target.x - w.boat.x) / gap,
            dz = (target.z - w.boat.z) / gap;
          w.boat.x += dx * stride;
          w.boat.z += dz * stride;
          const yaw = Math.atan2(-dx, -dz);
          w.boat.yaw +=
            Math.atan2(Math.sin(yaw - w.boat.yaw), Math.cos(yaw - w.boat.yaw)) *
            Math.min(1, dt * 3);
          w.boat.vx *= 0.9;
          w.boat.vz *= 0.9;
        }
      }
    }
    if (m.lessonAt && !m.lessonDone && w.clock >= m.lessonAt) {
      m.lessonDone = true;
      w.leak = { x: 1.2, z: -2.2, at: w.clock, patch: 0, warned: false };
      w.leaks++;
      emit(
        w,
        'leak',
        'A seam is creaking! Stand on the yellow leak and hold E to patch; bail at the bucket, or sail to the repair slip.',
      );
    }
    // Keep unhooked introductory fish in their fishing ground, including respawns.
    for (const [i, f] of w.fish.entries())
      if (
        !w.players.some((p) => p.line?.target === f.id) &&
        distance(f, HARBOR.fish) > 10
      ) {
        f.x = HARBOR.fish.x + Math.sin(i) * 6;
        f.z = HARBOR.fish.z + Math.cos(i) * 6;
      }
  }
  for (const c of m.cargo)
    if (c.location === 'water' && w.clock > c.until) {
      c.location = 'lost';
      m.lost++;
    }
  for (const [i, item] of m.components.entries()) {
    if (item.carrier && !w.players.some((p) => p.id === item.carrier)) {
      item.carrier = null;
      item.droppedAt = w.clock;
    }
    if (
      !item.installed &&
      !item.carrier &&
      item.droppedAt &&
      w.clock - item.droppedAt >= 10_000
    ) {
      Object.assign(item, componentHome(i));
      item.droppedAt = 0;
    }
  }
  for (const p of w.players) {
    if (!p.input.work) {
      delete m.holds[p.id];
      m.latched = m.latched.filter((id) => id !== p.id);
      continue;
    }
    if (m.latched.includes(p.id)) continue;
    const target = workTarget(w, p);
    if (!target) {
      delete m.holds[p.id];
      continue;
    }
    if (m.holds[p.id]?.target !== target.id)
      m.holds[p.id] = { target: target.id, progress: 0 };
    const hold = m.holds[p.id];
    hold.progress += dt / target.seconds;
    if (hold.progress >= 1) {
      completeWork(w, p, target.id, emit);
      delete m.holds[p.id];
      m.latched.push(p.id);
    }
  }
  if (m.delivered >= FIRST_DELIVERY.target) {
    m.status = 'completed';
    w.phase = 'won';
    emit(w, 'finish', 'First Delivery complete! The café is open for lunch.');
  }
  if (w.phase !== 'playing')
    for (const p of w.players) {
      p.line = null;
      p.input = idleInput();
    }
}
/** Recovery owns movement: there is no boat deck while the hull is sunk. */
export function advanceRecovery(w: ReelWorld, dt: number) {
  const m = w.mission!;
  for (const p of w.players) {
    if (p.support !== 'dock') {
      if (distance(p, HARBOR.dock) < 4 || w.clock - m.recoveryStarted >= 12_000)
        ontoDock(w, p);
      else if (!p.downedUntil) {
        const n = Math.max(1, Math.hypot(p.input.x, p.input.z));
        p.x += (p.input.x / n) * dt * 4.4;
        p.z += (p.input.z / n) * dt * 4.4;
      }
      continue;
    }
    const n = Math.max(1, Math.hypot(p.input.x, p.input.z));
    p.x = Math.max(8, Math.min(16, p.x + (p.input.x / n) * dt * 3));
    p.z = Math.max(25, Math.min(31, p.z + (p.input.z / n) * dt * 3));
    if (p.input.x || p.input.z) p.facing = Math.atan2(p.input.x, p.input.z);
  }
}
export function tickMissionNpc(w: ReelWorld, p: Angler): boolean {
  const m = w.mission;
  if (!m) return false;
  if (m.status === 'recovering') {
    const item = m.components.find((c) => c.carrier === p.id);
    const decks = m.components.filter(
      (c) => c.id.startsWith('deck') && c.installed,
    ).length;
    const available = m.components.find(
      (c) =>
        !c.installed &&
        !c.carrier &&
        (c.id.startsWith('deck') ||
          (c.id === 'barrels'
            ? decks === 2
            : m.components.some((c) => c.id === 'barrels' && c.installed))),
    );
    const target =
      p.support !== 'dock'
        ? HARBOR.dock
        : item || !available
          ? HARBOR.frame
          : available;
    const gap = distance(p, target);
    p.input = {
      ...idleInput(),
      x: gap > 0.8 ? (target.x - p.x) / gap : 0,
      z: gap > 0.8 ? (target.z - p.z) / gap : 0,
      work: gap < 1.2 && !m.latched.includes(p.id),
      seq: p.input.seq + 1,
    };
    p.task = item ? 'Building raft' : 'Collecting materials';
    return true;
  }
  const work = workTarget(w, p);
  if (work) {
    p.line = null;
    p.input = {
      ...idleInput(),
      work: !m.latched.includes(p.id),
      seq: p.input.seq + 1,
    };
    p.task = work.label;
    return true;
  }
  return false;
}
