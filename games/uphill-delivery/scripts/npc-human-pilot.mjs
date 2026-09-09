// Deterministic test pilot for human seats. Reads the live scene and submits
// ordinary controls/actions only; it never plans actions for the NPC seats.
import { ROUTE } from '../level.ts';
import { SOFA_CENTER } from '../types.ts';
import { gripPosition, cargoInsideRoom } from '../physics.ts';
import {
  angleDelta,
  clamp,
  deliveryGripClear,
  distanceXZ,
  routeProjection,
  steerDeliveryNpc,
} from '../navigation.ts';
import { followDeliveryPath } from '../npc-path.ts';
import { deliveryGripStand } from '../npcs.ts';

export function humanPilot() {
  const brains = new Map();
  let stage = 0,
    rotateAt = 0,
    liftAt = 0,
    progressAt = 0,
    last,
    recoverySide;
  return (w, act, stopping = false) => {
    const people = w.players.filter((p) => !p.bot);
    const foot = { x: w.sofa.x, y: w.sofa.y - SOFA_CENTER, z: w.sofa.z };
    const projection = routeProjection(foot);
    if (
      projection.stage !== stage &&
      distanceXZ(foot, ROUTE[Math.max(stage, projection.stage)]) > 2.5 &&
      distanceXZ(foot, projection.point) < 1.5 &&
      Math.abs(foot.y - projection.point.y) < 1.5
    )
      stage = projection.stage;
    if (foot.y < projection.point.y - 1.4)
      recoverySide ??= foot.z < 13 ? -1 : 1;
    if (
      recoverySide &&
      distanceXZ(foot, projection.point) < 1.3 &&
      Math.abs(foot.y - projection.point.y) < 1.1
    ) {
      recoverySide = undefined;
      stage = projection.stage;
    }
    if (foot.y < ROUTE[stage].y - 3) stage = projection.stage;
    if (stage < 10 && distanceXZ(foot, ROUTE[stage + 1]) < 0.85) stage++;
    const clearZ = 13 + (recoverySide ?? 1) * 5;
    const goal = recoverySide
      ? foot.x > -9
        ? {
            x: Math.abs(foot.z - clearZ) > 0.6 ? foot.x : -12,
            y: -0.6,
            z: clearZ,
          }
        : ROUTE[0]
      : foot.y > 21 && foot.x < 3
        ? { x: -6.05, y: 22, z: -23 }
        : ROUTE[stage + 1];
    const q = w.sofa.quaternion;
    const yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.z * q.z),
    );
    let desired = Math.atan2(
      -(goal.z - ROUTE[stage].z),
      goal.x - ROUTE[stage].x,
    );
    if (Math.abs(angleDelta(desired, yaw)) > Math.PI / 2) desired += Math.PI;
    if (recoverySide) desired = w.carryYaw;
    const carriers = w.players.filter((p) => p.grip !== null);
    const distance = distanceXZ(foot, goal);
    if (
      !last ||
      distanceXZ(last, foot) > 0.6 ||
      Math.abs(last.y - foot.y) > 0.5
    ) {
      last = { ...foot };
      progressAt = w.clock;
    }
    const lift =
      w.clock - progressAt > 2200 &&
      w.clock > liftAt &&
      (carriers.length >= 2 || (stage === 6 && carriers.length === 1));
    if (lift) liftAt = w.clock + 2500;
    const inside = foot.y > 21 && cargoInsideRoom(w);
    const occupied = new Set(carriers.map((p) => p.grip));
    for (const p of people) {
      let b = brains.get(p.id);
      if (!b) {
        b = {
          grip: null,
          actionAt: 0,
          movedAt: w.clock,
          last: { ...p },
          goal: null,
          thinkAt: 0,
        };
        brains.set(p.id, b);
      }
      if (distanceXZ(p, b.last) > 0.35) {
        b.last = { x: p.x, y: p.y, z: p.z };
        b.movedAt = w.clock;
      } else if (w.clock - b.movedAt > 3000 && p.grip === null) {
        b.grip = null;
        b.path = undefined;
        b.movedAt = w.clock;
      }
      p.input = { x: 0, z: 0, jump: false, seq: p.input.seq + 1 };
      p.seen = w.clock;
      const action = (type) => {
        if (w.clock < b.actionAt) return false;
        b.actionAt = w.clock + 500;
        try {
          act(p.id, { type });
          return true;
        } catch {
          return false;
        }
      };
      if (stopping || p.stumble > w.clock) continue;
      if (inside) {
        if (p.grip !== null) action('release');
        continue;
      }
      const belowRoad =
        p.y < foot.y - 2 ||
        (p.y < foot.y - 1.1 && p.y < routeProjection(p).point.y - 0.65);
      if (
        p.grip !== null &&
        (p.support === 'sofa' ||
          belowRoad ||
          !deliveryGripClear(w, p, gripPosition(w, p.grip)))
      ) {
        action('release');
        b.grip = null;
        continue;
      }
      if (
        p.grip !== null &&
        w.clock - b.movedAt > 4500 &&
        carriers.length > 1
      ) {
        if (action('release')) {
          b.regripAt = w.clock + 1200;
          b.grip = null;
          b.path = undefined;
        }
        continue;
      }
      if (
        stage === 6 &&
        p.grip !== null &&
        p.grounded &&
        p.x > 1.4 &&
        p.x < 2.4 &&
        carriers.length >= 2 &&
        ![...brains.values()].some((other) => other.crossing)
      ) {
        if (action('release'))
          b.crossing = { x: -2.1, y: 13.85, z: clamp(p.z, -9.2, -6.8) };
      }
      if (b.crossing) {
        if (p.y < 11.8) {
          delete b.crossing;
          b.path = undefined;
        } else if (p.x > -1.75 || !p.grounded) {
          const d = distanceXZ(p, b.crossing);
          p.input.x = (b.crossing.x - p.x) / Math.max(d, 0.1);
          p.input.z = (b.crossing.z - p.z) / Math.max(d, 0.1);
          p.input.jump =
            p.grounded &&
            (p.support === 'sofa' ||
              (p.x > 0 && (p.velocity.x < -3.2 || p.x < 1.65)));
          continue;
        } else if (
          w.sofa.x > 0.5 &&
          carriers.length > 0 &&
          ![0, 1, 2, 3].some(
            (g) =>
              !occupied.has(g) &&
              gripPosition(w, g).distanceTo({ x: p.x, y: p.y + 1.2, z: p.z }) <
                2.2,
          )
        )
          continue;
        else {
          delete b.crossing;
          b.grip = null;
          b.path = undefined;
        }
      }
      if (p.grip === null) {
        const free = [0, 1, 2, 3].filter((g) => !occupied.has(g));
        free.sort(
          (a, c) =>
            distanceXZ(p, gripPosition(w, a)) -
            distanceXZ(p, gripPosition(w, c)),
        );
        if (!free.length) continue;
        if (b.grip === null || occupied.has(b.grip))
          b.grip = [...free].sort(
            (a, c) =>
              distanceXZ(p, deliveryGripStand(w, a)) -
              distanceXZ(p, deliveryGripStand(w, c)),
          )[0];
        const grip = gripPosition(w, b.grip);
        const nearest = [...free].sort(
          (a, c) =>
            gripPosition(w, a).distanceTo({ x: p.x, y: p.y + 1.2, z: p.z }) -
            gripPosition(w, c).distanceTo({ x: p.x, y: p.y + 1.2, z: p.z }),
        )[0];
        occupied.add(b.grip);
        if (
          nearest === b.grip &&
          !belowRoad &&
          w.clock >= (b.regripAt ?? 0) &&
          grip.distanceTo({ x: p.x, y: p.y + 1.2, z: p.z }) < 2.2 &&
          deliveryGripClear(w, p, grip) &&
          Math.abs(p.velocity.y) < 1 &&
          p.support !== 'sofa'
        ) {
          if (action('grab')) occupied.add(p.grip);
        } else {
          Object.assign(
            p.input,
            followDeliveryPath(w, p, b, deliveryGripStand(w, b.grip, p)),
          );
        }
        continue;
      }
      if (carriers.length < 2 && stage !== 6) continue;
      if (
        Math.abs(Math.sin(desired - w.carryYaw)) > 0.7 &&
        w.clock > rotateAt
      ) {
        if (action('rotate')) rotateAt = w.clock + 2000;
      }
      const turning = Math.abs(angleDelta(w.carryYaw, yaw)) > 0.18;
      const pace = turning ? 0 : Math.min(0.55, distance * 0.6);
      let x = ((goal.x - foot.x) / Math.max(distance, 0.1)) * pace;
      let z = ((goal.z - foot.z) / Math.max(distance, 0.1)) * pace;
      const omega = turning
        ? clamp(angleDelta(w.carryYaw, yaw) * 1.3, -0.85, 0.85)
        : w.sofa.angular.y;
      x += (omega * (p.z - foot.z)) / 2.65;
      z -= (omega * (p.x - foot.x)) / 2.65;
      Object.assign(
        p.input,
        p.grounded
          ? steerDeliveryNpc(
              w,
              p,
              { x: p.x + x, y: p.y, z: p.z + z },
              Math.min(1, Math.hypot(x, z)),
            )
          : { x: clamp(x, -1, 1), z: clamp(z, -1, 1) },
      );
      if (lift && p.grounded) p.input.jump = true;
    }
  };
}
