import type { StationKind } from './types';

export const STATION_POSITIONS: Record<
  StationKind,
  { x: number; z: number; label: string }
> = {
  helm: { x: 0, z: -2.35, label: 'Helm' },
  throttle: { x: 1.15, z: -2.2, label: 'Throttle' },
  'rod-rack': { x: -2.55, z: -0.3, label: 'Rod rack' },
  'bait-table': { x: -2.35, z: 1.55, label: 'Bait table' },
  'net-rack': { x: 2.5, z: -0.4, label: 'Landing net' },
  'ice-hold': { x: 1.85, z: 1.65, label: 'Ice hold' },
  engine: { x: 0, z: 2.65, label: 'Engine' },
  'fuel-port': { x: 0.9, z: 2.55, label: 'Fuel port' },
  'repair-bench': { x: -1.45, z: 2.35, label: 'Repair bench' },
  'bilge-pump': { x: -0.45, z: 2.55, label: 'Bilge pump' },
  'rescue-line': { x: 2.65, z: 0.75, label: 'Rescue line' },
  'chart-table': { x: -1.1, z: -2.15, label: 'Chart table' },
};

export function stationPosition(kind: StationKind) {
  return STATION_POSITIONS[kind];
}
