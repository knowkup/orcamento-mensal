import test from 'node:test';
import assert from 'node:assert/strict';
import { createAsyncQueue } from '../js/domain/async-queue.js';

test('runs asynchronous tasks in submission order', async () => {
  const enqueue = createAsyncQueue();
  const events = [];

  const first = enqueue(async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    events.push('first');
  });
  const second = enqueue(async () => {
    events.push('second');
  });

  await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'second']);
});

test('continues after a failed task', async () => {
  const enqueue = createAsyncQueue();
  await assert.rejects(enqueue(async () => {
    throw new Error('failed');
  }));

  const result = await enqueue(async () => 'saved');
  assert.equal(result, 'saved');
});
