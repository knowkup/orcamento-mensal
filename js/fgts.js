import { state, el, currency } from "./state.js";
import { escapeHtml, icon, formatDate, formatCurrencyInput, parseCurrencyInput, todayIsoDate, nextAnnualDate, addYearsToDate, bindMoneyInputs, showToast, refreshIcons } from "./utils.js";
import { creditorLogoHtml, getCreditorName } from "./creditors.js";
import { metric, metaBox, debtTabs } from "./components.js";

export function normalizeFgtsContract(contract) {
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

export function createFgtsInstallments(total, amountOrValues, paid, firstDueDate) {
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

export function mergeFgtsInstallments(existing, total, amountOrValues, paid, firstDueDate) {
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

export function fgtsPendingTotal(contract) {
  normalizeFgtsContractShallow(contract);
  return (contract.installments || [])
    .filter((item) => item.status !== "Pago")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

export function normalizeFgtsContractShallow(contract) {
  if (contract.installments?.length) return;
  const total = Number(contract.totalInstallments || 1);
  const amount = Number(contract.installmentAmount || (contract.toPay && total ? Number(contract.toPay) / total : 0));
  contract.installments = createFgtsInstallments(total, amount, Number(contract.paidInstallments || 0), contract.firstDueDate);
}

export function fgtsAnnualPayments(contract) {
  const payments = contract.annualPayments || [];
  if (!payments.length) return `<div class="empty-state compact">Nenhum pagamento anual registrado.</div>`;
  return payments
    .map((payment) => `<span class="detail-pill ok">${payment.year} · ${currency.format(payment.amount)}</span>`)
    .join("");
}

export function fgtsContractCard(contract) {
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

export function renderFgts() {
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

export function renderFgtsV2() {
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

export function openFgtsDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
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

export function closeFgtsDialog() {
  state.fgtsEditingId = null;
  el.fgtsForm.reset();
  renderFgtsInstallmentValueFields();
  el.fgtsDialog.close();
}

export function renderFgtsInstallmentValueFields() {
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

export function getFgtsInstallmentValues(form, total) {
  const defaultValue = parseCurrencyInput(form.get("installmentAmount"));
  return Array.from({ length: total }, (_, index) => {
    const value = parseCurrencyInput(form.get(`installmentValue${index + 1}`));
    return value || defaultValue;
  });
}

export async function addFgtsContract(event) {
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
  if (state.saveStateFn) await state.saveStateFn(existing ? "Empréstimo FGTS atualizado." : "Empréstimo FGTS cadastrado.");
}

export async function addFgtsAnnualPayment(event) {
  event.preventDefault();
  const contract = state.data.fgts.contracts.find((item) => item.id === event.currentTarget.dataset.fgtsPayment);
  if (!contract) return;
  const form = new FormData(event.currentTarget);
  contract.annualPayments = contract.annualPayments || [];
  contract.annualPayments.push({ year: Number(form.get("year")), amount: Number(form.get("amount")) });
  if (state.saveStateFn) await state.saveStateFn("Pagamento FGTS registrado.");
}

export async function quitFgtsContract(event) {
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
  if (state.saveStateFn) await state.saveStateFn("Empréstimo FGTS quitado.");
}

export async function payFgtsInstallment(key) {
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
  if (state.saveStateFn) await state.saveStateFn("Parcela FGTS paga.");
}

export async function deleteFgtsContract(id) {
  state.data.fgts.contracts = state.data.fgts.contracts.filter((item) => item.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Empréstimo FGTS excluído.");
}
