import { state, STORAGE_KEY } from "./state.js";
import { normalizeData, createDefaultData } from "./data.js";
import { dateTimeKey, showToast } from "./utils.js";

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
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
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
      state.data = normalizeData(JSON.parse(String(reader.result)));
      if (state.saveStateFn) {
        await state.saveStateFn(`Backup importado: ${filename}`);
      } else {
        persistLocalState();
        if (state.hydrateFn) state.hydrateFn();
        if (state.renderFn) state.renderFn();
        showToast(`Backup importado: ${filename}`, "success");
      }
    } catch {
      showToast(`Arquivo invalido: ${filename}`, "error");
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
