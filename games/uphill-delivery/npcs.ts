import { DOOR, GATE, ROUTE, goatPose } from './level';
import { gripPosition, cargoInsideRoom } from './physics';
import {
  angleDelta,
  clamp,
  distanceXZ,
  routeProjection,
  deliveryFloor,
  deliveryGripClear,
  steerDeliveryNpc,
} from './navigation';
import {
  SOFA_CENTER,
  type DeliveryControlAction,
  type DeliveryPlayer,
  type DeliveryWorld,
  type Vec,
} from './types';
import type { DeliveryBrain } from './npc-types';
import { followDeliveryPath } from './npc-path';
import { carryDeliveryInput } from './npc-carry';

type Act = (id: string, action: DeliveryControlAction) => void;
const yawOf = (w: DeliveryWorld) => {
  const q = w.sofa.quaternion;
  return Math.atan2(
    2 * (q.w * q.y + q.x * q.z),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );
};
function brainFor(w: DeliveryWorld, p: DeliveryPlayer): DeliveryBrain {
  w.npcBrains ??= {};
  return (w.npcBrains[p.id] ??= {
    grip: null,
    actionAt: 0,
    movedAt: w.clock,
    last: { x: p.x, y: p.y, z: p.z },
    goal: null,
    thinkAt: 0,
  });
}
function attempt(
  w: DeliveryWorld,
  p: DeliveryPlayer,
  brain: DeliveryBrain,
  type: DeliveryControlAction['type'],
  act: Act,
) {
  if (w.clock < brain.actionAt) return false;
  brain.actionAt = w.clock + 450 + p.color * 35;
  try {
    act(p.id, { type });
    return true;
  } catch {
    return false;
  }
}
export function deliveryGripStand(
  w: DeliveryWorld,
  grip: number,
  from?: Vec,
): Vec {
  const g = gripPosition(w, grip),
    yaw = yawOf(w);
  const radial = Math.hypot(g.x - w.sofa.x, g.z - w.sofa.z);
  const sideX = g.x + ((g.x - w.sofa.x) / radial) * 0.65;
  const sideZ = g.z + ((g.z - w.sofa.z) / radial) * 0.65;
  const sideY = deliveryFloor(
    sideX,
    sideZ,
    w.sofa.y - SOFA_CENTER,
    w.clock - w.started,
  );
  if (sideY !== null) return { x: sideX, y: sideY, z: sideZ };
  const outward = Math.atan2(g.z - w.sofa.z, g.x - w.sofa.x);
  let best: Vec = {
      x: g.x + Math.cos(outward),
      y: w.sofa.y - SOFA_CENTER,
      z: g.z + Math.sin(outward),
    },
    score = Infinity;
  for (const turn of [0, 0.55, -0.55, 1.1, -1.1, 1.57, -1.57]) {
    const x = g.x + Math.cos(outward + turn) * 0.95,
      z = g.z + Math.sin(outward + turn) * 0.95;
    const lx = (x - w.sofa.x) * Math.cos(yaw) - (z - w.sofa.z) * Math.sin(yaw),
      lz = (x - w.sofa.x) * Math.sin(yaw) + (z - w.sofa.z) * Math.cos(yaw);
    if (Math.abs(lx) < 2.48 && Math.abs(lz) < 1.3) continue;
    const y = deliveryFloor(x, z, w.sofa.y - SOFA_CENTER, w.clock - w.started);
    if (y === null) continue;
    const point = { x, y, z },
      cost =
        (from ? distanceXZ(point, from) : Math.abs(turn)) +
        Math.abs(turn) * 0.1;
    if (cost < score) {
      best = point;
      score = cost;
    }
  }
  return best;
}

