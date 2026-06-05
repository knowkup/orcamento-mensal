import { state } from "./state.js";
import { createDefaultData, normalizeData } from "./data.js";
import { persistLocalState } from "./storage.js";
import { updateSync, showToast, formatTime } from "./utils.js";

export async function setupFirebase(firebaseConfig, isFirebaseConfigured) {
  if (!isFirebaseConfigured) {
    updateSync("Modo local", "Firebase nao configurado.", "offline");
    return;
  }

  try {
    updateSync("Conectando", "Preparando sincronizacao.", "syncing");
    const [{ initializeApp }, firestoreSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(firebaseConfig);
    state.db = firestoreSdk.getFirestore(app);
    state.firestore = firestoreSdk;
    state.firebaseReady = true;

    listenCloudState();
    if (state.loadDividasFn) state.loadDividasFn().catch(console.error);
  } catch (error) {
    console.error(error);
    updateSync("Firebase indisponivel", "Dados locais preservados.", "error");
  }
}

export function listenCloudState() {
  const { doc, onSnapshot, setDoc } = state.firestore;
  const ref = doc(state.db, "app", "state");
  state.unsubscribe = onSnapshot(ref, async (snapshot) => {
    if (!snapshot.exists()) {
      await setDoc(ref, withMeta(state.data));
      return;
    }
    const raw = snapshot.data();
    if (Number(raw.schemaVersion || 0) < 3) {
      state.data = createDefaultData();
      await setDoc(ref, withMeta(state.data));
      persistLocalState(false);
      updateSync("Sincronizado", `Dados antigos zerados as ${formatTime()}.`, "online");
      if (state.hydrateFn) state.hydrateFn();
      if (state.renderFn) state.renderFn();
      return;
    }
    state.data = normalizeData(raw);
    persistLocalState(false);
    updateSync("Sincronizado", `Dados na nuvem as ${formatTime()}.`, "online");
    if (state.hydrateFn) state.hydrateFn();
    if (state.renderFn) state.renderFn();
  }, (error) => {
    console.error(error);
    updateSync("Sem conexao", "Usando copia local.", "offline");
  });
}

export async function saveState(message) {
  persistLocalState();
  let cloudFailed = false;
  if (state.db && !state.saving) {
    state.saving = true;
    try {
      updateSync("Salvando", "Enviando para a nuvem.", "syncing");
      const { doc, setDoc } = state.firestore;
      await setDoc(doc(state.db, "app", "state"), withMeta(state.data));
      updateSync("Sincronizado", `Dados na nuvem as ${formatTime()}.`, "online");
    } catch (error) {
      console.error(error);
      cloudFailed = true;
      updateSync("Pendente", "Salvo localmente; nuvem falhou.", "error");
      showToast("Salvo localmente. Falha ao sincronizar.");
    } finally {
      state.saving = false;
    }
  } else if (!state.db) {
    updateSync("Modo local", `Salvo neste dispositivo as ${formatTime()}.`, "offline");
  }
  if (state.hydrateFn) state.hydrateFn();
  if (state.renderFn) state.renderFn();
  if (message && !cloudFailed) showToast(message);
}

export function withMeta(data) {
  return {
    ...structuredClone(data),
    schemaVersion: 3,
    updatedAt: Date.now()
  };
}
