export function isInstallmentComplete(item = {}) {
  const total = Number(item.totalInstallments || 0);
  return total > 0 && Number(item.paidInstallments || 0) >= total;
}

export function removeCompletedInstallments(items = []) {
  return items.filter((item) => !isInstallmentComplete(item));
}

export function sortInstallmentsByCreditorAndPurchaseDate(items = [], getCreditorName) {
  return [...items].sort((a, b) => {
    const creditorOrder = String(getCreditorName(a) || '').localeCompare(
      String(getCreditorName(b) || ''),
      'pt-BR',
      { sensitivity: 'base' }
    );
    if (creditorOrder) return creditorOrder;

    const dateOrder = String(a.purchaseDate || '9999-12-31').localeCompare(String(b.purchaseDate || '9999-12-31'));
    if (dateOrder) return dateOrder;

    return String(a.item || '').localeCompare(String(b.item || ''), 'pt-BR', { sensitivity: 'base' });
  });
}
