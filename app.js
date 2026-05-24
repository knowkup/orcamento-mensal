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
  projectionTable: document.querySelector("#projectionTable"),
  projectionTopScroll: document.querySelector("#projectionTopScroll"),
  projectionScroll: document.querySelector(".projection-scroll"),
  occurrenceList: document.querySelector("#occurrenceList"),
  installmentForm: document.querySelector("#installmentForm"),
  installmentsTable: document.querySelector("#installmentsTable"),
  fixedCostForm: document.querySelector("#fixedCostForm"),
  fixedCostsTable: document.querySelector("#fixedCostsTable"),
  carForm: document.querySelector("#carForm"),
  carTitle: document.querySelector("#carTitle"),
  carKpis: document.querySelector("#carKpis"),
  carTable: document.querySelector("#carTable"),
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
  el.fixedCostForm.addEventListener("submit", addFixedCost);
  el.carForm.addEventListener("submit", updateCar);
  el.fgtsForm.addEventListener("submit", addFgtsContract);
  el.creditorForm.addEventListener("submit", addCreditor);
  el.creditorForm.elements.logoFile.addEventListener("change", handleCreditorLogoUpload);
  el.newCreditorButton.addEventListener("click", () => openCreditorDialog());
  el.closeCreditorButton.addEventListener("click", closeCreditorDialog);
  el.addPlanButton.addEventListener("click", openPlannedDialog);
  el.closePlanButton.addEventListener("click", () => el.plannedDialog.close());
  el.plannedForm.addEventListener("submit", addPlannedPurchase);
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
    state.data = normalizeData(snapshot.data());
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
    schemaVersion: 2,
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
  renderOccurrences();
  renderInstallments();
  renderFixedCosts();
  renderCar();
  renderFgts();
  renderOrigins();
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

  el.projectionTable.querySelectorAll("[data-pay-occurrence]").forEach((button) => {
    button.addEventListener("click", () => togglePaidOccurrence(button.dataset.payOccurrence));
  });
}

function renderOccurrences() {
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

function buildProjectionRows(months) {
  const rows = [];
  state.data.incomeLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "income",
      label: line.label,
      origin: line.origin,
      sourceLabel: "entrada",
      values: valuesFromMonthlyMap(line.values, months)
    });
  });

  state.data.projectionLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "expense",
      label: line.label,
      origin: line.creditorId ? getCreditorName(line.creditorId) : line.origin,
      sourceLabel: sourceLabel(line),
      values: valuesForProjectionLine(line, months)
    });
  });

  return rows;
}

