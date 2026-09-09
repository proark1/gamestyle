import { cowExposed, fenceDistance, shockAge, SHOCK_STUN_MS } from './fence';
import { distance, GATE, LADDER_EXIT, PANEL, type FarmSnapshot } from './types';

/** Touch copy and available actions are derived only from this player's private snapshot. */
export function mobileHud(
  snapshot: FarmSnapshot,
  hud: { target: string; watched: boolean; grazing: boolean },
) {
  const w = snapshot.world;
  const cow = w.cows.find((c) => c.id === snapshot.you.cowId);
  let label = 'Interact',
    hint = '',
    available = false;
  let status = hud.grazing
    ? 'Grazing'
    : hud.watched
      ? 'Being watched'
      : 'Blending in';
  let warning = hud.watched;
  if (snapshot.you.role === 'farmer') {
    const target = w.cows.find(
      (c) => c.id === hud.target && !c.captured && !c.escaped,
    );
    const nearby = w.cows.some(
      (c) => !c.captured && !c.escaped && distance(c, w.farmer) <= 3.2,
    );
    return {
      label: 'Inspect',
      available:
        w.inspections > 0 &&
        (target ? distance(target, w.farmer) <= 3.2 : nearby),
      hint: target
        ? distance(target, w.farmer) > 3.2
          ? 'Move closer to inspect this cow.'
          : 'Inspect the selected cow.'
        : '',
      status: `${w.inspections} inspections left`,
      warning: false,
    };
  }
  if (!cow || cow.captured || cow.escaped) {
    return {
      label,
      available,
      hint: 'Watch your friends finish the round.',
      status: cow?.escaped ? 'Escaped' : 'Spectating',
      warning: false,
    };
  }
  const held = w.items.find((i) => i.id === cow.carrying);
  if (!w.powerOff && distance(cow, PANEL) < 2) {
    label = cow.task ? 'Stop' : 'Cut power';
    available = true;
    hint = cow.task
      ? 'Cutting power… stay still.'
      : 'Stay still for four seconds to cut the power.';
  } else if (held?.kind === 'key' && distance(cow, GATE) < 2) {
    label = 'Unlock';
    available = true;
    hint = 'Use your key at the gate.';
  } else if (held?.kind === 'ladder' && distance(cow, LADDER_EXIT) < 2) {
    label = 'Place ladder';
    available = true;
    hint = 'Set the ladder against the fence.';
  } else if (
    distance(cow, GATE) < 2 ||
    (w.ladderPlaced && distance(cow, LADDER_EXIT) < 2)
  ) {
    label = 'Escape';
    available =
      w.powerOff && (distance(cow, GATE) >= 2 || w.keysDelivered === 2);
    hint = !w.powerOff
      ? 'Cut the fence power before escaping.'
      : !available
        ? 'The gate still needs two keys.'
        : 'Your way out is open!';
  } else if (cow.carrying) {
    hint =
      held?.kind === 'ladder'
        ? 'Carry the ladder to the east fence.'
        : 'Carry the key to the south gate.';
  } else if (
    w.items.some((i) => !i.holder && !i.delivered && distance(cow, i) < 1.8)
  ) {
    label = 'Pick up';
    available = true;
    hint = 'Pick up the nearby item.';
  }
  if (cowExposed(cow, w.clock)) {
    status = 'Exposed!';
    warning = true;
    hint = 'Fence shock! The farmer can spot you.';
    if (shockAge(cow, w.clock) < SHOCK_STUN_MS) available = false;
  } else if (!w.powerOff && fenceDistance(cow) < 2.5 && !hint) {
    hint = 'Live fence — keep your distance.';
  }
  return { label, hint, available, status, warning };
}
