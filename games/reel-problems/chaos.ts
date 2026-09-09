import type {
  LakeWeather,
  ReelEvent,
  ReelWorld,
  SeaVisitor,
  WeatherKind,
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
  return ['shark', 'jellyfish', 'jellyfish'].map((kind, i) => ({
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

type Emit = (w: ReelWorld, kind: ReelEvent['kind'], message: string) => void;

/** Only the host advances hazards; all timing and randomness survive handover. */
export function advanceChaos(w: ReelWorld, dt: number, emit: Emit) {
  const weather = w.weather,
    boat = w.boat;
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
  weather.windX = Math.sin(weather.direction) * weather.gust * 13;
  weather.windZ = Math.cos(weather.direction) * weather.gust * 13;
  const localX = Math.sin(weather.direction - boat.yaw);
  const localZ = Math.cos(weather.direction - boat.yaw);
  if (weather.nextThunderAt && w.clock >= weather.nextThunderAt) {
    weather.nextThunderAt = w.clock + 5500 + random(w) * 4000;
    weather.flashUntil = w.clock + 450;
    const strikeAngle = random(w) * Math.PI * 2;
    weather.lightningX = boat.x + Math.sin(strikeAngle) * 12;
    weather.lightningZ = boat.z + Math.cos(strikeAngle) * 12;
    boat.rollVelocity -= localX * 0.55;
    boat.pitchVelocity += localZ * 0.4;
    emit(
      w,
      'thunder',
      'Thunder cracks! A wave hits the boat — brace and balance!',
    );
  }

  for (const visitor of w.wildlife) {
    if (visitor.activeUntil && w.clock >= visitor.activeUntil) {
      visitor.activeUntil = 0;
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
      emit(
        w,
        visitor.kind,
        visitor.kind === 'shark'
          ? 'Shark fin! Watch for a bump and keep your balance.'
          : 'Jellyfish drifting in! Keep your lines away from the glowing tentacles.',
      );
    }
    if (visitor.kind === 'shark') {
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
      if (near < 6 && w.clock >= visitor.hitAt) {
        visitor.hitAt = w.clock + 6200;
        const nx = bx / Math.max(0.1, near),
          nz = bz / Math.max(0.1, near);
        boat.vx -= nx * 1.6;
        boat.vz -= nz * 1.6;
        boat.rollVelocity +=
          (nx * Math.cos(boat.yaw) - nz * Math.sin(boat.yaw)) * 1.35;
        boat.pitchVelocity -=
          (nx * Math.sin(boat.yaw) + nz * Math.cos(boat.yaw)) * 0.95;
        emit(
          w,
          'shark',
          'The shark bumped the hull! Shift your weight and hold on!',
        );
      }
    } else {
      visitor.x += (Math.sin(visitor.angle) * 0.3 + weather.windX * 0.035) * dt;
      visitor.z += (Math.cos(visitor.angle) * 0.3 + weather.windZ * 0.035) * dt;
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
  const wave = Math.sin(w.clock / 660) * 0.22 + Math.sin(w.clock / 1100) * 0.1;
  return {
    forceX: weather.windX,
    forceZ: weather.windZ,
    roll: -localX * weather.gust * (0.38 + wave),
    pitch: localZ * weather.gust * (0.28 + wave),
  };
}
