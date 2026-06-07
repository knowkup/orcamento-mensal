import test from 'node:test';
import assert from 'node:assert/strict';
import {
  debtBalanceFromInstallments,
  debtInstallmentProgress,
  isDebtInstallmentOpen,
  isDebtPaidOff,
  openDebtInstallments
} from '../js/domain/debts.js';

const installments = [
  { status: 'Paga', expectedValue: 100 },
  { status: 'Pendente', expectedValue: 200 },
  { status: 'Renegociada', expectedValue: 300 },
  { status: 'Cancelada', expectedValue: 400 }
];

test('only pending-like statuses remain open', () => {
  assert.equal(isDebtInstallmentOpen({ status: 'Pendente' }), true);
  assert.equal(isDebtInstallmentOpen({ status: 'Paga' }), false);
  assert.deepEqual(openDebtInstallments(installments), [installments[1]]);
});

test('debt balance sums only open installments', () => {
  assert.equal(debtBalanceFromInstallments(installments), 200);
});

test('installment progress uses generated count and paid statuses', () => {
  assert.deepEqual(debtInstallmentProgress(installments, 10), { paid: 1, total: 4 });
  assert.deepEqual(debtInstallmentProgress([], 10), { paid: 0, total: 10 });
});

test('debt is paid off only when all expected installments exist and are closed', () => {
  assert.equal(isDebtPaidOff([{ status: 'Paga' }], 2), false);
  assert.equal(isDebtPaidOff([{ status: 'Paga' }, { status: 'Quitada' }], 2), true);
  assert.equal(isDebtPaidOff([{ status: 'Paga' }, { status: 'Pendente' }], 2), false);
  assert.equal(isDebtPaidOff([], 0), false);
});
