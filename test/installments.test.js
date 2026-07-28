import test from 'node:test';
import assert from 'node:assert/strict';
import { isInstallmentComplete, removeCompletedInstallments, sortInstallmentsByCreditorAndPurchaseDate } from '../js/domain/installments.js';

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

test('sorts installment plans by creditor and then purchase date', () => {
  const items = [
    { item: 'Compra recente Itaú', creditor: 'Itaú', purchaseDate: '2026-04-20' },
    { item: 'Compra Grazzatini', creditor: 'Grazzatini', purchaseDate: '2026-06-01' },
    { item: 'Compra antiga Itaú', creditor: 'Itaú', purchaseDate: '2026-01-05' }
  ];
  const ordered = sortInstallmentsByCreditorAndPurchaseDate(items, (item) => item.creditor);
  assert.deepEqual(ordered.map((item) => item.item), [
    'Compra Grazzatini',
    'Compra antiga Itaú',
    'Compra recente Itaú'
  ]);
  assert.deepEqual(items.map((item) => item.item), [
    'Compra recente Itaú',
    'Compra Grazzatini',
    'Compra antiga Itaú'
  ]);
});
