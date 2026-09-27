import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SpectatorEventTracker,
  spectatorDetail,
  spectatorReaction,
} from './spectator-presentation';
import type { CourseEvent } from './types';

const event = (id: number, kind: CourseEvent['kind']): CourseEvent => ({
  id,
  kind,
  at: id * 100,
  x: 0,
  z: 0,
});

void test('crowd reactions reserve the strongest cheer for cup chains', () => {
  assert.equal(spectatorReaction(event(1, 'shot')), null);
  assert.ok(
    spectatorReaction(event(2, 'wall'))!.intensity <
      spectatorReaction(event(3, 'cup'))!.intensity,
  );
  assert.equal(spectatorReaction(event(4, 'multi-cup'))!.intensity, 1);
});

void test('tracker deduplicates events and returns the strongest new reaction', () => {
  const tracker = new SpectatorEventTracker();
  const events = [event(1, 'wall'), event(2, 'cup'), event(3, 'impact')];
  assert.equal(tracker.ingest(events)?.eventId, 2);
  assert.equal(tracker.ingest(events), null);
  assert.equal(tracker.ingest([...events, event(4, 'platform')])?.eventId, 4);
});

void test('mobile and reduced motion lower crowd animation cost', () => {
  const desktop = spectatorDetail(false, false);
  const mobile = spectatorDetail(false, true);
  const reduced = spectatorDetail(true, false);
  assert.ok(mobile.total < desktop.total);
  assert.ok(mobile.animated < desktop.animated);
  assert.equal(reduced.animated, 0);
});
