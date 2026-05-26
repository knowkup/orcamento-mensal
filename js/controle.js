import { state, el, currency } from "./state.js";
import { escapeHtml, icon, formatDate, formatMonthLong, isOccurrencePaid, paidAmount, isIncomeReceived, receivedAmount, showToast, todayIsoDate, nextMonths, parseCurrencyInput, formatCurrencyInput } from "./utils.js";
import { creditorLogoHtml, sourceLogoHtml, ownerRank, getInstallmentCard, getCreditorName } from "./creditors.js";
import { metric, isManualPlannedRow } from "./components.js";
import { buildProjectionRows, uniqueGroups, groupKey } from "./planejamento.js";

function carPaymentMonthLocal(item) {
  return item.dueDate ? String(item.dueDate).slice(0, 7) : item.month;
}

export function renderMonthlyControl() {
  const month = nextMonths(1)[0];
  const rows = buildProjectionRows([month], true);
  const entries = rows
    .filter((row) => row.kind === "income")
    .map((row) => ({ row, value: row.values[month] || 0 }))
    .filter((item) => item.value > 0);
  const exits = rows
    .filter((row) => row.kind === "expense")
    .map((row) => ({ row, value: row.values[month] || 0 }))
    .filter((item) => item.value > 0 || rowHasAnyPayment(item.row, month));
  const pendingEntries = entries.filter((item) => !isIncomeReceived(`${item.row.id}:${month}`));
  const pendingExits = exits.filter((item) => rowOutstanding(item.row, month, item.value) > 0);
  const realizedEntries = entries.filter((item) => isIncomeReceived(`${item.row.id}:${month}`));
  const realizedExits = exits.filter((item) => rowHasAnyPayment(item.row, month));
  const received = entries.reduce((total, item) => total + (isIncomeReceived(`${item.row.id}:${month}`) ? receivedAmount(`${item.row.id}:${month}`, item.value) : 0), 0);
  const paid = exits.reduce((total, item) => total + rowPaidAmount(item.row, month, item.value), 0);
  const expectedIncome = pendingEntries.reduce((total, item) => total + item.value, 0);
  const expectedExpense = pendingExits.reduce((total, item) => total + rowOutstanding(item.row, month, item.value), 0);
  const accountBalance = Number(state.data.accountBalance || state.data.initialBalance || 0);
  const projectedBalance = accountBalance + received + expectedIncome - paid - expectedExpense;
  const hasPending = pendingEntries.length > 0 || pendingExits.length > 0;
  const isClosed = (state.data.closedMonths || []).includes(month);

  el.monthlyReference.textContent = "";
  el.closeMonthButton.disabled = hasPending;
  el.monthlySummary.classList.add("monthly-control-summary");
  el.monthlySummary.innerHTML = `
    <div class="monthly-summary-row executive-row">
      ${accountBalanceCard(accountBalance)}
      ${projectedBalanceCard(projectedBalance)}
      ${monthReferenceCard(month, isClosed)}
    </div>
    <div class="monthly-summary-row operational-row">
      ${metric("Previsto entrar", expectedIncome, "positive")}
      ${metric("Já recebido", received, "positive")}
      ${metric("Previsto sair", -expectedExpense, "negative")}
      ${metric("Já pago", -paid, "negative")}
    </div>
  `;

  el.monthlyBoard.innerHTML = `
    <section class="monthly-column income-column">
      <div class="monthly-column-head">
        <span>Entradas previstas</span>
        <strong>${currency.format(expectedIncome)}</strong>
      </div>
      ${monthlyItems(pendingEntries, month, "income")}
    </section>
    <section class="monthly-column expense-column">
      <div class="monthly-column-head">
        <span>Saídas previstas</span>
        <strong>-${currency.format(expectedExpense)}</strong>
      </div>
      ${monthlyItems(pendingExits, month, "expense")}
    </section>
    <section class="monthly-column realized-column">
      <div class="monthly-column-head">
        <span>Realizado no mÃªs</span>
        <strong>${currency.format(received - paid)}</strong>
      </div>
      ${monthlyRealizedItems(realizedEntries, realizedExits, month)}
    </section>
  `;

  el.monthlyBoard.querySelectorAll("[data-receive-income]").forEach((button) => {
    button.addEventListener("click", () => openReceiveDialog(button.dataset.receiveIncome, button.dataset.expected));
  });
  el.monthlyBoard.querySelectorAll("[data-cancel-income]").forEach((button) => {
    button.addEventListener("click", () => cancelReceivedOccurrence(button.dataset.cancelIncome));
  });
  el.monthlyBoard.querySelectorAll("[data-pay-expense]").forEach((button) => {
    button.addEventListener("click", () => openExpensePaymentDialog(button.dataset.payExpense, button.dataset.expected, button.dataset.label));
  });
  el.monthlyBoard.querySelectorAll("[data-cancel-payment]").forEach((button) => {
    button.addEventListener("click", () => cancelPaidOccurrence(button.dataset.cancelPayment));
  });
  el.monthlyBoard.querySelectorAll("[data-delete-manual-plan]").forEach((button) => {
    button.addEventListener("click", () => deleteManualPlanned(button.dataset.deleteManualPlan));
  });
  el.monthlyBoard.querySelectorAll("[data-toggle-monthly-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const details = button.closest(".monthly-item")?.querySelector(".monthly-breakdown");
      if (!details) return;
      details.open = !details.open;
      button.classList.toggle("is-open", details.open);
    });
  });
  el.monthlyBoard.querySelectorAll("[data-edit-fixed-amount]").forEach((button) => {
    button.addEventListener("click", () => openFixedCostAmountDialog(button.dataset.editFixedAmount));
  });
  el.monthlySummary.querySelector("[data-edit-account-balance]")?.addEventListener("click", openAccountBalanceDialog);
}