function valuesForProjectionLine(line, months) {
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
    if (isOccurrencePaid(`${line.id}:${month}`)) value = 0;
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
  const sectionClass = row.kind === "income" ? "income-row" : "expense-row";
  return `
    <tr class="${sectionClass}">
      <th class="sticky-col">
        <span>${escapeHtml(row.label)}</span>
        <small>${escapeHtml(row.sourceLabel)}</small>
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
  const payButton = row.kind === "expense"
    ? `<button class="cell-pay ${paid ? "paid" : ""}" type="button" data-pay-occurrence="${key}" title="${paid ? "Reabrir" : "Pagar"}">${paid ? "Pago" : "Pagar"}</button>`
    : "";
  return `<td><span class="${className}">${sign}${currency.format(value)}</span>${payButton}</td>`;
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

function renderInstallments() {
  const totals = state.data.installments.reduce((acc, item) => {
    acc.total += item.amount * item.totalInstallments;
    acc.paid += item.amount * item.paidInstallments;
    acc.left += item.amount * Math.max(0, item.totalInstallments - item.paidInstallments);
    return acc;
  }, { total: 0, paid: 0, left: 0 });

  const filtered = state.data.installments.filter((item) => {
    const left = Math.max(0, item.totalInstallments - item.paidInstallments);
    return state.installmentFilter === "paid" ? left === 0 : left > 0;
  });

  el.installmentsTable.innerHTML = `
    <thead>
      <tr><th colspan="6">${tabButtons("installment", state.installmentFilter)}</th></tr>
      <tr><th>Item</th><th>Credor</th><th>Valor</th><th>Pagas</th><th>Faltam</th><th>Ações</th></tr>
    </thead>
    <tbody>
      <tr class="summary-row"><td colspan="2">Total</td><td>${currency.format(totals.total)}</td><td>${currency.format(totals.paid)}</td><td>${currency.format(totals.left)}</td><td></td></tr>
      ${filtered.map((item) => {
        const left = Math.max(0, item.totalInstallments - item.paidInstallments);
        return `<tr>
          <td>
            <details>
              <summary>${escapeHtml(item.item)}</summary>
              <div class="detail-list">${installmentDetail(item)}</div>
            </details>
          </td>
          <td>${creditorLogoHtml(item.creditorId)}${escapeHtml(getCreditorName(item.creditorId))}</td>
          <td>${currency.format(item.amount)}</td>
          <td>${item.paidInstallments}/${item.totalInstallments}</td>
          <td>${left}</td>
          <td class="row-actions">
            <button class="small-button pay" type="button" data-pay-installment="${item.id}" ${left ? "" : "disabled"}>Pagar próxima</button>
            <button class="small-button" type="button" data-quit-installment="${item.id}" ${left ? "" : "disabled"}>Quitar</button>
            <button class="small-button danger-mini" type="button" data-delete-installment="${item.id}">Excluir</button>
          </td>
        </tr>`;
      }).join("")}
    </tbody>
  `;

  el.installmentsTable.querySelectorAll("[data-installment-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.installmentFilter = button.dataset.installmentTab;
      renderInstallments();
    });
  });
  el.installmentsTable.querySelectorAll("[data-pay-installment]").forEach((button) => {
    button.addEventListener("click", () => payInstallment(button.dataset.payInstallment));
  });
  el.installmentsTable.querySelectorAll("[data-quit-installment]").forEach((button) => {
    button.addEventListener("click", () => quitInstallment(button.dataset.quitInstallment));
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
  el.carForm.elements.financed.value = car.financed || "";
  el.carForm.elements.purchase.value = car.purchase || "";
  el.carForm.elements.monthly.value = car.monthly || "";
  el.carForm.elements.totalInstallments.value = car.totalInstallments || "";

  const paid = car.payments.filter((item) => item.status === "Pago");
  const pending = car.payments.filter((item) => item.status !== "Pago");
  const visiblePayments = state.carFilter === "paid" ? paid : pending;
  const paidValue = paid.reduce((total, item) => total + Number(item.paidAmount || item.value), 0);
  const pendingValue = pending.reduce((total, item) => total + Number(item.value), 0);
  const economy = paid.reduce((total, item) => total + Math.max(0, Number(item.value) - Number(item.paidAmount || item.value)), 0);

  el.carKpis.innerHTML = [
    metric("Pagas", paid.length, "neutral", false),
    metric("Pendentes", pending.length, "negative", false),
    metric("Pago", paidValue, "positive"),
    metric("Falta", -pendingValue, "negative"),
    metric("Economia", economy, "positive")
  ].join("");

  el.carTable.innerHTML = `
    <thead>
      <tr><th colspan="6">${tabButtons("car", state.carFilter)}</th></tr>
      <tr><th>Parcela</th><th>Mês</th><th>Valor</th><th>Pago</th><th>Status</th><th>Ações</th></tr>
    </thead>
    <tbody>
      ${visiblePayments.map((item) => `
        <tr>
          <td>${item.number}/${car.totalInstallments}</td>
          <td>${formatMonth(item.month)}</td>
          <td>${currency.format(item.value)}</td>
          <td>${item.paidAmount ? currency.format(item.paidAmount) : "-"}</td>
          <td><span class="status ${item.status === "Pago" ? "ok" : "warn"}">${item.status}</span></td>
          <td><button class="small-button pay" type="button" data-pay-car="${item.id}" ${item.status === "Pago" ? "disabled" : ""}>Pagar</button></td>
        </tr>
      `).join("")}
    </tbody>
  `;

  el.carTable.querySelectorAll("[data-car-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.carFilter = button.dataset.carTab;
      renderCar();
    });
  });
  el.carTable.querySelectorAll("[data-pay-car]").forEach((button) => {
    button.addEventListener("click", () => payCarInstallment(button.dataset.payCar));
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
    <thead><tr><th>Credor</th><th>Tipo</th><th>Vínculos</th><th>Saldo previsto</th><th>Ações</th></tr></thead>
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
            <td>${escapeHtml(creditor.type || "-")}</td>
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
    active: true
  };
  state.data.installments.push(item);
  event.currentTarget.reset();
  await saveState("Parcela cadastrada.");
}

async function payInstallment(id) {
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = Math.min(item.totalInstallments, Number(item.paidInstallments) + 1);
  await saveState("Parcela paga.");
}

async function quitInstallment(id) {
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = item.totalInstallments;
  await saveState("Parcela quitada.");
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
  await saveState("Cadastro do carro atualizado.");
}

async function payCarInstallment(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  payment.status = "Pago";
  payment.paidAmount = payment.value;
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
    type: String(form.get("type")),
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
  el.creditorForm.elements.type.value = creditor?.type || "Cartão de crédito";
  el.creditorForm.elements.logoUrl.value = creditor?.logoUrl || "";
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
  el.plannedDialog.showModal();
}

async function addPlannedPurchase(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.plannedPurchases.push({
    id: crypto.randomUUID(),
    description: String(form.get("description")).trim(),
    creditorId: String(form.get("creditorId")),
    month: String(form.get("month")),
    amount: Number(form.get("amount"))
  });
  el.plannedDialog.close();
  event.currentTarget.reset();
  await saveState("Compra planejada adicionada.");
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
  const creditors = data.creditors || defaults.creditors;
  const creditorByName = new Map(creditors.map((creditor) => [creditor.name, creditor.id]));
  return {
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
    installments: (data.installments || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin })),
    fixedCosts: (data.fixedCosts || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.payment) || item.payment, paymentMethod: item.paymentMethod || item.payment || "Cartão de crédito" })),
    plannedPurchases: (data.plannedPurchases || []).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.origin) || item.origin })),
    paidOccurrences: data.paidOccurrences || [],
    car: { ...defaults.car, ...(data.car || {}) },
    fgts: { ...defaults.fgts, ...(data.fgts || {}), contracts: ((data.fgts?.contracts) || defaults.fgts.contracts).map((item) => ({ ...item, creditorId: item.creditorId || creditorByName.get(item.contract) || creditorByName.get("Santander") || creditors[0]?.id })) }
  };
}

function createDefaultData() {
  const months = nextMonths(12);
  const paidCarPayments = previousMonths(12).map((month, index) => ({
    id: `car-paid-${index + 1}`,
    number: index + 1,
    month,
    value: 3621.12,
    paidAmount: 3621.12,
    status: "Pago"
  }));
  const carPayments = months.map((month, index) => ({
    id: `car-${index + 13}`,
    number: index + 13,
    month,
    value: 3621.12,
    paidAmount: 0,
    status: "Pendente"
  }));

  return {
    schemaVersion: 2,
    initialBalance: 320.19,
    paymentMethods: ["PIX", "Débito em conta", "Cartão de crédito", "Boleto"],
    creditors: [
      { id: "cred-santander", name: "Santander", type: "Cartão de crédito", logoUrl: "" },
      { id: "cred-nubank", name: "Nubank", type: "Cartão de crédito", logoUrl: "" },
      { id: "cred-itau-click", name: "Itaú Click", type: "Cartão de crédito", logoUrl: "" },
      { id: "cred-itau-kah", name: "Itaú Kah", type: "Cartão de crédito", logoUrl: "" },
      { id: "cred-grazziotin", name: "Grazziotin", type: "Cartão de crédito", logoUrl: "" },
      { id: "cred-sicredi", name: "Sicredi", type: "Empréstimo", logoUrl: "" },
      { id: "cred-jeep", name: "Jeep Compass", type: "Financiamento", logoUrl: "" }
    ],
    incomeLines: [
      { id: "income-salary", label: "ATP Salário", origin: "Santander", values: { default: 11159.48 } },
      { id: "income-rent", label: "Aluguel Matheus", origin: "Santander", values: { default: 900 } },
      { id: "income-13", label: "13º ATP", origin: "Santander", values: { "month-11": 10378.82, "month-12": 4862.83 } },
      { id: "income-vacation", label: "Férias ATP", origin: "Santander", values: { "2026-09": 7742.42 } },
      { id: "income-other", label: "Outros / rolagem", origin: "Santander", values: { [months[0]]: 10750, [months[1]]: 2500, [months[2]]: 2500 } }
    ],
    projectionLines: [
      { id: "line-itau-click", label: "Itaú Click", origin: "Débito Itaú Kah", creditorId: "cred-itau-click", source: "installments", match: "cred-itau-click" },
      { id: "line-grazziotin", label: "Grazziotin", origin: "PIX", creditorId: "cred-grazziotin", source: "installments", match: "cred-grazziotin" },
      { id: "line-diff-kah", label: "Diferença Kah (limite dela)", origin: "-", source: "difference", limit: 1000, subtractLineIds: ["line-itau-click", "line-grazziotin"] },
      { id: "line-agua", label: "Água - Semae", origin: "Boleto", source: "fixedByName", match: "Água - Semae" },
      { id: "line-inter-kah", label: "Inter Kah", origin: "Boleto", source: "manual", monthlyAmount: 667.13 },
      { id: "line-jeep", label: "Carro", origin: "Boleto", source: "car" },
      { id: "line-claro", label: "Claro/NET", origin: "Débito Itaú Kah", source: "fixedByName", match: "Claro/NET" },
      { id: "line-juvo", label: "Juvo", origin: "Boleto", source: "manual", monthlyAmount: 851.66 },
      { id: "line-nubank-parcelas", label: "Parcelas (Nubank)", origin: "Nubank", creditorId: "cred-nubank", source: "installments", match: "cred-nubank" },
      { id: "line-nubank-fixo", label: "Custo Fixo (Nubank)", origin: "Nubank", creditorId: "cred-nubank", source: "fixedByOrigin", match: "cred-nubank" },
      { id: "line-nubank-compras", label: "Compras Gerais (Nubank)", origin: "Nubank", creditorId: "cred-nubank", source: "planned", match: "cred-nubank" },
      { id: "line-luz", label: "Luz - RGE", origin: "PIX", source: "fixedByName", match: "Luz - RGE" },
      { id: "line-unimed", label: "Unimed VS", origin: "Boleto", source: "manual", monthlyAmount: 1400 },
      { id: "line-mei-kah", label: "MEI Kahramelos", origin: "PIX", source: "fixedByName", match: "MEI Kahramelos" },
      { id: "line-nubank-kah", label: "Nubank Kah", origin: "Boleto", source: "manual", monthlyAmount: 209.4 },
      { id: "line-luz-kah", label: "Luz - RGE - Kah", origin: "PIX", source: "fixedByName", match: "Luz - RGE - Kah" },
      { id: "line-mercado-emprestimo", label: "Mercado Pago EmpréstimoK", origin: "Boleto", source: "manual", monthlyAmount: 306.38 }
    ],
    installments: [
      { id: "par-1", item: "Amazon", creditorId: "cred-itau-click", amount: 94.67, totalInstallments: 12, paidInstallments: 6, active: true },
      { id: "par-2", item: "Curso Kah (Ventosa)", creditorId: "cred-itau-click", amount: 124.91, totalInstallments: 12, paidInstallments: 8, active: true },
      { id: "par-3", item: "Notebook Dell", creditorId: "cred-santander", amount: 469.08, totalInstallments: 12, paidInstallments: 9, active: true },
      { id: "par-4", item: "Amazon (Shampos)", creditorId: "cred-nubank", amount: 32.52, totalInstallments: 4, paidInstallments: 3, active: true }
    ],
    fixedCosts: [
      { id: "fix-1", name: "Claro/NET", creditorId: "cred-itau-kah", paymentMethod: "Débito em conta", group: "Residência", dueDay: 10, amount: 193.28, includeInProjection: true },
      { id: "fix-2", name: "Google GSUITE", creditorId: "cred-nubank", paymentMethod: "Cartão de crédito", group: "Kupka", dueDay: 1, amount: 40.9, includeInProjection: true },
      { id: "fix-3", name: "Spotify", creditorId: "cred-nubank", paymentMethod: "Cartão de crédito", group: "Streaming", dueDay: 5, amount: 31.9, includeInProjection: true },
      { id: "fix-4", name: "Netflix", creditorId: "cred-nubank", paymentMethod: "Cartão de crédito", group: "Streaming", dueDay: 9, amount: 44.9, includeInProjection: true },
      { id: "fix-5", name: "Barbeiro", creditorId: "cred-nubank", paymentMethod: "Cartão de crédito", group: "Cuidados", dueDay: 20, amount: 230, includeInProjection: true },
      { id: "fix-6", name: "ChatGPT", creditorId: "cred-nubank", paymentMethod: "Cartão de crédito", group: "Kupka", dueDay: 25, amount: 125, includeInProjection: true },
      { id: "fix-7", name: "Água - Semae", creditorId: "cred-santander", paymentMethod: "PIX", group: "Residência", dueDay: 15, amount: 160, includeInProjection: true },
      { id: "fix-8", name: "Luz - RGE", creditorId: "cred-santander", paymentMethod: "PIX", group: "Residência", dueDay: 13, amount: 1079.52, includeInProjection: true },
      { id: "fix-9", name: "MEI Kahramelos", creditorId: "cred-santander", paymentMethod: "PIX", group: "Kahramelos", dueDay: 20, amount: 81.9, includeInProjection: true },
      { id: "fix-10", name: "Luz - RGE - Kah", creditorId: "cred-santander", paymentMethod: "PIX", group: "Residência", dueDay: 28, amount: 130, includeInProjection: true }
    ],
    plannedPurchases: [
      { id: "plan-1", description: "Compras gerais", creditorId: "cred-nubank", month: months[0], amount: 653.38 },
      { id: "plan-2", description: "Compras gerais", creditorId: "cred-nubank", month: months[1], amount: 2000 }
    ],
    paidOccurrences: [],
    car: {
      name: "Jeep Compass",
      financed: 107981,
      purchase: 133900,
      monthly: 3621.12,
      totalInstallments: 60,
      payments: [...paidCarPayments, ...carPayments]
    },
    fgts: {
      balance: 58647.21,
      blocked: 46495.03,
      available: 12152.18,
      contracts: [
        { id: "fgts-1", description: "FGTS 01", creditorId: "cred-santander", contract: "5645599532", received: 3709.43, toPay: 4274.54, status: "Ativo", annualPayments: [] },
        { id: "fgts-2", description: "FGTS 02", creditorId: "cred-santander", contract: "5665960713", received: 3280.93, toPay: 3280.93, status: "Ativo", annualPayments: [] },
        { id: "fgts-3", description: "FGTS 03", creditorId: "cred-santander", contract: "Santander", received: 4662.34, toPay: 4081.53, status: "Ativo", annualPayments: [] }
      ]
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
    installments: "vem de Parcelas",
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
