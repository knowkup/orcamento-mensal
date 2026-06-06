export function normalizeCreditorKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function mergeCreditorCatalog(primaryCreditors, legacyCreditors, createId) {
  const creditors = primaryCreditors.map(creditor => ({ ...creditor }));
  const ids = new Set(creditors.map(creditor => creditor.id));
  const byName = new Map(
    creditors
      .map(creditor => [normalizeCreditorKey(creditor.name), creditor])
      .filter(([key]) => key)
  );
  const idMap = new Map();
  let changed = false;

  legacyCreditors.forEach(legacy => {
    const key = normalizeCreditorKey(legacy.name);
    let target = byName.get(key);

    if (!target) {
      const preferredId = legacy.id && !ids.has(legacy.id) ? legacy.id : createId();
      target = {
        id: preferredId,
        name: legacy.name || 'Credor',
        paymentForms: legacy.paymentForms?.length
          ? [...legacy.paymentForms]
          : [legacy.type].filter(Boolean),
        logoUrl: legacy.logoUrl || '',
        notes: legacy.notes || ''
      };
      creditors.push(target);
      ids.add(target.id);
      if (key) byName.set(key, target);
      changed = true;
    } else {
      const legacyPaymentForms = legacy.paymentForms?.length
        ? legacy.paymentForms
        : [legacy.type].filter(Boolean);
      const mergedPaymentForms = [...new Set([...(target.paymentForms || []), ...legacyPaymentForms])];
      if (mergedPaymentForms.length !== (target.paymentForms || []).length) {
        target.paymentForms = mergedPaymentForms;
        changed = true;
      }
      if (!target.logoUrl && legacy.logoUrl) {
        target.logoUrl = legacy.logoUrl;
        changed = true;
      }
      if (!target.notes && legacy.notes) {
        target.notes = legacy.notes;
        changed = true;
      }
    }

    if (legacy.id) idMap.set(legacy.id, target.id);
  });

  return { creditors, idMap, changed };
}
