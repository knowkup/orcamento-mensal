import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });

const STORAGE_KEY = "orcamento-mensal-state-v2";

const state = {
  data: createDefaultData(),
  user: null,
  db: null,
  auth: null,
  provider: null,
  firestore: null,
  unsubscribe: null,
  firebaseReady: false,
  saving: false,
  installmentFilter: "open",
  carFilter: "open",
  fgtsFilters: {},
  installmentFilters: {},
  expandedInstallments: {},
  installmentEditingId: null,
  creditorEditingId: null
};

const el = {
  views: document.querySelectorAll(".view"),
  navTabs: document.querySelectorAll(".nav-tab"),
  viewTitle: document.querySelector("#viewTitle"),
  syncTitle: document.querySelector("#syncTitle"),
  syncText: document.querySelector("#syncText"),
  syncDot: document.querySelector(".sync-dot"),
  loginButton: document.querySelector("#loginButton"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  monthSummary: document.querySelector("#monthSummary"),
  monthlySummary: document.querySelector("#monthlySummary"),
  planningChart: document.querySelector("#planningChart"),
  projectionTable: document.querySelector("#projectionTable"),
  projectionTopScroll: document.querySelector("#projectionTopScroll"),
  projectionScroll: document.querySelector(".projection-scroll"),
  monthlyBoard: document.querySelector("#monthlyBoard"),
  installmentForm: document.querySelector("#installmentForm"),
  installmentDialog: document.querySelector("#installmentDialog"),
  installmentDialogTitle: document.querySelector("#installmentDialogTitle"),
  newInstallmentButton: document.querySelector("#newInstallmentButton"),
  closeInstallmentButton: document.querySelector("#closeInstallmentButton"),
  installmentsTable: document.querySelector("#installmentsTable"),
  fixedCostForm: document.querySelector("#fixedCostForm"),
  fixedCostsTable: document.querySelector("#fixedCostsTable"),
  settingsForm: document.querySelector("#settingsForm"),
  carForm: document.querySelector("#carForm"),
  carTitle: document.querySelector("#carTitle"),
  carKpis: document.querySelector("#carKpis"),
  carTable: document.querySelector("#carTable"),
  carPaymentDialog: document.querySelector("#carPaymentDialog"),
  carPaymentForm: document.querySelector("#carPaymentForm"),
  carPaymentTitle: document.querySelector("#carPaymentTitle"),
  closeCarPaymentButton: document.querySelector("#closeCarPaymentButton"),
  fgtsForm: document.querySelector("#fgtsForm"),
  fgtsKpis: document.querySelector("#fgtsKpis"),
  fgtsTable: document.querySelector("#fgtsTable"),
  creditorForm: document.querySelector("#creditorForm"),
  creditorList: document.querySelector("#creditorList"),
  creditorLogoPreview: document.querySelector("#creditorLogoPreview"),
  creditorDialog: document.querySelector("#creditorDialog"),
  creditorDialogTitle: document.querySelector("#creditorDialogTitle"),
  newCreditorButton: document.querySelector("#newCreditorButton"),
  closeCreditorButton: document.querySelector("#closeCreditorButton"),
  plannedDialog: document.querySelector("#plannedDialog"),
  plannedForm: document.querySelector("#plannedForm"),
  plannedCredorField: document.querySelector("#plannedCredorField"),
  plannedFonteField: document.querySelector("#plannedFonteField"),
  addPlanButton: document.querySelector("#addPlanButton"),
  closePlanButton: document.querySelector("#closePlanButton"),
  toast: document.querySelector("#toast")
};

boot();

async function boot() {
  state.data = loadLocalState();
  bindEvents();
  hydrateForms();
  render();
  await setupFirebase();
}

function bindEvents() {
  el.navTabs.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  el.loginButton.addEventListener("click", handleLoginToggle);
  el.exportButton.addEventListener("click", exportState);
  el.importInput.addEventListener("change", importState);
  el.installmentForm.addEventListener("submit", addInstallment);
  el.newInstallmentButton.addEventListener("click", openInstallmentDialog);
  el.closeInstallmentButton.addEventListener("click", closeInstallmentDialog);
  el.fixedCostForm.addEventListener("submit", addFixedCost);
  el.settingsForm.addEventListener("submit", updateSettings);
  el.carForm.addEventListener("submit", updateCar);
  el.carPaymentForm.addEventListener("submit", payCarInstallment);
  el.closeCarPaymentButton.addEventListener("click", () => el.carPaymentDialog.close());
  el.fgtsForm.addEventListener("submit", addFgtsContract);
  el.creditorForm.addEventListener("submit", addCreditor);
  el.creditorForm.elements.logoFile.addEventListener("change", handleCreditorLogoUpload);
  el.newCreditorButton.addEventListener("click", () => openCreditorDialog());
  el.closeCreditorButton.addEventListener("click", closeCreditorDialog);
  el.addPlanButton.addEventListener("click", openPlannedDialog);
  el.closePlanButton.addEventListener("click", () => el.plannedDialog.close());
  el.plannedForm.addEventListener("submit", addPlannedPurchase);
  el.plannedForm.elements.kind.addEventListener("change", updatePlannedFields);
  el.projectionTopScroll.addEventListener("scroll", () => {
    el.projectionScroll.scrollLeft = el.projectionTopScroll.scrollLeft;
  });
  el.projectionScroll.addEventListener("scroll", () => {
    el.projectionTopScroll.scrollLeft = el.projectionScroll.scrollLeft;
  });
}

async function setupFirebase() {
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

    authSdk.getRedirectResult(state.auth).catch((error) => {
      console.error(error);
      if (error.code === "auth/unauthorized-domain") showToast("Autorize kupka1988.github.io no Firebase Auth.");
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
      refreshIcons();
    });
  } catch (error) {
    console.error(error);
    updateSync("Firebase indisponível", "Revise a configuração.", false);
  }
}

function listenCloudState() {
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
      hydrateForms();
      render();
      return;
    }
    state.data = normalizeData(raw);
    persistLocalState(false);
    updateSync("Sincronizado", state.user.email || "Google conectado.", true);
    hydrateForms();
    render();
  });
}

async function handleLoginToggle() {
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

async function saveState(message) {
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
  hydrateForms();
  render();
  if (message) showToast(message);
}

function withMeta(data) {
  return {
    ...structuredClone(data),
    schemaVersion: 3,
    updatedAt: Date.now()
  };
}

function showView(name) {
  el.navTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === name));
  el.views.forEach((view) => {
    const active = view.id === `${name}View`;
    view.classList.toggle("active", active);
    if (active) el.viewTitle.textContent = view.dataset.title;
  });
  refreshIcons();
}

function render() {
  renderProjection();
  renderMonthlyControl();
  renderInstallments();
  renderFixedCosts();
  renderCar();
  renderFgts();
  renderOrigins();
  renderSettings();
  refreshIcons();
}

function renderProjection() {
  const months = nextMonths(12);
  const rows = buildProjectionRows(months);
  const totals = buildTotals(rows, months);
  const current = totals[0];

  el.monthSummary.innerHTML = [
    metric("Entradas", current.income, "positive"),
    metric("Saídas", -current.expense, "negative"),
    metric("Sobra do mês", current.balance, current.balance >= 0 ? "positive" : "negative"),
    metric("Saldo acumulado", current.accumulated, current.accumulated >= 0 ? "positive" : "negative")
  ].join("");
  renderPlanningChart(totals, months);

  const monthHeaders = months.map((month) => `<th>${formatMonth(month)}</th>`).join("");
  const body = [
    groupRow("Entradas", months.length),
    ...rows.filter((row) => row.kind === "income").map((row) => projectionRow(row, months)),
    totalRow("Total entradas", months, (month) => totals.find((item) => item.month === month).income, "positive"),
    groupRow("Saídas", months.length),
    ...rows.filter((row) => row.kind === "expense").map((row) => projectionRow(row, months)),
    totalRow("Total saídas", months, (month) => -totals.find((item) => item.month === month).expense, "negative"),
    totalRow("Sobra do mês", months, (month) => totals.find((item) => item.month === month).balance, "balance"),
    totalRow("Saldo acumulado", months, (month) => totals.find((item) => item.month === month).accumulated, "balance")
  ].join("");

  el.projectionTable.innerHTML = `
    <thead>
      <tr>
        <th class="sticky-col">Linha</th>
        <th>Origem</th>
        ${monthHeaders}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  `;
  requestAnimationFrame(syncProjectionTopScroll);
}

