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

export function fixedCostBaseValue(cost, overrides, month) {
  const baseValue = overrides?.[fixedCostAdditionStorageKey(cost.id, month)];
  return baseValue === undefined ? positiveAmount(cost.amount) : positiveAmount(baseValue);
}

export function fixedCostMonthlyValue(cost, overrides, additions, month) {
  return fixedCostBaseValue(cost, overrides, month) + fixedCostAdditionAmount(additions, cost.id, month);
}
