import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstallmentComplete, removeCompletedInstallments } from '../js/domain/installments.js';

test('identifies a completed installment plan', () => {
  assert.equal(isInstallmentComplete({ totalInstallments: 7, paidInstallments: 7 }), true);
  assert.equal(isInstallmentComplete({ totalInstallments: 7, paidInstallments: 6 }), false);
});

test('removes completed installment plans and preserves pending ones', () => {
  const items = [
    { id: 'completed', totalInstallments: 2, paidInstallments: 2 },
    { id: 'pending', totalInstallments: 3, paidInstallments: 1 }
  ];
  assert.deepEqual(removeCompletedInstallments(items), [items[1]]);
});