function renderSettings() {
  el.settingsForm.elements.accountBalance.value = state.data.accountBalance || "";
  el.settingsForm.elements.kahLimit.value = state.data.kahLimit || "";
}

function renderOccurrencesLegacy() {
  const month = nextMonths(1)[0];
  const rows = buildProjectionRows([month]).filter((row) => row.kind === "expense");
  const occurrences = rows
    .map((row) => ({ row, value: row.values[month] || 0 }))
    .filter((item) => item.value > 0);

  el.occurrenceList.innerHTML = occurrences.length
    ? occurrences.map(({ row, value }) => `
        <div class="occurrence-card">
          <div>
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.origin || "-")} · ${row.sourceLabel}</span>
          </div>
          <div class="occurrence-actions">
            <strong class="negative">-${currency.format(value)}</strong>
            <button class="small-button pay" type="button" data-pay-occurrence="${row.id}:${month}">Pagar</button>
          </div>
        </div>
      `).join("")
    : `<div class="empty-state">Sem ocorrências pendentes neste mês.</div>`;

  el.occurrenceList.querySelectorAll("[data-pay-occurrence]").forEach((button) => {
    button.addEventListener("click", () => togglePaidOccurrence(button.dataset.payOccurrence));
  });
}

function renderMonthlyControl() {
  const month = nextMonths(1)[0];
  const rows = buildProjectionRows([month], true);
  const entries = rows
    .filter((row) => row.kind === "income")
    .map((row) => ({ row, value: row.values[month] || 0 }))
    .filter((item) => item.value > 0);
  const exits = rows
    .filter((row) => row.kind === "expense")
    .map((row) => ({ row, value: row.values[month] || 0 }))
    .filter((item) => item.value > 0 || isOccurrencePaid(`${item.row.id}:${month}`));
  const received = entries.reduce((total, item) => total + (isIncomeReceived(`${item.row.id}:${month}`) ? item.value : 0), 0);
  const paid = exits.reduce((total, item) => total + (isOccurrencePaid(`${item.row.id}:${month}`) ? item.value : 0), 0);
  const expectedIncome = entries.reduce((total, item) => total + item.value, 0);
  const expectedExpense = exits.reduce((total, item) => total + item.value, 0);

  el.monthlySummary.innerHTML = [
    metric("Previsto entrar", expectedIncome, "positive"),
    metric("Já recebido", received, "positive"),
    metric("Previsto sair", -expectedExpense, "negative"),
    metric("Já pago", -paid, "negative")
  ].join("");

  el.monthlyBoard.innerHTML = `
    <section class="monthly-column income-column">
      <div class="monthly-column-head">
        <span>Entradas previstas</span>
        <strong>${currency.format(expectedIncome)}</strong>
      </div>
      ${monthlyItems(entries, month, "income")}
    </section>
    <section class="monthly-column expense-column">
      <div class="monthly-column-head">
        <span>Saídas previstas</span>
        <strong>-${currency.format(expectedExpense)}</strong>
      </div>
      ${monthlyItems(exits, month, "expense")}
    </section>
  `;

  el.monthlyBoard.querySelectorAll("[data-toggle-income]").forEach((button) => {
    button.addEventListener("click", () => toggleReceivedOccurrence(button.dataset.toggleIncome));
  });
  el.monthlyBoard.querySelectorAll("[data-pay-occurrence]").forEach((button) => {
    button.addEventListener("click", () => togglePaidOccurrence(button.dataset.payOccurrence));
  });
}

function monthlyItems(items, month, kind) {
  if (!items.length) return `<div class="empty-state compact">Nada previsto para este mês.</div>`;
  return items.map(({ row, value }) => {
    const key = `${row.id}:${month}`;
    const done = kind === "income" ? isIncomeReceived(key) : isOccurrencePaid(key);
    const attr = kind === "income" ? `data-toggle-income="${key}"` : `data-pay-occurrence="${key}"`;
    const buttonLabel = kind === "income" ? (done ? "Recebido" : "Receber") : (done ? "Pago" : "Pagar");
    return `
      <article class="monthly-item ${done ? "done" : ""}">
        <div>
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.origin || "-")}</span>
        </div>
        <div class="monthly-item-action">
          <strong class="${kind === "income" ? "positive" : "negative"}">${kind === "income" ? "" : "-"}${currency.format(value)}</strong>
          <button class="small-button ${kind === "expense" ? "pay" : ""}" type="button" ${attr}>${buttonLabel}</button>
        </div>
      </article>
    `;
  }).join("");
}

function buildProjectionRows(months, keepPaidValues = false) {
  const rows = [];
  if (Number(state.data.accountBalance || 0)) {
    rows.push({
      id: "account-balance",
      kind: "income",
      owner: "Felipe",
      label: "Saldo em Conta",
      origin: "manual",
      sourceLabel: "",
      values: { [months[0]]: Number(state.data.accountBalance || 0) }
    });
  }
  state.data.incomeLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "income",
      owner: line.owner || "Felipe",
      label: line.label,
      origin: line.origin,
      sourceLabel: "",
      values: valuesFromMonthlyMap(line.values, months)
    });
  });

  state.data.projectionLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "expense",
      owner: line.owner || "Felipe",
      label: line.label,
      origin: line.creditorId ? getCreditorName(line.creditorId) : line.origin,
      sourceLabel: "",
      values: valuesForProjectionLine(line, months, keepPaidValues)
    });
  });

  appendDynamicProjectionRows(rows, months, keepPaidValues);
  appendKahDifferenceRow(rows, months);
  return rows.sort((a, b) => ownerRank(a.owner) - ownerRank(b.owner));
}

function valuesForProjectionLine(line, months, keepPaidValues = false) {
  const values = {};
  months.forEach((month, index) => {
    let value = 0;
    if (line.source === "installments") value = installmentTotal(line.match, index);
    if (line.source === "fixedByName") value = fixedTotalByName(line.match);
    if (line.source === "fixedByOrigin") value = fixedTotalByOrigin(line.match);
    if (line.source === "planned") value = plannedTotal(line.match, month);
    if (line.source === "manual") value = line.values?.[month] ?? line.monthlyAmount ?? 0;
    if (line.source === "car") value = carValueForMonth(month);
    if (line.source === "difference") value = differenceValue(line, months, month, index);
    if (!keepPaidValues && isOccurrencePaid(`${line.id}:${month}`)) value = 0;
    values[month] = value;
  });
  return values;
}

function valuesFromMonthlyMap(map, months) {
  const values = {};
  months.forEach((month) => {
    const monthNumber = Number(month.slice(5, 7));
    values[month] = map?.[month] ?? map?.[`month-${monthNumber}`] ?? map?.default ?? 0;
  });
  return values;
}

