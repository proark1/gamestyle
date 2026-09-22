import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventMessage } from './ui-text';
import type { CarryOnEvent } from './types';

void test('German gameplay feedback uses semantic events, never English fallback prose', () => {
  const cases: Partial<CarryOnEvent>[] = [
    { type: 'pack', detail: 'boarding' },
    { type: 'pack', detail: 'packed', item: 'clothes' },
    { type: 'pack', detail: 'unpacked', item: 'duck' },
    { type: 'pack', detail: 'inserted' },
    { type: 'compress' },
    { type: 'zip', detail: 'closed' },
    { type: 'zip', detail: 'jammed' },
    { type: 'zip', detail: 'progress' },
    { type: 'burst' },
    { type: 'tsa_alarm' },
    { type: 'tsa_distracted' },
    { type: 'tsa_caught' },
    { type: 'sizer_passed' },
    { type: 'sizer_rejected' },
    { type: 'flight_departed' },
  ];
  for (const data of cases) {
    const event = {
      id: 1,
      text: 'English fallback must not leak',
      ...data,
    } as CarryOnEvent;
    const de = eventMessage(event, 'de');
    assert.ok(de.length > 10);
    assert.notEqual(de, event.text);
    assert.notEqual(de, eventMessage(event, 'en'));
  }
  assert.match(
    eventMessage(
      { id: 1, text: '', type: 'pack', detail: 'packed', item: 'clothes' },
      'de',
    ),
    /Hawaiihemden/,
  );
});
