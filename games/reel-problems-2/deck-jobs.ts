import type { Angler, ReelEvent, ReelWorld, Vector } from './types';
import { BUCKET, idleInput } from './types';
import { distance } from './campaign';

export type Supply = 'rope' | 'plank';
export type DeckJobs = {
  carried: Record<string, Supply>;
  secured: boolean;
  fishAboard: boolean;
  flopAt: number;
  flopWarned: boolean;
  lastFlop: number;
  patches: number;
  gateLift: number;
  gateUntil: number;
  crossing: number;
};
export const STATIONS = {
  rope: { x: -1.75, z: -1.15 },
  timber: { x: 1.55, z: 2.6 },
  fish: { x: 0, z: 1.25 },
  winch: { x: -1.35, z: -2.65 },
  bucket: BUCKET,
};
export type JobTarget = { id: string; label: string; seconds: number };
type Emit = (w: ReelWorld, kind: ReelEvent['kind'], text: string) => void;
export const freshDeckJobs = (): DeckJobs => ({
  carried: {},
  secured: false,
  fishAboard: false,
  flopAt: 0,
  flopWarned: false,
  lastFlop: 0,
  patches: 0,
  gateLift: 0,
  gateUntil: 0,
  crossing: 0,
});
export const heldSupply = (w: ReelWorld, p: Angler) =>
  w.mission?.survival?.jobs?.carried[p.id];
export const giantAboard = (w: ReelWorld) =>
  w.mission?.cargo.some((c) => c.kind === 'monster' && c.location === 'boat') ??
  false;
export const gateOpen = (w: ReelWorld) =>
  (w.mission?.survival?.jobs?.gateUntil ?? 0) > w.clock;
const onDeck = (w: ReelWorld, p: Angler) =>
  !p.swimming &&
  !w.boat.sunk &&
  p.y < 0.4 &&
  p.downedUntil <= w.clock &&
  p.tumbleUntil <= w.clock;
const near = (p: Angler, point: Vector, reach = 1.05) =>
  distance(p, point) < reach;
