/** NPC seats are occupancy, never authenticated network members. */
export type NpcSlot = { id: string; name: string; color: number };
export type NpcRoster = { revision: number; slots: NpcSlot[] };
export type NpcAction =
  | { type: 'add-npc'; slot: number }
  | { type: 'remove-npc'; target: string }
  | { type: 'fill-npcs' };
export function isNpcAction(action: { type?: unknown }): boolean {
  return ['add-npc', 'remove-npc', 'fill-npcs'].includes(String(action.type));
}
export function changeNpcSlots(
  slots: NpcSlot[],
  humans: { color: number }[],
  raw: unknown,
  names: readonly string[] = ['Mika', 'Jo', 'Nora', 'Sam'],
): NpcSlot[] {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid NPC request.');
  const action = raw as Record<string, unknown>;
  const result = slots.map((slot) => ({ ...slot }));
  if (action.type === 'remove-npc') {
    if (
      typeof action.target !== 'string' ||
      !slots.some((s) => s.id === action.target)
    )
      throw new Error('That NPC has already left. Refresh the crew.');
    return result.filter((s) => s.id !== action.target);
  }
  if (!['add-npc', 'fill-npcs'].includes(String(action.type)))
    throw new Error('Invalid NPC request.');
  const free = [0, 1, 2, 3].filter(
    (color) => ![...humans, ...slots].some((s) => s.color === color),
  );
  if (
    action.type === 'add-npc' &&
    (!Number.isInteger(action.slot) || !free.includes(Number(action.slot)))
  )
    throw new Error('Choose an empty crew slot.');
  const adding = action.type === 'fill-npcs' ? free : [Number(action.slot)];
  for (const color of adding)
    result.push({
      id: `npc-${crypto.randomUUID()}`,
      color,
      name: names[color] ?? `Mover ${color + 1}`,
    });
  return result.sort((a, b) => a.color - b.color);
}
