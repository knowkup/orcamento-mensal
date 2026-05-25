import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
const monthLabelLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

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
  installmentCreditorFilter: "all",
  carFilter: "open",
  fgtsFilters: {},
  fgtsEditingId: null,
  installmentFilters: {},
  expandedInstallments: {},
  installmentEditingId: null,
  creditorEditingId: null,
  cardEditingId: null,
  fixedCostEditingId: null,
  incomeEditingId: null,
  plannedEditingId: null,
  plannedEditingKind: null
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
  monthlyReference: document.querySelector("#monthlyReference"),
  addMonthlyPlanButton: document.querySelector("#addMonthlyPlanButton"),
  closeMonthButton: document.querySelector("#closeMonthButton"),
  installmentForm: document.querySelector("#installmentForm"),
  installmentDialog: document.querySelector("#installmentDialog"),
  installmentDialogTitle: document.querySelector("#installmentDialogTitle"),
  newInstallmentButton: document.querySelector("#newInstallmentButton"),
  closeInstallmentButton: document.querySelector("#closeInstallmentButton"),
  installmentSummary: document.querySelector("#installmentSummary"),
  installmentFilters: document.querySelector("#installmentFilters"),
  installmentsTable: document.querySelector("#installmentsTable"),
  fixedCostForm: document.querySelector("#fixedCostForm"),
  fixedCostDialog: document.querySelector("#fixedCostDialog"),
  fixedCostDialogTitle: document.querySelector("#fixedCostDialogTitle"),
  fixedCardField: document.querySelector("#fixedCardField"),
  fixedCreditorField: document.querySelector("#fixedCreditorField"),
  fixedOwnerField: document.querySelector("#fixedOwnerField"),
  newFixedCostButton: document.querySelector("#newFixedCostButton"),
  closeFixedCostButton: document.querySelector("#closeFixedCostButton"),
  fixedCostsTable: document.querySelector("#fixedCostsTable"),
  settingsForm: document.querySelector("#settingsForm"),
  carForm: document.querySelector("#carForm"),
  carTitle: document.querySelector("#carTitle"),
  carKpis: document.querySelector("#carKpis"),
  carTable: document.querySelector("#carTable"),
  editCarButton: document.querySelector("#editCarButton"),
  carContractDialog: document.querySelector("#carContractDialog"),
  closeCarContractButton: document.querySelector("#closeCarContractButton"),
  carPaymentDialog: document.querySelector("#carPaymentDialog"),
  carPaymentForm: document.querySelector("#carPaymentForm"),
  carPaymentTitle: document.querySelector("#carPaymentTitle"),
  closeCarPaymentButton: document.querySelector("#closeCarPaymentButton"),
  receiveDialog: document.querySelector("#receiveDialog"),
  receiveForm: document.querySelector("#receiveForm"),
  receiveTitle: document.querySelector("#receiveTitle"),
  closeReceiveButton: document.querySelector("#closeReceiveButton"),
  accountBalanceDialog: document.querySelector("#accountBalanceDialog"),
  accountBalanceForm: document.querySelector("#accountBalanceForm"),
  closeAccountBalanceButton: document.querySelector("#closeAccountBalanceButton"),
  fgtsForm: document.querySelector("#fgtsForm"),
  fgtsDialog: document.querySelector("#fgtsDialog"),
  fgtsDialogTitle: document.querySelector("#fgtsDialogTitle"),
  newFgtsButton: document.querySelector("#newFgtsButton"),
  closeFgtsButton: document.querySelector("#closeFgtsButton"),
  fgtsKpis: document.querySelector("#fgtsKpis"),
  fgtsTable: document.querySelector("#fgtsTable"),
  creditorForm: document.querySelector("#creditorForm"),
  creditorList: document.querySelector("#creditorList"),
  creditorLogoPreview: document.querySelector("#creditorLogoPreview"),
  creditorDialog: document.querySelector("#creditorDialog"),
  creditorDialogTitle: document.querySelector("#creditorDialogTitle"),
  newCreditorButton: document.querySelector("#newCreditorButton"),
  closeCreditorButton: document.querySelector("#closeCreditorButton"),
  cardForm: document.querySelector("#cardForm"),
  cardDialog: document.querySelector("#cardDialog"),
  cardDialogTitle: document.querySelector("#cardDialogTitle"),
  cardList: document.querySelector("#cardList"),
  cardLogoPreview: document.querySelector("#cardLogoPreview"),
  newCardButton: document.querySelector("#newCardButton"),
  closeCardButton: document.querySelector("#closeCardButton"),
  incomeForm: document.querySelector("#incomeForm"),
  incomeDialog: document.querySelector("#incomeDialog"),
  incomeDialogTitle: document.querySelector("#incomeDialogTitle"),
  incomeList: document.querySelector("#incomeList"),
  newIncomeButton: document.querySelector("#newIncomeButton"),
  closeIncomeButton: document.querySelector("#closeIncomeButton"),
  plannedDialog: document.querySelector("#plannedDialog"),
  plannedForm: document.querySelector("#plannedForm"),
  plannedCredorField: document.querySelector("#plannedCredorField"),
  plannedFonteField: document.querySelector("#plannedFonteField"),
  addPlanButton: document.querySelector("#addPlanButton"),
  closePlanButton: document.querySelector("#closePlanButton"),
  fgtsInstallmentValues: document.querySelector("#fgtsInstallmentValues"),
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
  el.newFixedCostButton.addEventListener("click", openFixedCostDialog);
  el.closeFixedCostButton.addEventListener("click", closeFixedCostDialog);
  el.fixedCostForm.elements.paymentMethod.addEventListener("change", updateFixedCostFields);
  el.settingsForm.addEventListener("submit", updateSettings);
  el.carForm.addEventListener("submit", updateCar);
  el.editCarButton.addEventListener("click", openCarContractDialog);
  el.closeCarContractButton.addEventListener("click", () => el.carContractDialog.close());
  el.carPaymentForm.addEventListener("submit", payCarInstallment);
  el.closeCarPaymentButton.addEventListener("click", () => el.carPaymentDialog.close());
  el.receiveForm.addEventListener("submit", confirmReceivedOccurrence);
  el.closeReceiveButton.addEventListener("click", () => el.receiveDialog.close());
  el.accountBalanceForm.addEventListener("submit", saveAccountBalance);
  el.closeAccountBalanceButton.addEventListener("click", () => el.accountBalanceDialog.close());
  bindMoneyInputs();
  el.fgtsForm.addEventListener("submit", addFgtsContract);
  el.newFgtsButton.addEventListener("click", openFgtsDialog);
  el.closeFgtsButton.addEventListener("click", closeFgtsDialog);
  ["totalInstallments", "installmentAmount", "paidInstallments", "firstDueDate"].forEach((name) => {
    el.fgtsForm.elements[name].addEventListener("input", renderFgtsInstallmentValueFields);
    el.fgtsForm.elements[name].addEventListener("change", renderFgtsInstallmentValueFields);
  });
  el.creditorForm.addEventListener("submit", addCreditor);
  el.creditorForm.elements.logoFile.addEventListener("change", handleCreditorLogoUpload);
  el.newCreditorButton.addEventListener("click", () => openCreditorDialog());
  el.closeCreditorButton.addEventListener("click", closeCreditorDialog);
  el.cardForm.addEventListener("submit", saveCreditCard);
  el.cardForm.elements.creditorId.addEventListener("change", updateCardLogoPreview);
  el.newCardButton.addEventListener("click", () => openCardDialog());
  el.closeCardButton.addEventListener("click", closeCardDialog);
  el.incomeForm.addEventListener("submit", saveRecurringIncome);
  el.newIncomeButton.addEventListener("click", () => openIncomeDialog());
  el.closeIncomeButton.addEventListener("click", closeIncomeDialog);
  el.addPlanButton.addEventListener("click", () => openPlannedDialog());
  el.addMonthlyPlanButton.addEventListener("click", () => openPlannedDialog());
  el.closeMonthButton.addEventListener("click", closeMonth);
  el.closePlanButton.addEventListener("click", closePlannedDialog);
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
  renderCreditCards();
  renderRecurringIncomes();
  renderSettings();
  bindMoneyInputs();
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
  el.projectionTable.querySelectorAll("[data-edit-income-line]").forEach((button) => {
    button.addEventListener("click", () => openPlannedDialog(button.dataset.editIncomeLine, "income"));
  });
  requestAnimationFrame(syncProjectionTopScroll);
}

