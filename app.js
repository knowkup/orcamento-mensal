import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "2-digit"
});

const state = {
  items: [],
  user: null,
  db: null,
  auth: null,
  unsubscribe: null,
  monthCount: 6,
  filter: "open",
  firebaseReady: false
};

const demoItems = [
  {
    id: "demo-income",
    name: "Renda mensal",
    type: "income",
    amount: 15101.14,
    startMonth: getMonthKey(new Date()),
    recurrence: "monthly",
    installments: 1,
    category: "Renda",
    paidOccurrences: []
  },
  {
    id: "demo-fixed",
    name: "Custos fixos",
    type: "fixed",
    amount: 10288.39,
    startMonth: getMonthKey(new Date()),
    recurrence: "monthly",
    installments: 1,
    category: "Base do mês",
    paidOccurrences: []
  },
  {
    id: "demo-card",
    name: "Parcelas em aberto",
    type: "installment",
    amount: 985.08,
    startMonth: getMonthKey(new Date()),
    recurrence: "monthly",
    installments: 6,
    category: "Cartões",
    paidOccurrences: []
  },
  {
    id: "demo-13",
    name: "13º salário",
    type: "income",
    amount: 7500,
    startMonth: `${new Date().getFullYear()}-11`,
    recurrence: "once",
    installments: 1,
    category: "Extra",
    paidOccurrences: []
  }
];

const elements = {
  views: document.querySelectorAll(".view"),
  navTabs: document.querySelectorAll(".nav-tab"),
  viewTitle: document.querySelector("#viewTitle"),
  incomeMetric: document.querySelector("#incomeMetric"),
  expenseMetric: document.querySelector("#expenseMetric"),
  balanceMetric: document.querySelector("#balanceMetric"),
  balanceMetricCard: document.querySelector("#balanceMetricCard"),
  alertMetric: document.querySelector("#alertMetric"),
  dashboardTimeline: document.querySelector("#dashboardTimeline"),
  projectionList: document.querySelector("#projectionList"),
  upcomingList: document.querySelector("#upcomingList"),
  itemsList: document.querySelector("#itemsList"),
  itemForm: document.querySelector("#itemForm"),
  toast: document.querySelector("#toast"),
  loginButton: document.querySelector("#loginButton"),
  syncTitle: document.querySelector("#syncTitle"),
  syncText: document.querySelector("#syncText"),
  syncDot: document.querySelector(".sync-dot"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  copyRulesButton: document.querySelector("#copyRulesButton")
};

boot();

async function boot() {
  state.items = loadLocalItems();
  setInitialMonth();
  bindEvents();
  await setupFirebase();
  render();
  refreshIcons();
}

function bindEvents() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener("click", () => showView(tab.dataset.view));
  });

  document.querySelectorAll("[data-view-link]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewLink));
  });

  document.querySelectorAll("[data-month-count]").forEach((button) => {
    button.addEventListener("click", () => {
      state.monthCount = Number(button.dataset.monthCount);
      document.querySelectorAll("[data-month-count]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderProjection();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderItems();
    });
  });

  elements.itemForm.addEventListener("submit", handleItemSubmit);
  elements.loginButton.addEventListener("click", handleLoginToggle);
  elements.exportButton.addEventListener("click", exportData);
  elements.importInput.addEventListener("change", importData);
  elements.copyRulesButton.addEventListener("click", copyRulesPath);
}

async function setupFirebase() {
  if (!isFirebaseConfigured) {
    updateSyncStatus("Modo demonstração", "Configure Firebase para sincronizar.", false);
    return;
  }

  try {
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, onAuthStateChanged }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js")
    ]);

    const app = initializeApp(firebaseConfig);
    state.auth = getAuth(app);
    state.provider = new GoogleAuthProvider();
    state.db = firestore.getFirestore(app);
    state.firestore = firestore;
    state.firebaseReady = true;

    onAuthStateChanged(state.auth, (user) => {
      state.user = user;
      if (state.unsubscribe) state.unsubscribe();
      if (user) {
        elements.loginButton.innerHTML = iconMarkup("log-out") + "<span>Sair</span>";
        listenToCloudItems();
      } else {
        elements.loginButton.innerHTML = iconMarkup("log-in") + "<span>Entrar</span>";
        updateSyncStatus("Firebase pronto", "Entre para sincronizar.", false);
        state.items = loadLocalItems();
        render();
      }
      refreshIcons();
    });
  } catch (error) {
    updateSyncStatus("Firebase indisponível", "Revise a configuração.", false);
    showToast("Não consegui iniciar o Firebase.");
    console.error(error);
  }
}

function listenToCloudItems() {
  const { collection, onSnapshot, query, orderBy } = state.firestore;
  const itemsRef = collection(state.db, "users", state.user.uid, "items");
  const itemsQuery = query(itemsRef, orderBy("createdAt", "asc"));

  state.unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
    state.items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    updateSyncStatus("Sincronizado", state.user.email || "Firebase conectado.", true);
    render();
  });
}

