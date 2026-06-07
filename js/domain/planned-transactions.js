function withoutOccurrencePrefix(values = [], id) {
  const prefix = `${id}:`;
  return values.filter((key) => !String(key).startsWith(prefix));
}

function withoutMapPrefix(values = {}, id) {
  const prefix = `${id}:`;
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => !String(key).startsWith(prefix))
  );
}

export function removeManualPlanned(data, id) {
  const appliedCashMovements = data.appliedCashMovements || {};
  const removedCashMovement = Object.entries(appliedCashMovements)
    .filter(([key]) => String(key).startsWith(`${id}:`))
    .reduce((total, [, value]) => total + Number(value || 0), 0);

  return {
    ...data,
    accountBalance: Number(data.accountBalance || data.initialBalance || 0) - removedCashMovement,
    incomeLines: (data.incomeLines || []).filter((item) => item.id !== id),
    plannedPurchases: (data.plannedPurchases || []).filter((item) => item.id !== id),
    receivedOccurrences: withoutOccurrencePrefix(data.receivedOccurrences, id),
    paidOccurrences: withoutOccurrencePrefix(data.paidOccurrences, id),
    receivedAmounts: withoutMapPrefix(data.receivedAmounts, id),
    paidAmounts: withoutMapPrefix(data.paidAmounts, id),
    paidDates: withoutMapPrefix(data.paidDates, id),
    appliedCashMovements: withoutMapPrefix(appliedCashMovements, id)
  };
}