function renderSettings() {
  el.settingsForm.elements.kahLimit.value = formatCurrencyInput(state.data.kahLimit || "");
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
  const received = entries.reduce((total, item) => total + (isIncomeReceived(`${item.row.id}:${month}`) ? receivedAmount(`${item.row.id}:${month}`, item.value) : 0), 0);
  const paid = exits.reduce((total, item) => total + (isOccurrencePaid(`${item.row.id}:${month}`) ? item.value : 0), 0);
  const expectedIncome = entries.reduce((total, item) => total + item.value, 0);
  const expectedExpense = exits.reduce((total, item) => total + item.value, 0);
  const accountBalance = Number(state.data.accountBalance || state.data.initialBalance || 0);
  const hasPending = entries.some((item) => !isIncomeReceived(`${item.row.id}:${month}`))
    || exits.some((item) => !isOccurrencePaid(`${item.row.id}:${month}`));

  el.monthlyReference.textContent = formatMonthLong(month);
  el.closeMonthButton.disabled = hasPending;
  el.monthlySummary.innerHTML = [
    accountBalanceCard(accountBalance),
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

  el.monthlyBoard.querySelectorAll("[data-receive-income]").forEach((button) => {
    button.addEventListener("click", () => openReceiveDialog(button.dataset.receiveIncome, button.dataset.expected));
  });
  el.monthlyBoard.querySelectorAll("[data-pay-occurrence]").forEach((button) => {
    button.addEventListener("click", () => togglePaidOccurrence(button.dataset.payOccurrence));
  });
  el.monthlySummary.querySelector("[data-edit-account-balance]")?.addEventListener("click", openAccountBalanceDialog);
}

function monthlyItems(items, month, kind) {
  if (!items.length) return `<div class="empty-state compact">Nada previsto para este mês.</div>`;
  return items
    .sort((a, b) => ownerRank(a.row.owner) - ownerRank(b.row.owner))
    .map(({ row, value }) => {
    const key = `${row.id}:${month}`;
    const done = kind === "income" ? isIncomeReceived(key) : isOccurrencePaid(key);
    const displayValue = kind === "income" && done ? receivedAmount(key, value) : value;
    const attr = kind === "income" ? `data-receive-income="${key}" data-expected="${value}"` : `data-pay-occurrence="${key}"`;
    const buttonLabel = kind === "income" ? (done ? "Recebido" : "Receber") : (done ? "Pago" : "Pagar");
    const marker = row.creditorId ? creditorLogoHtml(row.creditorId) : `<span class="creditor-logo">${escapeHtml(initials(row.origin || row.label))}</span>`;
    return `
      <article class="monthly-item ${done ? "done" : ""} ${row.owner === "Kah" ? "owner-kah-card" : ""}">
        <div class="entity-cell">
          ${marker}
          <div>
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.origin || "-")}</span>
          </div>
        </div>
        <div class="monthly-item-action">
          <strong class="${kind === "income" ? "positive" : "negative"}">${kind === "income" ? "" : "-"}${currency.format(displayValue)}</strong>
          <button class="small-button ${kind === "expense" ? "pay" : ""}" type="button" ${attr}>${buttonLabel}</button>
        </div>
      </article>
    `;
  }).join("");
}

function accountBalanceCard(value) {
  const tone = value >= 0 ? "positive" : "negative";
  return `
    <button class="metric editable-metric" type="button" data-edit-account-balance>
      <span>Saldo em conta</span>
      <strong class="${tone}">${currency.format(value)}</strong>
      <small>Editar saldo atual</small>
    </button>
  `;
}

function buildProjectionRows(months, keepPaidValues = false) {
  const rows = [];
  state.data.incomeLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "income",
      owner: line.owner || "Felipe",
      creditorId: line.creditorId || "",
      label: line.label,
      origin: line.origin,
      sourceLabel: "",
      values: valuesFromMonthlyMap(line.values, months)
    });
  });
  state.data.recurringIncomes.forEach((income) => {
    rows.push({
      id: income.id,
      kind: "income",
      owner: income.owner || "Felipe",
      label: income.label,
      origin: income.origin,
      sourceLabel: "",
      values: recurringIncomeValues(income, months)
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

function recurringIncomeValues(income, months) {
  const changes = normalizedIncomeChanges(income);
  const values = {};
  months.forEach((month) => {
    const current = [...changes].reverse().find((change) => change.month <= month);
    values[month] = current ? Number(current.amount || 0) : 0;
  });
  return values;
}

function normalizedIncomeChanges(income) {
  const changes = income.changes?.length
    ? income.changes
    : [{ month: income.startMonth || nextMonths(1)[0], amount: Number(income.amount || 0) }];
  return changes
    .map((change) => ({ month: change.month, amount: Number(change.amount || 0) }))
    .filter((change) => change.month)
    .sort((a, b) => a.month.localeCompare(b.month));
}

function latestIncomeChange(income) {
  return normalizedIncomeChanges(income).at(-1) || { month: "", amount: 0 };
}

function upsertIncomeChange(changes, month, amount) {
  const next = normalizedIncomeChanges({ changes }).filter((change) => change.month !== month);
  next.push({ month, amount });
  return next.sort((a, b) => a.month.localeCompare(b.month));
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
      rows.push({
        id: `auto-installments-${group.id}`,
        kind: "expense",
        owner: group.owner,
        creditorId: group.creditorId,
        cardId: group.cardId,
        paymentMethod: "Cartão de crédito",
        label: group.name,
        origin: getCreditorName(group.creditorId),
        sourceLabel: "",
        values: installmentValues
      });
    }
  });

  uniqueFixedCostGroups().forEach((group) => {
    const fixedValues = {};
    months.forEach((month) => {
      fixedValues[month] = fixedTotalForGroup(group.key);
      const key = `auto-fixed-${group.id}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) fixedValues[month] = 0;
    });
    if (Object.values(fixedValues).some(Boolean)) {
      rows.push({
        id: `auto-fixed-${group.id}`,
        kind: "expense",
        owner: group.owner,
        creditorId: group.creditorId,
        cardId: group.cardId,
        paymentMethod: group.paymentMethod,
        label: group.label,
        origin: group.origin,
        sourceLabel: "",
        values: fixedValues
      });
    }
  });

  const creditors = new Set([
    ...state.data.plannedPurchases.map((item) => item.creditorId)
  ].filter(Boolean));
  creditors.forEach((creditorId) => {
    const plannedValues = {};
    months.forEach((month) => {
      plannedValues[month] = plannedTotal(creditorId, month);
      const key = `auto-planned-${creditorId}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) plannedValues[month] = 0;
    });
    const owner = ownerForCreditor(creditorId);
    if (Object.values(plannedValues).some(Boolean)) rows.push({ id: `auto-planned-${creditorId}`, kind: "expense", owner, label: `Compras planejadas (${getCreditorName(creditorId)})`, origin: getCreditorName(creditorId), sourceLabel: "", values: plannedValues });
  });

  const carValues = {};
  months.forEach((month) => {
    carValues[month] = carValueForMonth(month);
    const key = `auto-car:${month}`;
    if (!keepPaidValues && isOccurrencePaid(key)) carValues[month] = 0;
  });
  if (Object.values(carValues).some(Boolean)) rows.push({ id: "auto-car", kind: "expense", owner: "Felipe", creditorId: state.data.car.creditorId, label: state.data.car.name || "Carro", origin: state.data.car.creditorId ? getCreditorName(state.data.car.creditorId) : "Financiamento", sourceLabel: "", values: carValues });
}

function groupKey(item) {
  return getInstallmentCard(item).id;
}

function uniqueGroups(items, keyGetter) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) {
      const card = getInstallmentCard(item);
      groups.set(key, {
        id: key.replaceAll("|", "-").replaceAll(/\s+/g, "-"),
        cardId: card.real ? card.id : "",
        creditorId: card.creditorId,
        owner: card.owner,
        name: card.name,
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
    ...state.data.creditCards,
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
    .filter((item) => item.creditorId === origin && plannedMonth(item) === month)
    .reduce((total, item) => total + Number(item.amount), 0);
}

function carValueForMonth(month) {
  const payment = state.data.car.payments.find((item) => carPaymentMonth(item) === month && item.status !== "Pago");
  return payment ? Number(payment.value) : 0;
}

function plannedMonth(item) {
  return item.date ? String(item.date).slice(0, 7) : item.month;
}

function carPaymentMonth(item) {
  return item.dueDate ? String(item.dueDate).slice(0, 7) : item.month;
}

function uniqueFixedCostGroups() {
  const groups = new Map();
  state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false)
    .forEach((item) => {
      const key = fixedCostGroupKey(item);
      if (!groups.has(key)) groups.set(key, fixedCostGroupInfo(key, item));
    });
  return [...groups.values()].sort((a, b) => a.origin.localeCompare(b.origin, "pt-BR") || a.label.localeCompare(b.label, "pt-BR"));
}

function fixedCostGroupKey(item) {
  if (item.paymentMethod === "Cartão de crédito" && item.cardId) return `card|${item.cardId}`;
  return [item.creditorId || "", item.paymentMethod || "", item.owner || "Felipe"].join("|");
}

function fixedCostGroupInfo(key, item) {
  const card = item.cardId ? getCreditCard(item.cardId) : null;
  const creditorId = card?.creditorId || item.creditorId;
  const owner = card?.owner || item.owner || "Felipe";
  return {
    key,
    id: key.replaceAll("|", "-").replaceAll(/\s+/g, "-"),
    cardId: card?.id || "",
    creditorId,
    owner,
    paymentMethod: item.paymentMethod || "",
    label: card ? `Custo Fixo ${card.name}` : `Custos fixos (${getCreditorName(creditorId)})`,
    origin: card ? getCreditorName(card.creditorId) : getCreditorName(creditorId)
  };
}

function fixedTotalForGroup(key) {
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && fixedCostGroupKey(item) === key)
    .reduce((total, item) => total + Number(item.amount || 0), 0);
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
  let accumulated = Number(state.data.accountBalance || state.data.initialBalance || 0);
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
  const editAction = row.kind === "income" && isPlannedIncome(row.id)
    ? `<button class="icon-button mini-icon row-edit" type="button" title="Editar entrada" data-edit-income-line="${row.id}">${icon("pencil")}</button>`
    : "";
  return `
    <tr class="${sectionClass}">
      <th class="sticky-col">
        <span>${escapeHtml(row.label)}</span>
        ${editAction}
      </th>
      <td>${escapeHtml(row.origin || "-")}</td>
      ${months.map((month) => projectionCell(row, month)).join("")}
    </tr>
  `;
}

