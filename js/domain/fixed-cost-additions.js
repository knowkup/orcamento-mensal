function positiveAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function fixedCostAdditionStorageKey(costId, month) {
  return `${costId}:${month}`;
}

export function fixedCostAdditionAmount(additions, costId, month) {
  return positiveAmount(additions?.[fixedCostAdditionStorageKey(costId, month)]);
}

export function fixedCostMonthlyValue(cost, overrides, additions, month) {
  const baseValue = overrides?.[fixedCostAdditionStorageKey(cost.id, month)];
  const plannedValue = baseValue === undefined ? positiveAmount(cost.amount) : positiveAmount(baseValue);
  return plannedValue + fixedCostAdditionAmount(additions, cost.id, month);
}
