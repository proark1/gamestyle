import type {
  DiagnosticEngine,
  DiagnosticPlatform,
  ErrorKind,
} from '../../shared/diagnostics/protocol';
export type HealthTotals = {
  visits: number;
  readyVisits: number;
  issueVisits: number;
  sampledVisits: number;
  samples: number;
  medianReadyMs: number | null;
  averageFps: number | null;
  averageP95FrameMs: number | null;
  averageP95WorkMs: number | null;
  maxGeometries: number;
  maxTextures: number;
  errors: Partial<Record<ErrorKind, number>>;
};
export type HealthReport = {
  generated: number;
  truncated: boolean;
  totals: HealthTotals;
  games: (HealthTotals & { game: string })[];
  platforms: { platform: DiagnosticPlatform; visits: number }[];
  engines: { engine: DiagnosticEngine; visits: number }[];
  releases: { release: string; visits: number }[];
};
