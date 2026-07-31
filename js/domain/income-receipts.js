function positiveAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function incomeReceiptEntries(data, key) {
  const receipts = data?.receivedPayments?.[key];
  if (Array.isArray(receipts)) {
    return receipts
      .map((receipt) => ({ ...receipt, amount: positiveAmount(receipt?.amount) }))
      .filter((receipt) => receipt.amount > 0);
  }
  const legacyAmount = positiveAmount(data?.receivedAmounts?.[key]);
  return legacyAmount ? [{ amount: legacyAmount }] : [];
}

export function incomeReceivedAmount(data, key, fallback = 0) {
  const receipts = data?.receivedPayments?.[key];
  if (Array.isArray(receipts)) {
    return receipts.reduce((total, receipt) => total + positiveAmount(receipt?.amount), 0);
  }
  if (data?.receivedAmounts && Object.hasOwn(data.receivedAmounts, key)) {
    return positiveAmount(data.receivedAmounts[key]);
  }
  return (data?.receivedOccurrences || []).includes(key) ? positiveAmount(fallback) : 0;
}

export function incomeOutstandingAmount(data, key, expected) {
  if ((data?.receivedOccurrences || []).includes(key)) return 0;
  return Math.max(0, positiveAmount(expected) - incomeReceivedAmount(data, key, expected));
}

export function hasIncomeReceipt(data, key) {
  return incomeReceivedAmount(data, key) > 0;
}
