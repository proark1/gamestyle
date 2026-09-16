import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPlatform,
  isNative,
  isStandalone,
  isMobile,
  isTouchDevice,
} from './platform';
import { requestWakeLock, releaseWakeLock } from './wake-lock';
import { triggerHaptic } from './haptics';

void test('getPlatform returns web by default in non-browser or standard web environment', () => {
  const platform = getPlatform();
  assert.equal(typeof platform, 'string');
  assert.ok(['web', 'ios', 'android'].includes(platform));
});

void test('isNative returns false in standard node/web environment without Capacitor bridge', () => {
  assert.equal(isNative(), false);
});

void test('isStandalone returns false by default without standalone display mode', () => {
  assert.equal(isStandalone(), false);
});

void test('isMobile and isTouchDevice return booleans safely without crashing in test runner', () => {
  assert.equal(typeof isMobile(), 'boolean');
  assert.equal(typeof isTouchDevice(), 'boolean');
});

void test('requestWakeLock and releaseWakeLock operate safely when API is unavailable', async () => {
  const acquired = await requestWakeLock();
  assert.equal(acquired, false);
  await releaseWakeLock();
});

void test('triggerHaptic operates safely when vibration API is unavailable', () => {
  assert.doesNotThrow(() => {
    triggerHaptic('light');
    triggerHaptic('medium');
    triggerHaptic('heavy');
  });
});
