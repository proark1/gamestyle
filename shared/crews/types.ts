export const CREW_EMBLEMS = [
  'sun',
  'leaf',
  'rocket',
  'wave',
  'star',
  'flame',
] as const;
export type CrewEmblem = (typeof CREW_EMBLEMS)[number];
export type CrewBadge = { id: string; name: string; emblem: CrewEmblem };
export type CrewSnapshot = CrewBadge & {
  self: string;
  owner: string;
  members: { id: string; name: string; joined: number }[];
};
export type CrewReply = {
  crew: CrewSnapshot | null;
  ownerKey: string;
  invite?: { code: string; expires: number };
};
