export type PlazaPose = { x: number; z: number; angle: number };
export const PLAZA_SPEED = 4;
export const STATIONS = [
  {
    id: 'hats',
    name: 'The Hat Stand',
    x: -5.6,
    z: -2.4,
    item: 'frog-bucket-hat',
    slot: 'hat',
  },
  {
    id: 'outfits',
    name: 'Outfit Workshop',
    x: 5.6,
    z: -2.4,
    item: 'toast-puffer',
    slot: 'top',
  },
  {
    id: 'fitting',
    name: 'The Fitting Room',
    x: 0,
    z: -3.7,
    item: '',
    slot: 'all',
  },
  { id: 'play', name: 'Ready to play', x: 0, z: 4.2, item: '', slot: 'all' },
] as const;
export type PlazaStation = (typeof STATIONS)[number];

export function boundedPose(pose: PlazaPose): PlazaPose {
  const x = Math.max(-8, Math.min(8, pose.x));
  const backWall = Math.abs(x) > 3.5 ? -2.5 : Math.abs(x) < 1.25 ? -3.8 : -4.5;
  return {
    x,
    z: Math.max(backWall, Math.min(5.2, pose.z)),
    angle: Math.atan2(Math.sin(pose.angle), Math.cos(pose.angle)),
  };
}
export function spawnPose(color: number): PlazaPose {
  return { x: [-2.1, -0.7, 0.7, 2.1][color % 4] ?? 0, z: 1.4, angle: 0 };
}
export function nearestStation(pose: PlazaPose): PlazaStation | null {
  return (
    STATIONS.find(
      (station) => Math.hypot(station.x - pose.x, station.z - pose.z) < 1.9,
    ) ?? null
  );
}
export function validPose(value: unknown): value is PlazaPose {
  if (!value || typeof value !== 'object') return false;
  const pose = value as PlazaPose;
  return [pose.x, pose.z, pose.angle].every(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );
}
