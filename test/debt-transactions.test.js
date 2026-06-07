import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDebtGraph,
  paymentBreakdown,
  removeDebtGraph,
  removePaymentAndReopenInstallment
} from '../js/domain/debt-transactions.js';

test('calculates discount and interest for debt payments', () => {
  assert.deepEqual(paymentBreakdown(200, 150), {
    expectedValue: 200,
    paidValue: 150,
    discount: 50,
    interest: 0
  });
  assert.deepEqual(paymentBreakdown(200, 230), {
    expectedValue: 200,
    paidValue: 230,
    discount: 0,
    interest: 30
  });
});

test('removes a debt and every linked installment and payment', () => {
  const result = removeDebtGraph({
    debts: [{ id: 'd1' }, { id: 'd2' }],
    installments: [{ id: 'i1', debtId: 'd1' }, { id: 'i2', debtId: 'd2' }],
    payments: [{ id: 'p1', debtId: 'd1' }, { id: 'p2', debtId: 'd2' }]
  }, 'd1');

  assert.deepEqual(result, {
    debts: [{ id: 'd2' }],
    installments: [{ id: 'i2', debtId: 'd2' }],
    payments: [{ id: 'p2', debtId: 'd2' }]
  });
});

test('deleting a payment reopens only its installment', () => {
  const result = removePaymentAndReopenInstallment({
    payments: [{ id: 'p1' }, { id: 'p2' }],
    installments: [
      { id: 'i1', status: 'Paga', paidAt: '2026-06-01' },
      { id: 'i2', status: 'Paga', paidAt: '2026-06-02' }
    ]
  }, 'p1', 'i1');

  assert.deepEqual(result.payments, [{ id: 'p2' }]);
  assert.deepEqual(result.installments, [
    { id: 'i1', status: 'Pendente' },
    { id: 'i2', status: 'Paga', paidAt: '2026-06-02' }
  ]);
  assert.deepEqual(clearDebtGraph(), { debts: [], installments: [], payments: [] });
});