function appendDynamicProjectionRows(rows, months, keepPaidValues) {
  const installmentGroups = uniqueGroups(state.data.installments, (item) => groupKey(item));
  installmentGroups.forEach((group) => {
    const installmentValues = {};
    months.forEach((month, index) => {
      installmentValues[month] = installmentTotalForGroup(group, index);
      const key = `auto-installments-${group.id}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) installmentValues[month] = 0;
    });
    if (Object.values(installmentValues).some(Boolean)) {
      rows.push({ id: `auto-installments-${group.id}`, kind: "expense", owner: group.owner, label: `Parcelamentos (${group.paymentMethod})`, origin: getCreditorName(group.creditorId), sourceLabel: "", values: installmentValues });
    }
  });

  const creditors = new Set([
    ...state.data.fixedCosts.filter((item) => item.includeInProjection !== false).map((item) => item.creditorId),
    ...state.data.plannedPurchases.map((item) => item.creditorId)
  ].filter(Boolean));
  creditors.forEach((creditorId) => {
    const fixedValues = {};
    const plannedValues = {};
    months.forEach((month) => {
      fixedValues[month] = fixedTotalByOrigin(creditorId);
      plannedValues[month] = plannedTotal(creditorId, month);
      ["fixed", "planned"].forEach((kind) => {
        const key = `auto-${kind}-${creditorId}:${month}`;
        if (!keepPaidValues && isOccurrencePaid(key)) {
          if (kind === "fixed") fixedValues[month] = 0;
          if (kind === "planned") plannedValues[month] = 0;
        }
      });
    });
    const owner = ownerForCreditor(creditorId);
    if (Object.values(fixedValues).some(Boolean)) rows.push({ id: `auto-fixed-${creditorId}`, kind: "expense", owner, label: `Custos fixos (${getCreditorName(creditorId)})`, origin: getCreditorName(creditorId), sourceLabel: "", values: fixedValues });
    if (Object.values(plannedValues).some(Boolean)) rows.push({ id: `auto-planned-${creditorId}`, kind: "expense", owner, label: `Compras planejadas (${getCreditorName(creditorId)})`, origin: getCreditorName(creditorId), sourceLabel: "", values: plannedValues });
  });
}

function groupKey(item) {
  return `${item.creditorId || "sem-credor"}|${item.owner || "Felipe"}|${item.paymentMethod || "Cartão de crédito"}`;
}

function uniqueGroups(items, keyGetter) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key.replaceAll("|", "-").replaceAll(/\s+/g, "-"),
        creditorId: item.creditorId,
        owner: item.owner || "Felipe",
        paymentMethod: item.paymentMethod || "Cartão de crédito",
        key
      });
    }
  });
  return [...groups.values()];
}

function installmentTotalForGroup(group, monthIndex) {
  return state.data.installments
    .filter((item) => groupKey(item) === group.key && item.active !== false)
    .reduce((total, item) => {
      const left = Math.max(0, Number(item.totalInstallments) - Number(item.paidInstallments));
      return monthIndex < left ? total + Number(item.amount) : total;
    }, 0);
}

function appendKahDifferenceRow(rows, months) {
  const limit = Number(state.data.kahLimit || 0);
  if (!limit) return;
  const values = {};
  months.forEach((month) => {
    const used = rows
      .filter((row) => row.kind === "expense" && row.owner === "Kah")
      .reduce((total, row) => total + Number(row.values[month] || 0), 0);
    values[month] = Math.max(0, limit - used);
  });
  if (Object.values(values).some(Boolean)) {
    rows.unshift({ id: "kah-difference", kind: "expense", owner: "Kah", label: "Diferença Kah", origin: "Limite Kah", sourceLabel: "", values });
  }
}

function ownerForCreditor(creditorId) {
  const candidates = [
    ...state.data.installments,
    ...state.data.fixedCosts,
    ...state.data.plannedPurchases
  ].filter((item) => item.creditorId === creditorId);
  return candidates.find((item) => item.owner === "Kah") ? "Kah" : "Felipe";
}

function ownerRank(owner) {
  return owner === "Kah" ? 0 : 1;
}

function installmentTotal(origin, monthIndex) {
  return state.data.installments
    .filter((item) => item.creditorId === origin && item.active !== false)
    .reduce((total, item) => {
      const left = Math.max(0, Number(item.totalInstallments) - Number(item.paidInstallments));
      return monthIndex < left ? total + Number(item.amount) : total;
    }, 0);
}

function fixedTotalByName(name) {
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && item.name === name)
    .reduce((total, item) => total + Number(item.amount), 0);
}

function fixedTotalByOrigin(origin) {
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && item.creditorId === origin)
    .reduce((total, item) => total + Number(item.amount), 0);
}

function plannedTotal(origin, month) {
  return state.data.plannedPurchases
    .filter((item) => item.creditorId === origin && item.month === month)
    .reduce((total, item) => total + Number(item.amount), 0);
}

function carValueForMonth(month) {
  const payment = state.data.car.payments.find((item) => item.month === month && item.status !== "Pago");
  return payment ? Number(payment.value) : 0;
}

function differenceValue(line, months, month, index) {
  const limit = Number(line.limit || 0);
  const used = (line.subtractLineIds || []).reduce((total, id) => {
    const sibling = state.data.projectionLines.find((item) => item.id === id);
    return total + (sibling ? valuesForProjectionLine(sibling, months)[month] || 0 : 0);
  }, 0);
  return Math.max(0, limit - used);
}

function buildTotals(rows, months) {
  let accumulated = Number(state.data.initialBalance || 0);
  return months.map((month) => {
    const income = rows.filter((row) => row.kind === "income").reduce((total, row) => total + (row.values[month] || 0), 0);
    const expense = rows.filter((row) => row.kind === "expense").reduce((total, row) => total + (row.values[month] || 0), 0);
    const balance = income - expense;
    accumulated += balance;
    return { month, income, expense, balance, accumulated };
  });
}

function projectionRow(row, months) {
  const sectionClass = `${row.kind === "income" ? "income-row" : "expense-row"} ${row.owner === "Kah" ? "owner-kah" : ""}`;
  return `
    <tr class="${sectionClass}">
      <th class="sticky-col">
        <span>${escapeHtml(row.label)}</span>
      </th>
      <td>${escapeHtml(row.origin || "-")}</td>
      ${months.map((month) => projectionCell(row, month)).join("")}
    </tr>
  `;
}

function projectionCell(row, month) {
  const value = row.values[month] || 0;
  const key = `${row.id}:${month}`;
  const paid = isOccurrencePaid(key);
  if (!value && !paid) return `<td class="muted-cell">-</td>`;
  const sign = row.kind === "income" ? "" : "-";
  const className = row.kind === "income" ? "positive" : "negative";
  const status = paid && row.kind === "expense" ? `<small class="cell-status">pago no controle</small>` : "";
  return `<td><span class="${className}">${sign}${currency.format(value)}</span>${status}</td>`;
}

function groupRow(label, monthsCount) {
  return `<tr class="group-row"><th colspan="${monthsCount + 2}">${label}</th></tr>`;
}

function totalRow(label, months, getter, tone) {
  return `
    <tr class="total-row">
      <th class="sticky-col">${label}</th>
      <td></td>
      ${months.map((month) => {
        const value = getter(month);
        const className = tone === "balance" ? (value >= 0 ? "positive" : "negative") : tone;
        return `<td><strong class="${className}">${currency.format(value)}</strong></td>`;
      }).join("")}
    </tr>
  `;
}

function renderPlanningChart(totals, months) {
  const maxValue = Math.max(
    1,
    ...totals.flatMap((item) => [Math.abs(item.income), Math.abs(item.expense), Math.abs(item.balance)])
  );
  const points = totals.map((item, index) => {
    const x = 42 + index * 76;
    const y = 166 - ((item.balance + maxValue) / (maxValue * 2)) * 132;
    return { x, y, value: item.balance };
  });
  el.planningChart.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-dot income"></i>Entradas</span>
      <span><i class="legend-dot expense"></i>Saídas</span>
      <span><i class="legend-dot balance"></i>Saldo</span>
    </div>
    <div class="bar-chart-wrap">
      <svg class="balance-line" viewBox="0 0 900 190" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
      </svg>
      <div class="bar-chart">
      ${totals.map((item, index) => {
        const incomeHeight = Math.max(4, (item.income / maxValue) * 150);
        const expenseHeight = Math.max(4, (item.expense / maxValue) * 150);
        return `
          <div class="bar-month">
            <div class="bar-stack" title="${formatMonth(months[index])}">
              <span class="bar-value income-value">${compactCurrency(item.income)}</span>
              <span class="bar income" style="height:${incomeHeight}px"></span>
              <span class="bar expense" style="height:${expenseHeight}px"></span>
              <span class="bar-value expense-value">-${compactCurrency(item.expense)}</span>
              <span class="line-value ${item.balance < 0 ? "negative" : "positive"}">${compactCurrency(item.balance)}</span>
            </div>
            <strong>${formatMonth(months[index])}</strong>
          </div>
        `;
      }).join("")}
      </div>
    </div>
  `;
}

function renderInstallments() {
  el.installmentsTable.innerHTML = state.data.installments.length
    ? state.data.installments.map((item) => genericDebtCard({
      id: item.id,
      title: item.item,
      subtitle: `${getCreditorName(item.creditorId)} · ${item.owner || "Felipe"} · ${item.paymentMethod || "Cartão de crédito"}`,
      creditorId: item.creditorId,
      total: item.totalInstallments,
      paid: item.paidInstallments,
      amount: item.amount,
      purchaseDate: item.purchaseDate,
      filter: state.installmentFilters[item.id] || "open",
      prefix: "installment",
      open: state.expandedInstallments[item.id] === true
    })).join("")
    : `<div class="empty-state">Nenhuma conta parcelada cadastrada.</div>`;

  el.installmentsTable.querySelectorAll("[data-installment-card-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.expandedInstallments[button.dataset.contractId] = true;
      state.installmentFilters[button.dataset.contractId] = button.dataset.installmentCardTab;
      renderInstallments();
    });
  });
  el.installmentsTable.querySelectorAll("[data-installment-details]").forEach((detail) => {
    detail.addEventListener("toggle", () => {
      state.expandedInstallments[detail.dataset.installmentDetails] = detail.open;
    });
  });
  el.installmentsTable.querySelectorAll("[data-edit-installment]").forEach((button) => {
    button.addEventListener("click", () => openInstallmentDialog(button.dataset.editInstallment));
  });
  el.installmentsTable.querySelectorAll("[data-pay-installment]").forEach((button) => {
    button.addEventListener("click", () => payInstallment(button.dataset.payInstallment));
  });
  el.installmentsTable.querySelectorAll("[data-unpay-installment]").forEach((button) => {
    button.addEventListener("click", () => unpayInstallment(button.dataset.unpayInstallment));
  });
  el.installmentsTable.querySelectorAll("[data-delete-installment]").forEach((button) => {
    button.addEventListener("click", () => deleteInstallment(button.dataset.deleteInstallment));
  });
}

function renderFixedCosts() {
  el.fixedCostsTable.innerHTML = `
    <thead><tr><th>Custo</th><th>Credor</th><th>Método</th><th>Grupo</th><th>Venc.</th><th>Valor</th><th>Projeção</th><th>Ações</th></tr></thead>
    <tbody>
      ${state.data.fixedCosts.map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${creditorLogoHtml(item.creditorId)}${escapeHtml(getCreditorName(item.creditorId))}</td>
          <td>${escapeHtml(item.paymentMethod || "-")}</td>
          <td>${escapeHtml(item.group || "-")}</td>
          <td>${item.dueDay}</td>
          <td>${currency.format(item.amount)}</td>
          <td>${item.includeInProjection !== false ? "Sim" : "Não"}</td>
          <td><button class="small-button danger-mini" type="button" data-delete-fixed="${item.id}">Excluir</button></td>
        </tr>
      `).join("")}
    </tbody>
  `;

  el.fixedCostsTable.querySelectorAll("[data-delete-fixed]").forEach((button) => {
    button.addEventListener("click", () => deleteFixedCost(button.dataset.deleteFixed));
  });
}

function renderCar() {
  const car = state.data.car;
  el.carTitle.textContent = car.name || "Carro";
  el.carForm.elements.name.value = car.name || "";
  el.carForm.elements.financed.value = car.financed ? Number(car.financed).toFixed(2) : "";
  el.carForm.elements.purchase.value = car.purchase ? Number(car.purchase).toFixed(2) : "";
  el.carForm.elements.monthly.value = car.monthly ? Number(car.monthly).toFixed(2) : "";
  el.carForm.elements.totalInstallments.value = car.totalInstallments || "";

  const paid = car.payments.filter((item) => item.status === "Pago");
  const pending = car.payments.filter((item) => item.status !== "Pago");
  const financing = Number(car.monthly || 0) * Number(car.totalInstallments || 0);
  const paidValue = paid.reduce((total, item) => total + Number(item.paidAmount || 0), 0);
  const pendingValue = pending.reduce((total, item) => total + Number(item.value), 0);
  const economy = paid.reduce((total, item) => total + Math.max(0, Number(item.value) - Number(item.paidAmount || item.value)), 0);
  const realProjected = paidValue + pendingValue;

  el.carKpis.innerHTML = [
    metric("Valor financiado", Number(car.financed || 0), "neutral"),
    metric("Valor de compra", Number(car.purchase || 0), "neutral"),
    metric("Financiamento", financing, "negative"),
    metric("Real projetado", realProjected, "neutral"),
    metric("Valor pago", paidValue, "positive"),
    metric("Faltam", `${pending.length} parcelas`, "negative", false),
    metric("Falta pagar", -pendingValue, "negative"),
    metric("Economia", economy, "positive")
  ].join("");
  el.carKpis.insertAdjacentHTML("beforeend", carProgress(paid.length, car.payments.length));

  el.carTable.innerHTML = car.payments.length
    ? carDebtCard(car)
    : `<div class="empty-state">Nenhum financiamento cadastrado.</div>`;

  el.carTable.querySelectorAll("[data-car-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.carFilter = button.dataset.carTab;
      renderCar();
    });
  });
  el.carTable.querySelectorAll("[data-pay-car]").forEach((button) => {
    button.addEventListener("click", () => openCarPaymentDialog(button.dataset.payCar));
  });
}

function renderFgts() {
  renderFgtsV2();
  return;
  const received = state.data.fgts.contracts.reduce((total, item) => total + Number(item.received || 0), 0);
  const toPay = state.data.fgts.contracts.reduce((total, item) => total + Number(item.toPay || 0), 0);
  el.fgtsKpis.innerHTML = [
    metric("Recebido", received, "positive"),
    metric("A pagar", -toPay, "negative"),
    metric("Saldo", state.data.fgts.balance, "neutral"),
    metric("Liberado", state.data.fgts.available, "positive")
  ].join("");

  el.fgtsTable.innerHTML = `
    <thead><tr><th>Empréstimo</th><th>Credor</th><th>Contrato</th><th>Recebido</th><th>A pagar</th><th>Status</th></tr></thead>
    <tbody>
      ${state.data.fgts.contracts.map((item) => `
        <tr>
          <td>
            <details>
              <summary>${escapeHtml(item.description)}</summary>
              <div class="detail-list">
                ${fgtsAnnualPayments(item)}
                <form class="inline-form mini-form" data-fgts-payment="${item.id}">
                  <input name="year" type="number" min="2020" max="2040" placeholder="Ano" required>
                  <input name="amount" type="number" min="0" step="0.01" placeholder="Valor" required>
                  <button class="small-button pay" type="submit">Registrar</button>
                </form>
                <form class="inline-form mini-form" data-fgts-quit="${item.id}">
                  <input name="amount" type="number" min="0" step="0.01" placeholder="Valor quitação" required>
                  <button class="small-button" type="submit">Quitar</button>
                </form>
              </div>
            </details>
          </td>
          <td>${creditorLogoHtml(item.creditorId)}${escapeHtml(getCreditorName(item.creditorId))}</td>
          <td>${escapeHtml(item.contract || "-")}</td>
          <td>${currency.format(item.received || 0)}</td>
          <td>${currency.format(item.toPay || 0)}</td>
          <td>${escapeHtml(item.status || "Ativo")}</td>
        </tr>
      `).join("")}
    </tbody>
  `;

  el.fgtsTable.querySelectorAll("[data-fgts-payment]").forEach((form) => {
    form.addEventListener("submit", addFgtsAnnualPayment);
  });
  el.fgtsTable.querySelectorAll("[data-fgts-quit]").forEach((form) => {
    form.addEventListener("submit", quitFgtsContract);
  });
}

function renderOrigins() {
  renderOriginsV2();
  return;
  el.creditorList.innerHTML = state.data.creditors.map((creditor) => `
    <div class="creditor-card">
      ${creditorLogoHtml(creditor.id)}
      <div>
        <strong>${escapeHtml(creditor.name)}</strong>
        <span>${escapeHtml(creditor.type)}</span>
      </div>
      <button class="small-button danger-mini" type="button" data-delete-creditor="${creditor.id}">Excluir</button>
    </div>
  `).join("");

  el.creditorList.querySelectorAll("[data-delete-creditor]").forEach((button) => {
    button.addEventListener("click", () => deleteCreditor(button.dataset.deleteCreditor));
  });
}

function renderFgtsV2() {
  state.data.fgts.contracts.forEach(normalizeFgtsContract);
  const received = state.data.fgts.contracts.reduce((total, item) => total + Number(item.received || 0), 0);
  const toPay = state.data.fgts.contracts.reduce((total, item) => total + fgtsPendingTotal(item), 0);
  el.fgtsKpis.innerHTML = [
    metric("Recebido", received, "positive"),
    metric("A pagar", -toPay, "negative"),
    metric("Saldo", state.data.fgts.balance, "neutral"),
    metric("Liberado", state.data.fgts.available, "positive")
  ].join("");

  el.fgtsTable.innerHTML = state.data.fgts.contracts.length
    ? state.data.fgts.contracts.map((item) => fgtsContractCard(item)).join("")
    : `<div class="empty-state">Nenhum empréstimo FGTS cadastrado.</div>`;

  el.fgtsTable.querySelectorAll("[data-fgts-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.fgtsFilters[button.dataset.contractId] = button.dataset.fgtsTab;
      renderFgts();
    });
  });
  el.fgtsTable.querySelectorAll("[data-pay-fgts-installment]").forEach((button) => {
    button.addEventListener("click", () => payFgtsInstallment(button.dataset.payFgtsInstallment));
  });
  el.fgtsTable.querySelectorAll("[data-fgts-quit]").forEach((form) => {
    form.addEventListener("submit", quitFgtsContract);
  });
}

function renderOriginsV2() {
  el.creditorList.innerHTML = `
    <thead><tr><th>Credor</th><th>Formas de pagamento</th><th>Vínculos</th><th>Saldo previsto</th><th>Ações</th></tr></thead>
    <tbody>
      ${state.data.creditors.map((creditor) => {
        const inUse = isCreditorInUse(creditor.id);
        return `
          <tr>
            <td>
              <div class="entity-cell">
                ${creditorLogoHtml(creditor.id)}
                <strong>${escapeHtml(creditor.name)}</strong>
              </div>
            </td>
            <td>${escapeHtml((creditor.paymentForms || [creditor.type]).filter(Boolean).join(", ") || "-")}</td>
            <td>${creditorUsageCount(creditor.id)}</td>
            <td>${currency.format(creditorOpenBalance(creditor.id))}</td>
            <td class="row-actions">
              <button class="icon-button mini-icon" type="button" title="Editar" data-edit-creditor="${creditor.id}">${icon("pencil")}</button>
              <button class="icon-button mini-icon danger-mini" type="button" title="${inUse ? "Credor vinculado" : "Excluir"}" data-delete-creditor="${creditor.id}">${icon(inUse ? "ban" : "trash-2")}</button>
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;

  el.creditorList.querySelectorAll("[data-edit-creditor]").forEach((button) => {
    button.addEventListener("click", () => openCreditorDialog(button.dataset.editCreditor));
  });
  el.creditorList.querySelectorAll("[data-delete-creditor]").forEach((button) => {
    button.addEventListener("click", () => deleteCreditor(button.dataset.deleteCreditor));
  });
}

function hydrateForms() {
  document.querySelectorAll("[data-creditor-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = state.data.creditors.map((creditor) => `<option value="${creditor.id}">${escapeHtml(creditor.name)}</option>`).join("");
    if (current) select.value = current;
  });
  document.querySelectorAll("[data-payment-method-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = state.data.paymentMethods.map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`).join("");
    if (current) select.value = current;
  });
  document.querySelectorAll("[data-owner-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = ["Felipe", "Kah"].map((owner) => `<option value="${owner}">${owner}</option>`).join("");
    if (current) select.value = current;
  });
  const start = nextMonths(1)[0];
  if (el.plannedForm.elements.month) el.plannedForm.elements.month.value = start;
}

