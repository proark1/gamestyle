import { SAYINGS } from './sayings';
import { firstPersonCue } from './audio-events';
export { SAYINGS } from './sayings';
/** Shared construction rules. Distances are metres, timestamps are server time. */
export type Tool = 'brick' | 'mortar' | 'beam' | 'roof' | 'remove';
export type Ingredient = 'cement' | 'sand' | 'water';
export type PartKind = 'brick' | 'beam' | 'roof';
export type Position = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};
export type Builder = Position & {
  id: string;
  name: string;
  color: number;
  seen: number;
};
export type Part = {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  z: number;
  rotation: number;
  bonded: boolean;
  mortaredTop?: boolean;
  by: string;
  at: number;
};
export type Bed = {
  key: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  by: string;
};
export type Inventory = {
  bricks: number;
  mortar: number;
  beams: number;
  roofs: number;
  carrying: Ingredient | null;
};
export type Mixer = {
  cement: number;
  sand: number;
  water: number;
  started: number;
  readyAt: number;
  remaining: number;
  batches: number;
  jammed?: boolean;
};
export type Race = {
  started: number;
  deadline: number;
  baseline: string[];
  completed?: number;
};
export type SiteNotice = {
  text: string;
  at: number;
  kind: 'shout' | 'horn' | 'race' | 'mixer';
  by: string;
};
export type World = {
  parts: Part[];
  beds: Bed[];
  inventories: Record<string, Inventory>;
  mixer: Mixer;
  revision: number;
  recentActions: string[];
  race?: Race;
  notice?: SiteNotice;
  calls?: Record<string, { at: number; index: number }>;
  audioEvents?: { id: string; at: number; cue: string; x: number; z: number }[];
};
export type Snapshot = {
  world: World;
  players: Builder[];
  code: string;
  host: string;
  now: number;
  version: number;
};
export type Session = { code: string; id: string; token: string };
export type Placement = { x: number; y: number; z: number; rotation: number };
export type Action =
  | { type: 'supply'; station: string }
  | { type: 'mixer' }
  | { type: 'empty-mixer' }
  | { type: 'place'; kind: PartKind; placement: Placement }
  | { type: 'mortar'; placement: Placement }
  | { type: 'remove'; id: string }
  | { type: 'race' | 'shout' | 'horn' };
export const FLOOR = 0.12;
export const REACH = 3.2;
export const MIX_TIME = 6500;
export const MAX_PARTS = 1600;
export const STATIONS = [
  { id: 'mixer', name: 'Mortar mixer', x: -6.1, z: -2.7 },
  { id: 'cement', name: 'Cement bags', x: -7.8, z: -0.6 },
  { id: 'sand', name: 'Sand crate', x: -7.8, z: 1.8 },
  { id: 'water', name: 'Water barrel', x: -6.1, z: 3.3 },
  { id: 'brick', name: 'Brick pallet', x: -3.3, z: 5.1 },
  { id: 'beam', name: 'Timber supplies', x: 5.7, z: 5.2 },
  { id: 'roof', name: 'Roof panels', x: 7.7, z: 2.2 },
] as const;
export const START: Position = { x: 0.2, y: 1.8, z: 5.8, yaw: 0, pitch: -0.05 };
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const emptyInventory = (): Inventory => ({
  bricks: 0,
  mortar: 0,
  beams: 0,
  roofs: 0,
  carrying: null,
});
export function freshWorld(): World {
  return {
    parts: [],
    beds: [],
    inventories: {},
    mixer: {
      cement: 0,
      sand: 0,
      water: 0,
      started: 0,
      readyAt: 0,
      remaining: 0,
      batches: 0,
    },
    revision: 0,
    recentActions: [],
  };
}
export function dimensions(kind: PartKind, rotation: number) {
  if (kind === 'beam' && rotation === 2) return { w: 0.25, h: 2, d: 0.25 };
  const base =
    kind === 'brick'
      ? { w: 0.5, h: 0.25, d: 0.25 }
      : kind === 'beam'
        ? { w: 2, h: 0.25, d: 0.25 }
        : { w: 2, h: 0.12, d: 1 };
  return rotation % 2 ? { w: base.d, h: base.h, d: base.w } : base;
}
export function snapped(p: Placement, kind: PartKind = 'brick'): Placement {
  const count = kind === 'beam' ? 3 : 2,
    rotation = ((Math.round(p.rotation) % count) + count) % count;
  const h = dimensions(kind, rotation).h;
  return {
    x: Math.round(p.x * 8) / 8,
    z: Math.round(p.z * 8) / 8,
    y: Math.max(FLOOR + h / 2, Math.round(p.y * 1000) / 1000),
    rotation,
  };
}
export const bedKey = (p: Placement) =>
  `${p.x.toFixed(2)}:${p.y.toFixed(3)}:${p.z.toFixed(2)}:${p.rotation}`;
