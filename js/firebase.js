import { state } from "./state.js";
import { createDefaultData, normalizeData } from "./data.js";
import { persistLocalState } from "./storage.js";
import { updateSync, showToast } from "./utils.js";

export async function setupFirebase(firebaseConfig, isFirebaseConfigured) {
  if (!isFirebaseConfigured) {
    updateSync("Modo local", "Firebase não configurado.", false);
    return;
  }

  try {
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
    updateSync("Firebase indisponível", "Revise a configuração.", false);
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
      updateSync("Sincronizado", "Dados antigos zerados para cadastro real.", true);
      if (state.hydrateFn) state.hydrateFn();
      if (state.renderFn) state.renderFn();
      return;
    }
    state.data = normalizeData(raw);
    persistLocalState(false);
    updateSync("Sincronizado", "Dados na nuvem.", true);
    if (state.hydrateFn) state.hydrateFn();
    if (state.renderFn) state.renderFn();
  });
}

export async function saveState(message) {
  persistLocalState();
  if (state.db && !state.saving) {
    state.saving = true;
    try {
      const { doc, setDoc } = state.firestore;
      await setDoc(doc(state.db, "app", "state"), withMeta(state.data));
      updateSync("Sincronizado", "Dados na nuvem.", true);
    } finally {
      state.saving = false;
    }
  }
  if (state.hydrateFn) state.hydrateFn();
  if (state.renderFn) state.renderFn();
  if (message) showToast(message);
}

export function withMeta(data) {
  return {
    ...structuredClone(data),
    schemaVersion: 3,
    updatedAt: Date.now()
  };
}