async function addInstallment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const item = {
    id: crypto.randomUUID(),
    item: String(form.get("item")).trim(),
    creditorId: String(form.get("creditorId")),
    amount: Number(form.get("amount")),
    totalInstallments: Number(form.get("total")),
    paidInstallments: Number(form.get("paid") || 0),
    purchaseDate: String(form.get("date") || ""),
    owner: String(form.get("owner") || "Felipe"),
    paymentMethod: String(form.get("paymentMethod") || "Cartão de crédito"),
    active: true
  };
  const editing = Boolean(state.installmentEditingId);
  if (editing) {
    const current = state.data.installments.find((entry) => entry.id === state.installmentEditingId);
    if (current) Object.assign(current, item, { id: current.id });
  } else {
    state.data.installments.push(item);
    state.expandedInstallments[item.id] = true;
  }
  closeInstallmentDialog();
  event.currentTarget.reset();
  await saveState(editing ? "Parcelamento atualizado." : "Parcelamento cadastrado.");
}

function openInstallmentDialog(id = null) {
  hydrateForms();
  state.installmentEditingId = id;
  const item = id ? state.data.installments.find((entry) => entry.id === id) : null;
  if (item) item.item = item.item || item.name || item.description || "";
  el.installmentDialogTitle.textContent = item ? "Editar parcelamento" : "Novo parcelamento";
  el.installmentForm.elements.item.value = item?.item || "";
  el.installmentForm.elements.creditorId.value = item?.creditorId || el.installmentForm.elements.creditorId.value;
  el.installmentForm.elements.owner.value = item?.owner || "Felipe";
  el.installmentForm.elements.paymentMethod.value = item?.paymentMethod || "Cartão de crédito";
  el.installmentForm.elements.amount.value = item?.amount ? Number(item.amount).toFixed(2) : "";
  el.installmentForm.elements.total.value = item?.totalInstallments || "";
  el.installmentForm.elements.paid.value = item?.paidInstallments || 0;
  el.installmentForm.elements.date.value = item?.purchaseDate || "";
  el.installmentDialog.showModal();
}

