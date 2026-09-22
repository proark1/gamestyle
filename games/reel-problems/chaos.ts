import {
  BITE_COOLDOWN,
  DOWNED_MS,
  JELLY_REACH,
  JELLY_STING,
  SHARK_BITE,
  SHARK_REACH,
  STING_COOLDOWN,
  STING_STUN_MS,
  WIND_FORCE,
  WIND_PITCH,
  WIND_ROLL,
  type Angler,
  type Driftwood,
  type LakeWeather,
  type LeakCause,
  type ReelEvent,
  type ReelWorld,
  type SeaVisitor,
  type WeatherKind,
} from './types';

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  calm: 'Calm water',
  wind: 'Strong wind — brace!',
  rain: 'Rain — slippery deck',
  storm: 'Thunderstorm — hold on!',
};

export function random(w: ReelWorld) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

export function freshWeather(now: number): LakeWeather {
  return {
    kind: 'calm',
    since: now,
    until: now + 14_000,
    direction: 0,
    windX: 0,
    windZ: 0,
    rain: 0,
    gust: 0,
    nextThunderAt: 0,
    flashUntil: 0,
    lightningX: 0,
    lightningZ: 0,
  };
}

export function freshWildlife(now: number): SeaVisitor[] {
  return ['shark', 'jellyfish', 'jellyfish', 'gull'].map((kind, i) => ({
    id: `visitor-${i}`,
    kind: kind as SeaVisitor['kind'],
    x: 0,
    z: 0,
    angle: 0,
    activeUntil: 0,
    nextAt: now + 24_000 + i * 11_000,
    hitAt: 0,
  }));
}

/** Two logs out by the shore, drifting in across the lake. */
export function freshDebris(): Driftwood[] {
  return [
    { x: 31, z: -24 },
    { x: -30, z: 25 },
  ].map(({ x, z }, i) => {
    const d = Math.hypot(x, z);
    return {
      id: `log-${i}`,
      x,
      z,
      vx: (-x / d) * 0.7,
      vz: (-z / d) * 0.7,
      angle: Math.atan2(-x, -z),
      bumpAt: 0,
    };
  });
}

type Emit = (
  w: ReelWorld,
  kind: ReelEvent['kind'],
  message: string,
  position?: { x: number; z: number },
) => void;

/** Anglers in the water and still fighting: everything wildlife cares about. */
function swimmers(w: ReelWorld) {
  return w.players.filter((p) => p.swimming && !p.downedUntil);
}
/**
 * A hit on a swimmer. Grip breaks and the climb resets either way, so wildlife
 * costs you the five seconds you had banked. Two shark bites put an angler
 * under until the crew can get a rope on them.
 */
function wound(w: ReelWorld, emit: Emit, p: Angler, bite: boolean) {
  p.health = Math.max(0, p.health - (bite ? SHARK_BITE : JELLY_STING));
  p.clinging = false;
  p.climb = 0;
  if (bite) p.lostHat = true;
  if (!bite) p.stunUntil = w.clock + STING_STUN_MS;
  // Thrown clear of the boat, so the hull is a swim away again.
  const dx = p.x - w.boat.x,
    dz = p.z - w.boat.z,
    d = Math.max(0.1, Math.hypot(dx, dz)),
    shove = bite ? 2.6 : 1.4;
  p.x += (dx / d) * shove;
  p.z += (dz / d) * shove;
  if (p.health <= 0) {
    p.downedUntil = w.clock + DOWNED_MS;
    emit(
      w,
      bite ? 'chomp' : 'sting',
      `${p.name} went under! The crew is hauling them out.`,
      { x: p.x, z: p.z },
    );
    return;
  }
  emit(
    w,
    bite ? 'chomp' : 'sting',
    bite
      ? `The shark bit ${p.name}! Get out of the water.`
      : `${p.name} grabbed a fistful of tentacles — hands wide open.`,
    { x: p.x, z: p.z },
  );
}

const ARRIVALS: Record<SeaVisitor['kind'], string> = {
  shark: 'Shark fin! Watch for a bump and keep your balance.',
  jellyfish:
    'Jellyfish drifting in! Keep your lines away from the glowing tentacles.',
  gull: 'Seagulls overhead! When one dives for a catch, jump to scare it off.',
};

