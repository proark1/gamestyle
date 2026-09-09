import {
  distance,
  farmMode,
  GATE,
  PANEL,
  LADDER_EXIT,
  type Cow,
  type CowRoutine,
  type FarmWorld,
} from './types';
import { clearCoverPosition } from './visibility';

export function farmRandom(w: FarmWorld) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

function chooseRoutine(w: FarmWorld, cow: Cow): CowRoutine {
  const choice = farmRandom(w);
  const activity = choice < 0.45 ? 'graze' : choice < 0.9 ? 'walk' : 'idle';
  const angle = farmRandom(w) * Math.PI * 2;
  const length = 3 + farmRandom(w) * 4;
  const duration =
    activity === 'graze'
      ? 3500 + farmRandom(w) * 4500
      : activity === 'walk'
        ? 3000 + farmRandom(w) * 4000
        : 800 + farmRandom(w) * 2000;
  const target = {
    x: Math.max(-8.6, Math.min(8.6, cow.x * 0.84 + Math.sin(angle) * length)),
    z: Math.max(-8.6, Math.min(8.6, cow.z * 0.84 + Math.cos(angle) * length)),
  };
  if (farmMode(w) === 'human') {
    // Normal cows visit the same places as thieves; an errand alone is not proof.
    if (activity === 'walk' && farmRandom(w) < 0.35) {
      const places = [
        { x: -7, z: -6 },
        { x: 7, z: -6 },
        { x: 6, z: 4 },
        GATE,
        PANEL,
        LADDER_EXIT,
      ];
      const place = places[Math.floor(farmRandom(w) * places.length)];
      target.x = Math.max(
        -8.6,
        Math.min(8.6, place.x + (farmRandom(w) - 0.5) * 2),
      );
      target.z = Math.max(
        -8.6,
        Math.min(8.6, place.z + (farmRandom(w) - 0.5) * 2),
      );
    }
    clearCoverPosition(target);
  }
  return {
    activity,
    until: w.clock + duration,
    // Local wandering with a gentle pull inward keeps the herd loose, without shared destinations.
    target,
    speed: 1.9 + farmRandom(w) * 0.7,
  };
}

export function resetHerd(w: FarmWorld) {
  w.cowRoutines = {};
  for (const cow of w.cows) {
    const routine = chooseRoutine(w, cow);
    w.cowRoutines[cow.id] = routine;
    cow.grazing = routine.activity === 'graze';
    cow.moving = false;
    if (routine.activity === 'walk')
      cow.angle = Math.atan2(
        routine.target.x - cow.x,
        routine.target.z - cow.z,
      );
  }
}

export function herdIntent(w: FarmWorld, cow: Cow) {
  w.cowRoutines ??= {};
  let routine = w.cowRoutines[cow.id];
  if (
    !routine ||
    w.clock >= routine.until ||
    (routine.activity === 'walk' && distance(cow, routine.target) < 0.2)
  ) {
    routine = chooseRoutine(w, cow);
    w.cowRoutines[cow.id] = routine;
  }
  cow.grazing = routine.activity === 'graze';
  const dx = routine.target.x - cow.x,
    dz = routine.target.z - cow.z;
  const length = Math.hypot(dx, dz);
  return {
    x: routine.activity === 'walk' && length > 0.05 ? dx / length : 0,
    z: routine.activity === 'walk' && length > 0.05 ? dz / length : 0,
    speed: routine.speed,
  };
}