function closeInstallmentDialog() {
  state.installmentEditingId = null;
  el.installmentForm.reset();
  el.installmentDialog.close();
}

async function payInstallment(key) {
  const [id, number] = key.split(":");
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = Math.min(item.totalInstallments, Math.max(Number(item.paidInstallments), Number(number)));
  state.expandedInstallments[id] = true;
  await saveState("Parcela paga.");
}

async function unpayInstallment(key) {
  const [id, number] = key.split(":");
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = Math.max(0, Number(number) - 1);
  state.expandedInstallments[id] = true;
  await saveState("Pagamento removido.");
}

async function deleteInstallment(id) {
  state.data.installments = state.data.installments.filter((item) => item.id !== id);
  await saveState("Parcela excluída.");
}

async function addFixedCost(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.fixedCosts.push({
    id: crypto.randomUUID(),
    name: String(form.get("name")).trim(),
    creditorId: String(form.get("creditorId")),
    paymentMethod: String(form.get("paymentMethod")),
    owner: String(form.get("owner") || "Felipe"),
    group: String(form.get("group") || "").trim(),
    dueDay: Number(form.get("dueDay")),
    amount: Number(form.get("amount")),
    includeInProjection: form.get("includeInProjection") === "on"
  });
  event.currentTarget.reset();
  await saveState("Custo fixo cadastrado.");
}

async function deleteFixedCost(id) {
  state.data.fixedCosts = state.data.fixedCosts.filter((item) => item.id !== id);
  await saveState("Custo fixo excluído.");
}

async function updateCar(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.car.name = String(form.get("name")).trim();
  state.data.car.financed = Number(form.get("financed") || 0);
  state.data.car.purchase = Number(form.get("purchase") || 0);
  state.data.car.monthly = Number(form.get("monthly") || 0);
  state.data.car.totalInstallments = Number(form.get("totalInstallments") || state.data.car.totalInstallments);
  if (!state.data.car.payments.length && state.data.car.monthly && state.data.car.totalInstallments) {
    state.data.car.payments = nextMonths(state.data.car.totalInstallments).map((month, index) => ({
      id: crypto.randomUUID(),
      number: index + 1,
      month,
      value: state.data.car.monthly,
      paidAmount: 0,
      status: "Pendente"
    }));
  }
  await saveState("Cadastro do carro atualizado.");
}

async function updateSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.accountBalance = Number(form.get("accountBalance") || 0);
  state.data.initialBalance = state.data.accountBalance;
  state.data.kahLimit = Number(form.get("kahLimit") || 0);
  await saveState("Ajustes salvos.");
}

function openCarPaymentDialog(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  el.carPaymentTitle.textContent = `Parcela ${payment.number}/${state.data.car.payments.length}`;
  el.carPaymentForm.elements.paymentId.value = payment.id;
  el.carPaymentForm.elements.paidAmount.value = Number(payment.value || 0).toFixed(2);
  el.carPaymentDialog.showModal();
}

async function payCarInstallment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payment = state.data.car.payments.find((item) => item.id === String(form.get("paymentId")));
  if (!payment) return;
  payment.status = "Pago";
  payment.paidAmount = Number(form.get("paidAmount") || payment.value || 0);
  el.carPaymentDialog.close();
  await saveState("Parcela do carro paga.");
}