export function monthlyItems(items, month, kind, scope = "pending") {
  if (!items.length) return `<div class="empty-state compact">Nada previsto para este mês.</div>`;
  return items
    .sort((a, b) => compareMonthlyEntries(a, b, month, kind))
    .map(({ row, value }) => {
    const key = `${row.id}:${month}`;
    const done = kind === "income" ? isIncomeReceived(key) : isOccurrencePaid(key);
    const displayValue = kind === "income" && done
      ? receivedAmount(key, value)
      : kind === "expense"
        ? (scope === "realized" ? rowPaidAmount(row, month, value) : (done ? paidAmount(key, value) : rowOutstanding(row, month, value)))
        : value;
    const attr = kind === "income"
      ? (done ? `data-cancel-income="${key}"` : `data-receive-income="${key}" data-expected="${value}"`)
      : (done ? `data-cancel-payment="${key}"` : `data-pay-expense="${key}" data-expected="${value}" data-label="${escapeHtml(row.label)}"`);
    const buttonClass = kind === "expense" ? `pay ${done ? "danger-mini" : ""}` : "";
    const buttonLabel = kind === "income" ? (done ? "Cancelar Recebimento" : "Receber") : (done ? "Excluir pagamento" : "Pagar");
    const actionButton = scope === "realized" && kind === "expense" && !done
      ? ""
      : `<button class="small-button ${buttonClass}" type="button" ${attr}>${buttonLabel}</button>`;
    const marker = row.creditorId ? creditorLogoHtml(row.creditorId) : sourceLogoHtml(row.logoUrl, row.origin || row.label);
    const deleteButton = isManualPlannedRow(row)
      ? `<button class="icon-button mini-icon danger-mini" type="button" title="Excluir lançamento" data-delete-manual-plan="${row.id}">${icon("trash-2")}</button>`
      : "";
    const breakdown = kind === "expense" ? monthlyBreakdown(row, month) : "";
    const dueDate = rowDueDate(row, month);
    const dateLabel = kind === "income" ? "Recebimento" : "Vencimento";
    const accountCount = monthlyAccountCount(row, month);
    // mostra chevron sempre que houver conteúdo de breakdown (inclui grupos com 1 item)
    const hasBreakdown = kind === "expense" && Boolean(breakdown);
    const statusLabel = kind === "income"
      ? (done ? "Recebido" : "Pendente")
      : rowOutstanding(row, month, value) <= 0 ? "Pago" : rowHasAnyPayment(row, month) ? "Parcial" : "Pendente";
    const chevron = hasBreakdown
      ? `<button class="monthly-chevron" type="button" title="Expandir contas" data-toggle-monthly-details>${icon("chevron-down")}</button>`
      : `<span class="monthly-chevron placeholder"></span>`;
    return `
      <article class="monthly-item ${done ? "done" : ""} ${row.owner === "Kah" ? "owner-kah-card" : ""} ${kind === "income" ? "income-item" : "expense-item"}">
        <div class="entity-cell monthly-entity">
          ${marker}
          <div>
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(row.origin || "-")}</span>
          </div>
        </div>
        <div class="monthly-field"><span>${dateLabel}</span><strong>${dueDate ? formatDate(dueDate) : "-"}</strong></div>
        <div class="monthly-field compact"><span>Status</span><strong>${statusLabel}</strong></div>
        <div class="monthly-field compact"><span>Contas</span><strong>${accountCount}</strong></div>
        <div class="monthly-item-action">
          <strong class="${kind === "income" ? "positive" : "negative"}">${kind === "income" ? "" : "-"}${currency.format(displayValue)}</strong>
          ${actionButton}
          ${deleteButton}
        </div>
        ${chevron}
        ${breakdown}
      </article>
    `;
  }).join("");
}

