import type { StationKind } from './types';

export const STATION_POSITIONS: Record<
  StationKind,
  { x: number; z: number; label: string }
> = {
  helm: { x: -0.3, z: -2.0, label: 'Helm' },
  throttle: { x: 0.92, z: -1.95, label: 'Throttle' },
  'rod-rack': { x: -2.35, z: -0.45, label: 'Rod rack' },
  'bait-table': { x: -2.1, z: 1.55, label: 'Bait table' },
  'net-rack': { x: 2.32, z: -1.85, label: 'Landing net' },
  'ice-hold': { x: 1.88, z: 1.72, label: 'Ice hold' },
  engine: { x: 0.05, z: 2.55, label: 'Engine' },
  'fuel-port': { x: 1.05, z: 2.45, label: 'Fuel port' },
  'repair-bench': { x: -1.55, z: 2.25, label: 'Repair bench' },
  'bilge-pump': { x: -0.45, z: 2.35, label: 'Bilge pump' },
  'rescue-line': { x: 2.36, z: 1.0, label: 'Rescue line' },
  'chart-table': { x: -1.2, z: -1.9, label: 'Chart table' },
};

export function stationPosition(kind: StationKind) {
  return STATION_POSITIONS[kind];
}
