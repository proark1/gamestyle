import {
  CRADLE_WIDTH,
  MAX_TILT_DEG,
  ROOF_ALTITUDE,
  GROUND_ALTITUDE,
  TILT_SLIP_DEG,
  TILT_WARNING_DEG,
  clamp,
  degToRad,
  radToDeg,
  type CradleState,
  type GameEvent,
  type Pigeon,
  type Player,
  type SoapBucket,
  type WindGust,
} from './types';

export const GRAVITY = 9.81;
export const PLAYER_WALK_SPEED = 3.2; // m/s
export const BUCKET_FRICTION = 0.35;
export const SLIP_DECEL = 1.2;

export function stepCradleKinematics(cradle: CradleState, dt: number) {
  // Clamp cable heights to skyscraper bounds
  cradle.leftHeight = clamp(
    cradle.leftHeight,
    GROUND_ALTITUDE,
    ROOF_ALTITUDE - 2,
  );
  cradle.rightHeight = clamp(
    cradle.rightHeight,
    GROUND_ALTITUDE,
    ROOF_ALTITUDE - 2,
  );

  cradle.centerHeight = (cradle.leftHeight + cradle.rightHeight) / 2;

  // Exact geometric tilt angle
  const rawAngle = Math.atan2(
    cradle.rightHeight - cradle.leftHeight,
    CRADLE_WIDTH,
  );
  const maxRad = degToRad(MAX_TILT_DEG);
  cradle.tiltRad = clamp(rawAngle, -maxRad, maxRad);
  cradle.tiltDeg = radToDeg(cradle.tiltRad);

  // Suds on deck evaporate/clear slowly
  if (cradle.deckSuds > 0) {
    cradle.deckSuds = Math.max(0, cradle.deckSuds - dt * 0.05);
  }

  // Cradle sway oscillation damping
  cradle.swayX *= Math.exp(-dt * 1.5);
  cradle.swayZ *= Math.exp(-dt * 2.0);
}

export function stepBucketPhysics(
  bucket: SoapBucket,
  cradle: CradleState,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  const absTilt = Math.abs(cradle.tiltDeg);
  const slipThreshold = cradle.deckSuds > 0.3 ? 12.0 : TILT_SLIP_DEG - 2.0;

  // Tangential gravity along cradle deck: if right is higher (tiltRad > 0), downhill is to the left (-x)
  const downhillAccel = -GRAVITY * Math.sin(cradle.tiltRad);

  if (absTilt > slipThreshold) {
    const effFriction = Math.max(
      0.04,
      BUCKET_FRICTION * (1 - cradle.deckSuds * 0.8),
    );
    const frictionDecel = effFriction * GRAVITY * Math.cos(cradle.tiltRad);

    const netAccel =
      downhillAccel > 0
        ? Math.max(0, downhillAccel - frictionDecel)
        : Math.min(0, downhillAccel + frictionDecel);

    bucket.vx += netAccel * dt;
    bucket.x += bucket.vx * dt;

    const lastSlideEvent =
      events.length > 0 && events[events.length - 1].type === 'bucket_slide';
    if (Math.abs(bucket.vx) > 0.6 && !lastSlideEvent) {
      events.push({
        id: ++eventIdRef.current,
        type: 'bucket_slide',
        detail: `Bucket sliding down deck at ${absTilt.toFixed(0)}°`,
      });
    }
  } else {
    // Come to a rest
    bucket.vx *= Math.exp(-dt * 6.0);
    bucket.x += bucket.vx * dt;
  }

  // End rail collision
  const maxDeckX = CRADLE_WIDTH / 2 - 0.6; // 4.4m
  if (bucket.x < -maxDeckX) {
    bucket.x = -maxDeckX;
    if (Math.abs(bucket.vx) > 2.0 || absTilt > 32.0) {
      triggerBucketSpill(bucket, cradle, events, eventIdRef);
    }
    bucket.vx = -bucket.vx * 0.25;
  } else if (bucket.x > maxDeckX) {
    bucket.x = maxDeckX;
    if (Math.abs(bucket.vx) > 2.0 || absTilt > 32.0) {
      triggerBucketSpill(bucket, cradle, events, eventIdRef);
    }
    bucket.vx = -bucket.vx * 0.25;
  }

  // Respawn or refill spilled bucket
  if (bucket.spilled) {
    bucket.spillTimer -= dt;
    if (bucket.spillTimer <= 0) {
      bucket.spilled = false;
      bucket.sudsLevel = 1.0;
      bucket.x = bucket.id === 'bucket-1' ? -2.2 : 2.2;
      bucket.vx = 0;
    }
  }
}

