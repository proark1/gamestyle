import {
  emptyDiagnosticSummary,
  MAX_DIAGNOSTIC_SAMPLES,
  type DiagnosticSummary,
  type ErrorKind,
} from './protocol';

export class DiagnosticAccumulator {
  readonly summary = emptyDiagnosticSummary();
  private timedOut = false;
  constructor(readonly started: number) {}
  error(kind: ErrorKind) {
    this.summary.errors[kind] = Math.min(
      100,
      (this.summary.errors[kind] ?? 0) + 1,
    );
  }
  ready(now: number) {
    this.summary.readyMs ??= Math.min(
      300000,
      Math.max(0, Math.round(now - this.started)),
    );
  }
  checkTimeout(now: number) {
    if (
      this.summary.readyMs === null &&
      !this.timedOut &&
      now - this.started >= 45000
    ) {
      this.timedOut = true;
      this.error('start-timeout');
    }
  }
  sample(value: unknown) {
    if (
      this.summary.samples >= MAX_DIAGNOSTIC_SAMPLES ||
      !value ||
      typeof value !== 'object'
    )
      return false;
    const frame = value as Record<string, unknown>;
    const limits = {
      fps: 240,
      p95FrameMs: 10000,
      p95WorkMs: 10000,
      geometries: 1000000,
      textures: 100000,
    };
    for (const [key, max] of Object.entries(limits)) {
      const number = frame[key];
      if (
        typeof number !== 'number' ||
        !Number.isFinite(number) ||
        number < 0 ||
        number > max
      )
        return false;
    }
    if (typeof frame.frames !== 'number' || frame.frames <= 0) return false;
    this.summary.samples++;
    this.summary.fpsTotal += Math.round(frame.fps as number);
    this.summary.frameMsTotal += Math.round(frame.p95FrameMs as number);
    this.summary.workMsTotal += Math.round(frame.p95WorkMs as number);
    this.summary.maxGeometries = Math.max(
      this.summary.maxGeometries,
      Math.round(frame.geometries as number),
    );
    this.summary.maxTextures = Math.max(
      this.summary.maxTextures,
      Math.round(frame.textures as number),
    );
    return true;
  }
  snapshot(): DiagnosticSummary {
    return { ...this.summary, errors: { ...this.summary.errors } };
  }
}
