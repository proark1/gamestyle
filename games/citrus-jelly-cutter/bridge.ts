export const CITRUS_ACTIONS = new Set([
  'hand',
  'knife',
  'cutter',
  'nudge',
  'reset',
  'pause',
  'variety',
]);

export const CITRUS_MILESTONES = new Set([
  'first-grab',
  'first-cut',
  'first-stamp',
  'first-lift',
]);

export type CitrusMessage =
  | { kind: 'ready' }
  | { kind: 'action'; key: string }
  | { kind: 'milestone'; key: string };

export function citrusMessage(value: unknown): CitrusMessage | null {
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  if (message.source !== 'citrus-jelly-cutter') return null;
  if (message.kind === 'ready') return { kind: 'ready' };
  if (
    message.kind === 'action' &&
    typeof message.key === 'string' &&
    CITRUS_ACTIONS.has(message.key)
  )
    return { kind: 'action', key: message.key };
  if (
    message.kind === 'milestone' &&
    typeof message.key === 'string' &&
    CITRUS_MILESTONES.has(message.key)
  )
    return { kind: 'milestone', key: message.key };
  return null;
}
