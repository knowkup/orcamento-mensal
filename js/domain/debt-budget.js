export function normalizeDebtBudgetFlags(debt = {}) {
  const isConsignado = !!debt.isConsignado;
  return {
    isConsignado,
    includeInBudget: !isConsignado && !!debt.includeInBudget
  };
}

export function debtInstallmentForMonth({ debt, installments, month, paidOccurrences = [] }) {
  return debtInstallmentsForMonth({ debt, installments, month, paidOccurrences })[0] || null;
}

export function debtInstallmentsForMonth({ debt, installments, month, paidOccurrences = [] }) {
  const flags = normalizeDebtBudgetFlags(debt);
  if (!flags.includeInBudget || debt.status !== 'Ativa') return [];

  return installments
    .filter(installment => installment.debtId === debt.id
      && String(installment.dueDate || '').startsWith(month)
      && (installment.status === 'Pendente' || (installment.status === 'Paga' && (
        paidOccurrences.includes(`auto-debt-${debt.id}:${month}`)
        || paidOccurrences.includes(`auto-debt-${debt.id}|${installment.id}:${month}`)
      ))))
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || Number(a.number || 0) - Number(b.number || 0));
}

export function debtBudgetRow({ debt, installment, creditorName, month }) {
  if (!debt || !installment) return null;

  const value = Number(installment.expectedValue || 0);
  const wasRescheduled = Boolean(installment.originalDueDate);
  const originalDue = String(installment.originalDueDate || '');
  const originalLabel = originalDue
    ? ` · venc. ${originalDue.slice(8, 10)}/${originalDue.slice(5, 7)}/${originalDue.slice(0, 4)}`
    : '';
  return {
    row: {
      id: wasRescheduled ? `auto-debt-${debt.id}|${installment.id}` : `auto-debt-${debt.id}`,
      kind: 'expense',
      owner: 'Felipe',
      creditorId: debt.creditorId || '',
      fromDebtId: debt.id,
      label: debt.name + originalLabel,
      origin: creditorName || '',
      logoUrl: '',
      values: { [month]: value },
      dueDates: { [month]: installment.dueDate }
    },
    value
  };
}
