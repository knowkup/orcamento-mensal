import { state, el } from "./state.js";
import { createDefaultData, normalizeData } from "./data.js";
import { persistLocalState } from "./storage.js";
import { updateSync, showToast, icon, refreshIcons } from "./utils.js";

export async function setupFirebase(firebaseConfig, isFirebaseConfigured) {
  if (!isFirebaseConfigured) {
    updateSync("Modo local", "Firebase não configurado.", false);
    return;
  }

  try {
    const [{ initializeApp }, authSdk, firestoreSdk] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(firebaseConfig);
    state.auth = authSdk.getAuth(app);
    state.provider = new authSdk.GoogleAuthProvider();
    state.db = firestoreSdk.getFirestore(app);
    state.firestore = firestoreSdk;
    state.firebaseReady = true;

    authSdk.getRedirectResult(state.auth).then((result) => {
      if (result?.user) {
        state.user = result.user;
      }
    }).catch((error) => {
      console.error(error);
      if (error.code === "auth/unauthorized-domain") showToast("Autorize knowkup.github.io no Firebase Auth.");
    });

    authSdk.onAuthStateChanged(state.auth, (user) => {
      state.user = user;
      if (state.unsubscribe) state.unsubscribe();
      if (!user) {
        el.loginButton.innerHTML = icon("log-in") + "<span>Entrar</span>";
        updateSync("Firebase pronto", "Entre para sincronizar.", false);
        refreshIcons();
        return;
      }
      el.loginButton.innerHTML = icon("log-out") + "<span>Sair</span>";
      listenCloudState();
      if (state.loadDividasFn) state.loadDividasFn().catch(console.error);
      refreshIcons();
    });
  } catch (error) {
    console.error(error);
    updateSync("Firebase indisponível", "Revise a configuração.", false);
  }
}

export function listenCloudState() {
  const { doc, onSnapshot, setDoc } = state.firestore;
  const ref = doc(state.db, "users", state.user.uid, "app", "state");
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
    updateSync("Sincronizado", state.user.email || "Google conectado.", true);
    if (state.hydrateFn) state.hydrateFn();
    if (state.renderFn) state.renderFn();
  });
}

export async function handleLoginToggle() {
  if (!state.firebaseReady) {
    showToast("Firebase ainda não está pronto.");
    return;
  }
  if (state.user) {
    await state.auth.signOut();
    showToast("Você saiu.");
    return;
  }
  try {
    const { signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    await signInWithPopup(state.auth, state.provider);
  } catch (error) {
    console.error(error);
    const blockedCodes = ["auth/popup-blocked", "auth/popup-closed-by-user", "auth/unauthorized-domain"];
    if (blockedCodes.includes(error.code)) {
      showToast(error.code === "auth/unauthorized-domain" ? "Autorize o domínio no Firebase Auth." : "Abrindo login por redirecionamento.");
      const { signInWithRedirect } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
      await signInWithRedirect(state.auth, state.provider);
      return;
    }
    showToast("Não consegui abrir o login Google.");
  }
}

export async function saveState(message) {
  persistLocalState();
  if (state.user && state.db && !state.saving) {
    state.saving = true;
    try {
      const { doc, setDoc } = state.firestore;
      await setDoc(doc(state.db, "users", state.user.uid, "app", "state"), withMeta(state.data));
      updateSync("Sincronizado", state.user.email || "Google conectado.", true);
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