async function addFgtsContract(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const totalInstallments = Number(form.get("totalInstallments") || 1);
  const installmentAmount = Number(form.get("installmentAmount") || 0);
  const paidInstallments = Math.min(Number(form.get("paidInstallments") || 0), totalInstallments);
  const firstDueDate = String(form.get("firstDueDate") || "");
  state.data.fgts.contracts.push({
    id: crypto.randomUUID(),
    description: String(form.get("description")).trim(),
    creditorId: String(form.get("creditorId")),
    contract: String(form.get("contract") || "").trim(),
    createdAt: todayIsoDate(),
    received: Number(form.get("received") || 0),
    toPay: installmentAmount * (totalInstallments - paidInstallments),
    installmentAmount,
    totalInstallments,
    paidInstallments,
    firstDueDate,
    settlementAmount: Number(form.get("settlementAmount") || 0),
    status: "Ativo",
    annualPayments: [],
    installments: createFgtsInstallments(totalInstallments, installmentAmount, paidInstallments, firstDueDate)
  });
  event.currentTarget.reset();
  await saveState("Empréstimo FGTS cadastrado.");
}

async function addFgtsAnnualPayment(event) {
  event.preventDefault();
  const contract = state.data.fgts.contracts.find((item) => item.id === event.currentTarget.dataset.fgtsPayment);
  if (!contract) return;
  const form = new FormData(event.currentTarget);
  contract.annualPayments = contract.annualPayments || [];
  contract.annualPayments.push({ year: Number(form.get("year")), amount: Number(form.get("amount")) });
  await saveState("Pagamento FGTS registrado.");
}

async function quitFgtsContract(event) {
  event.preventDefault();
  const contract = state.data.fgts.contracts.find((item) => item.id === event.currentTarget.dataset.fgtsQuit);
  if (!contract) return;
  const form = new FormData(event.currentTarget);
  contract.quitAmount = Number(form.get("amount"));
  contract.status = "Quitado";
  contract.toPay = 0;
  normalizeFgtsContract(contract);
  contract.installments.forEach((installment) => {
    installment.status = "Pago";
    installment.paidAmount = Number(installment.paidAmount || installment.amount);
  });
  await saveState("Empréstimo FGTS quitado.");
}

async function payFgtsInstallment(key) {
  const [contractId, installmentId] = key.split(":");
  const contract = state.data.fgts.contracts.find((item) => item.id === contractId);
  if (!contract) return;
  normalizeFgtsContract(contract);
  const installment = contract.installments.find((item) => item.id === installmentId);
  if (!installment) return;
  installment.status = "Pago";
  installment.paidAmount = Number(installment.amount || 0);
  contract.paidInstallments = contract.installments.filter((item) => item.status === "Pago").length;
  contract.toPay = fgtsPendingTotal(contract);
  await saveState("Parcela FGTS paga.");
}

async function addCreditor(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = String(form.get("name")).trim();
  if (!name) return;
  const existing = state.creditorEditingId
    ? state.data.creditors.find((creditor) => creditor.id === state.creditorEditingId)
    : state.data.creditors.find((creditor) => creditor.name.toLowerCase() === name.toLowerCase());
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name,
    paymentForms: form.getAll("paymentForms").map(String),
    logoUrl: String(form.get("logoUrl") || "")
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.data.creditors.push(payload);
  }
  event.currentTarget.reset();
  state.creditorEditingId = null;
  el.creditorDialog.close();
  renderCreditorLogoPreview("");
  await saveState(existing ? "Credor atualizado." : "Credor cadastrado.");
}

function openCreditorDialog(id = null) {
  state.creditorEditingId = id;
  el.creditorForm.reset();
  const creditor = id ? getCreditor(id) : null;
  el.creditorDialogTitle.textContent = creditor ? "Editar credor" : "Novo credor";
  el.creditorForm.elements.name.value = creditor?.name || "";
  el.creditorForm.elements.logoUrl.value = creditor?.logoUrl || "";
  const forms = creditor?.paymentForms || [creditor?.type].filter(Boolean);
  el.creditorForm.querySelectorAll("input[name='paymentForms']").forEach((input) => {
    input.checked = forms.includes(input.value);
  });
  renderCreditorLogoPreview(creditor?.logoUrl || "");
  el.creditorDialog.showModal();
  refreshIcons();
}

function closeCreditorDialog() {
  state.creditorEditingId = null;
  el.creditorForm.reset();
  renderCreditorLogoPreview("");
  el.creditorDialog.close();
}

async function deleteCreditor(id) {
  if (isCreditorInUse(id)) {
    showToast("Este credor está vinculado a lançamentos.");
    return;
  }
  state.data.creditors = state.data.creditors.filter((creditor) => creditor.id !== id);
  await saveState("Credor excluído.");
}

function isCreditorInUse(id) {
  return state.data.installments.some((item) => item.creditorId === id)
    || state.data.fixedCosts.some((item) => item.creditorId === id)
    || state.data.plannedPurchases.some((item) => item.creditorId === id)
    || state.data.fgts.contracts.some((item) => item.creditorId === id)
    || state.data.projectionLines.some((item) => item.creditorId === id || item.match === id);
}

function handleCreditorLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 250 * 1024) {
    showToast("Use uma logo menor, até 250 KB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    el.creditorForm.elements.logoUrl.value = String(reader.result || "");
    renderCreditorLogoPreview(el.creditorForm.elements.logoUrl.value);
  };
  reader.readAsDataURL(file);
}

function renderCreditorLogoPreview(src) {
  el.creditorLogoPreview.innerHTML = src ? `<img alt="Logo" src="${escapeHtml(src)}">` : "CR";
}

function openPlannedDialog() {
  hydrateForms();
  updatePlannedFields();
  el.plannedDialog.showModal();
}

function updatePlannedFields() {
  const isIncome = el.plannedForm.elements.kind.value === "income";
  el.plannedCredorField.hidden = isIncome;
  el.plannedFonteField.hidden = !isIncome;
  el.plannedForm.elements.creditorId.required = !isIncome;
  el.plannedForm.elements.source.required = isIncome;
}

async function addPlannedPurchase(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const kind = String(form.get("kind") || "expense");
  const month = String(form.get("month"));
  const amount = Number(form.get("amount"));
  if (kind === "income") {
    state.data.incomeLines.push({
      id: crypto.randomUUID(),
      label: String(form.get("description")).trim(),
      origin: String(form.get("source") || "").trim(),
      owner: String(form.get("owner") || "Felipe"),
      values: { [month]: amount }
    });
  } else {
    state.data.plannedPurchases.push({
      id: crypto.randomUUID(),
      description: String(form.get("description")).trim(),
      creditorId: String(form.get("creditorId")),
      month,
      amount,
      owner: String(form.get("owner") || "Felipe")
    });
  }
  el.plannedDialog.close();
  event.currentTarget.reset();
  await saveState("Lançamento planejado adicionado.");
}

async function togglePaidOccurrence(key) {
  const paid = state.data.paidOccurrences || [];
  if (paid.includes(key)) {
    state.data.paidOccurrences = paid.filter((item) => item !== key);
    await saveState("Ocorrência reaberta.");
  } else {
    state.data.paidOccurrences = [...paid, key];
    await saveState("Ocorrência baixada.");
  }
}

function isOccurrencePaid(key) {
  return (state.data.paidOccurrences || []).includes(key);
}

async function toggleReceivedOccurrence(key) {
  const received = state.data.receivedOccurrences || [];
  if (received.includes(key)) {
    state.data.receivedOccurrences = received.filter((item) => item !== key);
    await saveState("Entrada marcada como prevista.");
  } else {
    state.data.receivedOccurrences = [...received, key];
    await saveState("Entrada recebida.");
  }
}

function isIncomeReceived(key) {
  return (state.data.receivedOccurrences || []).includes(key);
}

