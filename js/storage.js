import { state, STORAGE_KEY } from "./state.js";
import { normalizeData, createDefaultData } from "./data.js";
import { todayKey, showToast } from "./utils.js";

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
  link.href = url;
  link.download = `orcamento-mensal-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exportado.");
}

export function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      state.data = normalizeData(JSON.parse(String(reader.result)));
      if (state.saveStateFn) {
        await state.saveStateFn("Backup importado.");
      } else {
        persistLocalState();
        if (state.hydrateFn) state.hydrateFn();
        if (state.renderFn) state.renderFn();
        showToast("Backup importado.");
      }
    } catch {
      showToast("Arquivo inválido.");
    }
  };
  reader.readAsText(file);
}
