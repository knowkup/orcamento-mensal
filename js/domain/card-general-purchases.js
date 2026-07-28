export function cardGeneralPurchaseStorageKey(groupId, month) {
  return `${groupId}:${month}`;
}

export function cardGeneralPurchaseOccurrenceKey(groupId, month) {
  return `child-card-general|${groupId}:${month}`;
}

export function cardGeneralPurchaseAmount(values = {}, groupId, month) {
  return Number(values[cardGeneralPurchaseStorageKey(groupId, month)] || 0);
}
