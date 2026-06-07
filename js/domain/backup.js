const ARRAY_FIELDS = [
  "creditors",
  "creditCards",
  "incomeLines",
  "recurringIncomes",
  "projectionLines",
  "installments",
  "fixedCosts",
  "plannedPurchases"
];

export function createBackupEnvelope(data, exportedAt = new Date().toISOString()) {
  return {
    backupFormat: "orcamento-mensal",
    backupVersion: 1,
    exportedAt,
    data
  };
}

export function readBackupPayload(payload) {
  const data = payload?.backupFormat === "orcamento-mensal" ? payload.data : payload;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("O arquivo nao contem um backup valido.");
  }
  if (Number(data.schemaVersion || 0) < 3) {
    throw new Error("O backup usa uma versao antiga ou desconhecida.");
  }
  const invalidField = ARRAY_FIELDS.find((field) => data[field] != null && !Array.isArray(data[field]));
  if (invalidField) {
    throw new Error(`O campo ${invalidField} esta corrompido.`);
  }
  return data;
}

export function summarizeBackup(data) {
  return {
    creditors: (data.creditors || []).length,
    incomes: (data.incomeLines || []).length + (data.recurringIncomes || []).length,
    installments: (data.installments || []).length,
    fixedCosts: (data.fixedCosts || []).length,
    plannedPurchases: (data.plannedPurchases || []).length
  };
}