export function inReach(
  player: Position,
  p: { x: number; y?: number; z: number },
) {
  return (
    Math.hypot(player.x - p.x, player.y - (p.y ?? 0.9), player.z - p.z) <= REACH
  );
}
function overlap(a: Placement & { kind: PartKind }, b: Part) {
  const ad = dimensions(a.kind, a.rotation),
    bd = dimensions(b.kind, b.rotation);
  return (
    Math.abs(a.x - b.x) < (ad.w + bd.w) / 2 - 0.015 &&
    Math.abs(a.z - b.z) < (ad.d + bd.d) / 2 - 0.015 &&
    Math.abs(a.y - b.y) < (ad.h + bd.h) / 2 - 0.015
  );
}
export function supportingParts(world: World, p: Placement, kind: PartKind) {
  const d = dimensions(kind, p.rotation),
    bottom = p.y - d.h / 2;
  return world.parts.filter((b) => {
    const bd = dimensions(b.kind, b.rotation);
    return (
      Math.abs(b.y + bd.h / 2 - bottom) < 0.04 &&
      Math.abs(p.x - b.x) < (d.w + bd.w) / 2 - 0.025 &&
      Math.abs(p.z - b.z) < (d.d + bd.d) / 2 - 0.025
    );
  });
}
export function placementError(
  world: World,
  p: Placement,
  kind: PartKind,
  player?: Position,
): string | null {
  if (![p.x, p.y, p.z, p.rotation].every(Number.isFinite))
    return 'Choose a spot on the foundation.';
  if (!['brick', 'beam', 'roof'].includes(kind))
    return 'This building part is unavailable.';
  const d = dimensions(kind, p.rotation),
    bottom = p.y - d.h / 2;
  if (
    Math.abs(p.x) + d.w / 2 > 4.05 ||
    Math.abs(p.z) + d.d / 2 > 3.05 ||
    bottom < FLOOR - 0.02 ||
    p.y > 4.4
  )
    return 'Build within the marked foundation.';
  if (player && !inReach(player, p)) return 'Move closer to the building site.';
  if (
    player &&
    Math.abs(player.x - p.x) < d.w / 2 + 0.2 &&
    Math.abs(player.z - p.z) < d.d / 2 + 0.2 &&
    p.y + d.h / 2 > player.y - 1.68 + 0.31 &&
    bottom < player.y - 0.13
  )
    return 'You are standing in the building location. Take a step back.';
  if (world.parts.length >= MAX_PARTS)
    return 'The building site is full. Remove a part first.';
  if (world.parts.some((b) => overlap({ ...p, kind }, b)))
    return 'There is already a part here.';
  if (bottom <= FLOOR + 0.04)
    return kind === 'roof'
      ? 'Roof panels need a supporting frame first.'
      : null;
  const supports = supportingParts(world, p, kind);
  if (!supports.length) return 'No support here. Build underneath first.';
  if (kind === 'brick') {
    if (!supports.some((b) => b.bonded || b.kind === 'beam'))
      return 'The brick below is dry. Bond it with mortar first.';
    const coverage = supports.reduce((total, b) => {
      const bd = dimensions(b.kind, b.rotation);
      return (
        total +
        Math.max(
          0,
          Math.min(p.x + d.w / 2, b.x + bd.w / 2) -
            Math.max(p.x - d.w / 2, b.x - bd.w / 2),
        ) *
          Math.max(
            0,
            Math.min(p.z + d.d / 2, b.z + bd.d / 2) -
              Math.max(p.z - d.d / 2, b.z - bd.d / 2),
          )
      );
    }, 0);
    if (coverage < d.w * d.d * 0.45)
      return 'The brick needs more support area.';
  } else {
    if (kind === 'beam' && p.rotation === 2) {
      if (
        !supports.some(
          (b) =>
            b.bonded &&
            Math.abs(b.x - p.x) <= dimensions(b.kind, b.rotation).w / 2 &&
            Math.abs(b.z - p.z) <= dimensions(b.kind, b.rotation).d / 2,
        )
      )
        return 'The post needs a solid base directly underneath.';
      return null;
    }
    const alongX = d.w >= d.d;
    const ends = [-1, 1].map((sign) =>
      supports.some((b) => {
        const bd = dimensions(b.kind, b.rotation);
        const offset =
          (alongX ? p.x : p.z) + sign * (alongX ? d.w : d.d) * 0.38;
        return (
          Math.abs((alongX ? b.x : b.z) - offset) <=
            (alongX ? bd.w : bd.d) / 2 + 0.14 && b.bonded
        );
      }),
    );
    if (!ends.every(Boolean))
      return kind === 'beam'
        ? 'The beam needs support at both ends.'
        : 'The roof panel needs a beam on both sides.';
  }
  return null;
}
export function recipeStatus(m: Mixer, now: number) {
  if (m.jammed) return 'Mixer jammed! Press E to give it a nudge.';
  if (m.readyAt && now < m.readyAt) return 'The mixer is running …';
  if (m.remaining > 0) return 'Mortar ready. Fill your bucket.';
  if (!m.cement && !m.sand && !m.water)
    return 'Recipe: 1 cement · 2 sand · 1 water';
  if (m.cement < 1) return 'Add cement.';
  if (m.sand < m.cement * 2) return 'Add more sand.';
  if (m.water < m.cement) return 'Add more water.';
  if (m.water > m.cement * 1.5) return 'Too wet. Add cement and sand.';
  if (m.sand > m.cement * 3) return 'Too sandy. Add cement and water.';
  return 'Mix is ready. Switch on the machine.';
}
export function raceProgress(world: World) {
  const baseline = new Set(world.race?.baseline ?? []),
    parts = world.parts.filter((p) => !baseline.has(p.id));
  return {
    bricks: parts.filter((p) => p.kind === 'brick' && p.bonded).length,
    posts: parts.filter((p) => p.kind === 'beam' && p.rotation === 2).length,
    roofs: parts.filter((p) => p.kind === 'roof').length,
  };
}
export function raceActive(world: World, now: number) {
  return !!world.race && !world.race.completed && now < world.race.deadline;
}
export function applyAction(
  world: World,
  action: Action,
  player: Builder,
  now = Date.now(),
  actionId?: string,
): World {
  if (actionId && world.recentActions.includes(actionId)) return world;
  const next: World = structuredClone(world);
  const inv = (next.inventories[player.id] ??= emptyInventory());
  const requireStation = (id: string) => {
    const s = STATIONS.find((s) => s.id === id);
    if (!s || !inReach(player, s))
      throw new Error('Move closer to the supply station.');
    return s;
  };
  if (action.type === 'race') {
    if (!inReach(player, { x: -2.8, y: 1.9, z: -5.7 }))
      throw new Error(
        'Start the roof-raising race at the sign behind the house.',
      );
    if (raceActive(next, now))
      throw new Error('The roof-raising race is already running. Lend a hand!');
    next.race = {
      started: now,
      deadline: now + 300_000,
      baseline: next.parts.map((p) => p.id),
    };
    next.notice = {
      text: 'Roof-raising in 5 minutes! 12 bricks, 2 posts, 2 roof panels. All hands on trowels!',
      at: now,
      kind: 'race',
      by: player.id,
    };
  } else if (action.type === 'shout' || action.type === 'horn') {
    if (action.type === 'horn' && !inReach(player, { x: 7.5, y: 1, z: -6 }))
      throw new Error('Walk to the vehicle to use the horn.');
    const previous = next.calls?.[player.id];
    if (previous && now - previous.at < 3500)
      throw new Error('Catch your breath …');
    const index = (previous?.index ?? -1) + 1;
    next.calls ??= {};
    next.calls[player.id] = { at: now, index };
    next.notice = {
      text:
        action.type === 'horn'
          ? `${player.name}: BEEP BEEP! The clocking-off express is here!`
          : `${player.name}: ${SAYINGS[index % SAYINGS.length]}`,
      at: now,
      kind: action.type,
      by: player.id,
    };
  } else if (action.type === 'supply') {
    const s = requireStation(action.station);
    if (s.id === 'brick') {
      if (inv.bricks >= 8)
        throw new Error('You are already carrying eight bricks.');
      inv.bricks = 8;
    } else if (s.id === 'beam') {
      if (inv.beams >= 2)
        throw new Error('You are already carrying two beams.');
      inv.beams = 2;
    } else if (s.id === 'roof') {
      if (inv.roofs >= 2)
        throw new Error('You are already carrying two roof panels.');
      inv.roofs = 2;
    } else if (['cement', 'sand', 'water'].includes(s.id)) {
      if (inv.carrying === s.id) inv.carrying = null;
      else if (inv.carrying)
        throw new Error(
          'Pour your material into the mixer or return it to the supplies.',
        );
      else inv.carrying = s.id as Ingredient;
    } else throw new Error('Use E to operate the mixer.');
  } else if (action.type === 'empty-mixer') {
    requireStation('mixer');
    if (next.mixer.jammed) throw new Error('Nudge the mixer with E first.');
    if (next.mixer.readyAt > now)
      throw new Error('Wait for the mixer to stop.');
    next.mixer = { ...freshWorld().mixer, batches: next.mixer.batches };
  } else if (action.type === 'mixer') {
    requireStation('mixer');
    const m = next.mixer;
    if (m.jammed) {
      m.jammed = false;
      m.started = now;
      m.readyAt = now + MIX_TIME;
      next.notice = {
        text: `${player.name} saved the mixer. A nudge counts as a repair!`,
        at: now,
        kind: 'mixer',
        by: player.id,
      };
    } else if (m.readyAt && now < m.readyAt)
      throw new Error('The machine is running. Mortar will be ready soon.');
    else if (m.remaining > 0) {
      if (inv.carrying)
        throw new Error('Put your material down first: the mortar is ready.');
      const take = Math.min(24 - inv.mortar, m.remaining);
      if (take <= 0) throw new Error('Your mortar bucket is full.');
      inv.mortar += take;
      m.remaining -= take;
      if (!m.remaining) {
        m.started = 0;
        m.readyAt = 0;
      }
    } else if (inv.carrying) {
      if (m[inv.carrying] >= 12)
        throw new Error('There is enough of that in the mixer.');
      m[inv.carrying]++;
      inv.carrying = null;
    } else {
      const status = recipeStatus(m, now);
      if (!status.startsWith('Mix is ready')) throw new Error(status);
      m.remaining = Math.min(96, m.cement * 24);
      m.cement = 0;
      m.sand = 0;
      m.water = 0;
      m.started = now;
      m.readyAt = now + MIX_TIME;
      m.batches++;
      if (raceActive(next, now) && m.batches % 2 === 0) {
        m.jammed = true;
        next.notice = {
          text: 'CLUNK! The mixer is jammed. Anyone nearby? Press E to nudge it!',
          at: now,
          kind: 'mixer',
          by: player.id,
        };
      }
    }
  } else if (action.type === 'place' || action.type === 'mortar') {
    if (
      !action.placement ||
      ![
        action.placement.x,
        action.placement.y,
        action.placement.z,
        action.placement.rotation,
      ].every((v) => typeof v === 'number' && Number.isFinite(v))
    )
      throw new Error('Choose a valid building location.');
    const kind = action.type === 'mortar' ? 'brick' : action.kind;
    if (!['brick', 'beam', 'roof'].includes(kind))
      throw new Error('Unknown building part.');
    const p = snapped(action.placement, kind);
    const dryBrick =
      action.type === 'mortar'
        ? next.parts.find(
            (b) => b.kind === 'brick' && !b.bonded && bedKey(b) === bedKey(p),
          )
        : undefined;
    const reason = dryBrick
      ? !inReach(player, p)
        ? 'Move closer to the brick.'
        : null
      : placementError(next, p, kind, player);
    if (reason) throw new Error(reason);
    const key = bedKey(p);
    if (action.type === 'mortar') {
      if (inv.mortar < 1)
        throw new Error('Your bucket is empty. Mix mortar first.');
      if (next.beds.some((b) => b.key === key))
        throw new Error('There is already mortar here. Place a brick on it.');
      if (next.beds.length > 300)
        throw new Error('Use the prepared mortar beds first.');
      if (dryBrick) {
        dryBrick.bonded = true;
        dryBrick.mortaredTop = true;
      } else next.beds.push({ ...p, key, by: player.id });
      inv.mortar--;
    } else {
      const stock =
        kind === 'brick' ? 'bricks' : kind === 'beam' ? 'beams' : 'roofs';
      if (inv[stock] < 1)
        throw new Error(
          kind === 'brick'
            ? 'Collect bricks from the pallet.'
            : 'Collect materials from the supplies first.',
        );
      const bonded = kind !== 'brick' || next.beds.some((b) => b.key === key);
      inv[stock]--;
      next.beds = next.beds.filter((b) => b.key !== key);
      next.parts.push({
        ...p,
        kind,
        id: crypto.randomUUID(),
        bonded,
        by: player.id,
        at: now,
      });
    }
  } else if (action.type === 'remove') {
    const part = next.parts.find((b) => b.id === action.id);
    if (!part || !inReach(player, part))
      throw new Error('Move closer to the building part.');
    if (
      next.parts.some(
        (p) =>
          p.id !== part.id &&
          supportingParts(next, p, p.kind).some((s) => s.id === part.id),
      )
    )
      throw new Error(
        'Another part is resting on this one. Remove parts from the top down.',
      );
    next.parts = next.parts.filter((b) => b.id !== part.id);
    next.beds = next.beds.filter((b) => !placementError(next, b, 'brick'));
    const key =
      part.kind === 'brick'
        ? 'bricks'
        : part.kind === 'beam'
          ? 'beams'
          : 'roofs';
    inv[key]++;
  } else throw new Error('Unknown building action.');
  if (raceActive(next, now)) {
    const progress = raceProgress(next);
    if (progress.bricks >= 12 && progress.posts >= 2 && progress.roofs >= 2) {
      next.race!.completed = now;
      next.notice = {
        text: 'THE ROOF IS UP! The inspector would rather not look too closely. Great work, team!',
        at: now,
        kind: 'race',
        by: player.id,
      };
    }
  }
  next.revision++;
  const audioCue = firstPersonCue(action, world, player.id);
  if (audioCue)
    next.audioEvents = [
      ...(next.audioEvents || []).slice(-23),
      {
        id: crypto.randomUUID(),
        at: now,
        cue: audioCue,
        x: player.x,
        z: player.z,
      },
    ];
  if (actionId)
    next.recentActions = [...next.recentActions.slice(-95), actionId];
  return next;
}