/** One shared plan, normal player controls, and no mutations of physical body state. */
export function tickDeliveryNpcs(w: DeliveryWorld, act: Act) {
  const bots = w.players.filter((p) => p.bot);
  if (!bots.length || w.phase !== 'playing') return;
  const humans = w.players.filter((p) => !p.bot);
  const humanCarriers = humans.filter((p) => p.grip !== null);
  if (!humans.length) {
    for (const p of bots)
      p.input = { x: 0, z: 0, jump: false, seq: p.input.seq + 1 };
    return;
  }
  const foot = { x: w.sofa.x, y: w.sofa.y - SOFA_CENTER, z: w.sofa.z };
  const projection = routeProjection(foot);
  if (w.npcTeam && w.npcTeam.version !== 1) {
    delete w.npcTeam;
    delete w.npcBrains;
  }
  const team = (w.npcTeam ??= {
    version: 1,
    stage: projection.stage,
    helper: null,
    panel: null,
    rotateAt: 0,
    goal: ROUTE[projection.stage + 1],
    last: foot,
    progressAt: w.clock,
  });
  if (foot.y < ROUTE[team.stage].y - 3) team.stage = projection.stage;
  if (
    humanCarriers.length &&
    projection.stage !== team.stage &&
    distanceXZ(foot, ROUTE[Math.max(team.stage, projection.stage)]) > 2.5 &&
    distanceXZ(foot, projection.point) < 1.5 &&
    Math.abs(foot.y - projection.point.y) < 1.5
  )
    team.stage = projection.stage;
  if (
    team.stage < ROUTE.length - 2 &&
    distanceXZ(foot, ROUTE[team.stage + 1]) < 0.8
  )
    team.stage++;
  const summit = foot.y > 21 && w.sofa.x < 3;
  if (foot.y < projection.point.y - 1.4)
    team.recoverySide ??= foot.z < 13 ? -1 : 1;
  if (
    team.recoverySide &&
    distanceXZ(foot, projection.point) < 1.3 &&
    Math.abs(foot.y - projection.point.y) < 1.1
  ) {
    delete team.recoverySide;
    team.stage = projection.stage;
  }
  const clearZ = 13 + (team.recoverySide ?? 1) * 5;
  const goal = team.recoverySide
    ? foot.x > -9
      ? {
          x: Math.abs(foot.z - clearZ) > 0.6 ? foot.x : -12,
          y: -0.6,
          z: clearZ,
        }
      : ROUTE[0]
    : summit
      ? { x: -6.05, y: 22, z: -23 }
      : ROUTE[Math.min(team.stage + 1, ROUTE.length - 1)];
  team.goal = goal;
  let dx = goal.x - w.sofa.x,
    dz = goal.z - w.sofa.z;
  const distance = Math.hypot(dx, dz);
  dx /= Math.max(distance, 0.01);
  dz /= Math.max(distance, 0.01);
  const segmentStart = ROUTE[team.stage],
    segmentEnd = ROUTE[Math.min(team.stage + 1, ROUTE.length - 1)];
  let desiredYaw = Math.atan2(
    -(segmentEnd.z - segmentStart.z),
    segmentEnd.x - segmentStart.x,
  );
  const yaw = yawOf(w);
  if (Math.abs(angleDelta(desiredYaw, yaw)) > Math.PI / 2)
    desiredYaw += Math.PI;
  const turn = angleDelta(desiredYaw, yaw);
  let pairedGrip =
    w.players.length === 2 &&
    humanCarriers.length === 1 &&
    team.stage !== 6 &&
    !team.recoverySide &&
    1 - 2 * (w.sofa.quaternion.x ** 2 + w.sofa.quaternion.z ** 2) > 0.65
      ? humanCarriers[0].grip! ^ 3
      : null;
  let pairFallback = false;
  if (bots.length === 1) {
    const p = bots[0],
      b = brainFor(w, p);
    // Briefly letting go of the same human corner must not restart a failed
    // approach and discard the useful alternative grip we just secured.
    if (pairedGrip === null && humanCarriers.length) delete b.pair;
    else if (pairedGrip !== null) {
      if (b.pair?.grip !== pairedGrip)
        b.pair = { grip: pairedGrip, until: w.clock + 6000 };
      if (b.pair.until && w.clock > b.pair.until) {
        b.pair.until = 0;
        if (p.grip === null) {
          b.grip = null;
          b.path = undefined;
        }
      }
      if (!b.pair.until) {
        pairedGrip = null;
        pairFallback = true;
      }
    }
  }
  if (team.stage !== 6 || humanCarriers.length) delete team.gap;
  if (
    team.stage === 6 &&
    !team.gap &&
    !humanCarriers.length &&
    bots.length === 3 &&
    foot.x > 4.5 &&
    foot.x < 7.5 &&
    Math.abs(turn) < 0.3
  ) {
    const rear = [0, 1, 2, 3].filter((g) => gripPosition(w, g).x > w.sofa.x);
    const front = [0, 1, 2, 3].filter((g) => !rear.includes(g));
    if (rear.length === 2) {
      const ordered = [...bots].sort((a, b) => a.x - b.x);
      const leader = ordered.shift()!;
      front.sort(
        (a, b) =>
          distanceXZ(leader, gripPosition(w, a)) -
          distanceXZ(leader, gripPosition(w, b)),
      );
      const grips: Record<string, number> = { [leader.id]: front[0] };
      for (const p of ordered) {
        rear.sort(
          (a, b) =>
            distanceXZ(p, gripPosition(w, a)) -
            distanceXZ(p, gripPosition(w, b)),
        );
        grips[p.id] = rear.shift()!;
      }
      team.gap = { ready: false, grips };
    }
  }
  const gapPreparing = !!team.gap && !team.gap.ready;
  if (gapPreparing) {
    for (const p of bots) {
      const b = brainFor(w, p),
        wanted = team.gap!.grips[p.id];
      if (p.grip !== null && p.grip !== wanted)
        attempt(w, p, b, 'release', act);
      b.grip = wanted;
    }
    if (bots.every((p) => p.grip === team.gap!.grips[p.id]))
      team.gap!.ready = true;
  }
  const returning = bots.some(
    (p) =>
      p.grip === null &&
      (w.npcBrains?.[p.id]?.path?.length ?? 0) > 1 &&
      Math.hypot(p.velocity.x, p.velocity.z) > 0.5 &&
      (distanceXZ(p, foot) > 5 || Math.abs(p.y - foot.y) > 2),
  );
  if (returning) team.progressAt = w.clock;
  if (
    distanceXZ(foot, team.last) > 0.8 ||
    Math.abs(foot.y - team.last.y) > 0.7 ||
    humanCarriers.length
  ) {
    team.last = { ...foot };
    team.progressAt = w.clock;
    team.reformCount = 0;
    team.needsHelp = false;
  }
  if (
    !humanCarriers.length &&
    !team.panel &&
    !team.needsHelp &&
    w.clock - team.progressAt > 10000
  ) {
    team.reformCount = (team.reformCount ?? 0) + 1;
    team.reformUntil = w.clock + 1800;
    // Try all four corner assignments before asking the human to intervene.
    team.needsHelp = team.reformCount >= 5;
    team.progressAt = w.clock;
    for (const p of bots) {
      const b = brainFor(w, p);
      b.grip = null;
      b.goal = null;
      b.path = undefined;
    }
  }
  const humanStop = humanCarriers.some(
    (p) => w.clock - p.seen > 650 || Math.hypot(p.input.x, p.input.z) < 0.08,
  );
  const humanLift =
    humanCarriers.every((p) => w.clock - p.seen <= 650) &&
    humanCarriers.some(
      (p) =>
        p.input.jump &&
        p.input.seq > p.lastJump &&
        p.grounded &&
        p.stumble <= w.clock,
    );
  // A worker walking around a turning sofa supplies both translation and an
  // orbit. Start supporting the requested turn before the heavy cargo catches
  // up; its measured angular speed alone would turn that input into translation.
  const carryTurn = angleDelta(w.carryYaw, yaw);
  const humanOrbit =
    Math.abs(carryTurn) > 0.18
      ? clamp(carryTurn * 1.3, -0.85, 0.85)
      : w.sofa.angular.y;
  const humanMotion = humanCarriers.reduce(
    (motion, p) => ({
      x: motion.x + p.input.x - (humanOrbit * (p.z - w.sofa.z)) / 2.65,
      z: motion.z + p.input.z + (humanOrbit * (p.x - w.sofa.x)) / 2.65,
    }),
    { x: 0, z: 0 },
  );
  if (humanCarriers.length && !humanStop) {
    const hx = humanMotion.x,
      hz = humanMotion.z;
    const length = Math.hypot(hx, hz);
    if (length > 0.25) {
      dx = hx / length;
      dz = hz / length;
    } else {
      dx = 0;
      dz = 0;
    }
  }
  const nearGate =
    Math.abs(foot.y - GATE.y) < 2 &&
    w.sofa.x > -5 &&
    w.sofa.x < 4 &&
    Math.abs(w.sofa.z - GATE.z) < 3;
  const panel =
    nearGate && w.gate < 1.4
      ? 'gate'
      : foot.y > 20.5 && w.sofa.x < 5 && w.door < 1.4
        ? 'door'
        : null;
  if (panel !== team.panel) {
    team.panel = panel;
    team.helper = null;
  }
  if (panel && !team.helper) {
    const position = panel === 'gate' ? GATE : DOOR;
    team.helper = [...bots].sort(
      (a, b) => distanceXZ(a, position) - distanceXZ(b, position),
    )[0].id;
  }
  const carriers = w.players.filter((p) => p.grip !== null);
  const humanAcross =
    team.stage === 6 &&
    humans.some((p) => p.x < -1.75 && p.y > 13.4 && distanceXZ(p, foot) < 8);
  const lift =
    !panel &&
    !humanCarriers.length &&
    (carriers.length >= 2 || (carriers.length === 1 && humanAcross)) &&
    w.clock - team.progressAt > (team.stage === 6 ? 1600 : 3000) &&
    w.clock > (team.liftAt ?? 0) &&
    carriers.every((p) => p.grounded);
  if (lift) team.liftAt = w.clock + 2200;
  const supporters = carriers.filter((p) => p.id !== team.helper).length;
  const axisError = Math.abs(Math.sin(desiredYaw - w.carryYaw));
  if (
    !humanCarriers.length &&
    !panel &&
    !team.recoverySide &&
    axisError > 0.7 &&
    w.clock > team.rotateAt
  ) {
    const leader = carriers.find((p) => p.bot);
    if (
      leader &&
      carriers.length >= 2 &&
      attempt(w, leader, brainFor(w, leader), 'rotate', act)
    )
      team.rotateAt = w.clock + 2000;
  }
  const rotating = Math.abs(angleDelta(w.carryYaw, yaw)) > 0.5;
  if (
    !panel &&
    !pairFallback &&
    team.stage !== 6 &&
    carriers.length === 2 &&
    (carriers[0].grip! % 2 === carriers[1].grip! % 2 ||
      (pairedGrip !== null && carriers.find((p) => p.bot)?.grip !== pairedGrip))
  ) {
    const helper = carriers.find((p) => p.bot);
    if (helper) {
      const b = brainFor(w, helper);
      const opposite = carriers.find((p) => p.id !== helper.id)!.grip! ^ 3;
      const target = deliveryGripStand(w, opposite);
      if (
        deliveryFloor(target.x, target.z, target.y, w.clock - w.started) !==
          null &&
        attempt(w, helper, b, 'release', act)
      )
        b.grip = opposite;
    }
  }
  const bridging =
    team.stage === 6 &&
    (humanAcross ||
      bots.some(
        (p) => p.x < -1.75 && p.y > 13.4 && w.npcBrains?.[p.id]?.crossing,
      ));
  const rescue =
    carriers.length === 1 &&
    (!!team.recoverySide || distanceXZ(foot, projection.point) > 1.4);
  const assembled =
    carriers.length >= Math.min(2, w.players.length) ||
    (carriers.length === 1 &&
      (bridging ||
        (team.stage === 6 && carriers[0].x < -1.75 && Math.abs(foot.x) < 4))) ||
    rescue;
  const inside = summit && cargoInsideRoom(w);
  if (team.delivering) team.deliveringAt ??= w.clock;
  if (inside && (distance < 0.45 || humanCarriers.length)) {
    if (!team.delivering) team.deliveringAt = w.clock;
    team.delivering = true;
  }
  if (
    team.delivering &&
    !inside &&
    (distance > 1.3 || w.clock - (team.deliveringAt ?? w.clock) > 1800)
  )
    team.delivering = false;
  const releasedAtDestination = !!team.delivering;
  const occupied = new Set(
    w.players.flatMap((p) => (p.grip === null ? [] : [p.grip])),
  );
  const safeToSetDown =
    (!team.needsHelp && (team.reformUntil ?? 0) <= w.clock) ||
    [0, 1, 2, 3].every((g) => {
      const corner = gripPosition(w, g);
      return (
        deliveryFloor(corner.x, corner.z, foot.y, w.clock - w.started) !== null
      );
    });
  for (const p of bots) {
    const b = brainFor(w, p);
    if (p.grip !== null) b.grip = p.grip;
    else if (b.grip !== null && occupied.has(b.grip)) b.grip = null;
    if (b.grip !== null) occupied.add(b.grip);
  }
  for (const p of bots) {
    const b = brainFor(w, p);
    p.seen = w.clock;
    p.input = { x: 0, z: 0, jump: false, seq: p.input.seq + 1 };
    if (p.stumble > w.clock) {
      p.task = 'Finding my feet';
      b.grip = null;
      continue;
    }
    if (
      team.stage === 6 &&
      !humanStop &&
      p.grip !== null &&
      carriers.length >= 2 &&
      p.grounded &&
      p.x > 1.4 &&
      p.x < 2.4 &&
      Math.abs(p.z + 8) < 2.7 &&
      dx < 0 &&
      !bots.some(
        (other) => other.id !== p.id && w.npcBrains?.[other.id]?.crossing,
      )
    ) {
      if (attempt(w, p, b, 'release', act))
        b.crossing = { x: -2.1, y: 13.85, z: clamp(p.z, -9.2, -6.8) };
    }
    if (b.crossing) {
      p.task = 'Crossing the gap';
      if (p.y < 11.8 || team.stage !== 6) {
        delete b.crossing;
        b.path = undefined;
        b.grip = null;
      } else if (p.x > -1.75 || !p.grounded) {
        if (humanStop && p.grounded && p.x > 1.4 && p.support !== 'sofa') {
          p.task = 'Waiting for crew';
          continue;
        }
        const length = distanceXZ(p, b.crossing);
        p.input.x = (b.crossing.x - p.x) / Math.max(length, 0.1);
        p.input.z = (b.crossing.z - p.z) / Math.max(length, 0.1);
        p.input.jump =
          p.grounded &&
          (p.support === 'sofa' ||
            (p.x > 0 && (p.velocity.x < -3.2 || p.x < 1.65)));
        continue;
      } else {
        const free = [0, 1, 2, 3].filter(
          (g) => !w.players.some((p) => p.grip === g),
        );
        const near = free.find((g) => {
          const corner = gripPosition(w, g);
          return (
            Math.hypot(corner.x - p.x, corner.y - p.y - 1.2, corner.z - p.z) <
            2.2
          );
        });
        if (near === undefined && w.sofa.x > 0.5) {
          p.task = team.needsHelp
            ? 'Needs a hand: move the sofa'
            : 'Waiting across the gap';
          continue;
        }
        delete b.crossing;
        b.grip = near ?? null;
        b.path = undefined;
      }
    }
    if (team.needsHelp || (team.reformUntil ?? 0) > w.clock) {
      p.task = team.needsHelp ? 'Needs a hand: move the sofa' : 'Regrouping';
      if (p.grip !== null && safeToSetDown) attempt(w, p, b, 'release', act);
      if (p.grip === null) b.grip = (p.color + (team.reformCount ?? 0)) % 4;
      continue;
    }
    if (
      p.grip !== null &&
      ((!team.recoverySide &&
        (p.y < foot.y - 2 ||
          (p.y < foot.y - 1.1 && p.y < routeProjection(p).point.y - 0.65))) ||
        (!p.grounded && p.y > foot.y + 0.8 && w.clock > (b.jumpUntil ?? 0)) ||
        !deliveryGripClear(w, p, gripPosition(w, p.grip)) ||
        p.support === 'sofa')
    ) {
      p.task = 'Returning to the path';
      attempt(w, p, b, 'release', act);
      b.grip = null;
      continue;
    }
    if (releasedAtDestination) {
      p.task = 'Putting the sofa down';
      if (p.grip !== null) attempt(w, p, b, 'release', act);
      continue;
    }
    if (p.id === team.helper && panel) {
      p.task = panel === 'gate' ? 'Opening gate' : 'Opening door';
      if (p.grip !== null) {
        attempt(w, p, b, 'release', act);
        continue;
      }
      const target =
        panel === 'gate'
          ? { x: GATE.x - 0.9, y: GATE.y, z: GATE.z + 1.4 }
          : { x: -0.5, y: 22, z: -21 };
      const inReach =
        panel === 'gate'
          ? distanceXZ(p, GATE) < 3.3 && p.x < GATE.x - 0.35
          : distanceXZ(p, { ...DOOR, z: DOOR.z + 1.85 }) < 3.9 &&
            p.x > DOOR.x + 0.35 &&
            p.z > DOOR.z + 0.6;
      if (distanceXZ(p, b.last) > 0.35) {
        b.last = { x: p.x, y: p.y, z: p.z };
        b.movedAt = w.clock;
      }
      if (
        ((inReach && w.clock - b.movedAt > 1500) ||
          distanceXZ(p, target) < 1.25) &&
        Math.abs(p.y - target.y) < 1.8
      ) {
        if ((panel === 'gate' ? w.gateTarget : w.doorTarget) < 1)
          attempt(w, p, b, 'interact', act);
      } else Object.assign(p.input, followDeliveryPath(w, p, b, target));
      continue;
    }
    if (panel && supporters < 2 && p.grip !== null) {
      p.task = 'Setting down for the door';
      attempt(w, p, b, 'release', act);
      continue;
    }
    if (panel && supporters < 2) {
      p.task = 'Waiting for the door';
      continue;
    }
    if (p.grip === null) {
      if (pairedGrip !== null) {
        b.grip = pairedGrip;
        occupied.add(pairedGrip);
      }
      if (b.grip === null) {
        const free = [0, 1, 2, 3].filter((g) => !occupied.has(g));
        free.sort(
          (a, c) =>
            distanceXZ(p, deliveryGripStand(w, a)) -
            distanceXZ(p, deliveryGripStand(w, c)),
        );
        b.grip = free[0] ?? null;
        if (b.grip !== null) occupied.add(b.grip);
      }
      if (b.grip === null) {
        p.task = 'Waiting for a corner';
        continue;
      }
      const target = deliveryGripStand(w, b.grip, p);
      p.task =
        foot.y < ROUTE[team.stage].y - 1
          ? 'Recovering sofa'
          : 'Finding a corner';
      let grip = gripPosition(w, b.grip);
      const nearest = [0, 1, 2, 3]
        .filter((g) => !w.players.some((p) => p.grip === g))
        .sort((a, c) => {
          const ga = gripPosition(w, a),
            gc = gripPosition(w, c);
          return (
            Math.hypot(ga.x - p.x, ga.y - p.y - 1.2, ga.z - p.z) -
            Math.hypot(gc.x - p.x, gc.y - p.y - 1.2, gc.z - p.z)
          );
        })[0];
      if (
        !gapPreparing &&
        pairedGrip === null &&
        !assembled &&
        w.clock > (team.reformUntil ?? 0) + 6000 &&
        nearest !== undefined
      ) {
        const g = gripPosition(w, nearest);
        if (Math.hypot(g.x - p.x, g.y - p.y - 1.2, g.z - p.z) < 2.2) {
          b.grip = nearest;
          grip = g;
        }
      }
      if (
        nearest === b.grip &&
        Math.hypot(grip.x - p.x, grip.y - p.y - 1.2, grip.z - p.z) < 2.2 &&
        Math.abs(p.velocity.y) < 1 &&
        deliveryGripClear(w, p, grip) &&
        p.support !== 'sofa'
      )
        attempt(w, p, b, 'grab', act);
      else Object.assign(p.input, followDeliveryPath(w, p, b, target));
    } else {
      p.task = humanStop
        ? 'Waiting for crew'
        : Math.abs(turn) > 0.45
          ? 'Turning together'
          : panel
            ? 'Holding the sofa'
            : 'Carrying';
      if (humanCarriers.length && !panel) {
        const speed = humanStop
          ? 0
          : Math.min(
              1,
              Math.hypot(humanMotion.x, humanMotion.z) / humanCarriers.length,
            );
        p.input.x = clamp(
          dx * speed + (humanOrbit * (p.z - w.sofa.z)) / 2.65,
          -1,
          1,
        );
        p.input.z = clamp(
          dz * speed - (humanOrbit * (p.x - w.sofa.x)) / 2.65,
          -1,
          1,
        );
        const corner = deliveryGripStand(w, p.grip!, p);
        if (Math.hypot(dx, dz) > 0 || Math.abs(humanOrbit) > 0.1) {
          let correctionX = clamp((corner.x - p.x) * 0.7, -0.6, 0.6);
          let correctionZ = clamp((corner.z - p.z) * 0.7, -0.6, 0.6);
          if (Math.hypot(dx, dz) === 0) {
            // Re-form around a turning cargo frame without adding a shared
            // translation when the human asks only for rotation.
            const holding = bots.filter((other) => other.grip !== null);
            for (const other of holding) {
              const stand = deliveryGripStand(w, other.grip!, other);
              correctionX -=
                clamp((stand.x - other.x) * 0.7, -0.6, 0.6) / holding.length;
              correctionZ -=
                clamp((stand.z - other.z) * 0.7, -0.6, 0.6) / holding.length;
            }
          }
          p.input.x = clamp(p.input.x + correctionX, -1, 1);
          p.input.z = clamp(p.input.z + correctionZ, -1, 1);
        }
      } else if (assembled && !panel) {
        Object.assign(
          p.input,
          carryDeliveryInput(
            w,
            p,
            team.recoverySide || rescue ? foot : segmentStart,
            rescue && !team.recoverySide ? projection.point : goal,
            team.recoverySide || rescue ? yaw : desiredYaw,
          ),
        );
      }
      if (assembled && !panel && !humanStop && humanCarriers.length) {
        const radius = distanceXZ(p, w.sofa);
        const correction = Math.max(0, radius - 2.7) * 1.6;
        p.input.x = clamp(
          p.input.x + ((w.sofa.x - p.x) / Math.max(radius, 0.1)) * correction,
          -1,
          1,
        );
        p.input.z = clamp(
          p.input.z + ((w.sofa.z - p.z) / Math.max(radius, 0.1)) * correction,
          -1,
          1,
        );
      }
      if (team.stage === 6 && !rotating && !humanCarriers.length && p.x > 2.4) {
        // Set up a straight run along the road before reaching its broken edge.
        const lane = -8 + (p.z > -8 ? 1.1 : -1.1);
        p.input.z = clamp((lane - p.z) * 1.1, -0.65, 0.65);
      }
      if (p.grounded) {
        const guarded = steerDeliveryNpc(
          w,
          p,
          { x: p.x + p.input.x, y: p.y, z: p.z + p.input.z },
          Math.min(1, Math.hypot(p.input.x, p.input.z)),
        );
        Object.assign(p.input, guarded);
      }
      if (gapPreparing) {
        p.task = 'Repositioning for the gap';
        p.input.x = 0;
        p.input.z = 0;
      }
      if (humanStop) {
        p.input.x = 0;
        p.input.z = 0;
        p.input.jump = false;
      }
      for (let i = 0; i < 2; i++) {
        const goat = goatPose(i, w.clock - w.started);
        if (
          Math.abs(p.y - goat.y) < 1.5 &&
          distanceXZ(p, goat) < 2.2 &&
          p.grounded &&
          (goat.x - p.x) * p.input.x + (goat.z - p.z) * p.input.z > 0.05
        )
          p.input.jump = true;
      }
      if ((lift || (humanLift && !panel)) && p.grounded) {
        p.task = 'Lifting over the edge';
        p.input.jump = true;
      }
      if (p.input.jump && p.grounded) b.jumpUntil = w.clock + 1300;
    }
    if (distanceXZ(p, b.last) > 0.35) {
      b.last = { x: p.x, y: p.y, z: p.z };
      b.movedAt = w.clock;
    } else if (w.clock - b.movedAt > 3000 && p.grip === null) {
      b.grip = null;
      b.movedAt = w.clock;
      p.task = 'Finding another way';
    }
  }
}
