export function paymentBreakdown(expectedValue, paidValue) {
  const expected = Number(expectedValue || 0);
  const paid = Number(paidValue || 0);
  return {
    expectedValue: expected,
    paidValue: paid,
    discount: Math.max(0, expected - paid),
    interest: Math.max(0, paid - expected)
  };
}

export function removeDebtGraph(data, debtId) {
  return {
    debts: data.debts.filter(debt => debt.id !== debtId),
    installments: data.installments.filter(installment => installment.debtId !== debtId),
    payments: data.payments.filter(payment => payment.debtId !== debtId)
  };
}

export function removePaymentAndReopenInstallment(data, paymentId, installmentId) {
  return {
    payments: data.payments.filter(payment => payment.id !== paymentId),
    installments: data.installments.map(installment => {
      if (installment.id !== installmentId) return installment;
      const reopened = { ...installment, status: 'Pendente' };
      delete reopened.paidAt;
      return reopened;
    })
  };
}

export function clearDebtGraph() {
  return { debts: [], installments: [], payments: [] };
}