function triggerBucketSpill(
  bucket: SoapBucket,
  cradle: CradleState,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  if (bucket.spilled) return;
  bucket.spilled = true;
  bucket.spillTimer = 6.0; // 6s until clean replacement
  bucket.sudsLevel = 0.1;
  cradle.deckSuds = 1.0; // deck becomes super slippery

  events.push({
    id: ++eventIdRef.current,
    type: 'bucket_spill',
    detail: 'Soapy water splashed all over the cradle deck!',
  });
}

export function stepPlayerPhysics(
  player: Player,
  cradle: CradleState,
  buckets: SoapBucket[],
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  const absTilt = Math.abs(cradle.tiltDeg);
  const maxDeckX = CRADLE_WIDTH / 2 - 0.35; // 4.65m
  const slipThreshold = cradle.deckSuds > 0.4 ? 12.0 : TILT_SLIP_DEG;

  // Tangential gravity along the cradle
  const downhillAccel = -GRAVITY * Math.sin(cradle.tiltRad);

  switch (player.state) {
    case 'standing':
    case 'cranking':
    case 'cleaning':
    case 'shooing': {
      // Normal walk control
      const inputX = clamp(player.input.x, -1, 1);
      if (Math.abs(inputX) > 0.1) {
        player.facing = inputX > 0 ? 1 : -1;
      }

      const targetVx = inputX * PLAYER_WALK_SPEED;
      player.vx += (targetVx - player.vx) * Math.min(1, dt * 10);
      player.deckX += player.vx * dt;
      player.deckY = 0;

      // Check slip hazard: high tilt or slippery suds slope
      if (absTilt > slipThreshold) {
        // Player loses footing!
        player.state = 'sliding';
        player.slips++;
        events.push({
          id: ++eventIdRef.current,
          type: 'slip',
          playerId: player.id,
          detail: `${player.name} lost footing at ${absTilt.toFixed(0)}°!`,
        });
      }

      // Check bucket bonk collision
      for (const bucket of buckets) {
        if (
          !bucket.spilled &&
          Math.abs(bucket.vx) > 1.8 &&
          Math.abs(bucket.x - player.deckX) < 0.65
        ) {
          // Bonked by runaway bucket!
          player.state = 'sliding';
          player.vx += bucket.vx * 0.9;
          player.slips++;
          events.push({
            id: ++eventIdRef.current,
            type: 'slip',
            playerId: player.id,
            detail: `${player.name} got knocked over by a sliding soap bucket!`,
          });
        }
      }
      break;
    }

    case 'sliding': {
      // Downhill acceleration with dynamic friction
      const effFriction = Math.max(0.02, 0.22 * (1 - cradle.deckSuds * 0.75));
      const frictionDecel = effFriction * GRAVITY * Math.cos(cradle.tiltRad);

      const netAccel =
        downhillAccel > 0
          ? Math.max(0, downhillAccel - frictionDecel)
          : Math.min(0, downhillAccel + frictionDecel);

      player.vx += netAccel * dt;
      // Slight user control to try and brace against slide
      player.vx += clamp(player.input.x, -1, 1) * 0.8 * dt;
      player.deckX += player.vx * dt;
      player.deckY = 0;

      // If tilt drops below slip threshold and speed slows down, stand back up
      if (absTilt < slipThreshold - 3.0 && Math.abs(player.vx) < 0.6) {
        player.state = 'standing';
        player.vx = 0;
      }

      // If sliding past the edge of the cradle, FALL OFF AND DANGLE BY TETHER!
      if (Math.abs(player.deckX) > maxDeckX) {
        player.deckX = player.deckX > 0 ? maxDeckX : -maxDeckX;
        player.state = 'dangling';
        player.deckY = -0.5;
        player.dangleY = -2.2;
        player.tetherLength = 2.4;
        player.vx = 0;
        player.dangles++;

        events.push({
          id: ++eventIdRef.current,
          type: 'dangle',
          playerId: player.id,
          detail: `${player.name} slid over the ledge and dangles by their safety tether!`,
        });
      }
      break;
    }

    case 'dangling': {
      // Worker hangs below the cradle deck by their harness tether, kicking and swinging
      player.deckY += (player.dangleY - player.deckY) * Math.min(1, dt * 5.0);

      // Swaying in the wind / pendulum bounce
      player.dangleY =
        -2.3 + Math.sin(Date.now() * 0.005 + player.color) * 0.25;

      // Climb input (Jump / Action key pressed)
      if (player.input.jump || player.input.action) {
        player.state = 'climbing';
        player.stateTimer = 1.2; // 1.2s to pull up
      }
      break;
    }

    case 'climbing': {
      // Pulling oneself back up onto the platform deck
      player.deckY += dt * 2.2;
      if (player.deckY >= 0) {
        player.deckY = 0;
        player.state = 'standing';
        player.deckX = clamp(
          player.deckX * 0.85,
          -maxDeckX + 0.6,
          maxDeckX - 0.6,
        );
        player.vx = 0;

        events.push({
          id: ++eventIdRef.current,
          type: 'climb_up',
          playerId: player.id,
          detail: `${player.name} hauled themselves back up onto the cradle!`,
        });
      }
      break;
    }
  }

  // Keep deckX bounded
  player.deckX = clamp(player.deckX, -maxDeckX, maxDeckX);
}

