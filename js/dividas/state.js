export const state = {
  debts: [],
  creditors: [],
  installments: [],
  payments: [],
  installmentsByDebt: new Map(),
  paymentsByDebt: new Map(),
  paymentByInstallment: new Map(),
  editingDebtId: null,
  paymentInstallmentId: null,
  reschedulingInstallmentId: null,
  deleteContext: null,
  selectedWaitingCreditorFilter: 'all',
  selectedPaidOffCreditorFilter: 'all',
  selectedTrailCreditorFilter: 'all',
  selectedTrailDebtSort: 'trail',
  selectedTrailDebtSortDirection: 'desc',
  selectedWaitingDebtSort: 'priority',
  selectedWaitingDebtSortDirection: 'desc',
  expandedOverviewSimulationDebtId: null,
  expandedOverviewConsolidationId: null,
  selectedOverviewConsolidationDebtIds: new Set(),
  selectedRenegotiationDebtIds: new Set(),
  expandedDebtId: null,
  expandedDebtTab: 'pending',
  expandedDebtListMode: 'preview',
  payoffDebtId: null,
  editingInstallmentId: null,
  draggedRouteDebtId: null,
  draggedWaitingDebtId: null,
  userPreferences: {},
  renderFn: null,
  loadAllFn: null
};

export function groupBy(items, key) {
  const grouped = new Map();
  items.forEach(item => {
    const value = item[key];
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(item);
  });
  return grouped;
}

export function rebuildIndexes() {
  state.installmentsByDebt = groupBy(state.installments, 'debtId');
  state.paymentsByDebt = groupBy(state.payments, 'debtId');
  state.paymentByInstallment = new Map(state.payments.map(item => [item.installmentId, item]));
}
