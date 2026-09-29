/**
 * Consolida, somente para apresentacao, as partes de uma mesma fatura de
 * cartao. Os objetos de origem continuam referenciados em sourceRows e os
 * lancamentos filhos continuam inalterados em children.
 */
export function cardInvoiceDueDate(row, month) {
  return row?.dueDates?.[month]
    || (row?.children?.[month] || []).map((item) => item.dueDate).filter(Boolean).sort()[0]
    || "";
}

function isAutomaticCardInvoicePart(row) {
  return row?.kind === "expense"
    && Boolean(row.cardId)
    && /^auto-(installments|fixed)-/.test(String(row.id || ""));
}

function invoiceKey(row, month) {
  const dueDate = cardInvoiceDueDate(row, month);
  return dueDate ? `${row.cardId}|${dueDate}` : "";
}

/**
 * Agrupa custos fixos e parcelamentos quando sao cobrados no mesmo cartao e
 * na mesma data. Nao grava nem altera os registros brutos.
 */
export function consolidateCardInvoices(rows, month) {
  const groups = new Map();
  const untouched = [];

  (rows || []).forEach((row) => {
    const key = isAutomaticCardInvoicePart(row) ? invoiceKey(row, month) : "";
    if (!key) {
      untouched.push(row);
      return;
    }
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  });

  const consolidated = [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const first = group[0];
    const dueDate = cardInvoiceDueDate(first, month);
    const sourceRows = group.map((row) => ({
      id: row.id,
      value: Number(row.values?.[month] || 0),
      children: row.children?.[month] || []
    }));

    return {
      ...first,
      // Chave deterministica para pagamentos futuros sem tocar nas partes brutas.
      id: `auto-card-invoice|${encodeURIComponent(first.cardId)}|${dueDate}`,
      values: {
        ...first.values,
        [month]: sourceRows.reduce((total, row) => total + row.value, 0)
      },
      dueDates: { ...first.dueDates, [month]: dueDate },
      children: {
        ...first.children,
        [month]: sourceRows.flatMap((row) => row.children)
      },
      sourceRows: { [month]: sourceRows }
    };
  });

  return [...untouched, ...consolidated];
}
