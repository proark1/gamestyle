import assert from 'node:assert/strict';
import test from 'node:test';
import { freshWorld } from './simulation';
import {
  CupSequenceTracker,
  feedbackTier,
  playerStatus,
  presentationProfile,
} from './presentation';
import type { CourseEvent } from './types';

const event = (
  id: number,
  kind: CourseEvent['kind'],
  at = 0,
  player?: string,
): CourseEvent => ({ id, kind, at, x: 0, z: 0, player });

void test('feedback tiers reserve camera emphasis for course-changing events', () => {
  assert.equal(feedbackTier(event(1, 'impact')), 'minor');
  assert.equal(feedbackTier(event(2, 'wall')), 'course');
  assert.equal(feedbackTier(event(3, 'platform')), 'major');
  assert.equal(feedbackTier(event(4, 'multi-cup')), 'celebration');
});

void test('cup chains aggregate unique players over 1200ms without replaying', () => {
  const tracker = new CupSequenceTracker();
  const first = [
    event(1, 'cup', 100, 'a'),
    event(2, 'cup', 500, 'b'),
    event(3, 'cup', 1_100, 'c'),
  ];
  assert.deepEqual(tracker.ingest(first), {
    kind: 'chain',
    count: 3,
    at: 1_100,
    players: ['a', 'b', 'c'],
  });
  assert.equal(tracker.ingest(first), null);
  assert.equal(
    tracker.ingest([...first, event(4, 'cup', 1_250, 'd')])?.kind,
    'everybody',
  );
});

void test('old cup events and duplicate players do not start a chain', () => {
  const tracker = new CupSequenceTracker();
  assert.equal(
    tracker.ingest([
      event(1, 'cup', 0, 'a'),
      event(2, 'cup', 1_300, 'b'),
      event(3, 'cup', 1_400, 'b'),
      event(4, 'cup', 1_500, 'c'),
    ]),
    null,
  );
});

void test('reduced motion disables camera and trails while mobile caps particles', () => {
  assert.equal(presentationProfile(true, false).camera, 0);
  assert.equal(presentationProfile(true, false).trails, false);
  assert.ok(
    presentationProfile(false, true).particles <
      presentationProfile(false, false).particles,
  );
});

void test('player status follows authoritative ball state', () => {
  const world = freshWorld(0);
  const player = world.players[0];
  const ball = world.balls[0];
  assert.equal(playerStatus(world, player.id), 'aiming');
  ball.moving = true;
  assert.equal(playerStatus(world, player.id), 'moving');
  ball.holed = true;
  assert.equal(playerStatus(world, player.id), 'holed');
});
