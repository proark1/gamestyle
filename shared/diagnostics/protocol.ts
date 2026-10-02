import { isGame, type Game } from '../games/identity';

export const DIAGNOSTICS_ENDPOINT = '/api/diagnostics';
export const MAX_DIAGNOSTIC_BYTES = 4096;
export const MAX_DIAGNOSTIC_SAMPLES = 120;
export const PLATFORMS = ['web', 'android', 'ios', 'desktop'] as const;
export const ENGINES = ['chromium', 'firefox', 'webkit', 'other'] as const;
export const ERROR_KINDS = [
  'javascript',
  'resource',
  'rejection',
  'graphics-lost',
  'offline',
  'start-timeout',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];
export type DiagnosticPlatform = (typeof PLATFORMS)[number];
export type DiagnosticEngine = (typeof ENGINES)[number];
export type DiagnosticSummary = {
  readyMs: number | null;
  samples: number;
  fpsTotal: number;
  frameMsTotal: number;
  workMsTotal: number;
  maxGeometries: number;
  maxTextures: number;
  errors: Partial<Record<ErrorKind, number>>;
};
export type DiagnosticBatch = {
  v: 1;
  id: string;
  game: Game;
  delivery: number;
  elapsedMs: number;
  platform: DiagnosticPlatform;
  engine: DiagnosticEngine;
  release: string;
  summary: DiagnosticSummary;
};

export class DiagnosticError extends Error {}
const fail = (): never => {
  throw new DiagnosticError('Invalid diagnostic report.');
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function number(value: unknown, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    return fail();
  return Math.min(max, Math.round(value));
}
function member<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return fail();
  return value as T;
}

/** Only fixed categories and numeric summaries cross the wire. Never store messages or URLs. */
export function parseDiagnostics(value: unknown): DiagnosticBatch {
  const body = record(value);
  if (
    body.v !== 1 ||
    typeof body.id !== 'string' ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(body.id)
  )
    return fail();
  if (!isGame(body.game)) return fail();
  if (
    typeof body.release !== 'string' ||
    !/^[a-zA-Z0-9._-]{1,64}$/.test(body.release)
  )
    return fail();
  const summary = record(body.summary);
  const rawErrors = record(summary.errors);
  const errors: DiagnosticSummary['errors'] = {};
  for (const [kind, count] of Object.entries(rawErrors)) {
    const key = member(kind, ERROR_KINDS);
    errors[key] = number(count, 100);
  }
  const samples = number(summary.samples, MAX_DIAGNOSTIC_SAMPLES);
  const delivery = number(body.delivery, 10000);
  if (!delivery) return fail();
  return {
    v: 1,
    id: body.id,
    game: body.game,
    delivery,
    elapsedMs: number(body.elapsedMs, 86400000),
    platform: member(body.platform, PLATFORMS),
    engine: member(body.engine, ENGINES),
    release: body.release,
    summary: {
      readyMs:
        summary.readyMs === null ? null : number(summary.readyMs, 300000),
      samples,
      fpsTotal: number(summary.fpsTotal, samples * 240),
      frameMsTotal: number(summary.frameMsTotal, samples * 10000),
      workMsTotal: number(summary.workMsTotal, samples * 10000),
      maxGeometries: number(summary.maxGeometries, 1000000),
      maxTextures: number(summary.maxTextures, 100000),
      errors,
    },
  };
}

export function emptyDiagnosticSummary(): DiagnosticSummary {
  return {
    readyMs: null,
    samples: 0,
    fpsTotal: 0,
    frameMsTotal: 0,
    workMsTotal: 0,
    maxGeometries: 0,
    maxTextures: 0,
    errors: {},
  };
}
