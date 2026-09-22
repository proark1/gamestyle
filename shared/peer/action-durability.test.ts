import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { PeerGameConnection } from './connection';
import { DurableBatch } from './durable-batch';

type Harness = {
  handleAction(
    id: string,
    requestId: string,
    action: unknown,
    epoch: number,
  ): void;
  epoch: number;
};

void test('four players execute ordered actions while checkpoint I/O is blocked, then receive only durable acknowledgements', async () => {
  const executions: string[] = [],
    acknowledgements: string[] = [];
  const captures: string[][] = [],
    releases: (() => void)[] = [];
  const connection = Object.create(PeerGameConnection.prototype) as Harness;
  Object.assign(connection, {
    epoch: 1,
    session: { id: 'p0' },
    processing: new Set(),
    actionQueue: Promise.resolve(),
    authoritative: () => true,
    status: () => {},
    ack: (requestId: string) => acknowledgements.push(requestId),
    mesh: {
      view: { members: [0, 1, 2, 3].map((i) => ({ id: `p${i}` })) },
      send: (_id: string, message: { requestId: string }) =>
        acknowledgements.push(message.requestId),
    },
    engine: {
      execute: (_id: string, requestId: string) => {
        executions.push(requestId);
        return {};
      },
    },
    durability: new DurableBatch(async () => {
      captures.push([...executions]);
      await new Promise<void>((resolve) => releases.push(resolve));
    }),
  });
  for (let i = 0; i < 12; i++)
    connection.handleAction(`p${i % 4}`, `action-${i}`, { type: 'shoot' }, 1);
  await setImmediate();
  assert.deepEqual(
    executions,
    Array.from({ length: 12 }, (_, i) => `action-${i}`),
  );
  assert.equal(acknowledgements.length, 0);
  assert.equal(captures.length, 1);
  releases.shift()!();
  await setImmediate();
  assert.ok(acknowledgements.every((id) => captures[0].includes(id)));
  assert.equal(captures.length, 2);
  releases.shift()!();
  await setImmediate();
  assert.deepEqual([...acknowledgements].sort(), [...executions].sort());

  connection.handleAction('p1', 'before-handover', { type: 'pass' }, 1);
  await setImmediate();
  connection.epoch = 2;
  releases.shift()!();
  await setImmediate();
  assert.ok(
    !acknowledgements.includes('before-handover'),
    'a former host cannot acknowledge after its epoch changes',
  );
});
