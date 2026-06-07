import test from 'node:test';
import assert from 'node:assert/strict';
import { moveItemToTargetPosition, moveItemByDirection } from '../js/domain/reorder.js';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

test('moves an item one position in either direction', () => {
  assert.deepEqual(moveItemByDirection(items, 'b', -1).map(item => item.id), ['b', 'a', 'c']);
  assert.deepEqual(moveItemByDirection(items, 'b', 1).map(item => item.id), ['a', 'c', 'b']);
  assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c']);
});

test('rejects movement outside list boundaries', () => {
  assert.equal(moveItemByDirection(items, 'a', -1), null);
  assert.equal(moveItemByDirection(items, 'c', 1), null);
  assert.equal(moveItemByDirection(items, 'missing', 1), null);
});

test('moves a dragged item to the target position', () => {
  assert.deepEqual(moveItemToTargetPosition(items, 'c', 'a').map(item => item.id), ['c', 'a', 'b']);
  assert.deepEqual(moveItemToTargetPosition(items, 'a', 'c').map(item => item.id), ['b', 'c', 'a']);
  assert.equal(moveItemToTargetPosition(items, 'a', 'a'), null);
});
