export const firebaseConfig = {
  apiKey: "AIzaSyCZQB_K57L4PtKUNMraBCC8pORqHb3UTF8",
  authDomain: "orcamento-mensal-fdc1a.firebaseapp.com",
  projectId: "orcamento-mensal-fdc1a",
  storageBucket: "orcamento-mensal-fdc1a.firebasestorage.app",
  messagingSenderId: "570144455096",
  appId: "1:570144455096:web:3f2afa91c93f8b4a9fb74d",
  measurementId: "G-9NX1SZ3TBF"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);
