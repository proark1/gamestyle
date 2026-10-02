import assert from 'node:assert/strict';
import test from 'node:test';
import { DiagnosticAccumulator } from './model';
import {
  activateDiagnosticGame,
  diagnosticGameSnapshot,
  subscribeDiagnosticGame,
} from './game-context';
import {
  emptyDiagnosticSummary,
  MAX_DIAGNOSTIC_SAMPLES,
  parseDiagnostics,
} from './protocol';

const report = () => ({
  v: 1,
  id: 'anonymous-0123456789abcdef',
  game: 'course-correction',
  delivery: 1,
  elapsedMs: 1000,
  platform: 'web',
  engine: 'chromium',
  release: 'test-build',
  summary: emptyDiagnosticSummary(),
});
const frame = {
  frames: 100,
  fps: 60,
  p95FrameMs: 17,
  p95WorkMs: 5,
  geometries: 20,
  textures: 3,
};
void test('party diagnostics follow the embedded game and ignore stale unmounts', () => {
  const changes: (string | null)[] = [];
  const unsubscribe = subscribeDiagnosticGame(() =>
    changes.push(diagnosticGameSnapshot()),
  );
  const stopFirst = activateDiagnosticGame('course-correction');
  const stopNext = activateDiagnosticGame('slopewreck');
  stopFirst();
  assert.equal(diagnosticGameSnapshot(), 'slopewreck');
  stopNext();
  assert.equal(diagnosticGameSnapshot(), null);
  activateDiagnosticGame('party')();
  unsubscribe();
  assert.deepEqual(changes, ['course-correction', 'slopewreck', null]);
});
void test('diagnostics scrub extra properties and never retain free-text error details', () => {
  const raw = {
    ...report(),
    url: '/?room=PRIVATE',
    message: 'Name: Private',
    summary: {
      ...emptyDiagnosticSummary(),
      stack: 'secret',
      errors: { resource: 2 },
    },
  };
  const parsed = parseDiagnostics(raw);
  assert.equal('url' in parsed, false);
  assert.equal('stack' in parsed.summary, false);
  assert.deepEqual(parsed.summary.errors, { resource: 2 });
  assert.throws(() =>
    parseDiagnostics({
      ...raw,
      summary: { ...raw.summary, errors: { 'private-player': 1 } },
    }),
  );
});
void test('malformed identities, games, builds and numbers cannot enter diagnostics', () => {
  for (const patch of [
    { id: 'short' },
    { game: 'unknown' },
    { delivery: 0 },
    { platform: 'my-phone-name' },
    { release: 'https://private.example' },
    { elapsedMs: NaN },
  ])
    assert.throws(() => parseDiagnostics({ ...report(), ...patch }));
  for (const value of [Infinity, NaN, -1, '60'])
    assert.throws(() =>
      parseDiagnostics({
        ...report(),
        summary: { ...emptyDiagnosticSummary(), fpsTotal: value },
      }),
    );
});
void test('untrusted samples and error counters are bounded', () => {
  const parsed = parseDiagnostics({
    ...report(),
    summary: {
      ...emptyDiagnosticSummary(),
      samples: 9999,
      fpsTotal: 99999999,
      errors: { javascript: 999999 },
    },
  });
  assert.equal(parsed.summary.samples, MAX_DIAGNOSTIC_SAMPLES);
  assert.equal(parsed.summary.fpsTotal, MAX_DIAGNOSTIC_SAMPLES * 240);
  assert.equal(parsed.summary.errors.javascript, 100);
});
void test('first frame is retained and the slow-start warning is counted only once', () => {
  const model = new DiagnosticAccumulator(1000);
  model.checkTimeout(45000);
  assert.equal(model.summary.errors['start-timeout'], undefined);
  model.checkTimeout(46000);
  model.checkTimeout(100000);
  assert.equal(model.summary.errors['start-timeout'], 1);
  model.ready(110000);
  model.ready(150000);
  assert.equal(model.summary.readyMs, 109000);
});
void test('valid frame samples cap their overhead and preserve peak resource counts', () => {
  const model = new DiagnosticAccumulator(0);
  assert.equal(model.sample({ ...frame, frames: 0 }), false);
  assert.equal(model.sample({ ...frame, fps: NaN }), false);
  assert.equal(model.sample({ ...frame, geometries: '20' }), false);
  assert.equal(model.sample({ ...frame, geometries: 40 }), true);
  for (let i = 1; i < MAX_DIAGNOSTIC_SAMPLES; i++)
    assert.equal(model.sample(frame), true);
  assert.equal(model.sample(frame), false);
  assert.equal(model.summary.samples, MAX_DIAGNOSTIC_SAMPLES);
  assert.equal(model.summary.maxGeometries, 40);
  assert.equal(model.summary.fpsTotal, MAX_DIAGNOSTIC_SAMPLES * 60);
  const snapshot = model.snapshot();
  snapshot.errors.javascript = 1;
  assert.equal(model.summary.errors.javascript, undefined);
});
