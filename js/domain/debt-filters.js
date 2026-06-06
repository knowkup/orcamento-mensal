export function filterDebtsByCreditor(debts, creditorId) {
  return creditorId === 'all'
    ? [...debts]
    : debts.filter(debt => debt.creditorId === creditorId);
}

export function creditorFilterEntries(debts, getCreditorName) {
  const counts = new Map();
  debts.forEach(debt => {
    if (!debt.creditorId) return;
    counts.set(debt.creditorId, (counts.get(debt.creditorId) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([id, count]) => ({ id, count, name: getCreditorName(id) }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR', { sensitivity: 'base' }));
}
