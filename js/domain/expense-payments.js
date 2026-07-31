function positiveAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function expensePaidAmount(data, key, fallback = 0) {
  const payments = data?.expensePayments?.[key];
  if (Array.isArray(payments)) {
    return payments.reduce((total, payment) => total + positiveAmount(payment?.amount), 0);
  }
  if (data?.paidAmounts && Object.hasOwn(data.paidAmounts, key)) {
    return positiveAmount(data.paidAmounts[key]);
  }
  return (data?.paidOccurrences || []).includes(key) ? positiveAmount(fallback) : 0;
}

export function expenseOutstandingAmount(data, key, expected) {
  if ((data?.paidOccurrences || []).includes(key)) return 0;
  return Math.max(0, positiveAmount(expected) - expensePaidAmount(data, key, expected));
}

export function hasExpensePayment(data, key) {
  return expensePaidAmount(data, key) > 0;
}
