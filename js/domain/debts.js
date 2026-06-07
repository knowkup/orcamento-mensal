const CLOSED_INSTALLMENT_STATUSES = new Set(['Paga', 'Renegociada', 'Quitada', 'Cancelada']);

export function isDebtInstallmentOpen(installment) {
  return !CLOSED_INSTALLMENT_STATUSES.has(installment?.status);
}

export function openDebtInstallments(installments = []) {
  return installments.filter(isDebtInstallmentOpen);
}

export function debtBalanceFromInstallments(installments = []) {
  return openDebtInstallments(installments)
    .reduce((total, installment) => total + Number(installment.expectedValue || 0), 0);
}

export function debtInstallmentProgress(installments = [], expectedQuantity = 0) {
  const paid = installments.filter(installment => installment.status === 'Paga' || installment.status === 'Quitada').length;
  return {
    paid,
    total: installments.length || Number(expectedQuantity || 0) || 0
  };
}

export function isDebtPaidOff(installments = [], expectedQuantity = 0) {
  const expected = Number(expectedQuantity || 0);
  if (expected > 0 && installments.length < expected) return false;
  return installments.length > 0 && openDebtInstallments(installments).length === 0;
}