export function monthlyRealizedItems(entries, exits, month) {
  if (!entries.length && !exits.length) return `<div class="empty-state compact">Nada realizado neste mÃªs.</div>`;
  const entryRows = entries.length
    ? `<div class="realized-group"><span>Recebimentos</span>${monthlyItems(entries, month, "income", "realized")}</div>`
    : "";
  const exitRows = exits.length
    ? `<div class="realized-group"><span>Pagamentos</span>${monthlyItems(exits, month, "expense", "realized")}</div>`
    : "";
  return `${entryRows}${exitRows}`;
}

export function monthlyAccountCount(row, month) {
  const children = (row.children?.[month] || []).filter((item) => Number(item.value || 0) > 0 || isOccurrencePaid(item.key));
  return children.length || 1;
}

function monthlyBreakdown(row, month) {
  const children = (row.children?.[month] || []).filter((item) => Number(item.value || 0) > 0 || isOccurrencePaid(item.key));
  if (!children.length) return "";
  return `
    <details class="monthly-breakdown">
      <summary>Detalhes do valor</summary>
      <div class="monthly-breakdown-list">
        ${children
          .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")) || a.label.localeCompare(b.label, "pt-BR"))
          .map((item) => {
            const done = isOccurrencePaid(item.key);
            const displayValue = done ? paidAmount(item.key, item.value) : item.value;
            const attr = done
              ? `data-cancel-payment="${item.key}"`
              : `data-pay-expense="${item.key}" data-expected="${item.value}" data-label="${escapeHtml(item.label)}"`;
            const isFixed = item.key.startsWith("child-fixed|");
            const editAmountButton = isFixed && !done
              ? `<button class="icon-button mini-icon" type="button" title="Editar valor deste mês" data-edit-fixed-amount="${item.key}">${icon("pencil")}</button>`
              : "";
            return `
              <div class="monthly-breakdown-row ${done ? "done" : ""}">
                <div>
                  <strong>${escapeHtml(item.label)}</strong>
                  <span>${item.dueDate ? formatDate(item.dueDate) : formatMonthLong(month)}</span>
                </div>
                <div class="monthly-item-action">
                  <strong class="negative">-${currency.format(displayValue)}</strong>
                  ${editAmountButton}
                  <button class="small-button pay ${done ? "danger-mini" : ""}" type="button" ${attr}>${done ? "Excluir pagamento" : "Pagar"}</button>
                </div>
              </div>
            `;
          }).join("")}
      </div>
    </details>
  `;
}

export function compareMonthlyEntries(a, b, month, kind) {
  if (kind === "expense") {
    const aDone = rowOutstanding(a.row, month, a.value) <= 0 ? 1 : 0;
    const bDone = rowOutstanding(b.row, month, b.value) <= 0 ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
  }
  return compareRowsByDueDate(a.row, b.row, month)
    || String(a.row.label || "").localeCompare(String(b.row.label || ""), "pt-BR");
}

export function compareRowsByDueDate(a, b, month) {
  return rowDueDate(a, month).localeCompare(rowDueDate(b, month))
    || ownerRank(a.owner) - ownerRank(b.owner)
    || String(a.origin || "").localeCompare(String(b.origin || ""), "pt-BR");
}

export function rowDueDate(row, month) {
  return row.dueDates?.[month] || firstDueDate(row.children?.[month]) || `${month}-01`;
}

export function firstDueDate(children = []) {
  return children
    .map((item) => item.dueDate)
    .filter(Boolean)
    .sort()[0] || "";
}

export function rowHasAnyPayment(row, month) {
  return isOccurrencePaid(`${row.id}:${month}`) || (row.children?.[month] || []).some((item) => isOccurrencePaid(item.key));
}

export function rowReceivedAmount(row, month, fallback) {
  const key = `${row.id}:${month}`;
  return isIncomeReceived(key) ? receivedAmount(key, fallback) : 0;
}

