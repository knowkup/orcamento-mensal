function _nextMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function createDefaultData() {
  const months = _nextMonths(12);

  return {
    schemaVersion: 3,
    initialBalance: 0,
    accountBalance: 0,
    kahLimit: 0,
    paymentMethods: ["PIX", "Débito em conta", "Cartão de crédito", "Boleto"],
    creditors: [],
    creditCards: [],
    incomeLines: [],
    vacations: [],
    recurringIncomes: [],
    projectionLines: [],
    installments: [],
    fixedCosts: [],
    plannedPurchases: [],
    paidOccurrences: [],
    receivedOccurrences: [],
    paidAmounts: {},
    paidDates: {},
    receivedAmounts: {},
    appliedCashMovements: {},
    fixedCostAmountOverrides: {},
    car: {
      name: "Carro",
      creditorId: "",
      financed: 0,
      purchase: 0,
      monthly: 0,
      totalInstallments: 0,
      payments: []
    },
    fgts: {
      balance: 0,
      blocked: 0,
      available: 0,
      contracts: []
    },
    taxes: {
      inss: [
        { upTo: 1621.00, rate: 7.5 },
        { upTo: 2902.84, rate: 9 },
        { upTo: 4354.27, rate: 12 },
        { upTo: 8475.55, rate: 14 }
      ],
      irrf: {
        exemptionLimit: 5000,
        partialLimit: 7350,
        brackets: [
          { upTo: 2428.80, rate: 0, deduction: 0 },
          { upTo: 2826.65, rate: 7.5, deduction: 182.16 },
          { upTo: 3751.05, rate: 15, deduction: 394.16 },
          { upTo: 4664.68, rate: 22.5, deduction: 675.49 },
          { upTo: null, rate: 27.5, deduction: 908.73 }
        ]
      }
    }
  };
}

export function getCreditorNameFromList(id, creditors) {
  return creditors.find((creditor) => creditor.id === id)?.name || id || "Credor";
}

export function buildCardsFromInstallments(installments, creditors, creditorByName) {
  const cards = new Map();
  installments.forEach((item) => {
    const creditorId = item.creditorId || creditorByName.get(item.origin) || item.origin || "";
    if (!creditorId) return;
    const owner = item.owner || "Felipe";
    const paymentMethod = item.paymentMethod || "Cartão de crédito";
    const key = `${creditorId}|${owner}|${paymentMethod}`;
    if (cards.has(key)) return;
    cards.set(key, {
      id: `card-${key.replaceAll("|", "-").replaceAll(/\s+/g, "-")}`,
      name: `${getCreditorNameFromList(creditorId, creditors)} ${owner}`.trim(),
      creditorId,
      owner,
      paymentMethod,
      dueDay: 1
    });
  });
  return [...cards.values()];
}

