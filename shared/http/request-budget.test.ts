import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RequestBudget } from './request-budget';

void test('request slots reject overload and release exactly once after completion', () => {
  const budget = new RequestBudget(1);
  const release = budget.enter();
  assert.throws(() => budget.enter(), /busy/);
  release();
  release();
  const second = budget.enter();
  assert.throws(() => budget.enter(), /busy/);
  second();
});

void test('rate limits refill, isolate rooms, and cannot allocate unbounded keys', () => {
  const budget = new RequestBudget(2, 2);
  budget.take('a', 1, 1, 0);
  assert.throws(() => budget.take('a', 1, 1, 500), /Too many/);
  budget.take('b', 1, 1, 500);
  assert.throws(() => budget.take('c', 1, 1, 500), /busy/);
  budget.take('a', 1, 1, 1000);
  budget.take('c', 1, 1, 1500);
  assert.throws(() => budget.take('a', 1, 1, 1500), /Too many/);
});