async function handleLoginToggle() {
  if (!state.firebaseReady) {
    showToast("Preencha firebase-config.js antes de entrar.");
    showView("settings");
    return;
  }

  if (state.user) {
    await state.auth.signOut();
    showToast("Você saiu.");
    return;
  }

  const { signInWithPopup } = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
  await signInWithPopup(state.auth, state.provider);
}

async function handleItemSubmit(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const item = {
    name: String(form.get("name")).trim(),
    type: String(form.get("type")),
    amount: Number(form.get("amount")),
    startMonth: String(form.get("startMonth")),
    recurrence: String(form.get("recurrence")),
    installments: Math.max(1, Number(form.get("installments") || 1)),
    category: String(form.get("category")).trim(),
    paidOccurrences: [],
    createdAt: Date.now()
  };

  if (!item.name || !item.amount || !item.startMonth) return;

  await saveItem(item);
  formElement.reset();
  setInitialMonth();
  showToast("Item adicionado.");
}

async function saveItem(item) {
  if (state.user && state.db) {
    const { addDoc, collection, serverTimestamp } = state.firestore;
    await addDoc(collection(state.db, "users", state.user.uid, "items"), {
      ...item,
      createdAt: serverTimestamp()
    });
    return;
  }

  state.items = [...state.items, { ...item, id: crypto.randomUUID() }];
  persistLocalItems();
  render();
}

async function updateItem(itemId, patch) {
  if (state.user && state.db) {
    const { doc, updateDoc } = state.firestore;
    await updateDoc(doc(state.db, "users", state.user.uid, "items", itemId), patch);
    return;
  }

  state.items = state.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
  persistLocalItems();
  render();
}

function showView(viewName) {
  elements.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  elements.views.forEach((view) => {
    const isActive = view.id === `${viewName}View`;
    view.classList.toggle("active", isActive);
    if (isActive) elements.viewTitle.textContent = view.dataset.title;
  });
  refreshIcons();
}

function render() {
  renderDashboard();
  renderProjection();
  renderItems();
  refreshIcons();
}

function renderDashboard() {
  const projection = buildProjection(6);
  const current = projection[0];
  const alertCount = projection.filter((month) => month.balance < 0).length;

  elements.incomeMetric.textContent = currency.format(current.income);
  elements.expenseMetric.textContent = currency.format(current.expense);
  elements.balanceMetric.textContent = currency.format(current.balance);
  elements.balanceMetricCard.classList.toggle("positive", current.balance >= 0);
  elements.balanceMetricCard.classList.toggle("negative", current.balance < 0);
  elements.alertMetric.textContent = String(alertCount);
  elements.dashboardTimeline.innerHTML = projection.map(renderMonthRow).join("");
  elements.upcomingList.innerHTML = renderUpcoming();
}

function renderProjection() {
  elements.projectionList.innerHTML = buildProjection(state.monthCount).map(renderMonthRow).join("");
}

function renderItems() {
  const occurrences = buildOccurrences(18).sort((a, b) => a.month.localeCompare(b.month));
  const filtered = occurrences.filter((occurrence) => {
    if (state.filter === "all") return true;
    if (state.filter === "paid") return occurrence.paid;
    return !occurrence.paid;
  });

  elements.itemsList.innerHTML = filtered.length
    ? filtered.map(renderItemRow).join("")
    : `<div class="empty-state">Nada para mostrar aqui.</div>`;

  elements.itemsList.querySelectorAll("[data-pay]").forEach((button) => {
    button.addEventListener("click", () => markPaid(button.dataset.pay, button.dataset.month));
  });

  elements.itemsList.querySelectorAll("[data-undo]").forEach((button) => {
    button.addEventListener("click", () => undoPaid(button.dataset.undo, button.dataset.month));
  });
}

function buildProjection(monthCount) {
  const months = getNextMonths(monthCount);
  const occurrences = buildOccurrences(monthCount);

  return months.map((month) => {
    const monthItems = occurrences.filter((item) => item.month === month && !item.paid);
    const income = sum(monthItems.filter((item) => item.type === "income"));
    const expense = sum(monthItems.filter((item) => item.type !== "income"));
    return {
      month,
      income,
      expense,
      balance: income - expense
    };
  });
}

function buildOccurrences(monthCount) {
  const months = getNextMonths(monthCount);
  const occurrences = [];

  state.items.forEach((item) => {
    months.forEach((month) => {
      if (!occursInMonth(item, month)) return;
      occurrences.push({
        ...item,
        month,
        occurrenceKey: `${item.id}:${month}`,
        paid: item.paidOccurrences?.includes(month)
      });
    });
  });

  return occurrences;
}

