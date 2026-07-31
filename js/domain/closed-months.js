function movementMonth(key) {
  const index = String(key).lastIndexOf(":");
  const month = index >= 0 ? String(key).slice(index + 1) : "";
  return /^\d{4}-\d{2}$/.test(month) ? month : "";
}

export function accountBalanceAtMonthEnd(data, month) {
  const currentBalance = Number(data?.accountBalance || data?.initialBalance || 0);
  const futureMovements = Object.entries(data?.appliedCashMovements || {})
    .filter(([key]) => movementMonth(key) > month)
    .reduce((total, [, amount]) => total + Number(amount || 0), 0);
  return currentBalance - futureMovements;
}