function exportState() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `orcamento-mensal-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exportado.");
}

function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      state.data = normalizeData(JSON.parse(String(reader.result)));
      await saveState("Backup importado.");
    } catch {
      showToast("Arquivo inválido.");
    }
  };
  reader.readAsText(file);
}

function loadLocalState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeData(JSON.parse(saved)) : createDefaultData();
  } catch {
    return createDefaultData();
  }
}

function persistLocalState(write = true) {
  if (write) localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function normalizeData(data) {
  const defaults = createDefaultData();
  if (!data || Number(data.schemaVersion || 0) < 3) return defaults;
  const creditors = (data.creditors || defaults.creditors).map((creditor) => ({
    ...creditor,
    paymentForms: creditor.paymentForms || [creditor.type].filter(Boolean)
  }));
  const creditorByName = new Map(creditors.map((creditor) => [creditor.name, creditor.id]));
  const normalized = {
    ...defaults,
    ...data,
    creditors,
    paymentMethods: data.paymentMethods || defaults.paymentMethods,
    incomeLines: data.incomeLines || defaults.incomeLines,
    projectionLines: (data.projectionLines || defaults.projectionLines).map((line) => ({
      ...line,
      match: creditorByName.get(line.match) || line.match,
      creditorId: line.creditorId || creditorByName.get(line.origin) || null
    })),
    installments: (data.installments || []).map((item) => ({ ...item, item: item.item || item.name || item.description || "Parcelamento", creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin, owner: item.owner || "Felipe", paymentMethod: item.paymentMethod || "Cartão de crédito" })),
    fixedCosts: (data.fixedCosts || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.payment) || item.payment, paymentMethod: item.paymentMethod || item.payment || "Cartão de crédito" })),
    plannedPurchases: (data.plannedPurchases || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin })),
    paidOccurrences: data.paidOccurrences || [],
    receivedOccurrences: data.receivedOccurrences || [],
    car: { ...defaults.car, ...(data.car || {}) },
    fgts: { ...defaults.fgts, ...(data.fgts || {}), contracts: ((data.fgts?.contracts) || defaults.fgts.contracts).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.contract) || creditors[0]?.id })) }
  };
  if (!normalized.fgts.contracts.length) {
    normalized.fgts.balance = 0;
    normalized.fgts.blocked = 0;
    normalized.fgts.available = 0;
  }
  return normalized;
}

function createDefaultData() {
  const months = nextMonths(12);

  return {
    schemaVersion: 3,
    initialBalance: 0,
    accountBalance: 0,
    kahLimit: 0,
    paymentMethods: ["PIX", "Débito em conta", "Cartão de crédito", "Boleto"],
    creditors: [],
    incomeLines: [],
    projectionLines: [],
    installments: [],
    fixedCosts: [],
    plannedPurchases: [],
    paidOccurrences: [],
    receivedOccurrences: [],
    car: {
      name: "Carro",
      financed: 0,
      purchase: 0,
      monthly: 0,
      totalInstallments: 0,
      payments: []
    },
    fgts: {
      balance: 0,
      blocked: 0,
      available: 0,
      contracts: []
    }
  };
}

function metric(label, value, tone, money = true) {
  return `
    <article class="metric ${tone}">
      <span>${label}</span>
      <strong>${money ? currency.format(value) : value}</strong>
    </article>
  `;
}

function sourceLabel(line) {
  const labels = {
    installments: "vem de Parcelamentos",
    fixedByName: "vem de Custo Fixo",
    fixedByOrigin: "custos da origem",
    planned: "compras planejadas",
    manual: "projeção manual",
    car: "financiamento",
    difference: "limite/diferença"
  };
  return labels[line.source] || "projeção";
}

function tabButtons(prefix, active) {
  const attr = prefix === "car" ? "data-car-tab" : "data-installment-tab";
  return `
    <div class="segmented">
      <button class="segment ${active === "open" ? "active" : ""}" type="button" ${attr}="open">Pendentes</button>
      <button class="segment ${active === "paid" ? "active" : ""}" type="button" ${attr}="paid">Pagas</button>
    </div>
  `;
}

function installmentDetail(item) {
  return Array.from({ length: item.totalInstallments }, (_, index) => {
    const paid = index < item.paidInstallments;
    return `<span class="detail-pill ${paid ? "ok" : "warn"}">${index + 1}/${item.totalInstallments} · ${paid ? "Paga" : "Pendente"} · ${currency.format(item.amount)}</span>`;
  }).join("");
}

function fgtsContractCard(contract) {
  normalizeFgtsContract(contract);
  const paid = contract.installments.filter((item) => item.status === "Pago");
  const pending = contract.installments.filter((item) => item.status !== "Pago");
  const activeTab = state.fgtsFilters[contract.id] || "open";
  const visible = activeTab === "paid" ? paid : pending.slice(0, 5);
  const nextDue = pending[0]?.dueDate || "";
  return `
    <details class="debt-card" open>
      <summary>
        <div class="entity-cell">
          ${creditorLogoHtml(contract.creditorId)}
          <div>
            <strong>${escapeHtml(contract.description)}</strong>
            <span>${escapeHtml(getCreditorName(contract.creditorId))} · ${escapeHtml(contract.contract || "sem contrato")}</span>
          </div>
        </div>
        <span class="status ${contract.status === "Quitado" ? "ok" : "warn"}">${escapeHtml(contract.status || "Ativo")}</span>
      </summary>
      <div class="debt-meta-grid">
        ${metaBox("Criada em", formatDate(contract.createdAt || contract.firstDueDate))}
        ${metaBox("Tipo", "Empréstimo")}
        ${metaBox("Parcelas pagas", `${paid.length} de ${contract.installments.length}`)}
        ${metaBox("Próximo vencimento", nextDue ? formatDate(nextDue) : "-")}
        <form class="inline-form debt-action" data-fgts-quit="${contract.id}">
          <input name="amount" type="number" min="0" step="0.01" placeholder="Valor quitação" value="${contract.settlementAmount || ""}" required>
          <button class="small-button" type="submit">Quitar</button>
        </form>
      </div>
      ${debtTabs("fgts", contract.id, activeTab, pending.length, paid.length)}
      <div class="table-wrap inner-table">
        <table class="data-table clean-table">
          <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>
            ${visible.map((installment) => `
              <tr>
                <td>${installment.number}/${contract.installments.length}</td>
                <td>${formatDate(installment.dueDate)}</td>
                <td>${currency.format(installment.amount || 0)}</td>
                <td><span class="status ${installment.status === "Pago" ? "ok" : "warn"}">${escapeHtml(installment.status)}</span></td>
                <td>
                  <button class="small-button pay" type="button" data-pay-fgts-installment="${contract.id}:${installment.id}" ${installment.status === "Pago" ? "disabled" : ""}>Registrar pagamento</button>
                </td>
              </tr>
            `).join("") || `<tr><td colspan="5" class="muted-cell">Nenhuma parcela nesta aba.</td></tr>`}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function genericDebtCard(config) {
  const installments = Array.from({ length: Number(config.total || 0) }, (_, index) => ({
    id: `${config.id}-${index + 1}`,
    number: index + 1,
    amount: Number(config.amount || 0),
    dueDate: installmentDueDate(config.purchaseDate, index),
    status: index < Number(config.paid || 0) ? "Pago" : "Pendente"
  }));
  const paid = installments.filter((item) => item.status === "Pago");
  const pending = installments.filter((item) => item.status !== "Pago");
  const visible = config.filter === "paid" ? paid : pending;
  const progress = installments.length ? Math.round((paid.length / installments.length) * 100) : 0;
  const balance = pending.length * Number(config.amount || 0);
  const nextDue = pending[0]?.dueDate || "";
  return `
    <details class="debt-card" data-installment-details="${config.id}" ${config.open ? "open" : ""}>
      <summary class="installment-summary">
        <div class="entity-cell">
          ${creditorLogoHtml(config.creditorId)}
          <div>
            <strong>${escapeHtml(config.title)}</strong>
            <span>${escapeHtml(config.subtitle)}</span>
          </div>
        </div>
        <div class="summary-progress">
          <span>Progresso</span>
          <div class="mini-progress"><i style="width:${progress}%"></i></div>
          <strong>${progress}%</strong>
        </div>
        <div class="summary-stat"><span>Parcela</span><strong>${currency.format(config.amount || 0)}</strong></div>
        <div class="summary-stat"><span>Próxima parcela</span><strong>${nextDue ? formatDate(nextDue) : "-"}</strong></div>
        <div class="summary-stat"><span>Status</span><strong>${paid.length}/${installments.length}</strong></div>
        <div class="summary-stat"><span>Saldo</span><strong>${currency.format(balance)}</strong></div>
      </summary>
      <div class="debt-meta-grid">
        ${metaBox("Parcelas pagas", `${paid.length} de ${installments.length}`)}
        ${metaBox("Valor da parcela", currency.format(config.amount || 0))}
        ${metaBox("Falta pagar", currency.format(balance))}
        <div class="debt-action row-actions">
          <button class="small-button" type="button" data-edit-installment="${config.id}">Editar</button>
          <button class="small-button danger-mini" type="button" data-delete-installment="${config.id}">Excluir</button>
        </div>
      </div>
      <div class="debt-tabs">
        <button class="debt-tab ${config.filter === "open" ? "active" : ""}" type="button" data-installment-card-tab="open" data-contract-id="${config.id}">Pendentes <span>${pending.length}</span></button>
        <button class="debt-tab ${config.filter === "paid" ? "active" : ""}" type="button" data-installment-card-tab="paid" data-contract-id="${config.id}">Pagas <span>${paid.length}</span></button>
      </div>
      <div class="table-wrap inner-table">
        <table class="data-table clean-table">
          <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${visible.map((item) => `<tr><td>${item.number}/${installments.length}</td><td>${formatDate(item.dueDate)}</td><td>${currency.format(item.amount)}</td><td><span class="status ${item.status === "Pago" ? "ok" : "warn"}">${item.status}</span></td><td>${item.status === "Pago" ? `<button class="small-button danger-mini" type="button" data-unpay-installment="${config.id}:${item.number}">Excluir pagamento</button>` : `<button class="small-button pay" type="button" data-pay-installment="${config.id}:${item.number}">Pagar</button>`}</td></tr>`).join("") || `<tr><td colspan="5" class="muted-cell">Nenhuma parcela nesta aba.</td></tr>`}</tbody>
        </table>
      </div>
    </details>
  `;
}