function isPlannedIncome(id) {
  return state.data.incomeLines.some((line) => line.id === id);
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
  renderInstallmentSummary();
  renderInstallmentChips();
  const filtered = state.installmentCreditorFilter === "all"
    ? state.data.installments
    : state.data.installments.filter((item) => getInstallmentCard(item).creditorId === state.installmentCreditorFilter);
  el.installmentsTable.innerHTML = filtered.length
    ? filtered.map((item) => {
      const card = getInstallmentCard(item);
      return genericDebtCard({
        id: item.id,
        title: item.item,
        subtitle: `${card.name} · ${getCreditorName(card.creditorId)} · ${card.owner}`,
        creditorId: card.creditorId,
        total: item.totalInstallments,
        paid: item.paidInstallments,
        amount: item.amount,
        purchaseDate: item.purchaseDate,
        filter: state.installmentFilters[item.id] || "open",
        prefix: "installment",
        open: state.expandedInstallments[item.id] === true
      });
    }).join("")
    : `<div class="empty-state">Nenhuma conta parcelada encontrada para este filtro.</div>`;

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

function renderInstallmentSummary() {
  const groups = [
    { label: "Curto prazo", helper: "Até 3 meses", tone: "short", test: (left) => left <= 3 },
    { label: "Médio prazo", helper: "De 4 a 6 meses", tone: "medium", test: (left) => left > 3 && left <= 6 },
    { label: "Longo prazo", helper: "Acima de 6 meses", tone: "long", test: (left) => left > 6 }
  ];
  el.installmentSummary.innerHTML = groups.map((group) => {
    const items = state.data.installments.filter((item) => {
      const left = Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0));
      return left > 0 && group.test(left);
    });
    const total = items.reduce((sum, item) => sum + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
    return `
      <article class="installment-range-card ${group.tone}">
        <h3>${group.label}</h3>
        <span>${group.helper}</span>
        <strong>${currency.format(total)}</strong>
        <small>${items.length} dívida${items.length === 1 ? "" : "s"}</small>
      </article>
    `;
  }).join("");
}

function renderInstallmentChips() {
  const counts = new Map();
  state.data.installments.forEach((item) => {
    const creditorId = getInstallmentCard(item).creditorId;
    if (creditorId) counts.set(creditorId, (counts.get(creditorId) || 0) + 1);
  });
  const chips = [
    { id: "all", label: "Todos", count: state.data.installments.length },
    ...[...counts.entries()]
      .sort((a, b) => getCreditorName(a[0]).localeCompare(getCreditorName(b[0]), "pt-BR"))
      .map(([id, count]) => ({ id, label: getCreditorName(id), count }))
  ];
  el.installmentFilters.innerHTML = chips.map((chip) => `
    <button class="filter-chip ${state.installmentCreditorFilter === chip.id ? "active" : ""}" type="button" data-installment-creditor="${chip.id}">
      ${chip.id === "all" ? `<i class="all-chip-dot"></i>` : creditorLogoHtml(chip.id)}
      <strong>${escapeHtml(chip.label)}</strong>
      <span>${chip.count}</span>
    </button>
  `).join("");
  el.installmentFilters.querySelectorAll("[data-installment-creditor]").forEach((button) => {
    button.addEventListener("click", () => {
      state.installmentCreditorFilter = button.dataset.installmentCreditor;
      renderInstallments();
      refreshIcons();
    });
  });
}

function renderFixedCosts() {
  const fixedCosts = [...state.data.fixedCosts].sort((a, b) => {
    const creditorSort = getCreditorName(a.creditorId).localeCompare(getCreditorName(b.creditorId), "pt-BR");
    return creditorSort || Number(a.dueDay || 0) - Number(b.dueDay || 0);
  });
  el.fixedCostsTable.innerHTML = `
    <thead><tr><th>Custo</th><th>Credor</th><th>Método</th><th>Grupo</th><th>Venc.</th><th>Valor</th><th>Ações</th></tr></thead>
    <tbody>
      ${fixedCosts.map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${creditorLogoHtml(item.creditorId)}${escapeHtml(getCreditorName(item.creditorId))}</td>
          <td>${escapeHtml(item.paymentMethod || "-")}</td>
          <td>${escapeHtml(item.group || "-")}</td>
          <td>${item.dueDay}</td>
          <td>${currency.format(item.amount)}</td>
          <td class="row-actions">
            <button class="icon-button mini-icon" type="button" title="Editar" data-edit-fixed="${item.id}">${icon("pencil")}</button>
            <button class="icon-button mini-icon danger-mini" type="button" title="Excluir" data-delete-fixed="${item.id}">${icon("trash-2")}</button>
          </td>
        </tr>
      `).join("") || `<tr><td colspan="7" class="muted-cell">Nenhum custo fixo cadastrado.</td></tr>`}
    </tbody>
  `;

  el.fixedCostsTable.querySelectorAll("[data-edit-fixed]").forEach((button) => {
    button.addEventListener("click", () => openFixedCostDialog(button.dataset.editFixed));
  });
  el.fixedCostsTable.querySelectorAll("[data-delete-fixed]").forEach((button) => {
    button.addEventListener("click", () => deleteFixedCost(button.dataset.deleteFixed));
  });
}

function renderCar() {
  const car = state.data.car;
  el.carTitle.textContent = car.name || "Carro";

  const paid = car.payments.filter((item) => item.status === "Pago");
  const pending = car.payments.filter((item) => item.status !== "Pago");
  const financing = Number(car.monthly || 0) * Number(car.totalInstallments || 0);
  const paidValue = paid.reduce((total, item) => total + Number(item.paidAmount || 0), 0);
  const pendingValue = pending.reduce((total, item) => total + Number(item.value), 0);
  const economy = paid.reduce((total, item) => total + carInstallmentEconomy(item), 0);
  const realProjected = paidValue + pendingValue;
  const creditor = car.creditorId ? getCreditorName(car.creditorId) : "sem credor";

  el.carKpis.innerHTML = [
    metric("Credor", creditor, "neutral", false),
    metric("Valor financiado", Number(car.financed || 0), "neutral"),
    metric("Valor de compra", Number(car.purchase || 0), "neutral"),
    metric("Financiamento", financing, "negative"),
    metric("Real projetado", realProjected, "neutral"),
    metric("Valor pago", paidValue, "positive"),
    metric("Faltam", `${pending.length} parcelas`, "negative", false),
    metric("Falta pagar", -pendingValue, "negative"),
    metric("Economia", economy, economy > 0 ? "positive" : economy < 0 ? "negative" : "neutral")
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
  el.carTable.querySelectorAll("[data-unpay-car]").forEach((button) => {
    button.addEventListener("click", () => unpayCarInstallment(button.dataset.unpayCar));
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
  el.creditorList.innerHTML = sortedCreditors().map((creditor) => `
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
  el.fgtsTable.querySelectorAll("[data-edit-fgts]").forEach((button) => {
    button.addEventListener("click", () => openFgtsDialog(button.dataset.editFgts));
  });
  el.fgtsTable.querySelectorAll("[data-delete-fgts]").forEach((button) => {
    button.addEventListener("click", () => deleteFgtsContract(button.dataset.deleteFgts));
  });
  el.fgtsTable.querySelectorAll("[data-fgts-quit]").forEach((form) => {
    form.addEventListener("submit", quitFgtsContract);
  });
}

