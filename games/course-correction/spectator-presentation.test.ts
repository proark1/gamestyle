import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SpectatorEventTracker,
  spectatorAnchors,
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

void test('spectator anchors populate both sides with seated and standing fans', () => {
  const anchors = spectatorAnchors(12);
  assert.equal(anchors.length, 12);
  assert.ok(anchors.some((anchor) => anchor.seated));
  assert.ok(anchors.some((anchor) => !anchor.seated));
  assert.ok(anchors.some((anchor) => anchor.x < 0));
  assert.ok(anchors.some((anchor) => anchor.x > 0));
  for (const anchor of anchors) {
    if (anchor.x < 0) assert.ok(Math.sin(anchor.facing) > 0);
    else assert.ok(Math.sin(anchor.facing) < 0);
  }
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