export function rowIncomeOutstanding(row, month, value) {
  return Math.max(0, Number(value || 0) - rowReceivedAmount(row, month, value));
}

export function rowPaidAmount(row, month, fallback) {
  const key = `${row.id}:${month}`;
  if (isOccurrencePaid(key)) return paidAmount(key, fallback);
  return (row.children?.[month] || []).reduce((total, item) => (
    total + (isOccurrencePaid(item.key) ? paidAmount(item.key, item.value) : 0)
  ), 0);
}

export function rowOutstanding(row, month, value) {
  return Math.max(0, Number(value || 0) - rowPaidAmount(row, month, value));
}

export function adjustAccountBalance(delta) {
  state.data.accountBalance = Number(state.data.accountBalance || state.data.initialBalance || 0) + Number(delta || 0);
}

export function applyCashMovement(key, amount) {
  state.data.appliedCashMovements = { ...(state.data.appliedCashMovements || {}) };
  const previous = Number(state.data.appliedCashMovements[key] || 0);
  const next = Number(amount || 0);
  adjustAccountBalance(next - previous);
  if (next) state.data.appliedCashMovements[key] = next;
  else delete state.data.appliedCashMovements[key];
}

export function accountBalanceCard(value) {
  const tone = value >= 0 ? "positive" : "negative";
  return `
    <button class="metric editable-metric" type="button" data-edit-account-balance>
      <span>Saldo em conta</span>
      <strong class="${tone}">${currency.format(value)}</strong>
      <small>Editar saldo</small>
    </button>
  `;
}

export function projectedBalanceCard(value) {
  const tone = value >= 0 ? "positive" : "negative";
  return `
    <article class="metric projected-balance-card">
      <span>Saldo projetado do mês</span>
      <strong class="${tone}">${currency.format(value)}</strong>
      <small>Conta + entradas - saídas</small>
    </article>
  `;
}

export function monthReferenceCard(month, isClosed) {
  return `
    <article class="metric month-reference-card">
      <span>Mês de referência</span>
      <strong>${formatMonthLong(month)}</strong>
      <small class="${isClosed ? "negative" : "positive"}">${isClosed ? "Fechado" : "Em andamento"}</small>
    </article>
  `;
}

