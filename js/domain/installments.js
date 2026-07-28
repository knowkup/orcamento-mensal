export function isInstallmentComplete(item = {}) {
  const total = Number(item.totalInstallments || 0);
  return total > 0 && Number(item.paidInstallments || 0) >= total;
}

export function removeCompletedInstallments(items = []) {
  return items.filter((item) => !isInstallmentComplete(item));
}