/** Keeps a perched pigeon on its cable or railing as the cradle moves. */
function anchorPigeon(pigeon: Pigeon, cradle: CradleState) {
  switch (pigeon.target) {
    case 'cable-left':
      pigeon.x = -CRADLE_WIDTH / 2;
      pigeon.y = cradle.leftHeight + 1.2;
      break;
    case 'cable-right':
      pigeon.x = CRADLE_WIDTH / 2;
      pigeon.y = cradle.rightHeight + 1.2;
      break;
    case 'railing-left':
      pigeon.x = -CRADLE_WIDTH / 2 + 1.0;
      pigeon.y = cradle.leftHeight + 1.1;
      break;
    case 'railing-right':
      pigeon.x = CRADLE_WIDTH / 2 - 1.0;
      pigeon.y = cradle.rightHeight + 1.1;
      break;
  }
}

export function stepPigeonBehavior(
  pigeon: Pigeon,
  cradle: CradleState,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  pigeon.flapTimer += dt;

  if (pigeon.perched) {
    pigeon.timeToLeave -= dt;

    anchorPigeon(pigeon, cradle);

    // Violent tilt scares pigeon away
    if (
      Math.abs(cradle.tiltDeg) > TILT_WARNING_DEG ||
      pigeon.timeToLeave <= 0
    ) {
      pigeon.perched = false;
      events.push({
        id: ++eventIdRef.current,
        type: 'pigeon_shoo',
        detail: 'Pigeon flew away into the high-altitude updraft!',
      });
    }
  } else {
    // Flying around
    pigeon.y += dt * 3.5;
    pigeon.x += (Math.sin(pigeon.flapTimer * 2) > 0 ? 1 : -1) * dt * 2.0;

    // Respawn / swoop in periodically
    if (pigeon.y > ROOF_ALTITUDE + 10) {
      if (Math.random() < 0.25) {
        pigeon.perched = true;
        pigeon.timeToLeave = 12 + Math.random() * 8;
        pigeon.target =
          Math.random() < 0.5
            ? Math.random() < 0.5
              ? 'cable-left'
              : 'cable-right'
            : Math.random() < 0.5
              ? 'railing-left'
              : 'railing-right';
        // It lands where it perches. Left high above the cradle for a frame,
        // a worker below could shoo it by x alone and it would land again,
        // many times a second.
        anchorPigeon(pigeon, cradle);

        events.push({
          id: ++eventIdRef.current,
          type: 'pigeon_land',
          detail: 'An aggressive skyscraper pigeon landed on the winch cable!',
        });
      }
    }
  }
}

export function stepWind(
  wind: WindGust,
  cradle: CradleState,
  dt: number,
  events: GameEvent[],
  eventIdRef: { current: number },
) {
  wind.timer -= dt;
  if (wind.active) {
    cradle.swayX += wind.strength * dt * 2.5;
    if (wind.timer <= 0) {
      wind.active = false;
      wind.timer = 15 + Math.random() * 15; // wait for next gust
    }
  } else if (wind.timer <= 0) {
    wind.active = true;
    wind.duration = 4 + Math.random() * 3;
    wind.timer = wind.duration;
    wind.strength =
      (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.6);

    events.push({
      id: ++eventIdRef.current,
      type: 'wind_gust',
      detail: 'A strong gust of wind buffeted the suspended cradle!',
    });
  }
}