/** Only the host advances hazards; all timing and randomness survive handover. */
export function advanceChaos(w: ReelWorld, dt: number, emit: Emit) {
  const weather = w.weather,
    boat = w.boat;
  // A plank the sea cracked this frame, for the hull to spring a leak from.
  let crack: LeakCause | null = null;
  if (w.clock >= weather.until) {
    const next: Record<WeatherKind, WeatherKind> = {
      calm: 'wind',
      wind: 'rain',
      rain: 'storm',
      storm: 'calm',
    };
    weather.kind = next[weather.kind];
    weather.since = w.clock;
    weather.until = w.clock + 14_000 + random(w) * 9_000;
    weather.direction = random(w) * Math.PI * 2;
    weather.nextThunderAt = weather.kind === 'storm' ? w.clock + 3200 : 0;
    emit(w, 'weather', WEATHER_LABELS[weather.kind]);
  }
  const strength =
    weather.kind === 'storm'
      ? 1
      : weather.kind === 'wind'
        ? 0.8
        : weather.kind === 'rain'
          ? 0.25
          : 0;
  const ramp = Math.min(1, (w.clock - weather.since) / 2500);
  weather.gust = strength * ramp * (0.65 + 0.35 * Math.sin(w.clock / 850) ** 2);
  const rainTarget =
    weather.kind === 'storm' ? 1 : weather.kind === 'rain' ? 0.7 : 0;
  weather.rain += (rainTarget - weather.rain) * (1 - Math.exp(-dt * 1.5));
  weather.windX = Math.sin(weather.direction) * weather.gust * WIND_FORCE;
  weather.windZ = Math.cos(weather.direction) * weather.gust * WIND_FORCE;
  const localX = Math.sin(weather.direction - boat.yaw);
  const localZ = Math.cos(weather.direction - boat.yaw);
  if (weather.nextThunderAt && w.clock >= weather.nextThunderAt) {
    weather.nextThunderAt = w.clock + 5500 + random(w) * 4000;
    weather.flashUntil = w.clock + 450;
    const strikeAngle = random(w) * Math.PI * 2;
    weather.lightningX = boat.x + Math.sin(strikeAngle) * 12;
    weather.lightningZ = boat.z + Math.cos(strikeAngle) * 12;
    boat.rollVelocity -= localX * 0.38;
    boat.pitchVelocity += localZ * 0.28;
    if (random(w) < 0.2) crack = 'thunder';
    emit(
      w,
      'thunder',
      'Thunder cracks! A wave hits the boat — brace and balance!',
    );
  }

  // Sharks a wreck drew in leave for good once their hunt is over.
  w.wildlife = w.wildlife.filter(
    (visitor) => !visitor.wreck || w.clock < visitor.activeUntil,
  );
  for (const visitor of w.wildlife) {
    if (visitor.activeUntil && w.clock >= visitor.activeUntil) {
      visitor.activeUntil = 0;
      visitor.carry = undefined;
      visitor.nextAt = w.clock + 28_000 + random(w) * 22_000;
    }
    if (!visitor.activeUntil) {
      if (w.clock < visitor.nextAt) continue;
      visitor.angle = random(w) * Math.PI * 2;
      const radius = visitor.kind === 'shark' ? 11 : 7 + random(w) * 4;
      visitor.x = boat.x + Math.sin(visitor.angle) * radius;
      visitor.z = boat.z + Math.cos(visitor.angle) * radius;
      visitor.activeUntil =
        w.clock + (visitor.kind === 'shark' ? 19_000 : 26_000);
      visitor.hitAt = w.clock + 2200;
      emit(w, visitor.kind, ARRIVALS[visitor.kind]);
    }
    if (visitor.kind === 'shark') {
      const prey = swimmers(w)
        .map((p) => ({ p, d: Math.hypot(p.x - visitor.x, p.z - visitor.z) }))
        .sort((a, b) => a.d - b.d)[0];
      // An angler in the water beats bumping the hull for a laugh.
      if (prey) {
        // Bite and back off: while its cooldown runs the shark circles at a
        // distance, and that is the window a bitten angler has to climb out.
        const wary = w.clock < visitor.hitAt;
        const standoff = wary ? 6 : 0;
        const bearing =
          Math.atan2(visitor.x - prey.p.x, visitor.z - prey.p.z) + dt * 1.1;
        const dx = prey.p.x + Math.sin(bearing) * standoff - visitor.x,
          dz = prey.p.z + Math.cos(bearing) * standoff - visitor.z,
          d = Math.max(0.01, Math.hypot(dx, dz)),
          travel = Math.min(d, dt * 7);
        visitor.x += (dx / d) * travel;
        visitor.z += (dz / d) * travel;
        visitor.angle = Math.atan2(dx, dz);
        if (!wary && prey.d < SHARK_REACH) {
          visitor.hitAt = w.clock + BITE_COOLDOWN;
          wound(w, emit, prey.p, true);
        }
      } else {
        const orbit =
          Math.atan2(visitor.x - boat.x, visitor.z - boat.z) + dt * 0.65;
        const radius = 5.4 + Math.sin(w.clock / 1500) * 0.6;
        const dx = boat.x + Math.sin(orbit) * radius - visitor.x;
        const dz = boat.z + Math.cos(orbit) * radius - visitor.z;
        const d = Math.max(0.01, Math.hypot(dx, dz));
        const travel = Math.min(d, dt * 5.5);
        visitor.x += (dx / d) * travel;
        visitor.z += (dz / d) * travel;
        visitor.angle = Math.atan2(dx, dz);
        const bx = visitor.x - boat.x,
          bz = visitor.z - boat.z;
        const near = Math.hypot(bx, bz);
        if (!boat.sunk && near < 6 && w.clock >= visitor.hitAt) {
          visitor.hitAt = w.clock + 6200;
          const nx = bx / Math.max(0.1, near),
            nz = bz / Math.max(0.1, near);
          boat.vx -= nx * 1.6;
          boat.vz -= nz * 1.6;
          boat.rollVelocity +=
            (nx * Math.cos(boat.yaw) - nz * Math.sin(boat.yaw)) * 1.35;
          boat.pitchVelocity -=
            (nx * Math.sin(boat.yaw) + nz * Math.cos(boat.yaw)) * 0.95;
          if (random(w) < 0.2) crack = 'shark';
          emit(
            w,
            'shark',
            'The shark bumped the hull! Shift your weight and hold on!',
          );
        }
      }
    } else if (visitor.kind === 'gull') {
      // Wheeling over the boat, or off over the shore with a stolen catch.
      const dx = visitor.x - boat.x,
        dz = visitor.z - boat.z,
        out = Math.max(0.01, Math.hypot(dx, dz));
      if (visitor.carry) {
        visitor.x += (dx / out) * dt * 8;
        visitor.z += (dz / out) * dt * 8;
        visitor.angle = Math.atan2(dx, dz);
      } else {
        const orbit = Math.atan2(dx, dz) + dt * 0.9,
          tx = boat.x + Math.sin(orbit) * 4 - visitor.x,
          tz = boat.z + Math.cos(orbit) * 4 - visitor.z,
          d = Math.max(0.01, Math.hypot(tx, tz)),
          travel = Math.min(d, dt * 9);
        visitor.x += (tx / d) * travel;
        visitor.z += (tz / d) * travel;
        visitor.angle = Math.atan2(tx, tz);
      }
    } else {
      visitor.x += (Math.sin(visitor.angle) * 0.3 + weather.windX * 0.035) * dt;
      visitor.z += (Math.cos(visitor.angle) * 0.3 + weather.windZ * 0.035) * dt;
      if (w.clock >= visitor.hitAt)
        for (const p of swimmers(w))
          if (Math.hypot(p.x - visitor.x, p.z - visitor.z) < JELLY_REACH) {
            visitor.hitAt = w.clock + STING_COOLDOWN;
            wound(w, emit, p, false);
            break;
          }
      for (const p of w.players) {
        const line = p.line;
        if (
          !line ||
          line.tangled ||
          p.swimming ||
          w.clock < line.clearUntil ||
          w.clock < visitor.hitAt
        )
          continue;
        if (Math.hypot(line.x - visitor.x, line.z - visitor.z) < 2.1) {
          line.tangled = true;
          visitor.hitAt = w.clock + 2200;
          emit(
            w,
            'jellyfish',
            `${p.name}'s line caught jellyfish tentacles! R untangles; reel away from the glow.`,
          );
        }
      }
    }
    const radius = Math.hypot(visitor.x, visitor.z);
    if (radius > 40) {
      visitor.x *= 40 / radius;
      visitor.z *= 40 / radius;
    }
  }
  for (const log of w.debris) {
    log.x += (log.vx + weather.windX * 0.02) * dt;
    log.z += (log.vz + weather.windZ * 0.02) * dt;
    if (Math.hypot(log.x, log.z) <= 40.5) continue;
    // Washed ashore: another piece floats in from elsewhere, across the boat's water.
    const from = random(w) * Math.PI * 2;
    log.x = Math.sin(from) * 39;
    log.z = Math.cos(from) * 39;
    const aimX = boat.x + (random(w) * 2 - 1) * 8 - log.x,
      aimZ = boat.z + (random(w) * 2 - 1) * 8 - log.z,
      d = Math.max(1, Math.hypot(aimX, aimZ)),
      speed = 0.5 + random(w) * 0.4;
    log.vx = (aimX / d) * speed;
    log.vz = (aimZ / d) * speed;
    log.angle = Math.atan2(log.vx, log.vz);
  }
  const wave = Math.sin(w.clock / 660) * 0.22 + Math.sin(w.clock / 1100) * 0.1;
  return {
    forceX: weather.windX,
    forceZ: weather.windZ,
    // The wave rides the gust instead of adding to it, so a lull never heels
    // the boat harder than the gust itself does.
    roll: -localX * weather.gust * WIND_ROLL * (1 + wave),
    pitch: localZ * weather.gust * WIND_PITCH * (1 + wave),
    crack,
  };
}