export function deckJobTarget(w: ReelWorld, p: Angler): JobTarget | null {
  const a = w.mission?.survival,
    j = a?.jobs;
  if (!a || !j || !onDeck(w, p) || w.mission?.status === 'recovering')
    return null;
  const item = j.carried[p.id];
  if (item === 'rope')
    return giantAboard(w) && !j.secured && near(p, STATIONS.fish, 1.7)
      ? { id: 'tie-fish', label: 'Tie the giant down', seconds: 1.6 }
      : null;
  if (item === 'plank')
    return w.leak && near(p, w.leak, 1.15)
      ? { id: 'patch-plank', label: 'Fit the plank over the leak', seconds: 2 }
      : null;
  if (a.stage === 'escape' && Math.abs(w.boat.x) < 4 && near(p, STATIONS.winch))
    return {
      id: 'gate-winch',
      label: gateOpen(w)
        ? 'Keep holding the gate open'
        : 'Crank the harbour gate open',
      seconds: 2,
    };
  if (w.leak && near(p, STATIONS.timber))
    return { id: 'take-plank', label: 'Pick up a repair plank', seconds: 0.35 };
  if (giantAboard(w) && !j.secured && near(p, STATIONS.rope))
    return {
      id: 'take-rope',
      label: 'Pick up rope for the giant',
      seconds: 0.35,
    };
  if (w.boat.flood > 0.025 && near(p, STATIONS.bucket))
    return {
      id: 'bail-bucket',
      label: w.leak
        ? 'Bail water — the leak still needs a plank'
        : 'Bail water out of the boat',
      seconds: 1.2,
    };
  return null;
}
export function completeDeckJob(
  w: ReelWorld,
  p: Angler,
  target: string,
  emit: Emit,
) {
  const j = w.mission?.survival?.jobs;
  if (
    !j ||
    ![
      'take-rope',
      'take-plank',
      'tie-fish',
      'patch-plank',
      'bail-bucket',
      'gate-winch',
    ].includes(target)
  )
    return false;
  if (deckJobTarget(w, p)?.id !== target) return true;
  if (target === 'take-rope' || target === 'take-plank')
    j.carried[p.id] = target === 'take-rope' ? 'rope' : 'plank';
  if (target === 'tie-fish') {
    j.secured = true;
    delete j.carried[p.id];
    emit(
      w,
      'catch',
      `${p.name} tied down the giant! One less thing trying to sink us.`,
    );
  }
  if (target === 'patch-plank') {
    w.leak = null;
    j.patches++;
    p.stats.leaksRepaired += 2;
    delete j.carried[p.id];
    emit(
      w,
      'patched',
      'Plank fitted! The leak is sealed. Bail out the remaining water.',
    );
  }
  if (target === 'bail-bucket') w.boat.flood = Math.max(0, w.boat.flood - 0.25);
  if (target === 'gate-winch') {
    j.gateLift = 1;
    j.gateUntil = w.clock + (w.players.length === 1 ? 14000 : 1800);
    emit(
      w,
      'launch',
      w.players.length === 1
        ? 'Gate latched for 14 seconds! Release Work and ROW!'
        : 'GATE OPEN! Keep cranking while your friends row through.',
    );
  }
  return true;
}
export function advanceDeckJobs(w: ReelWorld, dt: number, emit: Emit) {
  const a = w.mission?.survival,
    j = a?.jobs;
  if (!a || !j) return;
  for (const id of Object.keys(j.carried))
    if (!w.players.some((p) => p.id === id && !p.swimming) || w.boat.sunk)
      delete j.carried[id];
  const aboard = giantAboard(w);
  if (!aboard) {
    j.secured = false;
    j.flopAt = 0;
    j.fishAboard = false;
  } else if (!j.fishAboard) {
    j.fishAboard = true;
    j.flopAt = w.clock + 10000;
    j.flopWarned = false;
  }
  if (w.mission!.status === 'recovering') {
    j.gateLift = 0;
    j.gateUntil = 0;
    j.crossing = 0;
    return;
  }
  if (aboard && !j.secured) {
    if (!j.flopWarned && w.clock >= j.flopAt - 3000) {
      j.flopWarned = true;
      emit(
        w,
        'slap',
        'The giant is winding up! Fetch rope and tie it, or keep clear of its tail.',
      );
    }
    if (w.clock >= j.flopAt) {
      j.lastFlop = w.clock;
      for (const p of w.players)
        if (onDeck(w, p) && near(p, STATIONS.fish, 1.9) && !p.input.brace) {
          p.slipX += (p.x < 0 ? -1 : 1) * 4;
          p.tumbleUntil = w.clock + 650;
        }
      const cargo = w.mission!.cargo.find(
        (c) => c.kind !== 'monster' && c.location === 'boat',
      );
      if (cargo) {
        cargo.location = 'water';
        cargo.x = w.boat.x + 3;
        cargo.z = w.boat.z;
        cargo.until = w.clock + 45000;
      }
      j.flopAt = w.clock + 12000;
      j.flopWarned = false;
      emit(w, 'slap', 'TAIL SLAP! That fish needs a rope.');
    }
  }
  const operator = w.players.find(
    (p) =>
      onDeck(w, p) &&
      !j.carried[p.id] &&
      p.input.work &&
      deckJobTarget(w, p)?.id === 'gate-winch',
  );
  if (j.gateLift >= 1 && operator && a.stage === 'escape')
    j.gateUntil = w.clock + (w.players.length === 1 ? 14000 : 1800);
  if (!gateOpen(w)) {
    j.gateLift = Math.max(0, j.gateLift - dt * 0.7);
    j.crossing = Math.max(0, j.crossing - dt * 0.1);
    return;
  }
  if (
    a.stage !== 'escape' ||
    Math.abs(w.boat.x) >= 4 ||
    w.players.some((p) => p.swimming)
  )
    return;
  const rowers = w.players.filter(
    (p) =>
      onDeck(w, p) &&
      p.input.reel &&
      !p.input.brace &&
      !p.input.work &&
      !j.carried[p.id],
  );
  j.crossing = Math.min(1, j.crossing + (dt * rowers.length) / 3);
  if (j.crossing >= 1) {
    a.gateReady = true;
    w.mission!.status = 'completed';
    w.phase = 'won';
    for (const c of w.mission!.cargo)
      if (c.location === 'boat') {
        c.location = 'delivered';
        w.mission!.delivered++;
      }
    w.score = w.mission!.delivered;
    emit(w, 'finish', 'Gate cleared! Every friend home. Every plank earned.');
  }
}
/** Returns the destination for a deckhand job; humans keep the same contextual controls. */
export function deckhandGoal(w: ReelWorld, p: Angler): Vector | null {
  const a = w.mission?.survival,
    j = a?.jobs;
  if (!a || !j || p.swimming) return null;
  const item = j.carried[p.id];
  if (item === 'rope') {
    if (!giantAboard(w) || j.secured) {
      delete j.carried[p.id];
      return null;
    }
    return { ...STATIONS.fish, x: p.x < 0 ? -1.35 : 1.35 };
  }
  if (item === 'plank') {
    if (!w.leak) {
      delete j.carried[p.id];
      return null;
    }
    return w.leak;
  }
  if (a.stage === 'escape' && Math.abs(w.boat.x) < 4) {
    const otherOperator = w.players.some(
      (q) =>
        q.id !== p.id &&
        q.input.work &&
        deckJobTarget(w, q)?.id === 'gate-winch',
    );
    if (
      !otherOperator &&
      (!gateOpen(w) || w.players.some((q) => !q.bot && !q.input.work))
    )
      return STATIONS.winch;
  }
  if (w.leak && !Object.values(j.carried).includes('plank'))
    return STATIONS.timber;
  if (w.boat.flood > 0.3) return STATIONS.bucket;
  if (
    giantAboard(w) &&
    !j.secured &&
    !Object.values(j.carried).includes('rope')
  )
    return STATIONS.rope;
  return null;
}
export function deckhandInput(w: ReelWorld, p: Angler, target: Vector) {
  const gap = distance(p, target),
    work = deckJobTarget(w, p);
  const dx = gap > 0.7 ? (target.x - p.x) / gap : 0,
    dz = gap > 0.7 ? (target.z - p.z) / gap : 0,
    c = Math.cos(w.boat.yaw),
    sin = Math.sin(w.boat.yaw);
  p.input = {
    ...idleInput(),
    seq: p.input.seq + 1,
    x: dx * c + dz * sin,
    z: -dx * sin + dz * c,
    work:
      !!work &&
      (!w.mission!.latched.includes(p.id) || work.id === 'gate-winch'),
  };
  p.task = work?.label ?? 'Carrying supplies';
}