function carDebtCard(car) {
  const paid = car.payments.filter((item) => item.status === "Pago");
  const pending = car.payments.filter((item) => item.status !== "Pago");
  const visible = state.carFilter === "paid" ? paid : pending;
  return `
    <details class="debt-card" open>
      <summary>
        <div class="entity-cell">
          <span class="creditor-logo">CA</span>
          <div>
            <strong>${escapeHtml(car.name || "Carro")}</strong>
            <span>Financiamento</span>
          </div>
        </div>
        <span class="status ${pending.length ? "warn" : "ok"}">${pending.length ? "Pendente" : "Quitado"}</span>
      </summary>
      <div class="debt-meta-grid">
        ${metaBox("Parcelas pagas", `${paid.length} de ${car.payments.length}`)}
        ${metaBox("Próxima parcela", pending[0] ? formatMonth(pending[0].month) : "-")}
        ${metaBox("Falta pagar", currency.format(pending.reduce((total, item) => total + Number(item.value || 0), 0)))}
      </div>
      ${tabButtons("car", state.carFilter)}
      <div class="table-wrap inner-table">
        <table class="data-table clean-table">
          <thead><tr><th>Parcela</th><th>Mês</th><th>Valor</th><th>Pago</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${visible.map((item) => `<tr><td>${item.number}/${car.payments.length}</td><td>${formatMonth(item.month)}</td><td>${currency.format(item.value)}</td><td>${item.paidAmount ? currency.format(item.paidAmount) : "-"}</td><td><span class="status ${item.status === "Pago" ? "ok" : "warn"}">${item.status}</span></td><td><button class="small-button pay" type="button" data-pay-car="${item.id}" ${item.status === "Pago" ? "disabled" : ""}>Registrar pagamento</button></td></tr>`).join("")}</tbody>
        </table>
      </div>
    </details>
  `;
}

function carProgress(paid, total) {
  const percent = total ? (paid / total) * 100 : 0;
  return `
    <article class="metric car-progress-card">
      <span>Progresso</span>
      <div class="progress-line"><span style="width:${percent}%"></span></div>
      <strong>${percent.toFixed(2).replace(".", ",")}%</strong>
    </article>
  `;
}

function debtTabs(prefix, id, active, openCount, paidCount) {
  return `
    <div class="debt-tabs">
      <button class="debt-tab ${active === "open" ? "active" : ""}" type="button" data-${prefix}-tab="open" data-contract-id="${id}">Pendentes <span>${openCount}</span></button>
      <button class="debt-tab ${active === "paid" ? "active" : ""}" type="button" data-${prefix}-tab="paid" data-contract-id="${id}">Pagas <span>${paidCount}</span></button>
    </div>
  `;
}

function metaBox(label, value) {
  return `<div class="meta-box"><span>${label}</span><strong>${value}</strong></div>`;
}

function normalizeFgtsContract(contract) {
  const total = Number(contract.totalInstallments || contract.installments?.length || 1);
  const amount = Number(contract.installmentAmount || (contract.toPay && total ? Number(contract.toPay) / total : 0));
  const paid = Number(contract.paidInstallments || 0);
  contract.totalInstallments = total;
  contract.installmentAmount = amount;
  contract.installments = contract.installments?.length
    ? contract.installments
    : createFgtsInstallments(total, amount, paid, contract.firstDueDate);
  contract.paidInstallments = contract.installments.filter((item) => item.status === "Pago").length;
  contract.toPay = fgtsPendingTotal(contract);
}

function createFgtsInstallments(total, amount, paid, firstDueDate) {
  const start = firstDueDate || nextAnnualDate();
  return Array.from({ length: total }, (_, index) => {
    const status = index < paid ? "Pago" : "Pendente";
    return {
      id: crypto.randomUUID(),
      number: index + 1,
      dueDate: addYearsToDate(start, index),
      amount,
      paidAmount: status === "Pago" ? amount : 0,
      status
    };
  });
}

function fgtsPendingTotal(contract) {
  normalizeFgtsContractShallow(contract);
  return (contract.installments || [])
    .filter((item) => item.status !== "Pago")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

function normalizeFgtsContractShallow(contract) {
  if (contract.installments?.length) return;
  const total = Number(contract.totalInstallments || 1);
  const amount = Number(contract.installmentAmount || (contract.toPay && total ? Number(contract.toPay) / total : 0));
  contract.installments = createFgtsInstallments(total, amount, Number(contract.paidInstallments || 0), contract.firstDueDate);
}

function creditorUsageCount(id) {
  return state.data.installments.filter((item) => item.creditorId === id).length
    + state.data.fixedCosts.filter((item) => item.creditorId === id).length
    + state.data.plannedPurchases.filter((item) => item.creditorId === id).length
    + state.data.fgts.contracts.filter((item) => item.creditorId === id).length
    + state.data.projectionLines.filter((item) => item.creditorId === id || item.match === id).length;
}

function creditorOpenBalance(id) {
  const installments = state.data.installments
    .filter((item) => item.creditorId === id)
    .reduce((total, item) => total + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
  const fgts = state.data.fgts.contracts
    .filter((item) => item.creditorId === id)
    .reduce((total, item) => total + fgtsPendingTotal(item), 0);
  return installments + fgts;
}

function fgtsAnnualPayments(contract) {
  const payments = contract.annualPayments || [];
  if (!payments.length) return `<div class="empty-state compact">Nenhum pagamento anual registrado.</div>`;
  return payments
    .map((payment) => `<span class="detail-pill ok">${payment.year} · ${currency.format(payment.amount)}</span>`)
    .join("");
}

function getCreditorName(id) {
  return state.data.creditors.find((creditor) => creditor.id === id)?.name || id || "Credor";
}

function getCreditor(id) {
  return state.data.creditors.find((creditor) => creditor.id === id) || null;
}

function initials(value) {
  return String(value || "?").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function creditorLogoHtml(id) {
  const creditor = getCreditor(id);
  const name = creditor?.name || id || "?";
  if (creditor?.logoUrl) {
    return `<span class="creditor-logo"><img alt="${escapeHtml(name)}" src="${escapeHtml(creditor.logoUrl)}"></span>`;
  }
  return `<span class="creditor-logo">${escapeHtml(initials(name))}</span>`;
}

function syncProjectionTopScroll() {
  if (!el.projectionTable || !el.projectionTopScroll) return;
  const inner = el.projectionTopScroll.firstElementChild;
  if (inner) inner.style.width = `${el.projectionTable.scrollWidth}px`;
}

function nextMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function previousMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function nextAnnualDate() {
  const now = new Date();
  const date = new Date(now.getFullYear() + 1, 5, 28);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addYearsToDate(value, years) {
  const [year, month, day] = String(value || nextAnnualDate()).split("-").map(Number);
  const date = new Date(year + years, (month || 1) - 1, day || 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function installmentDueDate(value, monthOffset) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month - 1 + monthOffset, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonth(month) {
  const [year, value] = month.split("-").map(Number);
  return monthLabel.format(new Date(year, value - 1, 1)).replace(".", "");
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "-";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

function compactCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function updateSync(title, text, online) {
  el.syncTitle.textContent = title;
  el.syncText.textContent = text;
  el.syncDot.classList.toggle("offline", !online);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 2500);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
