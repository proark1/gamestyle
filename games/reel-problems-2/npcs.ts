import { tickMissionNpc } from './mission';
import {
  BOAT_HALF,
  BUCKET,
  BUCKET_REACH,
  CATCHES,
  DOCK,
  GRAB_REACH,
  LEAK_REACH,
  idleInput,
  type Angler,
  type ReelAction,
  type ReelWorld,
  type Vector,
} from './types';
import { anglerPosition, hookedAnglers, hullGap } from './simulation';

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const distance = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.z - b.z);

const SLOT_HOME: readonly Vector[] = [
  { x: -1.1, z: 1 },
  { x: 1.1, z: 1 },
  { x: -1.1, z: -1 },
  { x: 1.1, z: -1 },
];

/**
 * Ticks all NPC anglers aboard or in the water:
 * - Climbs or swims back to boat / dock when overboard.
 * - Rescues nearby swimming friends.
 * - Saws through crises: patches leaks and bails water.
 * - Shields against wildlife: stomps crabs and scares diving gulls.
 * - Braces and counter-balances the deck during storms and heavy tilt.
 * - Untangles crossed lines.
 * - Casts intelligently and joins team-pulls on big catches.
 * - Eases off the reel during fish surges and high tension to prevent line snaps.
 */
export function tickReelNpcs(
  w: ReelWorld,
  act: (id: string, action: ReelAction) => void,
) {
  const bots = w.players.filter((p) => p.bot);
  if (!bots.length || w.phase !== 'playing') return;

  const canAct = (p: Angler) => w.clock - p.lastAction >= 250;

  for (const p of bots) {
    p.seen = w.clock;
    if (tickMissionNpc(w, p)) continue;
    const input = idleInput();

    // -------------------------------------------------------------
    // 1. Overboard / Swimming State
    // -------------------------------------------------------------
    if (p.swimming) {
      if (w.boat.sunk) {
        // Boat is sunk: swim straight to the dock to launch a new boat.
        const dx = DOCK.x - p.x;
        const dz = DOCK.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.1) {
          input.x = dx / d;
          input.z = dz / d;
        }
        p.task = 'Swimming for dock';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }

      if (p.clinging) {
        // Caught hold of the hull: hold E to haul over the gunwale.
        input.reel = true;
        p.task = 'Climbing aboard';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }

      // In the water, not yet clinging: swim toward the boat hull.
      const gap = hullGap(w, p);
      if (gap < GRAB_REACH * 1.5 && canAct(p)) {
        act(p.id, { type: 'rescue' });
      }

      const dx = w.boat.x - p.x;
      const dz = w.boat.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        input.x = dx / d;
        input.z = dz / d;
      }
      p.task = 'Swimming to boat';
      p.input = { ...input, seq: p.input.seq + 1 };
      continue;
    }

    // -------------------------------------------------------------
    // 2. On-Deck: Rescuing Overboard Teammates
    // -------------------------------------------------------------
    const pPos = anglerPosition(w, p);
    const drowning = w.players.find(
      (other) =>
        other.id !== p.id &&
        other.swimming &&
        !other.downedUntil &&
        distance(pPos, other) < 6.8,
    );
    if (drowning && canAct(p)) {
      act(p.id, { type: 'rescue' });
      p.task = `Rescuing ${drowning.name}`;
      p.input = { ...input, seq: p.input.seq + 1 };
      continue;
    }

    // -------------------------------------------------------------
    // 3. Wildlife Hazards: Seagull diving for catch
    // -------------------------------------------------------------
    if (w.pending && canAct(p) && !p.y && !p.vy) {
      // Scare the gull away before it steals the landed catch.
      act(p.id, { type: 'jump' });
      p.task = 'Scaring seagull';
      p.input = { ...input, seq: p.input.seq + 1 };
      continue;
    }

    // -------------------------------------------------------------
    // 4. Wildlife Hazards: Crab on deck
    // -------------------------------------------------------------
    if (w.crab) {
      const cdx = w.crab.x - p.x;
      const cdz = w.crab.z - p.z;
      const cd = Math.hypot(cdx, cdz);
      if (cd < 0.85 && canAct(p) && !p.y && !p.vy) {
        // Stomp crab by landing a jump on it.
        act(p.id, { type: 'jump' });
        p.task = 'Stomping crab';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }
      if (cd > 0.3) {
        input.x = clamp(cdx * 1.5, -1, 1);
        input.z = clamp(cdz * 1.5, -1, 1);
        p.task = 'Chasing crab';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }
    }

    // -------------------------------------------------------------
    // 5. Boat Crisis: Leaks and Flooding
    // -------------------------------------------------------------
    if (w.leak) {
      const patchers = w.players.filter(
        (o) =>
          !o.swimming &&
          Math.hypot(o.x - w.leak!.x, o.z - w.leak!.z) < LEAK_REACH,
      );
      // Up to 2 players can effectively patch; prioritize if not covered.
      if (patchers.length < 2 || patchers.some((o) => o.id === p.id)) {
        const ldx = w.leak.x - p.x;
        const ldz = w.leak.z - p.z;
        const ld = Math.hypot(ldx, ldz);
        if (ld < LEAK_REACH) {
          input.reel = true;
          p.task = 'Patching leak';
          p.input = { ...input, seq: p.input.seq + 1 };
          continue;
        } else {
          input.x = clamp(ldx * 2, -1, 1);
          input.z = clamp(ldz * 2, -1, 1);
          p.task = 'Rushing to leak';
          p.input = { ...input, seq: p.input.seq + 1 };
          continue;
        }
      }
    }

    if (w.boat.flood > 0.15) {
      // Water is accumulating: bail at the bucket if leak is handled or absent.
      const bdx = BUCKET.x - p.x;
      const bdz = BUCKET.z - p.z;
      const bd = Math.hypot(bdx, bdz);
      if (bd < BUCKET_REACH) {
        input.reel = true;
        p.task = 'Bailing water';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      } else if (w.boat.flood > 0.3) {
        input.x = clamp(bdx * 2, -1, 1);
        input.z = clamp(bdz * 2, -1, 1);
        p.task = 'Heading to bucket';
        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }
    }

    // -------------------------------------------------------------
    // 6. Deck Balance & Severe Tilt
    // -------------------------------------------------------------
    const slopeX = -Math.sin(w.boat.roll);
    const slopeZ = Math.sin(w.boat.pitch) * Math.cos(w.boat.roll);
    const tilt = Math.hypot(slopeX, slopeZ);
    const nearEdge =
      Math.abs(p.x) > BOAT_HALF.x - 0.4 || Math.abs(p.z) > BOAT_HALF.z - 0.4;

    if (tilt > 0.25) {
      input.brace = true;
      if (nearEdge) {
        // Counteract sliding toward the water.
        input.x = clamp(-slopeX * 1.5, -1, 1);
        input.z = clamp(-slopeZ * 1.5, -1, 1);
      }
    }

    // -------------------------------------------------------------
    // 7. Fishing: Tangled Lines
    // -------------------------------------------------------------
    if (p.line?.tangled) {
      if (canAct(p)) {
        act(p.id, { type: 'untangle' });
      }
      p.task = 'Untangling lines';
      p.input = { ...input, seq: p.input.seq + 1 };
      continue;
    }

    // -------------------------------------------------------------
    // 8. Fishing: Reeling Fish on Line
    // -------------------------------------------------------------
    if (p.line?.kind === 'fish') {
      const fish = w.fish.find((f) => f.id === p.line!.target);
      if (fish) {
        // Fish is surging or tension is red/near limit: ease off and brace!
        const dangerousTension =
          p.line.tension > 0.82 || p.line.strain > 0.45 || fish.surge;
        if (dangerousTension) {
          input.reel = false;
          input.brace = true;
          p.task = 'Easing off surge';
        } else {
          // Fish is tired: wind it in!
          input.reel = true;
          p.task = `Reeling in ${CATCHES[fish.kind].name}`;
        }

        // Avoid being pulled over the side: lean toward the center of the boat.
        if (nearEdge) {
          input.x = clamp(-Math.sign(p.x) * 0.4, -1, 1);
          input.z = clamp(-Math.sign(p.z) * 0.4, -1, 1);
        }

        p.input = { ...input, seq: p.input.seq + 1 };
        continue;
      }
    }

    // -------------------------------------------------------------
    // 9. Fishing: Cast if Rod is Empty
    // -------------------------------------------------------------
    if (!p.line && !p.paddle && canAct(p)) {
      const availableFish = w.fish.filter(
        (f) =>
          !f.respawnAt && distance(pPos, f) >= 1.5 && distance(pPos, f) <= 22,
      );

      if (availableFish.length > 0) {
        const best = availableFish
          .map((f) => {
            const d = distance(pPos, f);
            const helpers = hookedAnglers(w, f.id).length;
            let score = 40 - d;
            // Encourage cooperative team-pull on bigger catches!
            if (helpers > 0) score += 30;
            if (f.kind === 'monster') score += 45;
            else if (f.kind === 'pike' || f.kind === 'eel') score += 20;
            if (w.clock < f.stunnedUntil) score += 35;
            return { f, score };
          })
          .sort((a, b) => b.score - a.score)[0]?.f;

        if (best) {
          act(p.id, { type: 'cast', x: best.x, z: best.z });
          p.task = `Casting for ${CATCHES[best.kind].name}`;
          p.input = { ...input, seq: p.input.seq + 1 };
          continue;
        }
      }
    }

    // -------------------------------------------------------------
    // 10. Stay around assigned deck quadrant to prevent line clutter
    // -------------------------------------------------------------
    const home = SLOT_HOME[p.color % SLOT_HOME.length];
    const hdx = home.x - p.x;
    const hdz = home.z - p.z;
    if (Math.hypot(hdx, hdz) > 0.6 && !p.line) {
      input.x = clamp(hdx * 1.5, -1, 1);
      input.z = clamp(hdz * 1.5, -1, 1);
    }

    p.task = p.line ? 'Waiting on line' : 'Ready';
    p.input = { ...input, seq: p.input.seq + 1 };
  }
}
