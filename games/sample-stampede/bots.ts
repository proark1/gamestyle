import {
  ITEM_DEFS,
  type ItemKind,
  type PlayerInput,
  type SampleStampedeWorld,
  type ShoppingCart,
} from './types';

export function updateSampleStampedeBots(
  world: SampleStampedeWorld,
  _dt: number,
): Map<string, PlayerInput> {
  const inputs = new Map<string, PlayerInput>();

  for (const player of world.players) {
    if (!player.bot) {
      inputs.set(player.id, player.input);
      continue;
    }

    const cart = world.carts.find((c) => c.id === player.cartId);
    if (!cart) continue;

    if (player.role === 'driver') {
      const driverInp = computeDriverBotInput(world, cart);
      inputs.set(player.id, driverInp);
    } else {
      const grabberInp = computeGrabberBotInput(world, cart);
      inputs.set(player.id, grabberInp);
    }
  }

  return inputs;
}

function computeDriverBotInput(
  world: SampleStampedeWorld,
  cart: ShoppingCart,
): PlayerInput {
  // 1. Determine destination target (X, Z)
  let targetX = 0;
  let targetZ = 0;

  // Check if manifest is complete -> Head to Exit Gauntlet!
  const counts: Partial<Record<ItemKind, number>> = {};
  for (const it of cart.items) {
    counts[it.kind] = (counts[it.kind] || 0) + 1;
  }
  const isManifestComplete =
    cart.manifest.targetItems.every(
      (ti) => (counts[ti.kind] || 0) >= ti.required,
    ) && cart.items.length > 0;

  // Has contraband (e.g. 10-foot teddy)? We need to get rid of it or find a rival!
  const hasContraband = cart.items.some(
    (it) => ITEM_DEFS[it.kind].isContraband,
  );

  if (isManifestComplete && !hasContraband) {
    targetX = world.exitGauntlet.x;
    targetZ = world.exitGauntlet.z;
  } else {
    // Check if active sample kiosk is calling!
    const activeKiosk = world.kiosks.find((k) => k.active);
    if (activeKiosk && Math.random() < 0.6) {
      targetX = activeKiosk.x;
      targetZ = activeKiosk.z;
    } else {
      // Find nearest item that is needed for manifest
      const neededKinds = cart.manifest.targetItems
        .filter((ti) => (counts[ti.kind] || 0) < ti.required)
        .map((ti) => ti.kind);

      let bestDist = Infinity;
      let bestItem = null;

      for (const item of world.groundItems) {
        if (neededKinds.includes(item.kind)) {
          const dx = item.x - cart.x;
          const dz = item.z - cart.z;
          const d = dx * dx + dz * dz;
          if (d < bestDist) {
            bestDist = d;
            bestItem = item;
          }
        }
      }

      if (bestItem) {
        targetX = bestItem.x;
        targetZ = bestItem.z;
      } else {
        // Roam aisles
        targetX = Math.sin(world.clock * 0.001) * 16;
        targetZ = Math.cos(world.clock * 0.0008) * 20;
      }
    }
  }

  // Calculate steering towards target
  const toX = targetX - cart.x;
  const toZ = targetZ - cart.z;
  const targetAngle = Math.atan2(-toZ, toX); // -Z is North

  // Current forward angle
  let angleDiff = targetAngle - cart.rotY;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // Positive steer turns left, toward a larger heading, like the A key.
  const steer = Math.max(-1, Math.min(1, angleDiff * 1.6));

  // Throttle
  let throttle = 0.9;
  const dist = Math.sqrt(toX * toX + toZ * toZ);
  if (dist < 2.0 && isManifestComplete) {
    throttle = 0.5;
  }

  // Drift when making sharp corner at speed
  const drift = Math.abs(angleDiff) > 0.9;

  return {
    x: steer,
    z: throttle,
    steer,
    throttle,
    drift,
    grabberAction: false,
  };
}

function computeGrabberBotInput(
  world: SampleStampedeWorld,
  cart: ShoppingCart,
): PlayerInput {
  let grabberAction = false;
  let grabberAngle = 0;

  // Check if close to an item (< 2.2m)
  for (const it of world.groundItems) {
    const dx = it.x - cart.x;
    const dz = it.z - cart.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2.5) {
      const itAngle = Math.atan2(-dz, dx);
      grabberAngle = itAngle - cart.rotY;
      grabberAction = true;
      break;
    }
  }

  // Or check if close to a rival cart to swat them!
  if (!grabberAction) {
    for (const rival of world.carts) {
      if (rival.id === cart.id) continue;
      const dx = rival.x - cart.x;
      const dz = rival.z - cart.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 2.2) {
        const rivalAngle = Math.atan2(-dz, dx);
        grabberAngle = rivalAngle - cart.rotY;
        grabberAction = true;
        break;
      }
    }
  }

  return {
    x: 0,
    z: 0,
    steer: 0,
    throttle: 0,
    drift: false,
    grabberAction,
    grabberAngle,
  };
}
