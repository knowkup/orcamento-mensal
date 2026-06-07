import { state, STORAGE_KEY } from "./state.js";
import { normalizeData, createDefaultData } from "./data.js";
import { dateTimeKey, showToast } from "./utils.js";
import { createBackupEnvelope, readBackupPayload, summarizeBackup } from "./domain/backup.js";

export function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeData(JSON.parse(saved)) : createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function persistLocalState(write = true) {
  if (write) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

export function exportState() {
  const backup = createBackupEnvelope(state.data);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `orcamento-mensal-${dateTimeKey()}.json`;
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`Backup exportado: ${filename}`, "success");
}

export function importState(event) {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return;
  const filename = file.name || "backup.json";
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = readBackupPayload(JSON.parse(String(reader.result)));
      const summary = summarizeBackup(payload);
      const confirmed = window.confirm(
        `Importar ${filename} e substituir os dados atuais?\n\n`
        + `${summary.creditors} credores, ${summary.incomes} entradas, `
        + `${summary.installments} parcelamentos, ${summary.fixedCosts} custos fixos e `
        + `${summary.plannedPurchases} lancamentos planejados.`
      );
      if (!confirmed) return;
      state.data = normalizeData(payload);
      if (state.saveStateFn) {
        await state.saveStateFn(`Backup importado: ${filename}`);
      } else {
        persistLocalState();
        if (state.hydrateFn) state.hydrateFn();
        if (state.renderFn) state.renderFn();
        showToast(`Backup importado: ${filename}`, "success");
      }
    } catch (error) {
      console.error(error);
      showToast(error?.message || `Arquivo invalido: ${filename}`, "error");
    } finally {
      input.value = "";
    }
  };
  reader.onerror = () => {
    showToast(`Nao foi possivel ler: ${filename}`, "error");
    input.value = "";
  };
  reader.readAsText(file);
}
