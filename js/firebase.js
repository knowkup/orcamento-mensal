import { state } from "./state.js";
import { createDefaultData, normalizeData } from "./data.js";
import { persistLocalState } from "./storage.js";
import { updateSync, showToast, formatTime } from "./utils.js";
import { createAsyncQueue } from "./domain/async-queue.js";
import { nextRevision, shouldApplyCloudSnapshot } from "./domain/sync.js";

const enqueueCloudSave = createAsyncQueue();

function isDividasViewActive() {
  return typeof document !== 'undefined' &&
    document.querySelector('.view.active')?.id?.startsWith('div') === true;
}

export async function setupFirebase(firebaseConfig, isFirebaseConfigured) {
  if (!isFirebaseConfigured) {
    updateSync("Modo local", "Firebase nao configurado.", "offline");
    return;
  }

  try {
    updateSync("Conectando", "Preparando sincronizacao.", "syncing");
    const [{ initializeApp }, firestoreSdk, { getAuth, signInAnonymously }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js")
    ]);

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    await signInAnonymously(auth);

    state.db = firestoreSdk.getFirestore(app);
    state.firestore = firestoreSdk;
    state.firebaseReady = true;

    await listenCloudState();
    if (state.loadDividasFn) {
      try {
        await state.loadDividasFn();
      } catch (error) {
        console.error(error);
      }
    }
  } catch (error) {
    console.error(error);
    updateSync("Firebase indisponivel", "Dados locais preservados.", "error");
  }
}

export function listenCloudState() {
  const { doc, onSnapshot, setDoc } = state.firestore;
  const ref = doc(state.db, "app", "state");
  return new Promise((resolve) => {
    let initialSnapshotHandled = false;
    const finishInitialLoad = () => {
      if (initialSnapshotHandled) return;
      initialSnapshotHandled = true;
      resolve();
    };

    state.unsubscribe = onSnapshot(ref, async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          await setDoc(ref, withMeta(state.data));
          return;
        }
        const raw = snapshot.data();
        const cloudRevision = Number(raw.updatedAt || 0);
        if (!shouldApplyCloudSnapshot(cloudRevision, state.pendingCloudRevision)) {
          updateSync("Salvando", "Aguardando a versao local mais recente.", "syncing");
          return;
        }
        if (Number(raw.schemaVersion || 0) < 3) {
          state.data = createDefaultData();
          await setDoc(ref, withMeta(state.data));
          persistLocalState(false);
          updateSync("Sincronizado", `Dados antigos zerados as ${formatTime()}.`, "online");
        } else {
          state.data = normalizeData(raw);
          state.lastLocalRevision = Math.max(state.lastLocalRevision, cloudRevision);
          persistLocalState(false);
          updateSync("Sincronizado", `Dados na nuvem as ${formatTime()}.`, "online");
        }
        if (state.hydrateFn) state.hydrateFn();
        if (state.renderFn) state.renderFn();
        if (state.renderDividasFn && isDividasViewActive()) state.renderDividasFn();
      } finally {
        finishInitialLoad();
      }
    }, (error) => {
      console.error(error);
      updateSync("Sem conexao", "Usando copia local.", "offline");
      finishInitialLoad();
    });
  });
}

export async function saveState(message) {
  const revision = nextRevision(state.lastLocalRevision);
  state.lastLocalRevision = revision;
  const snapshot = structuredClone(state.data);
  persistLocalState();
  let cloudFailed = false;
  if (state.db) {
    state.pendingCloudRevision = Math.max(state.pendingCloudRevision, revision);
    try {
      await enqueueCloudSave(async () => {
        state.saving = true;
        updateSync("Salvando", "Enviando para a nuvem.", "syncing");
        try {
          const { doc, setDoc } = state.firestore;
          await setDoc(doc(state.db, "app", "state"), withMeta(snapshot, revision));
          if (state.pendingCloudRevision === revision) state.pendingCloudRevision = 0;
          updateSync("Sincronizado", `Dados na nuvem as ${formatTime()}.`, "online");
        } finally {
          state.saving = false;
        }
      });
    } catch (error) {
      console.error(error);
      cloudFailed = true;
      if (state.pendingCloudRevision === revision) state.pendingCloudRevision = 0;
      updateSync("Pendente", "Salvo localmente; nuvem falhou.", "error");
      showToast("Salvo localmente. Falha ao sincronizar.", "error");
    }
  } else if (!state.db) {
    updateSync("Modo local", `Salvo neste dispositivo as ${formatTime()}.`, "offline");
  }
  if (state.hydrateFn) state.hydrateFn();
  if (state.renderFn) state.renderFn();
  if (state.renderDividasFn && isDividasViewActive()) state.renderDividasFn();
  if (message && !cloudFailed) showToast(message, "success");
}

export function withMeta(data, updatedAt = Date.now()) {
  return {
    ...structuredClone(data),
    schemaVersion: 3,
    updatedAt
  };
}
