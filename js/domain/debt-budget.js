export function normalizeDebtBudgetFlags(debt = {}) {
  const isConsignado = !!debt.isConsignado;
  return {
    isConsignado,
    includeInBudget: !isConsignado && !!debt.includeInBudget
  };
}

export function debtInstallmentForMonth({ debt, installments, month, paidOccurrences = [] }) {
  const flags = normalizeDebtBudgetFlags(debt);
  if (!flags.includeInBudget || debt.status === 'Quitada') return null;

  const paidViaControl = paidOccurrences.includes(`auto-debt-${debt.id}:${month}`);
  return installments
    .filter(installment => installment.debtId === debt.id
      && String(installment.dueDate || '').startsWith(month)
      && (installment.status === 'Pendente' || (installment.status === 'Paga' && paidViaControl)))
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))[0] || null;
}

export function debtBudgetRow({ debt, installment, creditorName, month }) {
  if (!debt || !installment) return null;

  const value = Number(installment.expectedValue || 0);
  return {
    row: {
      id: `auto-debt-${debt.id}`,
      kind: 'expense',
      owner: 'Felipe',
      creditorId: debt.creditorId || '',
      fromDebtId: debt.id,
      label: debt.name,
      origin: creditorName || '',
      logoUrl: '',
      values: { [month]: value },
      dueDates: { [month]: installment.dueDate }
    },
    value
  };
}
