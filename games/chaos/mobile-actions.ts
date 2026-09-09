import { CATALOG, type Piece, type Player, type Snapshot } from './model';
import { inReach } from './colliders';
import { removalSupportError } from './structure';
import { PROP_USES } from './house-props';

export type InteractionTarget = {
  id: string;
  kind: Piece['kind'];
  name: string;
  reachable: boolean;
  grabError: string | null;
  useError: string | null;
  useLabel: string | null;
};

export function describeTarget(
  snapshot: Snapshot,
  player: Player,
  piece?: Piece,
): InteractionTarget | null {
  if (!piece) return null;
  const reachable = inReach(snapshot.world, player, piece, piece.id);
  const speed = piece.physics ? Math.hypot(...piece.physics.v) : 0;
  const unavailable = piece.heldBy
    ? `${snapshot.players.find((p) => p.id === piece.heldBy)?.name || 'Another builder'} is carrying this.`
    : piece.hoisted
      ? 'This part is on the crane.'
      : piece.supply
        ? 'Use the roof crane for this module.'
        : null;
  const use = PROP_USES[piece.kind];
  return {
    id: piece.id,
    kind: piece.kind,
    name: CATALOG.find((item) => item.id === piece.kind)?.name || 'Part',
    reachable,
    grabError:
      unavailable ||
      (piece.kind === 'roof' ? 'Use the roof crane for this module.' : null) ||
      (speed > 4 ? 'Wait for the part to land.' : null) ||
      removalSupportError(snapshot.world, piece, snapshot.players),
    useLabel: use?.label || null,
    useError:
      unavailable ||
      (!use ? 'This part has no use action.' : null) ||
      (speed > 0.5 ? 'Wait for the prop to settle.' : null) ||
      (use &&
      piece.usedAt !== undefined &&
      snapshot.now - piece.usedAt < Math.max(1500, use.duration)
        ? 'Let the prop finish first.'
        : null),
  };
}

export type MobileActionType =
  | 'grab'
  | 'use'
  | 'drop'
  | 'throw'
  | 'place'
  | 'paint'
  | 'remove'
  | 'rotate'
  | 'cancel'
  | 'stop';
export type MobileAction = {
  type: MobileActionType;
  key: string;
  label: string;
  disabled: boolean;
  targetId?: string;
};
export type MobileActionState = {
  context: string;
  tool: 'walk' | 'build' | 'paint' | 'remove';
  target: InteractionTarget | null;
  held?: Piece;
  dropError?: string | null;
  placementKey?: string;
  placementError?: string | null;
  paintLabel?: string;
  working: boolean;
  blocked: boolean;
};

export function mobileActions(s: MobileActionState): {
  primary: MobileAction;
  secondary: MobileAction;
} {
  const make = (
    type: MobileActionType,
    label: string,
    identity = '',
    disabled = false,
    targetId?: string,
  ): MobileAction => ({
    type,
    label,
    key: `${s.context}:${s.tool}:${type}:${identity}`,
    disabled: s.blocked || disabled,
    targetId,
  });
  if (s.working)
    return {
      primary: make('stop', 'Stop'),
      secondary: make('cancel', 'Cancel', '', true),
    };
  if (s.held)
    return {
      primary: make('drop', 'Put down', s.held.id, !!s.dropError, s.held.id),
      secondary: make('throw', 'Throw', s.held.id, false, s.held.id),
    };
  if (s.tool !== 'walk')
    return {
      primary: make(
        s.tool === 'build' ? 'place' : s.tool,
        s.tool === 'build'
          ? 'Place'
          : s.tool === 'paint'
            ? s.paintLabel || 'Paint'
            : 'Remove',
        s.placementKey,
        !s.placementKey || !!s.placementError,
      ),
      secondary:
        s.tool === 'build'
          ? make('rotate', 'Rotate')
          : make('cancel', 'Cancel'),
    };
  return {
    primary: make(
      'grab',
      s.target && !s.target.reachable ? 'Fetch' : 'Pick up',
      s.target?.id,
      !s.target || !!s.target.grabError,
      s.target?.id,
    ),
    secondary: make(
      'use',
      'Use',
      s.target?.id,
      !s.target?.useLabel || !!s.target.useError,
      s.target?.id,
    ),
  };
}

/** A release can only commit the command that owned the original contact. */
export class ActionContact {
  active: { id: number; key: string } | null = null;
  down(id: number, key: string) {
    if (this.active) return false;
    this.active = { id, key };
    return true;
  }
  up(id: number, key: string, cancelled = false) {
    if (this.active?.id !== id) return false;
    const valid = !cancelled && this.active.key === key;
    this.active = null;
    return valid;
  }
  clear() {
    this.active = null;
  }
}
