import test from 'node:test';
import assert from 'node:assert/strict';
import { debtInstallmentForMonth, debtBudgetRow, normalizeDebtBudgetFlags } from '../js/domain/debt-budget.js';

const debt = {
  id: 'debt-1',
  name: 'Acordo banco',
  creditorId: 'creditor-1',
  status: 'Ativa',
  includeInBudget: true
};

const installments = [
  { id: 'i2', debtId: 'debt-1', number: 2, dueDate: '2026-06-20', expectedValue: 200, status: 'Pendente' },
  { id: 'i1', debtId: 'debt-1', number: 1, dueDate: '2026-06-10', expectedValue: 150, status: 'Pendente' },
  { id: 'other', debtId: 'debt-2', number: 1, dueDate: '2026-06-05', expectedValue: 999, status: 'Pendente' }
];

test('selects the first pending installment for the month', () => {
  assert.equal(debtInstallmentForMonth({ debt, installments, month: '2026-06' })?.id, 'i1');
});

test('ignores debts outside the budget or already paid off', () => {
  assert.equal(debtInstallmentForMonth({
    debt: { ...debt, includeInBudget: false },
    installments,
    month: '2026-06'
  }), null);
  assert.equal(debtInstallmentForMonth({
    debt: { ...debt, status: 'Quitada' },
    installments,
    month: '2026-06'
  }), null);
});

test('never includes Consignado CLT in the monthly control', () => {
  assert.deepEqual(normalizeDebtBudgetFlags({
    includeInBudget: true,
    isConsignado: true
  }), {
    includeInBudget: false,
    isConsignado: true
  });
  assert.equal(debtInstallmentForMonth({
    debt: { ...debt, isConsignado: true },
    installments,
    month: '2026-06'
  }), null);
});

test('keeps a paid installment visible when payment came from monthly control', () => {
  const paid = [{ ...installments[1], status: 'Paga' }];
  assert.equal(debtInstallmentForMonth({
    debt,
    installments: paid,
    month: '2026-06',
    paidOccurrences: ['auto-debt-debt-1:2026-06']
  })?.id, 'i1');
});

test('builds the same auto-debt projection contract', () => {
  const result = debtBudgetRow({
    debt,
    installment: installments[1],
    creditorName: 'Banco',
    month: '2026-06'
  });
  assert.deepEqual(result, {
    row: {
      id: 'auto-debt-debt-1',
      kind: 'expense',
      owner: 'Felipe',
      creditorId: 'creditor-1',
      fromDebtId: 'debt-1',
      label: 'Acordo banco',
      origin: 'Banco',
      logoUrl: '',
      values: { '2026-06': 150 },
      dueDates: { '2026-06': '2026-06-10' }
    },
    value: 150
  });
});