export function normalizedIncomeChanges(income) {
  const changes = income.changes?.length
    ? income.changes
    : [{ month: income.startMonth || _nextMonths(1)[0], amount: Number(income.amount || 0) }];
  return changes
    .map((change) => ({ month: change.month, amount: Number(change.amount || 0) }))
    .filter((change) => change.month)
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function migrateCashMovements(data) {
  const movements = {};
  (data.receivedOccurrences || []).forEach((key) => {
    const amount = Number(data.receivedAmounts?.[key] || 0);
    if (amount) movements[key] = amount;
  });
  (data.paidOccurrences || []).forEach((key) => {
    if (key.startsWith("child-car|")) return;
    const amount = Number(data.paidAmounts?.[key] || 0);
    if (amount) movements[key] = -amount;
  });
  const delta = Object.values(movements).reduce((total, value) => total + Number(value || 0), 0);
  data.accountBalance = Number(data.accountBalance || data.initialBalance || 0) + delta;
  data.appliedCashMovements = movements;
}

export function normalizeData(data) {
  const defaults = createDefaultData();
  if (!data || Number(data.schemaVersion || 0) < 3) return defaults;
  const creditors = (data.creditors || defaults.creditors).map((creditor) => ({
    ...creditor,
    paymentForms: creditor.paymentForms || [creditor.type].filter(Boolean)
  }));
  const creditorByName = new Map(creditors.map((creditor) => [creditor.name, creditor.id]));
  const rawInstallments = data.installments || [];
  const creditCards = (data.creditCards?.length ? data.creditCards : buildCardsFromInstallments(rawInstallments, creditors, creditorByName))
    .map((card) => ({
      ...card,
      name: card.name || getCreditorNameFromList(card.creditorId, creditors),
      creditorId: card.creditorId || creditorByName.get(card.creditor) || card.creditor || "",
      owner: card.owner || "Felipe",
      dueDay: Number(card.dueDay || 1)
    }));
  const cardByLegacyKey = new Map(creditCards.map((card) => [`${card.creditorId}|${card.owner || "Felipe"}|${card.paymentMethod || "Cartão de crédito"}`, card.id]));
  const normalized = {
    ...defaults,
    ...data,
    creditors,
    creditCards,
    paymentMethods: data.paymentMethods?.length ? data.paymentMethods : defaults.paymentMethods,
    incomeLines: data.incomeLines || defaults.incomeLines,
    vacations: data.vacations || defaults.vacations,
    recurringIncomes: (data.recurringIncomes || defaults.recurringIncomes).map((income) => {
      const isClt = income.isClt || false;
      return {
        ...income,
        owner: income.owner || "Felipe",
        logoUrl: income.logoUrl || "",
        receiveDay: Number(income.receiveDay || 1),
        changes: normalizedIncomeChanges(income),
        isClt,
        clt: isClt ? { consignado: Number(income.clt?.consignado || 0), alimentacao: Number(income.clt?.alimentacao ?? 1) } : null
      };
    }),
    projectionLines: (data.projectionLines || defaults.projectionLines).map((line) => ({
      ...line,
      match: creditorByName.get(line.match) || line.match,
      creditorId: line.creditorId || creditorByName.get(line.origin) || null
    })),
    installments: rawInstallments.map((item) => {
      const creditorId = item.creditorId || creditorByName.get(item.origin) || item.origin;
      const owner = item.owner || "Felipe";
      const paymentMethod = item.paymentMethod || "Cartão de crédito";
      return { ...item, item: item.item || item.name || item.description || "Parcelamento", creditorId, owner, paymentMethod, cardId: item.cardId || cardByLegacyKey.get(`${creditorId}|${owner}|${paymentMethod}`) || "" };
    }),
    fixedCosts: (data.fixedCosts || []).map((item) => {
      const card = creditCards.find((entry) => entry.id === item.cardId);
      return { ...item, cardId: item.cardId || "", creditorId: card?.creditorId || item.creditorId || creditorByName.get(item.payment) || item.payment, owner: card?.owner || item.owner || "Felipe", paymentMethod: item.paymentMethod || item.payment || "Cartão de crédito" };
    }),
    plannedPurchases: (data.plannedPurchases || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin, date: item.date || (item.month ? `${item.month}-01` : ""), installments: item.installments || 1 })),
    paidOccurrences: data.paidOccurrences || [],
    receivedOccurrences: data.receivedOccurrences || [],
    paidAmounts: data.paidAmounts || {},
    paidDates: data.paidDates || {},
    receivedAmounts: data.receivedAmounts || {},
    appliedCashMovements: data.appliedCashMovements || {},
    fixedCostAmountOverrides: data.fixedCostAmountOverrides || {},
    car: { ...defaults.car, ...(data.car || {}) },
    fgts: { ...defaults.fgts, ...(data.fgts || {}), contracts: ((data.fgts?.contracts) || defaults.fgts.contracts).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.contract) || creditors[0]?.id })) },
    taxes: {
      inss: data.taxes?.inss?.length ? data.taxes.inss : defaults.taxes.inss,
      irrf: {
        exemptionLimit: Number(data.taxes?.irrf?.exemptionLimit ?? defaults.taxes.irrf.exemptionLimit),
        partialLimit: Number(data.taxes?.irrf?.partialLimit ?? defaults.taxes.irrf.partialLimit),
        brackets: data.taxes?.irrf?.brackets?.length ? data.taxes.irrf.brackets : defaults.taxes.irrf.brackets
      }
    }
  };
  if (!normalized.fgts.contracts.length) {
    normalized.fgts.balance = 0;
    normalized.fgts.blocked = 0;
    normalized.fgts.available = 0;
  }
  normalized.car.payments = (normalized.car.payments || []).map((payment) => ({
    ...payment,
    dueDate: payment.dueDate || (payment.month ? `${payment.month}-01` : "")
  }));
  normalized.car.firstDueDate = normalized.car.firstDueDate || normalized.car.payments[0]?.dueDate || "";
  if (!data.appliedCashMovements) migrateCashMovements(normalized);
  return normalized;
}
