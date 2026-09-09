import type { Action as FPAction, World as FPWorld } from './model';
export function firstPersonCue(
  action: FPAction,
  before: FPWorld,
  player: string,
): string | null {
  const inv = before.inventories[player];
  if (action.type === 'supply')
    return `material.${action.station}.${inv?.carrying === action.station ? 'drop' : 'grab'}`;
  if (action.type === 'place') {
    const p = action.placement;
    const wet =
      action.kind === 'brick' &&
      before.beds.some(
        (b) =>
          Math.abs(b.x - p.x) < 0.02 &&
          Math.abs(b.y - p.y) < 0.02 &&
          Math.abs(b.z - p.z) < 0.02 &&
          b.rotation === p.rotation,
      );
    return wet ? 'material.brick.wet' : `material.${action.kind}.place`;
  }
  if (action.type === 'mortar') return 'material.mortar.place';
  if (action.type === 'remove') {
    const part = before.parts.find((p) => p.id === action.id);
    return part ? `material.${part.kind}.remove` : null;
  }
  if (action.type === 'empty-mixer') return 'mixer.empty';
  if (action.type === 'mixer') {
    if (before.mixer.jammed) return 'mixer.fix';
    if (before.mixer.remaining > 0) return 'material.mortar.grab';
    if (inv?.carrying) return `material.${inv.carrying}.pour`;
    return 'mixer.start';
  }
  return null;
}