function occursInMonth(item, month) {
  if (month < item.startMonth) return false;
  const offset = monthDiff(item.startMonth, month);

  if (item.recurrence === "monthly" && item.type !== "installment") return true;
  if (item.type === "installment") return offset >= 0 && offset < Number(item.installments || 1);
  return offset === 0;
}

function renderMonthRow(month) {
  const max = Math.max(month.income, month.expense, 1);
  const incomeWidth = Math.min(100, (month.income / max) * 100);
  const expenseWidth = Math.min(100, (month.expense / max) * 100);
  const statusClass = month.balance >= 0 ? "positive" : "negative";

  return `
    <div class="month-row">
      <div>
        <div class="month-name">${formatMonth(month.month)}</div>
        <span class="${statusClass}">${month.balance >= 0 ? "Saudável" : "Alerta"}</span>
      </div>
      <div class="month-bars">
        <div class="bar bar-income"><span style="width: ${incomeWidth}%"></span></div>
        <div class="bar bar-expense"><span style="width: ${expenseWidth}%"></span></div>
      </div>
      <div class="month-balance ${statusClass}">${currency.format(month.balance)}</div>
    </div>
  `;
}

function renderUpcoming() {
  const upcoming = buildOccurrences(3)
    .filter((item) => item.type !== "income" && !item.paid)
    .slice(0, 5);

  if (!upcoming.length) return `<div class="empty-state">Sem pagamentos pendentes próximos.</div>`;

  return upcoming
    .map(
      (item) => `
        <div class="item-row">
          <div class="item-main">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatMonth(item.month)} · ${escapeHtml(item.category || "Sem grupo")}</span>
          </div>
          <strong class="negative">-${currency.format(item.amount)}</strong>
        </div>
      `
    )
    .join("");
}

function renderItemRow(item) {
  const isIncome = item.type === "income";
  const value = `${isIncome ? "" : "-"}${currency.format(item.amount)}`;
  const action = item.paid
    ? `<button class="small-button undo" type="button" data-undo="${item.id}" data-month="${item.month}">Desfazer</button>`
    : `<button class="small-button pay" type="button" data-pay="${item.id}" data-month="${item.month}">Pagar</button>`;

  return `
    <div class="item-row">
      <div class="item-main">
        <strong>${escapeHtml(item.name)}</strong>
        <span>${formatMonth(item.month)} · ${labelForType(item.type)} · ${escapeHtml(item.category || "Sem grupo")}</span>
      </div>
      <div class="item-actions">
        <strong class="${isIncome ? "positive" : "negative"}">${value}</strong>
        ${isIncome ? "" : action}
      </div>
    </div>
  `;
}

async function markPaid(itemId, month) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const paidOccurrences = Array.from(new Set([...(item.paidOccurrences || []), month]));
  await updateItem(itemId, { paidOccurrences });
  showToast("Pagamento marcado.");
}

async function undoPaid(itemId, month) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const paidOccurrences = (item.paidOccurrences || []).filter((entry) => entry !== month);
  await updateItem(itemId, { paidOccurrences });
  showToast("Pagamento reaberto.");
}

function exportData() {
  const blob = new Blob([JSON.stringify({ items: state.items }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `orcamento-mensal-${getMonthKey(new Date())}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("Backup exportado.");
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed.items)) throw new Error("Formato inválido");
      state.items = parsed.items;
      persistLocalItems();
      render();
      showToast("Backup importado neste navegador.");
    } catch {
      showToast("Não consegui importar esse arquivo.");
    }
  };
  reader.readAsText(file);
}

async function copyRulesPath() {
  await navigator.clipboard.writeText("firestore.rules");
  showToast("Caminho copiado.");
}

function loadLocalItems() {
  const saved = localStorage.getItem("orcamento-mensal-items");
  if (!saved) return demoItems;
  try {
    return JSON.parse(saved);
  } catch {
    return demoItems;
  }
}

function persistLocalItems() {
  localStorage.setItem("orcamento-mensal-items", JSON.stringify(state.items));
}

function setInitialMonth() {
  const input = elements.itemForm.elements.startMonth;
  if (input) input.value = getMonthKey(new Date());
}

function getNextMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return getMonthKey(date);
  });
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthFormatter.format(new Date(year, monthNumber - 1, 1)).replace(".", "");
}

function monthDiff(startMonth, endMonth) {
  const [startYear, start] = startMonth.split("-").map(Number);
  const [endYear, end] = endMonth.split("-").map(Number);
  return (endYear - startYear) * 12 + (end - start);
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function labelForType(type) {
  const labels = {
    income: "Entrada",
    fixed: "Custo fixo",
    installment: "Parcela",
    event: "Evento"
  };
  return labels[type] || "Item";
}

function updateSyncStatus(title, text, online) {
  elements.syncTitle.textContent = title;
  elements.syncText.textContent = text;
  elements.syncDot.classList.toggle("offline", !online);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2600);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function iconMarkup(name) {
  return `<i data-lucide="${name}"></i>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
