import test from 'node:test';
import assert from 'node:assert/strict';
import { creditorFilterEntries, filterDebtsByCreditor } from '../js/domain/debt-filters.js';

const debts = [
  { id: '1', creditorId: 'b' },
  { id: '2', creditorId: 'a' },
  { id: '3', creditorId: 'b' },
  { id: '4', creditorId: '' }
];

test('filters debts by creditor without mutating the source', () => {
  assert.deepEqual(filterDebtsByCreditor(debts, 'b').map(item => item.id), ['1', '3']);
  assert.notEqual(filterDebtsByCreditor(debts, 'all'), debts);
  assert.equal(debts.length, 4);
});

test('builds sorted creditor filter entries with counts', () => {
  const names = { a: 'Ágil', b: 'Banco' };
  assert.deepEqual(creditorFilterEntries(debts, id => names[id]), [
    { id: 'a', count: 1, name: 'Ágil' },
    { id: 'b', count: 2, name: 'Banco' }
  ]);
});
