const productionFirebaseConfig = {
  apiKey: "AIzaSyCZQB_K57L4PtKUNMraBCC8pORqHb3UTF8",
  authDomain: "orcamento-mensal-fdc1a.firebaseapp.com",
  projectId: "orcamento-mensal-fdc1a",
  storageBucket: "orcamento-mensal-fdc1a.firebasestorage.app",
  messagingSenderId: "570144455096",
  appId: "1:570144455096:web:3f2afa91c93f8b4a9fb74d",
  measurementId: "G-9NX1SZ3TBF"
};

const homologFirebaseConfig = {
  apiKey: "AIzaSyA7EubWW9nnlbfEckRD69tEpfbcWH_uXEY",
  authDomain: "orcamento-mensal-homolog.firebaseapp.com",
  projectId: "orcamento-mensal-homolog",
  storageBucket: "orcamento-mensal-homolog.firebasestorage.app",
  messagingSenderId: "434131302084",
  appId: "1:434131302084:web:f97a89f0a8d239e2963b91"
};

const hostname = globalThis.location?.hostname || "";
const pathname = globalThis.location?.pathname || "";
const homologHosts = new Set([
  "localhost",
  "127.0.0.1",
  "orcamento-mensal-homolog.web.app",
  "orcamento-mensal-homolog.firebaseapp.com"
]);
const githubHomologPath = "/orcamento-mensal/homolog";
const isGitHubHomolog = hostname === "knowkup.github.io"
  && (pathname === githubHomologPath || pathname.startsWith(`${githubHomologPath}/`));

export const firebaseEnvironment = homologHosts.has(hostname) || isGitHubHomolog
  ? "homolog"
  : "production";
export const firebaseConfig = firebaseEnvironment === "homolog"
  ? homologFirebaseConfig
  : productionFirebaseConfig;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);