function renderOriginsV2() {
  el.creditorList.innerHTML = `
    <thead><tr><th>Credor</th><th>Formas</th><th>Vínculos</th><th>Ações</th></tr></thead>
    <tbody>
      ${sortedCreditors().map((creditor) => {
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

function renderCreditCards() {
  el.cardList.innerHTML = `
    <thead><tr><th>Cartão/Crediário</th><th>Credor</th><th>Dono</th><th>Saldo previsto</th><th>Ações</th></tr></thead>
    <tbody>
      ${sortedCreditCards().map((card) => {
        const inUse = isCreditCardInUse(card.id);
        return `
          <tr>
            <td>
              <div class="entity-cell">
                ${creditorLogoHtml(card.creditorId)}
                <strong>${escapeHtml(card.name)}</strong>
              </div>
            </td>
            <td>${escapeHtml(getCreditorName(card.creditorId))}</td>
            <td>${escapeHtml(card.owner || "Felipe")}</td>
            <td>${currency.format(cardOpenBalance(card.id))}</td>
            <td class="row-actions">
              <button class="icon-button mini-icon" type="button" title="Editar" data-edit-card="${card.id}">${icon("pencil")}</button>
              <button class="icon-button mini-icon danger-mini" type="button" title="${inUse ? "Cartão vinculado" : "Excluir"}" data-delete-card="${card.id}">${icon(inUse ? "ban" : "trash-2")}</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="5" class="muted-cell">Nenhum cartão ou crediário cadastrado.</td></tr>`}
    </tbody>
  `;

  el.cardList.querySelectorAll("[data-edit-card]").forEach((button) => {
    button.addEventListener("click", () => openCardDialog(button.dataset.editCard));
  });
  el.cardList.querySelectorAll("[data-delete-card]").forEach((button) => {
    button.addEventListener("click", () => deleteCreditCard(button.dataset.deleteCard));
  });
}

function renderRecurringIncomes() {
  el.incomeList.innerHTML = `
    <thead><tr><th>Renda</th><th>Fonte</th><th>Dono</th><th>Valor atual</th><th>Vale desde</th><th>Ações</th></tr></thead>
    <tbody>
      ${state.data.recurringIncomes.map((income) => {
        const current = latestIncomeChange(income);
        return `
          <tr>
            <td>${escapeHtml(income.label)}</td>
            <td>${escapeHtml(income.origin || "-")}</td>
            <td>${escapeHtml(income.owner || "Felipe")}</td>
            <td>${currency.format(current.amount || 0)}</td>
            <td>${current.month ? formatMonth(current.month) : "-"}</td>
            <td class="row-actions">
              <button class="small-button" type="button" data-edit-income="${income.id}">Editar/Reajustar</button>
              <button class="small-button danger-mini" type="button" data-delete-income="${income.id}">Excluir</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="6" class="muted-cell">Nenhuma renda recorrente cadastrada.</td></tr>`}
    </tbody>
  `;

  el.incomeList.querySelectorAll("[data-edit-income]").forEach((button) => {
    button.addEventListener("click", () => openIncomeDialog(button.dataset.editIncome));
  });
  el.incomeList.querySelectorAll("[data-delete-income]").forEach((button) => {
    button.addEventListener("click", () => deleteRecurringIncome(button.dataset.deleteIncome));
  });
}

function hydrateForms() {
  document.querySelectorAll("[data-creditor-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = sortedCreditors().map((creditor) => `<option value="${creditor.id}">${escapeHtml(creditor.name)}</option>`).join("");
    if (current) select.value = current;
  });
  document.querySelectorAll("[data-card-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = sortedCreditCards().map((card) => `<option value="${card.id}">${escapeHtml(card.name)} · ${escapeHtml(getCreditorName(card.creditorId))} · ${escapeHtml(card.owner || "Felipe")}</option>`).join("");
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
  if (el.plannedForm.elements.date && !el.plannedForm.elements.date.value) el.plannedForm.elements.date.value = `${start}-01`;
  if (el.incomeForm.elements.month && !el.incomeForm.elements.month.value) el.incomeForm.elements.month.value = start;
}

async function addInstallment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const card = getCreditCard(String(form.get("cardId")));
  if (!card) {
    showToast("Cadastre e selecione um cartão/crediário.");
    return;
  }
  const item = {
    id: crypto.randomUUID(),
    item: String(form.get("item")).trim(),
    cardId: card.id,
    creditorId: card.creditorId,
    amount: parseCurrencyInput(form.get("amount")),
    totalInstallments: Number(form.get("total")),
    paidInstallments: Number(form.get("paid") || 0),
    purchaseDate: String(form.get("date") || ""),
    owner: card.owner || "Felipe",
    paymentMethod: "Cartão de crédito",
    active: true
  };
  const editing = Boolean(state.installmentEditingId);
  if (editing) {
    const current = state.data.installments.find((entry) => entry.id === state.installmentEditingId);
    if (current) {
      Object.assign(current, item, { id: current.id });
    } else {
      state.data.installments.push(item);
    }
  } else {
    state.data.installments.push(item);
  }
  closeInstallmentDialog();
  event.currentTarget.reset();
  await saveState(editing ? "Parcelamento atualizado." : "Parcelamento cadastrado.");
}

function openInstallmentDialog(id = null) {
  hydrateForms();
  state.installmentEditingId = id;
  const item = id ? state.data.installments.find((entry) => entry.id === id) : null;
  if (item) item.item = item.item || item.name || item.description || "Parcelamento";
  const card = item ? getInstallmentCard(item) : null;
  el.installmentDialogTitle.textContent = item ? "Editar parcelamento" : "Novo parcelamento";
  el.installmentForm.elements.item.value = item?.item || "";
  if (card?.real) el.installmentForm.elements.cardId.value = card.id;
  el.installmentForm.elements.amount.value = item?.amount ? formatCurrencyInput(item.amount) : "";
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

function openFixedCostDialog(id = null) {
  hydrateForms();
  state.fixedCostEditingId = id;
  el.fixedCostForm.reset();
  const item = id ? state.data.fixedCosts.find((entry) => entry.id === id) : null;
  el.fixedCostDialogTitle.textContent = item ? "Editar custo fixo" : "Novo custo fixo";
  if (item) {
    el.fixedCostForm.elements.name.value = item.name || "";
    el.fixedCostForm.elements.paymentMethod.value = item.paymentMethod || "PIX";
    el.fixedCostForm.elements.cardId.value = item.cardId || "";
    el.fixedCostForm.elements.creditorId.value = item.creditorId || "";
    el.fixedCostForm.elements.owner.value = item.owner || "Felipe";
    el.fixedCostForm.elements.group.value = item.group || "";
    el.fixedCostForm.elements.dueDay.value = item.dueDay || "";
    el.fixedCostForm.elements.amount.value = item.amount ? formatCurrencyInput(item.amount) : "";
  }
  updateFixedCostFields();
  el.fixedCostDialog.showModal();
}

function closeFixedCostDialog() {
  state.fixedCostEditingId = null;
  el.fixedCostForm.reset();
  el.fixedCostDialog.close();
}

function updateFixedCostFields() {
  const isCard = el.fixedCostForm.elements.paymentMethod.value === "Cartão de crédito";
  el.fixedCardField.hidden = !isCard;
  el.fixedCreditorField.hidden = isCard;
  el.fixedOwnerField.hidden = isCard;
  el.fixedCostForm.elements.cardId.required = isCard;
  el.fixedCostForm.elements.creditorId.required = !isCard;
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
  const paymentMethod = String(form.get("paymentMethod"));
  const card = paymentMethod === "Cartão de crédito" ? getCreditCard(String(form.get("cardId"))) : null;
  const creditorId = card?.creditorId || String(form.get("creditorId") || "");
  if (!creditorId) {
    showToast("Cadastre e selecione um credor.");
    return;
  }
  const item = {
    id: state.fixedCostEditingId || crypto.randomUUID(),
    name: String(form.get("name")).trim(),
    creditorId,
    cardId: card?.id || "",
    paymentMethod,
    owner: card?.owner || String(form.get("owner") || "Felipe"),
    group: String(form.get("group") || "").trim(),
    dueDay: Number(form.get("dueDay")),
    amount: parseCurrencyInput(form.get("amount")),
    includeInProjection: true
  };
  const editing = Boolean(state.fixedCostEditingId);
  if (editing) {
    const current = state.data.fixedCosts.find((entry) => entry.id === state.fixedCostEditingId);
    if (current) Object.assign(current, item, { id: current.id });
  } else {
    state.data.fixedCosts.push(item);
  }
  closeFixedCostDialog();
  await saveState(editing ? "Custo fixo atualizado." : "Custo fixo cadastrado.");
}

async function deleteFixedCost(id) {
  state.data.fixedCosts = state.data.fixedCosts.filter((item) => item.id !== id);
  await saveState("Custo fixo excluído.");
}

async function updateCar(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.car.name = String(form.get("name")).trim();
  state.data.car.creditorId = String(form.get("creditorId") || "");
  state.data.car.financed = parseCurrencyInput(form.get("financed"));
  state.data.car.purchase = parseCurrencyInput(form.get("purchase"));
  state.data.car.monthly = parseCurrencyInput(form.get("monthly"));
  state.data.car.totalInstallments = Number(form.get("totalInstallments") || state.data.car.totalInstallments);
  state.data.car.firstDueDate = String(form.get("firstDueDate") || "");
  syncCarPayments();
  el.carContractDialog.close();
  await saveState("Cadastro do carro atualizado.");
}

function openCarContractDialog() {
  const car = state.data.car;
  el.carForm.elements.name.value = car.name || "";
  el.carForm.elements.creditorId.value = car.creditorId || el.carForm.elements.creditorId.value;
  el.carForm.elements.financed.value = formatCurrencyInput(car.financed || "");
  el.carForm.elements.purchase.value = formatCurrencyInput(car.purchase || "");
  el.carForm.elements.monthly.value = formatCurrencyInput(car.monthly || "");
  el.carForm.elements.totalInstallments.value = car.totalInstallments || "";
  el.carForm.elements.firstDueDate.value = car.firstDueDate || car.payments?.[0]?.dueDate || "";
  el.carContractDialog.showModal();
}

function syncCarPayments() {
  const car = state.data.car;
  const total = Number(car.totalInstallments || 0);
  if (!total || !car.monthly) {
    car.payments = [];
    return;
  }
  const existing = new Map((car.payments || []).map((payment) => [Number(payment.number), payment]));
  const firstDueDate = car.firstDueDate || `${nextMonths(1)[0]}-01`;
  car.payments = Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const current = existing.get(number);
    const dueDate = addMonthsToDate(firstDueDate, index);
    const month = dueDate.slice(0, 7);
    if (current?.status === "Pago") return { ...current, number, dueDate, month };
    return {
      id: current?.id || crypto.randomUUID(),
      number,
      dueDate,
      month,
      value: car.monthly,
      paidAmount: 0,
      status: "Pendente"
    };
  });
}

async function updateSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.kahLimit = parseCurrencyInput(form.get("kahLimit"));
  await saveState("Preferências salvas.");
}

function openCarPaymentDialog(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  el.carPaymentTitle.textContent = `Parcela ${payment.number}/${state.data.car.payments.length}`;
  el.carPaymentForm.elements.paymentId.value = payment.id;
  el.carPaymentForm.elements.paidAmount.value = formatCurrencyInput(payment.paidAmount || payment.value || "");
  el.carPaymentForm.elements.paymentDate.value = payment.paymentDate || todayIsoDate();
  el.carPaymentDialog.showModal();
}

async function payCarInstallment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payment = state.data.car.payments.find((item) => item.id === String(form.get("paymentId")));
  if (!payment) return;
  payment.status = "Pago";
  payment.paidAmount = parseCurrencyInput(form.get("paidAmount")) || Number(payment.value || 0);
  payment.paymentDate = String(form.get("paymentDate") || todayIsoDate());
  el.carPaymentDialog.close();
  await saveState("Parcela do carro paga.");
}

async function unpayCarInstallment(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  payment.status = "Pendente";
  payment.paidAmount = 0;
  payment.paymentDate = "";
  await saveState("Pagamento do carro removido.");
}

function openFgtsDialog(id = null) {
  hydrateForms();
  state.fgtsEditingId = id;
  el.fgtsForm.reset();
  const contract = id ? state.data.fgts.contracts.find((item) => item.id === id) : null;
  if (contract) {
    normalizeFgtsContract(contract);
    el.fgtsDialogTitle.textContent = "Editar contrato FGTS";
    el.fgtsForm.elements.description.value = contract.description || "";
    el.fgtsForm.elements.creditorId.value = contract.creditorId || el.fgtsForm.elements.creditorId.value;
    el.fgtsForm.elements.contract.value = contract.contract || "";
    el.fgtsForm.elements.received.value = formatCurrencyInput(contract.received || "");
    el.fgtsForm.elements.installmentAmount.value = formatCurrencyInput(contract.installmentAmount || "");
    el.fgtsForm.elements.totalInstallments.value = contract.totalInstallments || contract.installments.length || "";
    el.fgtsForm.elements.paidInstallments.value = contract.paidInstallments || 0;
    el.fgtsForm.elements.firstDueDate.value = contract.firstDueDate || contract.installments[0]?.dueDate || "";
    el.fgtsForm.elements.settlementAmount.value = formatCurrencyInput(contract.settlementAmount || "");
  } else {
    el.fgtsDialogTitle.textContent = "Novo contrato FGTS";
  }
  renderFgtsInstallmentValueFields();
  if (contract) {
    contract.installments.forEach((installment) => {
      const field = el.fgtsForm.elements[`installmentValue${installment.number}`];
      if (field) field.value = formatCurrencyInput(installment.amount || "");
    });
  }
  el.fgtsDialog.showModal();
  refreshIcons();
}

function closeFgtsDialog() {
  state.fgtsEditingId = null;
  el.fgtsForm.reset();
  renderFgtsInstallmentValueFields();
  el.fgtsDialog.close();
}

function renderFgtsInstallmentValueFields() {
  const total = Math.min(60, Number(el.fgtsForm.elements.totalInstallments.value || 0));
  if (!total) {
    el.fgtsInstallmentValues.innerHTML = "";
    return;
  }
  const defaultValue = parseCurrencyInput(el.fgtsForm.elements.installmentAmount.value);
  const firstDueDate = el.fgtsForm.elements.firstDueDate.value || nextAnnualDate();
  const currentValues = new FormData(el.fgtsForm);
  el.fgtsInstallmentValues.innerHTML = `
    <div>
      <p class="eyebrow">Parcelas FGTS</p>
      <div class="installment-values-grid">
        ${Array.from({ length: total }, (_, index) => {
          const number = index + 1;
          const value = currentValues.get(`installmentValue${number}`) || (defaultValue ? formatCurrencyInput(defaultValue) : "");
          const dueDate = addYearsToDate(firstDueDate, index);
          return `
            <label class="money-label">Parcela ${number} · ${formatDate(dueDate)}
              <input name="installmentValue${number}" type="text" inputmode="decimal" data-money-input value="${escapeHtml(value)}">
            </label>
          `;
        }).join("")}
      </div>
    </div>
  `;
  bindMoneyInputs(el.fgtsInstallmentValues);
}

function getFgtsInstallmentValues(form, total) {
  const defaultValue = parseCurrencyInput(form.get("installmentAmount"));
  return Array.from({ length: total }, (_, index) => {
    const value = parseCurrencyInput(form.get(`installmentValue${index + 1}`));
    return value || defaultValue;
  });
}

async function addFgtsContract(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const totalInstallments = Number(form.get("totalInstallments") || 1);
  if (!form.get("creditorId")) {
    showToast("Cadastre e selecione um credor para o FGTS.");
    return;
  }
  const installmentValues = getFgtsInstallmentValues(form, totalInstallments);
  const installmentAmount = installmentValues[0] || parseCurrencyInput(form.get("installmentAmount"));
  const paidInstallments = Math.min(Number(form.get("paidInstallments") || 0), totalInstallments);
  const firstDueDate = String(form.get("firstDueDate") || "");
  const existing = state.fgtsEditingId
    ? state.data.fgts.contracts.find((item) => item.id === state.fgtsEditingId)
    : null;
  const next = {
    id: existing?.id || crypto.randomUUID(),
    description: String(form.get("description")).trim(),
    creditorId: String(form.get("creditorId")),
    contract: String(form.get("contract") || "").trim(),
    createdAt: existing?.createdAt || todayIsoDate(),
    received: parseCurrencyInput(form.get("received")),
    toPay: installmentValues.slice(paidInstallments).reduce((total, value) => total + value, 0),
    installmentAmount,
    totalInstallments,
    paidInstallments,
    firstDueDate,
    settlementAmount: parseCurrencyInput(form.get("settlementAmount")),
    status: existing?.status || "Ativo",
    annualPayments: existing?.annualPayments || [],
    installments: mergeFgtsInstallments(existing?.installments || [], totalInstallments, installmentValues, paidInstallments, firstDueDate)
  };
  next.paidInstallments = next.installments.filter((item) => item.status === "Pago").length;
  next.toPay = fgtsPendingTotal(next);
  if (existing) {
    Object.assign(existing, next);
  } else {
    state.data.fgts.contracts.push(next);
  }
  event.currentTarget.reset();
  renderFgtsInstallmentValueFields();
  state.fgtsEditingId = null;
  el.fgtsDialog.close();
  await saveState(existing ? "Empréstimo FGTS atualizado." : "Empréstimo FGTS cadastrado.");
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
  contract.quitAmount = parseCurrencyInput(form.get("amount"));
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

async function deleteFgtsContract(id) {
  state.data.fgts.contracts = state.data.fgts.contracts.filter((item) => item.id !== id);
  await saveState("Empréstimo FGTS excluído.");
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
    paymentForms: form.getAll("paymentForms").map(String).filter(Boolean),
    logoUrl: String(form.get("logoUrl") || "")
  };
  if (!payload.paymentForms.length) payload.paymentForms = ["Cartão de crédito"];
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
    input.checked = creditor ? forms.includes(input.value) : input.value === "Cartão de crédito";
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

function openCardDialog(id = null) {
  hydrateForms();
  state.cardEditingId = id;
  el.cardForm.reset();
  const card = id ? getCreditCard(id) : null;
  el.cardDialogTitle.textContent = card ? "Editar cartão/crediário" : "Novo cartão/crediário";
  el.cardForm.elements.name.value = card?.name || "";
  el.cardForm.elements.creditorId.value = card?.creditorId || el.cardForm.elements.creditorId.value;
  el.cardForm.elements.owner.value = card?.owner || "Felipe";
  updateCardLogoPreview();
  el.cardDialog.showModal();
  refreshIcons();
}

function closeCardDialog() {
  state.cardEditingId = null;
  el.cardForm.reset();
  renderCardLogoPreview("");
  el.cardDialog.close();
}

async function saveCreditCard(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const creditorId = String(form.get("creditorId") || "");
  if (!creditorId) {
    showToast("Cadastre e selecione um credor primeiro.");
    return;
  }
  const name = String(form.get("name")).trim();
  if (!name) return;
  const existing = state.cardEditingId
    ? state.data.creditCards.find((card) => card.id === state.cardEditingId)
    : null;
  const payload = {
    id: existing?.id || crypto.randomUUID(),
    name,
    creditorId,
    owner: String(form.get("owner") || "Felipe")
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.data.creditCards.push(payload);
  }
  closeCardDialog();
  await saveState(existing ? "Cartão/crediário atualizado." : "Cartão/crediário cadastrado.");
}

async function deleteCreditCard(id) {
  if (isCreditCardInUse(id)) {
    showToast("Este cartão/crediário está vinculado a parcelamentos.");
    return;
  }
  state.data.creditCards = state.data.creditCards.filter((card) => card.id !== id);
  await saveState("Cartão/crediário excluído.");
}

function updateCardLogoPreview() {
  renderCardLogoPreview(el.cardForm.elements.creditorId.value);
}

function renderCardLogoPreview(creditorId) {
  const creditor = getCreditor(creditorId);
  el.cardLogoPreview.innerHTML = creditor?.logoUrl
    ? `<img alt="${escapeHtml(creditor.name)}" src="${escapeHtml(creditor.logoUrl)}">`
    : escapeHtml(initials(creditor?.name || "CC"));
}

function openIncomeDialog(id = null) {
  hydrateForms();
  state.incomeEditingId = id;
  el.incomeForm.reset();
  const income = id ? state.data.recurringIncomes.find((item) => item.id === id) : null;
  const current = income ? latestIncomeChange(income) : { month: nextMonths(1)[0], amount: 0 };
  el.incomeDialogTitle.textContent = income ? "Editar/Reajustar renda" : "Nova renda";
  el.incomeForm.elements.label.value = income?.label || "";
  el.incomeForm.elements.origin.value = income?.origin || "";
  el.incomeForm.elements.owner.value = income?.owner || "Felipe";
  el.incomeForm.elements.month.value = current.month || nextMonths(1)[0];
  el.incomeForm.elements.amount.value = current.amount ? formatCurrencyInput(current.amount) : "";
  el.incomeDialog.showModal();
  refreshIcons();
}

function closeIncomeDialog() {
  state.incomeEditingId = null;
  el.incomeForm.reset();
  el.incomeDialog.close();
}

async function saveRecurringIncome(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const month = String(form.get("month"));
  const amount = parseCurrencyInput(form.get("amount"));
  const existing = state.incomeEditingId
    ? state.data.recurringIncomes.find((item) => item.id === state.incomeEditingId)
    : null;
  if (existing) {
    existing.label = String(form.get("label")).trim();
    existing.origin = String(form.get("origin")).trim();
    existing.owner = String(form.get("owner") || "Felipe");
    existing.changes = upsertIncomeChange(existing.changes || [], month, amount);
  } else {
    state.data.recurringIncomes.push({
      id: crypto.randomUUID(),
      label: String(form.get("label")).trim(),
      origin: String(form.get("origin")).trim(),
      owner: String(form.get("owner") || "Felipe"),
      changes: [{ month, amount }]
    });
  }
  closeIncomeDialog();
  await saveState(existing ? "Renda recorrente atualizada." : "Renda recorrente cadastrada.");
}

async function deleteRecurringIncome(id) {
  state.data.recurringIncomes = state.data.recurringIncomes.filter((item) => item.id !== id);
  await saveState("Renda recorrente excluída.");
}

function isCreditorInUse(id) {
  return state.data.creditCards.some((card) => card.creditorId === id)
    || state.data.installments.some((item) => item.creditorId === id)
    || state.data.fixedCosts.some((item) => item.creditorId === id)
    || state.data.plannedPurchases.some((item) => item.creditorId === id)
    || state.data.fgts.contracts.some((item) => item.creditorId === id)
    || state.data.car.creditorId === id
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

function openPlannedDialog(id = null, kind = null) {
  hydrateForms();
  state.plannedEditingId = id;
  state.plannedEditingKind = kind;
  el.plannedForm.reset();
  const income = kind === "income" && id ? state.data.incomeLines.find((item) => item.id === id) : null;
  const expense = kind === "expense" && id ? state.data.plannedPurchases.find((item) => item.id === id) : null;
  const item = income || expense;
  el.plannedForm.querySelector("button[type='submit']").textContent = item ? "Salvar lançamento" : "Adicionar ao planejamento";
  el.plannedForm.elements.kind.value = income ? "income" : "expense";
  el.plannedForm.elements.description.value = income?.label || expense?.description || "";
  el.plannedForm.elements.creditorId.value = expense?.creditorId || el.plannedForm.elements.creditorId.value;
  el.plannedForm.elements.sourceCreditorId.value = income?.creditorId || el.plannedForm.elements.sourceCreditorId.value;
  el.plannedForm.elements.date.value = item?.date || todayIsoDate();
  el.plannedForm.elements.installments.value = expense?.installments || 1;
  el.plannedForm.elements.owner.value = item?.owner || "Felipe";
  const amount = income ? Object.values(income.values || {})[0] : expense?.amount;
  el.plannedForm.elements.amount.value = amount ? formatCurrencyInput(amount) : "";
  updatePlannedFields();
  el.plannedDialog.showModal();
}

function closePlannedDialog() {
  state.plannedEditingId = null;
  state.plannedEditingKind = null;
  el.plannedForm.elements.kind.disabled = false;
  el.plannedForm.reset();
  el.plannedDialog.close();
}

function updatePlannedFields() {
  const isIncome = el.plannedForm.elements.kind.value === "income";
  el.plannedCredorField.hidden = isIncome;
  el.plannedFonteField.hidden = !isIncome;
  el.plannedForm.elements.creditorId.required = !isIncome;
  el.plannedForm.elements.sourceCreditorId.required = isIncome;
  el.plannedForm.elements.kind.disabled = Boolean(state.plannedEditingId);
}

async function addPlannedPurchase(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const kind = state.plannedEditingKind || String(form.get("kind") || "expense");
  const date = String(form.get("date"));
  const month = date.slice(0, 7);
  const amount = parseCurrencyInput(form.get("amount"));
  const installments = Math.max(1, Number(form.get("installments") || 1));
  if (kind === "income") {
    const creditorId = String(form.get("sourceCreditorId") || "");
    const existing = state.plannedEditingKind === "income" && state.plannedEditingId
      ? state.data.incomeLines.find((item) => item.id === state.plannedEditingId)
      : null;
    const item = {
      id: existing?.id || crypto.randomUUID(),
      label: String(form.get("description")).trim(),
      origin: getCreditorName(creditorId),
      creditorId,
      owner: String(form.get("owner") || "Felipe"),
      date,
      values: { [month]: amount }
    };
    if (existing) Object.assign(existing, item);
    else state.data.incomeLines.push(item);
  } else {
    const existing = state.plannedEditingKind === "expense" && state.plannedEditingId
      ? state.data.plannedPurchases.find((item) => item.id === state.plannedEditingId)
      : null;
    const item = {
      id: existing?.id || crypto.randomUUID(),
      description: String(form.get("description")).trim(),
      creditorId: String(form.get("creditorId")),
      month,
      date,
      installments,
      amount,
      owner: String(form.get("owner") || "Felipe")
    };
    if (existing) Object.assign(existing, item);
    else state.data.plannedPurchases.push(item);
  }
  const editing = Boolean(state.plannedEditingId);
  closePlannedDialog();
  await saveState(editing ? "Lançamento planejado atualizado." : "Lançamento planejado adicionado.");
}

async function togglePaidOccurrence(key) {
  const paid = state.data.paidOccurrences || [];
  if (paid.includes(key)) {
    state.data.paidOccurrences = paid.filter((item) => item !== key);
    syncExpenseSource(key, false);
    await saveState("Ocorrência reaberta.");
  } else {
    state.data.paidOccurrences = [...paid, key];
    syncExpenseSource(key, true);
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

function syncExpenseSource(key, paid) {
  const [rowId, month] = key.split(":");
  if (rowId === "auto-car") {
    const payment = state.data.car.payments.find((item) => carPaymentMonth(item) === month);
    if (payment) {
      payment.status = paid ? "Pago" : "Pendente";
      payment.paidAmount = paid ? Number(payment.value || 0) : 0;
      payment.paymentDate = paid ? todayIsoDate() : "";
    }
  }
  if (rowId.startsWith("auto-installments-")) {
    const groupId = rowId.replace("auto-installments-", "");
    const group = uniqueGroups(state.data.installments, (item) => groupKey(item)).find((item) => item.id === groupId);
    if (group) {
      state.data.installments
        .filter((item) => groupKey(item) === group.key)
        .forEach((item) => {
          const nextPaid = paid
            ? Math.min(Number(item.totalInstallments || 0), Number(item.paidInstallments || 0) + 1)
            : Math.max(0, Number(item.paidInstallments || 0) - 1);
          item.paidInstallments = nextPaid;
        });
    }
  }
}

async function closeMonth() {
  const month = nextMonths(1)[0];
  const rows = buildProjectionRows([month], true);
  const entries = rows.filter((row) => row.kind === "income" && (row.values[month] || 0) > 0);
  const exits = rows.filter((row) => row.kind === "expense" && ((row.values[month] || 0) > 0 || isOccurrencePaid(`${row.id}:${month}`)));
  const hasPending = entries.some((row) => !isIncomeReceived(`${row.id}:${month}`))
    || exits.some((row) => !isOccurrencePaid(`${row.id}:${month}`));
  if (hasPending) {
    showToast("Baixe todas as entradas e saídas antes de fechar.");
    return;
  }
  if (!window.confirm(`Fechar ${formatMonthLong(month)} e levar o saldo atual para o próximo mês?`)) return;
  const received = entries.reduce((total, row) => total + receivedAmount(`${row.id}:${month}`, row.values[month] || 0), 0);
  const paid = exits.reduce((total, row) => total + Number(row.values[month] || 0), 0);
  state.data.accountBalance = Number(state.data.accountBalance || state.data.initialBalance || 0) + received - paid;
  state.data.initialBalance = state.data.accountBalance;
  state.data.closedMonths = [...new Set([...(state.data.closedMonths || []), month])];
  await saveState("Mês fechado e saldo levado para o próximo cálculo.");
}

function openAccountBalanceDialog() {
  el.accountBalanceForm.elements.accountBalance.value = formatCurrencyInput(state.data.accountBalance || state.data.initialBalance || "");
  el.accountBalanceDialog.showModal();
}

async function saveAccountBalance(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.accountBalance = parseCurrencyInput(form.get("accountBalance"));
  state.data.initialBalance = state.data.accountBalance;
  el.accountBalanceDialog.close();
  await saveState("Saldo em conta atualizado.");
}

function isIncomeReceived(key) {
  return (state.data.receivedOccurrences || []).includes(key);
}

function receivedAmount(key, fallback) {
  return Number(state.data.receivedAmounts?.[key] ?? fallback ?? 0);
}

function openReceiveDialog(key, expected) {
  const [rowId] = key.split(":");
  const row = buildProjectionRows(nextMonths(1), true).find((item) => item.id === rowId);
  el.receiveTitle.textContent = row?.label || "Confirmar entrada";
  el.receiveForm.elements.key.value = key;
  el.receiveForm.elements.amount.value = formatCurrencyInput(receivedAmount(key, Number(expected || 0)));
  el.receiveDialog.showModal();
}

async function confirmReceivedOccurrence(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const key = String(form.get("key"));
  state.data.receivedOccurrences = [...new Set([...(state.data.receivedOccurrences || []), key])];
  state.data.receivedAmounts = { ...(state.data.receivedAmounts || {}), [key]: parseCurrencyInput(form.get("amount")) };
  el.receiveDialog.close();
  await saveState("Entrada recebida.");
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

function buildCardsFromInstallments(installments, creditors, creditorByName) {
  const cards = new Map();
  installments.forEach((item) => {
    const creditorId = item.creditorId || creditorByName.get(item.origin) || item.origin || "";
    if (!creditorId) return;
    const owner = item.owner || "Felipe";
    const paymentMethod = item.paymentMethod || "Cartão de crédito";
    const key = `${creditorId}|${owner}|${paymentMethod}`;
    if (cards.has(key)) return;
    cards.set(key, {
      id: `card-${key.replaceAll("|", "-").replaceAll(/\s+/g, "-")}`,
      name: `${getCreditorNameFromList(creditorId, creditors)} ${owner}`.trim(),
      creditorId,
      owner,
      paymentMethod
    });
  });
  return [...cards.values()];
}

function getCreditorNameFromList(id, creditors) {
  return creditors.find((creditor) => creditor.id === id)?.name || id || "Credor";
}

function normalizeData(data) {
  const defaults = createDefaultData();
  if (!data || Number(data.schemaVersion || 0) < 3) return defaults;
  const creditors = (data.creditors || defaults.creditors).map((creditor) => ({
    ...creditor,
    paymentForms: creditor.paymentForms || [creditor.type].filter(Boolean)
  }));
  const creditorByName = new Map(creditors.map((creditor) => [creditor.name, creditor.id]));
  const rawInstallments = data.installments || [];
  const creditCards = (data.creditCards?.length ? data.creditCards : buildCardsFromInstallments(rawInstallments, creditors, creditorByName))
    .map((card) => ({
      ...card,
      name: card.name || getCreditorNameFromList(card.creditorId, creditors),
      creditorId: card.creditorId || creditorByName.get(card.creditor) || card.creditor || "",
      owner: card.owner || "Felipe"
    }));
  const cardByLegacyKey = new Map(creditCards.map((card) => [`${card.creditorId}|${card.owner || "Felipe"}|${card.paymentMethod || "Cartão de crédito"}`, card.id]));
  const normalized = {
    ...defaults,
    ...data,
    creditors,
    creditCards,
    paymentMethods: data.paymentMethods || defaults.paymentMethods,
    incomeLines: data.incomeLines || defaults.incomeLines,
    recurringIncomes: (data.recurringIncomes || defaults.recurringIncomes).map((income) => ({
      ...income,
      owner: income.owner || "Felipe",
      changes: normalizedIncomeChanges(income)
    })),
    projectionLines: (data.projectionLines || defaults.projectionLines).map((line) => ({
      ...line,
      match: creditorByName.get(line.match) || line.match,
      creditorId: line.creditorId || creditorByName.get(line.origin) || null
    })),
    installments: rawInstallments.map((item) => {
      const creditorId = item.creditorId || creditorByName.get(item.origin) || item.origin;
      const owner = item.owner || "Felipe";
      const paymentMethod = item.paymentMethod || "Cartão de crédito";
      return { ...item, item: item.item || item.name || item.description || "Parcelamento", creditorId, owner, paymentMethod, cardId: item.cardId || cardByLegacyKey.get(`${creditorId}|${owner}|${paymentMethod}`) || "" };
    }),
    fixedCosts: (data.fixedCosts || []).map((item) => {
      const card = creditCards.find((entry) => entry.id === item.cardId);
      return { ...item, cardId: item.cardId || "", creditorId: card?.creditorId || item.creditorId || creditorByName.get(item.payment) || item.payment, owner: card?.owner || item.owner || "Felipe", paymentMethod: item.paymentMethod || item.payment || "Cartão de crédito" };
    }),
    plannedPurchases: (data.plannedPurchases || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin, date: item.date || (item.month ? `${item.month}-01` : ""), installments: item.installments || 1 })),
    paidOccurrences: data.paidOccurrences || [],
    receivedOccurrences: data.receivedOccurrences || [],
    receivedAmounts: data.receivedAmounts || {},
    car: { ...defaults.car, ...(data.car || {}) },
    fgts: { ...defaults.fgts, ...(data.fgts || {}), contracts: ((data.fgts?.contracts) || defaults.fgts.contracts).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.contract) || creditors[0]?.id })) }
  };
  if (!normalized.fgts.contracts.length) {
    normalized.fgts.balance = 0;
    normalized.fgts.blocked = 0;
    normalized.fgts.available = 0;
  }
  normalized.car.payments = (normalized.car.payments || []).map((payment) => ({
    ...payment,
    dueDate: payment.dueDate || (payment.month ? `${payment.month}-01` : "")
  }));
  normalized.car.firstDueDate = normalized.car.firstDueDate || normalized.car.payments[0]?.dueDate || "";
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
    creditCards: [],
    incomeLines: [],
    recurringIncomes: [],
    projectionLines: [],
    installments: [],
    fixedCosts: [],
    plannedPurchases: [],
    paidOccurrences: [],
    receivedOccurrences: [],
    car: {
      name: "Carro",
      creditorId: "",
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
  const pendingTotal = fgtsPendingTotal(contract);
  return `
    <details class="debt-card">
      <summary class="fgts-summary">
        <div class="entity-cell">
          ${creditorLogoHtml(contract.creditorId)}
          <div>
            <strong>${escapeHtml(contract.description)}</strong>
            <span>${escapeHtml(getCreditorName(contract.creditorId))} · ${escapeHtml(contract.contract || "sem contrato")}</span>
          </div>
        </div>
        <div class="summary-stat"><span>Recebido</span><strong>${currency.format(contract.received || 0)}</strong></div>
        <div class="summary-stat"><span>A pagar</span><strong>${currency.format(pendingTotal)}</strong></div>
        <div class="summary-stat"><span>Parcelas</span><strong>${paid.length}/${contract.installments.length}</strong></div>
        <div class="summary-stat"><span>Próximo venc.</span><strong>${nextDue ? formatDate(nextDue) : "-"}</strong></div>
        <span class="status ${contract.status === "Quitado" ? "ok" : "warn"}">${escapeHtml(contract.status || "Ativo")}</span>
      </summary>
      <div class="debt-meta-grid">
        ${metaBox("Criada em", formatDate(contract.createdAt || contract.firstDueDate))}
        ${metaBox("Tipo", "Empréstimo")}
        ${metaBox("Parcelas pagas", `${paid.length} de ${contract.installments.length}`)}
        ${metaBox("Próximo vencimento", nextDue ? formatDate(nextDue) : "-")}
        <div class="debt-action row-actions">
          <button class="small-button" type="button" data-edit-fgts="${contract.id}">Editar</button>
          <button class="small-button danger-mini" type="button" data-delete-fgts="${contract.id}">Excluir</button>
        </div>
        <form class="inline-form debt-action" data-fgts-quit="${contract.id}">
          <input name="amount" type="text" inputmode="decimal" data-money-input placeholder="Valor quitação" value="${formatCurrencyInput(contract.settlementAmount || "")}" required>
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
        <div class="summary-stat compact-status"><span>Status</span><strong>${paid.length}/${installments.length}</strong></div>
        <div class="summary-stat"><span>Saldo</span><strong>${currency.format(balance)}</strong></div>
        <span class="summary-chevron">${icon("chevron-down")}</span>
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
          ${car.creditorId ? creditorLogoHtml(car.creditorId) : `<span class="creditor-logo">CA</span>`}
          <div>
            <strong>${escapeHtml(car.name || "Carro")}</strong>
            <span>${escapeHtml(car.creditorId ? getCreditorName(car.creditorId) : "Financiamento")}</span>
          </div>
        </div>
        <span class="status ${pending.length ? "warn" : "ok"}">${pending.length ? "Pendente" : "Quitado"}</span>
      </summary>
      <div class="debt-meta-grid">
        ${metaBox("Parcelas pagas", `${paid.length} de ${car.payments.length}`)}
        ${metaBox("Próxima parcela", pending[0] ? formatDate(pending[0].dueDate || `${pending[0].month}-01`) : "-")}
        ${metaBox("Falta pagar", currency.format(pending.reduce((total, item) => total + Number(item.value || 0), 0)))}
      </div>
      ${tabButtons("car", state.carFilter)}
      <div class="table-wrap inner-table">
        <table class="data-table clean-table">
          <thead><tr><th>Parcela</th><th>Data</th><th>Valor</th><th>Pago</th><th>Economia</th><th>Status</th><th>Ação</th></tr></thead>
          <tbody>${visible.map((item) => {
            const economy = carInstallmentEconomy(item);
            return `<tr><td>${item.number}/${car.payments.length}</td><td>${formatDate(item.dueDate || `${item.month}-01`)}</td><td>${currency.format(item.value)}</td><td>${item.paidAmount ? currency.format(item.paidAmount) : "-"}</td><td>${item.status === "Pago" ? `<span class="${economyClass(economy)}">${currency.format(economy)}</span>` : "-"}</td><td><span class="status ${item.status === "Pago" ? "ok" : "warn"}">${item.status}</span></td><td>${item.status === "Pago" ? `<button class="small-button danger-mini" type="button" data-unpay-car="${item.id}">Excluir pagamento</button>` : `<button class="small-button pay" type="button" data-pay-car="${item.id}">Registrar pagamento</button>`}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </details>
  `;
}

function carInstallmentEconomy(item) {
  if (item.status !== "Pago") return 0;
  return Number(item.value || 0) - Number(item.paidAmount || item.value || 0);
}

function economyClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
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

function createFgtsInstallments(total, amountOrValues, paid, firstDueDate) {
  const start = firstDueDate || nextAnnualDate();
  const values = Array.isArray(amountOrValues)
    ? amountOrValues
    : Array.from({ length: total }, () => Number(amountOrValues || 0));
  return Array.from({ length: total }, (_, index) => {
    const status = index < paid ? "Pago" : "Pendente";
    const amount = Number(values[index] || 0);
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

function mergeFgtsInstallments(existing, total, amountOrValues, paid, firstDueDate) {
  const start = firstDueDate || nextAnnualDate();
  const values = Array.isArray(amountOrValues)
    ? amountOrValues
    : Array.from({ length: total }, () => Number(amountOrValues || 0));
  return Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const current = existing.find((item) => Number(item.number) === number);
    const amount = Number(values[index] || 0);
    const status = current?.status === "Pago" || index < paid ? "Pago" : "Pendente";
    return {
      id: current?.id || crypto.randomUUID(),
      number,
      dueDate: addYearsToDate(start, index),
      amount,
      paidAmount: status === "Pago" ? Number(current?.paidAmount || amount) : 0,
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
  return state.data.creditCards.filter((card) => card.creditorId === id).length
    + state.data.installments.filter((item) => item.creditorId === id).length
    + state.data.fixedCosts.filter((item) => item.creditorId === id).length
    + state.data.plannedPurchases.filter((item) => item.creditorId === id).length
    + state.data.fgts.contracts.filter((item) => item.creditorId === id).length
    + (state.data.car.creditorId === id ? 1 : 0)
    + state.data.projectionLines.filter((item) => item.creditorId === id || item.match === id).length;
}

function creditorOpenBalance(id) {
  const installments = state.data.installments
    .filter((item) => getInstallmentCard(item).creditorId === id)
    .reduce((total, item) => total + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
  const fgts = state.data.fgts.contracts
    .filter((item) => item.creditorId === id)
    .reduce((total, item) => total + fgtsPendingTotal(item), 0);
  return installments + fgts;
}

function cardOpenBalance(id) {
  return state.data.installments
    .filter((item) => getInstallmentCard(item).id === id)
    .reduce((total, item) => total + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
}

function isCreditCardInUse(id) {
  return state.data.installments.some((item) => getInstallmentCard(item).id === id);
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

function sortedCreditors() {
  return [...state.data.creditors].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function sortedCreditCards() {
  return [...state.data.creditCards].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

function getCreditor(id) {
  return state.data.creditors.find((creditor) => creditor.id === id) || null;
}

function getCreditCard(id) {
  return state.data.creditCards.find((card) => card.id === id) || null;
}

function getInstallmentCard(item) {
  const card = item.cardId ? getCreditCard(item.cardId) : null;
  if (card) return { ...card, real: true };
  const creditorId = item.creditorId || "";
  const owner = item.owner || "Felipe";
  return {
    id: `legacy-${creditorId || "sem-credor"}-${owner}`.replaceAll(/\s+/g, "-"),
    name: `${getCreditorName(creditorId)} ${owner}`.trim(),
    creditorId,
    owner,
    real: false
  };
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

function addMonthsToDate(value, months) {
  const [year, month, day] = String(value || todayIsoDate()).slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + months, day || 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function installmentDueDate(value, monthOffset) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month + monthOffset, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonth(month) {
  const [year, value] = month.split("-").map(Number);
  return monthLabel.format(new Date(year, value - 1, 1)).replace(".", "");
}

function formatMonthLong(month) {
  const [year, value] = month.split("-").map(Number);
  const text = monthLabelLong.format(new Date(year, value - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
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

function parseCurrencyInput(value) {
  const text = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!text) return 0;
  if (text.includes(",")) return Number(text.replaceAll(".", "").replace(",", ".")) || 0;
  return Number(text) || 0;
}

function formatCurrencyInput(value) {
  const number = typeof value === "number" ? value : parseCurrencyInput(value);
  return number ? currency.format(number).replace("R$", "").trim() : "";
}

function bindMoneyInputs(root = document) {
  root.querySelectorAll("[data-money-input]").forEach((input) => {
    if (input.dataset.moneyBound) return;
    input.dataset.moneyBound = "true";
    input.addEventListener("blur", () => {
      input.value = formatCurrencyInput(input.value);
    });
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^\d,.-]/g, "");
    });
  });
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
