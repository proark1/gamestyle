import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
void test('every shared panel selects the peer client regardless of gameplay transport', () => {
  const panel = readFileSync('shared/voice/VoicePanel.tsx', 'utf8');
  assert.match(panel, /await import\('\.\/peer-client'\)/);
  assert.doesNotMatch(panel, /import\('\.\/client'\)/);
});