export function openPlannedDialog(id = null, kind = null) {
  if (state.hydrateFn) state.hydrateFn();
  state.plannedEditingId = id;
  state.plannedEditingKind = kind;
  el.plannedForm.reset();
  const income = kind === "income" && id ? state.data.incomeLines.find((item) => item.id === id) : null;
  const expense = kind === "expense" && id ? state.data.plannedPurchases.find((item) => item.id === id) : null;
  const item = income || expense;
  const submitLabel = el.plannedForm.querySelector("button[type='submit'] span");
  if (submitLabel) submitLabel.textContent = item ? "Salvar lançamento" : "Adicionar ao planejamento";
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

export function closePlannedDialog() {
  state.plannedEditingId = null;
  state.plannedEditingKind = null;
  el.plannedForm.elements.kind.disabled = false;
  el.plannedForm.reset();
  el.plannedDialog.close();
}

export function updatePlannedFields() {
  const isIncome = el.plannedForm.elements.kind.value === "income";
  el.plannedCredorField.hidden = isIncome;
  el.plannedFonteField.hidden = !isIncome;
  el.plannedForm.elements.creditorId.required = !isIncome;
  el.plannedForm.elements.sourceCreditorId.required = isIncome;
  el.plannedForm.elements.kind.disabled = Boolean(state.plannedEditingId);
}

export async function addPlannedPurchase(event) {
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
  if (state.saveStateFn) await state.saveStateFn(editing ? "Lançamento planejado atualizado." : "Lançamento planejado adicionado.");
}

export async function deleteManualPlanned(id) {
  state.data.incomeLines = state.data.incomeLines.filter((item) => item.id !== id);
  state.data.plannedPurchases = state.data.plannedPurchases.filter((item) => item.id !== id);
  state.data.receivedOccurrences = (state.data.receivedOccurrences || []).filter((key) => !key.startsWith(`${id}:`));
  state.data.paidOccurrences = (state.data.paidOccurrences || []).filter((key) => !key.startsWith(`${id}:`));
  if (state.data.receivedAmounts) {
    Object.keys(state.data.receivedAmounts).forEach((key) => {
      if (key.startsWith(`${id}:`)) delete state.data.receivedAmounts[key];
    });
  }
  ["paidAmounts", "paidDates"].forEach((field) => {
    if (!state.data[field]) return;
    Object.keys(state.data[field]).forEach((key) => {
      if (key.startsWith(`${id}:`)) delete state.data[field][key];
    });
  });
  if (state.saveStateFn) await state.saveStateFn("Lançamento planejado excluído.");
}

export async function togglePaidOccurrence(key) {
  const paid = state.data.paidOccurrences || [];
  if (paid.includes(key)) {
    await cancelPaidOccurrence(key);
  } else {
    await registerPaidOccurrence(key, null, todayIsoDate());
  }
}

export function openExpensePaymentDialog(key, expected, label) {
  el.expensePaymentTitle.textContent = label || "Registrar pagamento";
  el.expensePaymentForm.elements.key.value = key;
  el.expensePaymentForm.elements.paidAmount.value = formatCurrencyInput(paidAmount(key, Number(expected || 0)));
  el.expensePaymentForm.elements.paymentDate.value = state.data.paidDates?.[key] || todayIsoDate();
  el.expensePaymentDialog.showModal();
}

export async function confirmPaidOccurrence(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const key = String(form.get("key"));
  const amount = parseCurrencyInput(form.get("paidAmount"));
  const paymentDate = String(form.get("paymentDate") || todayIsoDate());
  el.expensePaymentDialog.close();
  await registerPaidOccurrence(key, amount, paymentDate);
}

export async function registerPaidOccurrence(key, amount, paymentDate) {
  const value = amount == null ? undefined : Number(amount || 0);
  state.data.paidOccurrences = [...new Set([...(state.data.paidOccurrences || []), key])];
  state.data.paidAmounts = { ...(state.data.paidAmounts || {}) };
  state.data.paidDates = { ...(state.data.paidDates || {}) };
  if (value != null) state.data.paidAmounts[key] = value;
  state.data.paidDates[key] = paymentDate || todayIsoDate();
  applyCashMovement(key, -paidAmount(key, value || 0));
  syncExpenseSource(key, true, value, state.data.paidDates[key]);
  if (state.saveStateFn) await state.saveStateFn("Pagamento registrado.");
}

export async function cancelPaidOccurrence(key) {
  state.data.paidOccurrences = (state.data.paidOccurrences || []).filter((item) => item !== key);
  if (state.data.paidAmounts) delete state.data.paidAmounts[key];
  if (state.data.paidDates) delete state.data.paidDates[key];
  applyCashMovement(key, 0);
  syncExpenseSource(key, false);
  if (state.saveStateFn) await state.saveStateFn("Pagamento cancelado.");
}

export async function toggleReceivedOccurrence(key) {
  const received = state.data.receivedOccurrences || [];
  if (received.includes(key)) {
    state.data.receivedOccurrences = received.filter((item) => item !== key);
    if (state.saveStateFn) await state.saveStateFn("Entrada marcada como prevista.");
  } else {
    state.data.receivedOccurrences = [...received, key];
    if (state.saveStateFn) await state.saveStateFn("Entrada recebida.");
  }
}

export async function cancelReceivedOccurrence(key) {
  state.data.receivedOccurrences = (state.data.receivedOccurrences || []).filter((item) => item !== key);
  if (state.data.receivedAmounts) delete state.data.receivedAmounts[key];
  applyCashMovement(key, 0);
  if (state.saveStateFn) await state.saveStateFn("Recebimento cancelado.");
}

export function splitOccurrenceKey(key) {
  const index = String(key).lastIndexOf(":");
  if (index < 0) return { rowId: String(key), month: "" };
  return { rowId: String(key).slice(0, index), month: String(key).slice(index + 1) };
}

export function syncExpenseSource(key, paid, amount, paymentDate) {
  const { rowId, month } = splitOccurrenceKey(key);
  if (rowId === "auto-car") {
    const payment = state.data.car.payments.find((item) => carPaymentMonthLocal(item) === month);
    if (payment) {
      payment.status = paid ? "Pago" : "Pendente";
      payment.paidAmount = paid ? Number(amount ?? payment.value ?? 0) : 0;
      payment.paymentDate = paid ? (paymentDate || todayIsoDate()) : "";
    }
  }
  if (rowId.startsWith("child-car|")) {
    const paymentId = rowId.split("|")[1];
    const payment = state.data.car.payments.find((item) => item.id === paymentId);
    if (payment) {
      payment.status = paid ? "Pago" : "Pendente";
      payment.paidAmount = paid ? Number(amount ?? payment.value ?? 0) : 0;
      payment.paymentDate = paid ? (paymentDate || todayIsoDate()) : "";
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
  if (rowId.startsWith("child-installment|")) {
    // "child-installment|{itemId}|{number}" — pagar/cancelar parcela filha precisa
    // atualizar paidInstallments para que a mesma parcela não reapareça no mês seguinte.
    const parts = rowId.split("|");
    const itemId = parts[1];
    const number = Number(parts[2] || 0);
    const item = state.data.installments.find((entry) => entry.id === itemId);
    if (item && number > 0) {
      item.paidInstallments = paid
        ? Math.min(Number(item.totalInstallments || 0), Math.max(Number(item.paidInstallments || 0), number))
        : Math.max(0, number - 1);
    }
  }
}

export async function closeMonth() {
  const month = nextMonths(1)[0];
  const rows = buildProjectionRows([month], true);
  const entries = rows.filter((row) => row.kind === "income" && (row.values[month] || 0) > 0);
  const exits = rows.filter((row) => row.kind === "expense" && ((row.values[month] || 0) > 0 || rowHasAnyPayment(row, month)));
  const hasPending = entries.some((row) => !isIncomeReceived(`${row.id}:${month}`))
    || exits.some((row) => rowOutstanding(row, month, row.values[month] || 0) > 0);
  if (hasPending) {
    showToast("Baixe todas as entradas e saídas antes de fechar.");
    return;
  }
  if (!window.confirm(`Fechar ${formatMonthLong(month)} e levar o saldo atual para o próximo mês?`)) return;
  state.data.accountBalance = Number(state.data.accountBalance || state.data.initialBalance || 0);
  state.data.initialBalance = state.data.accountBalance;
  state.data.closedMonths = [...new Set([...(state.data.closedMonths || []), month])];
  if (state.saveStateFn) await state.saveStateFn("Mês fechado e saldo levado para o próximo cálculo.");
}

export function openAccountBalanceDialog() {
  el.accountBalanceForm.elements.accountBalance.value = formatCurrencyInput(state.data.accountBalance || state.data.initialBalance || "");
  el.accountBalanceDialog.showModal();
}

export async function saveAccountBalance(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.accountBalance = parseCurrencyInput(form.get("accountBalance"));
  state.data.initialBalance = state.data.accountBalance;
  el.accountBalanceDialog.close();
  if (state.saveStateFn) await state.saveStateFn("Saldo em conta atualizado.");
}

export function openReceiveDialog(key, expected) {
  const [rowId] = key.split(":");
  const row = buildProjectionRows(nextMonths(1), true).find((item) => item.id === rowId);
  el.receiveTitle.textContent = row?.label || "Confirmar entrada";
  el.receiveForm.elements.key.value = key;
  el.receiveForm.elements.amount.value = formatCurrencyInput(receivedAmount(key, Number(expected || 0)));
  el.receiveDialog.showModal();
}

export async function confirmReceivedOccurrence(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const key = String(form.get("key"));
  const amount = parseCurrencyInput(form.get("amount"));
  state.data.receivedOccurrences = [...new Set([...(state.data.receivedOccurrences || []), key])];
  state.data.receivedAmounts = { ...(state.data.receivedAmounts || {}), [key]: amount };
  applyCashMovement(key, amount);
  el.receiveDialog.close();
  if (state.saveStateFn) await state.saveStateFn("Entrada recebida.");
}

export function openFixedCostAmountDialog(key) {
  const { rowId, month } = splitOccurrenceKey(key);
  const id = rowId.replace("child-fixed|", "");
  const cost = state.data.fixedCosts.find((item) => item.id === id);
  const overrideKey = `${id}:${month}`;
  const overrides = state.data.fixedCostAmountOverrides || {};
  const current = overrides[overrideKey] !== undefined ? overrides[overrideKey] : Number(cost?.amount || 0);
  el.fixedCostAmountForm.elements.key.value = overrideKey;
  el.fixedCostAmountForm.elements.amount.value = formatCurrencyInput(current);
  el.fixedCostAmountTitle.textContent = cost?.name || "Custo fixo";
  el.fixedCostAmountDialog.showModal();
}

export async function saveFixedCostAmount(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const key = String(form.get("key"));
  const amount = parseCurrencyInput(form.get("amount"));
  state.data.fixedCostAmountOverrides = { ...(state.data.fixedCostAmountOverrides || {}), [key]: amount };
  el.fixedCostAmountDialog.close();
  if (state.saveStateFn) await state.saveStateFn("Valor do custo fixo ajustado para o mês.");
}
