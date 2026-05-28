import { state, el, currency } from "./state.js";
import { escapeHtml, icon, formatCurrencyInput, parseCurrencyInput, showToast, nextMonths, formatMonth, refreshIcons, addMonthsToDate } from "./utils.js";
import { calcNetClt } from "./taxes.js";
import { getCreditorName, getCreditor, getCreditCard, sortedCreditors, sortedCreditCards, creditorLogoHtml, sourceLogoHtml, initials, isCreditCardInUse, creditorUsageCount, cardOpenBalance } from "./creditors.js";
import { createDefaultData, normalizedIncomeChanges } from "./data.js";
import { latestIncomeChange, upsertIncomeChange } from "./planejamento.js";
import { openFeriasDialog, openDecimoTerceiroDialog } from "./ferias.js";

export function renderSettings() {
  el.settingsForm.elements.kahLimit.value = formatCurrencyInput(state.data.kahLimit || "");
}

export function renderOrigins() {
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

export function renderOriginsV2() {
  el.creditorList.innerHTML = `
    <thead><tr><th>Credor</th><th>Formas</th><th class="col-center">Vínculos</th><th class="col-center">Ações</th></tr></thead>
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
            <td class="col-center">${creditorUsageCount(creditor.id)}</td>
            <td class="row-actions col-center">
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

export function renderCreditCards() {
  el.cardList.innerHTML = `
    <thead><tr><th>Cartão/Crediário</th><th>Credor</th><th class="col-center">Titular</th><th class="col-center">Venc.</th><th class="col-right">Total comprometido</th><th class="col-center">Ações</th></tr></thead>
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
            <td class="col-center"><span class="owner-pill">${escapeHtml(card.owner || "Felipe")}</span></td>
            <td class="col-center">${card.dueDay || "-"}</td>
            <td class="col-right">${currency.format(cardOpenBalance(card.id))}</td>
            <td class="row-actions col-center">
              <button class="icon-button mini-icon" type="button" title="Editar" data-edit-card="${card.id}">${icon("pencil")}</button>
              <button class="icon-button mini-icon danger-mini" type="button" title="${inUse ? "Cartão vinculado" : "Excluir"}" data-delete-card="${card.id}">${icon(inUse ? "ban" : "trash-2")}</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="6" class="muted-cell">Nenhum cartão ou crediário cadastrado.</td></tr>`}
    </tbody>
  `;

  el.cardList.querySelectorAll("[data-edit-card]").forEach((button) => {
    button.addEventListener("click", () => openCardDialog(button.dataset.editCard));
  });
  el.cardList.querySelectorAll("[data-delete-card]").forEach((button) => {
    button.addEventListener("click", () => deleteCreditCard(button.dataset.deleteCard));
  });
}


export function renderRecurringIncomes() {
  el.incomeList.innerHTML = `
    <thead><tr><th>Renda</th><th>Fonte</th><th class="col-center">Titular</th><th class="col-center">Dia</th><th class="col-right">Valor atual</th><th class="col-center">Ações</th></tr></thead>
    <tbody>
      ${state.data.recurringIncomes.map((income) => {
        const current = latestIncomeChange(income);
        const gross = current.amount || 0;
        const net = income.isClt && gross > 0
          ? Math.max(0, calcNetClt(gross, income.clt?.consignado || 0, income.clt?.alimentacao ?? 1))
          : null;
        const netHtml = net !== null
          ? `<br><small class="income-net">líq. ${currency.format(net)}</small>`
          : "";
        const cltButtons = income.isClt ? `
          <button class="income-act-btn" type="button" data-ferias-income="${income.id}" data-tip="Férias">${icon("palmtree")}</button>
          <button class="income-act-btn" type="button" data-decimo-income="${income.id}" data-tip="13º salário">13º</button>
        ` : "";
        return `
          <tr>
            <td><div class="entity-cell">${sourceLogoHtml(income.logoUrl, income.label)}<strong>${escapeHtml(income.label)}</strong></div></td>
            <td>${escapeHtml(income.origin || "-")}</td>
            <td class="col-center"><span class="owner-pill">${escapeHtml(income.owner || "Felipe")}</span></td>
            <td class="col-center">${income.receiveDay || 1}</td>
            <td class="col-right">${currency.format(gross)}${netHtml}</td>
            <td class="row-actions col-center">
              <button class="income-act-btn" type="button" data-edit-income="${income.id}" data-tip="Editar / Reajustar">${icon("pencil")}</button>
              ${cltButtons}
              <button class="income-act-btn danger" type="button" data-delete-income="${income.id}" data-tip="Excluir">${icon("trash-2")}</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="6" class="muted-cell">Nenhuma renda recorrente cadastrada.</td></tr>`}
    </tbody>
  `;

  el.incomeList.querySelectorAll("[data-edit-income]").forEach((button) => {
    button.addEventListener("click", () => openIncomeDialog(button.dataset.editIncome));
  });
  el.incomeList.querySelectorAll("[data-ferias-income]").forEach((button) => {
    button.addEventListener("click", () => openFeriasDialog(button.dataset.feriasIncome));
  });
  el.incomeList.querySelectorAll("[data-decimo-income]").forEach((button) => {
    button.addEventListener("click", () => openDecimoTerceiroDialog(button.dataset.decimoIncome));
  });
  el.incomeList.querySelectorAll("[data-delete-income]").forEach((button) => {
    button.addEventListener("click", () => deleteRecurringIncome(button.dataset.deleteIncome));
  });
}

export async function deleteIncomeChange(incomeId, month) {
  const income = state.data.recurringIncomes.find((i) => i.id === incomeId);
  if (!income) return;
  const sorted = [...(income.changes || [])].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length <= 1) {
    showToast("Não é possível excluir a entrada base.");
    return;
  }
  if (sorted[0]?.month === month) {
    showToast("Não é possível excluir a entrada base. Use Editar/Reajustar para alterar o valor inicial.");
    return;
  }
  income.changes = income.changes.filter((c) => c.month !== month);
  if (state.renderFn) state.renderFn();
  if (state.saveStateFn) await state.saveStateFn("Entrada de renda excluída.");
}

export function hydrateForms() {
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
    const methods = availablePaymentMethods();
    select.innerHTML = [
      `<option value="">Selecione</option>`,
      ...methods.map((method) => `<option value="${escapeHtml(method)}">${escapeHtml(method)}</option>`)
    ].join("");
    select.value = current && methods.includes(current) ? current : "";
  });
  document.querySelectorAll("[data-owner-select]").forEach((select) => {
    const current = select.value;
    select.innerHTML = ["Felipe", "Kah"].map((owner) => `<option value="${owner}">${owner}</option>`).join("");
    if (current) select.value = current;
  });
  const start = nextMonths(1)[0];
  if (el.plannedForm.elements.month) el.plannedForm.elements.month.value = start;
  if (el.plannedForm.elements.date && !el.plannedForm.elements.date.value) el.plannedForm.elements.date.value = `${start}-01`;
  if (el.incomeForm.elements.startDate && !el.incomeForm.elements.startDate.value) el.incomeForm.elements.startDate.value = `${start}-01`;
}

export function defaultPaymentMethod() {
  const methods = availablePaymentMethods();
  return methods.find((method) => method !== "Cartão de crédito") || methods[0] || "PIX";
}

export function availablePaymentMethods() {
  const defaults = createDefaultData().paymentMethods;
  const methods = Array.isArray(state.data.paymentMethods) && state.data.paymentMethods.length
    ? state.data.paymentMethods
    : defaults;
  return [...new Set([...methods, "Cartão de crédito"])];
}

export async function addCreditor(event) {
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
  if (state.saveStateFn) await state.saveStateFn(existing ? "Credor atualizado." : "Credor cadastrado.");
}

export function openCreditorDialog(id = null) {
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

export function closeCreditorDialog() {
  state.creditorEditingId = null;
  el.creditorForm.reset();
  renderCreditorLogoPreview("");
  el.creditorDialog.close();
}

export async function deleteCreditor(id) {
  if (isCreditorInUse(id)) {
    showToast("Este credor está vinculado a lançamentos.");
    return;
  }
  state.data.creditors = state.data.creditors.filter((creditor) => creditor.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Credor excluído.");
}

export function openCardDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
  state.cardEditingId = id;
  el.cardForm.reset();
  const card = id ? getCreditCard(id) : null;
  el.cardDialogTitle.textContent = card ? "Editar cartão/crediário" : "Novo cartão/crediário";
  el.cardForm.elements.name.value = card?.name || "";
  el.cardForm.elements.creditorId.value = card?.creditorId || el.cardForm.elements.creditorId.value;
  el.cardForm.elements.owner.value = card?.owner || "Felipe";
  el.cardForm.elements.dueDay.value = card?.dueDay || "";
  updateCardLogoPreview();
  el.cardDialog.showModal();
  refreshIcons();
}

export function closeCardDialog() {
  state.cardEditingId = null;
  el.cardForm.reset();
  renderCardLogoPreview("");
  el.cardDialog.close();
}

export async function saveCreditCard(event) {
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
    owner: String(form.get("owner") || "Felipe"),
    dueDay: Number(form.get("dueDay") || 1)
  };
  if (existing) {
    Object.assign(existing, payload);
  } else {
    state.data.creditCards.push(payload);
  }
  closeCardDialog();
  if (state.saveStateFn) await state.saveStateFn(existing ? "Cartão/crediário atualizado." : "Cartão/crediário cadastrado.");
}

export async function deleteCreditCard(id) {
  if (isCreditCardInUse(id)) {
    showToast("Este cartão/crediário está vinculado a parcelamentos.");
    return;
  }
  state.data.creditCards = state.data.creditCards.filter((card) => card.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Cartão/crediário excluído.");
}

export function updateCardLogoPreview() {
  renderCardLogoPreview(el.cardForm.elements.creditorId.value);
}

export function renderCardLogoPreview(creditorId) {
  const creditor = getCreditor(creditorId);
  el.cardLogoPreview.innerHTML = creditor?.logoUrl
    ? `<img alt="${escapeHtml(creditor.name)}" src="${escapeHtml(creditor.logoUrl)}">`
    : escapeHtml(initials(creditor?.name || "CC"));
}

export function toggleIncomeCltFields() {
  const label = el.incomeForm?.elements?.label?.value || "";
  const isClt = label === "Salário ATP";
  const cltHeader = document.querySelector("#incomeCltHeader");
  const cltFields = document.querySelector("#incomeCltFields");
  const amountLabelText = document.querySelector("#incomeAmountLabelText");
  if (cltHeader) cltHeader.hidden = !isClt;
  if (cltFields) cltFields.hidden = !isClt;
  if (amountLabelText) amountLabelText.textContent = isClt ? "Salário bruto" : "Valor";
  _updateIncomeLiquidoStrip();
  renderIncomeLogoPreview(el.incomeForm?.elements?.logoUrl?.value || "");
}

function _updateIncomeLiquidoStrip() {
  const valorEl = document.querySelector("#incomeLiquidoValor");
  if (!valorEl) return;
  const form = el.incomeForm;
  const gross = parseCurrencyInput(form?.elements?.amount?.value || "0");
  const consignado = parseCurrencyInput(form?.elements?.cltConsignado?.value || "0");
  const alimentacao = parseFloat(form?.elements?.cltAlimentacao?.value || "1") || 1;
  const net = gross > 0 ? Math.max(0, calcNetClt(gross, consignado, alimentacao)) : 0;
  valorEl.textContent = currency.format(net);
}

export function openIncomeDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
  state.incomeEditingId = id;
  el.incomeForm.reset();
  const income = id ? state.data.recurringIncomes.find((item) => item.id === id) : null;
  const current = income ? latestIncomeChange(income) : { month: nextMonths(1)[0], amount: 0 };
  el.incomeDialogTitle.textContent = income ? "Editar/Reajustar renda" : "Nova renda";

  // Renda select + Fonte
  el.incomeForm.elements.label.value = income?.label || "Salário ATP";
  el.incomeForm.elements.origin.value = income?.origin || "";
  el.incomeForm.elements.logoUrl.value = income?.logoUrl || "";

  // Titular
  el.incomeForm.elements.owner.value = income?.owner || "Felipe";

  // Data inicial: reconstruir a partir de month + receiveDay
  const month = current.month || nextMonths(1)[0];
  const day = String(income?.receiveDay || 5).padStart(2, "0");
  el.incomeForm.elements.startDate.value = `${month}-${day}`;

  // Valor / Salário bruto
  el.incomeForm.elements.amount.value = current.amount ? formatCurrencyInput(current.amount) : "";

  // Campos CLT
  if (income?.clt) {
    el.incomeForm.elements.cltConsignado.value = income.clt.consignado ? formatCurrencyInput(income.clt.consignado) : "";
    el.incomeForm.elements.cltAlimentacao.value = income.clt.alimentacao ?? 1;
  }

  // Mostrar/ocultar campos condicionais + label + faixa líquido
  toggleIncomeCltFields();
  renderIncomeLogoPreview(income?.logoUrl || "");
  el.incomeDialog.showModal();
  refreshIcons();
}

export function closeIncomeDialog() {
  state.incomeEditingId = null;
  el.incomeForm.reset();
  renderIncomeLogoPreview("");
  el.incomeDialog.close();
}

export async function saveRecurringIncome(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  // startDate → month (YYYY-MM) + receiveDay (dia do mês)
  const startDate = String(form.get("startDate") || "");
  const month = startDate.slice(0, 7) || nextMonths(1)[0];
  const receiveDay = parseInt(startDate.split("-")[2], 10) || 5;

  const label = String(form.get("label")).trim();
  const amount = parseCurrencyInput(form.get("amount"));
  // isClt é automático pelo label
  const isClt = label === "Salário ATP";
  const cltConsignado = parseCurrencyInput(form.get("cltConsignado") || "0");
  const cltAlimentacao = parseFloat(form.get("cltAlimentacao") || "1") || 1;
  const clt = isClt ? { consignado: cltConsignado, alimentacao: cltAlimentacao } : null;

  const existing = state.incomeEditingId
    ? state.data.recurringIncomes.find((item) => item.id === state.incomeEditingId)
    : null;
  if (existing) {
    existing.label = label;
    existing.origin = String(form.get("origin")).trim();
    existing.logoUrl = String(form.get("logoUrl") || "");
    existing.owner = String(form.get("owner") || "Felipe");
    existing.receiveDay = receiveDay;
    existing.changes = upsertIncomeChange(existing.changes || [], month, amount);
    existing.isClt = isClt;
    existing.clt = clt;
  } else {
    state.data.recurringIncomes.push({
      id: crypto.randomUUID(),
      label,
      origin: String(form.get("origin")).trim(),
      logoUrl: String(form.get("logoUrl") || ""),
      owner: String(form.get("owner") || "Felipe"),
      receiveDay,
      changes: [{ month, amount }],
      isClt,
      clt
    });
  }
  closeIncomeDialog();
  if (state.saveStateFn) await state.saveStateFn(existing ? "Renda recorrente atualizada." : "Renda recorrente cadastrada.");
}

export async function deleteRecurringIncome(id) {
  state.data.recurringIncomes = state.data.recurringIncomes.filter((item) => item.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Renda recorrente excluída.");
}

// openFeriasDialog e openDecimoTerceiroDialog implementados em ferias.js, re-exportados para app.js
export { openFeriasDialog, openDecimoTerceiroDialog };

function _prefillExceptionAmount(income, month) {
  if (!income || !month) return;
  const changes = normalizedIncomeChanges(income);
  const active = [...changes].reverse().find((c) => c.month <= month);
  el.incomeExceptionForm.elements.amount.value = active?.amount
    ? formatCurrencyInput(active.amount)
    : "";
}

export function openIncomeExceptionDialog(id) {
  state.incomeExceptionId = id;
  const income = state.data.recurringIncomes.find((item) => item.id === id);
  el.incomeExceptionDialogTitle.textContent = income ? `Exceção: ${income.label}` : "Exceção de mês";
  el.incomeExceptionForm.reset();
  const defaultMonth = nextMonths(1)[0];
  el.incomeExceptionForm.elements.month.value = defaultMonth;
  _prefillExceptionAmount(income, defaultMonth);

  // Re-prefill amount whenever the month changes
  const monthEl = el.incomeExceptionForm.elements.month;
  const onMonthChange = () => {
    const inc = state.data.recurringIncomes.find((item) => item.id === state.incomeExceptionId);
    _prefillExceptionAmount(inc, monthEl.value);
  };
  monthEl.removeEventListener("change", monthEl._exceptionMonthHandler);
  monthEl._exceptionMonthHandler = onMonthChange;
  monthEl.addEventListener("change", onMonthChange);

  el.incomeExceptionDialog.showModal();
}

export function closeIncomeExceptionDialog() {
  state.incomeExceptionId = null;
  el.incomeExceptionForm.reset();
  el.incomeExceptionDialog.close();
}

export async function saveIncomeException(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const month = String(form.get("month"));
  const amount = parseCurrencyInput(form.get("amount"));
  const income = state.data.recurringIncomes.find((item) => item.id === state.incomeExceptionId);
  if (!income) { closeIncomeExceptionDialog(); return; }
  if (!amount) { showToast("Informe o valor do salário para o mês de exceção."); return; }

  const changes = normalizedIncomeChanges(income);
  const nextMonth = addMonthsToDate(`${month}-01`, 1).slice(0, 7);

  // Revert target: if the exception month already had a permanent salary change,
  // revert to that salary; otherwise revert to the latest change BEFORE the exception.
  // This avoids zeroing out subsequent months when the income started on the exception month.
  const existingChangeForMonth = changes.find((c) => c.month === month);
  const priorChange = [...changes].reverse().find((c) => c.month < month);
  const revertAmount = existingChangeForMonth?.amount ?? priorChange?.amount ?? 0;

  income.changes = upsertIncomeChange(income.changes || [], month, amount);

  // Only add the revert if there is no explicit change already defined for nextMonth
  if (!changes.find((c) => c.month === nextMonth) && revertAmount > 0) {
    income.changes = upsertIncomeChange(income.changes, nextMonth, revertAmount);
  }

  closeIncomeExceptionDialog();
  if (state.saveStateFn) await state.saveStateFn("Exceção de renda cadastrada.");
}

export function isCreditorInUse(id) {
  return state.data.creditCards.some((card) => card.creditorId === id)
    || state.data.installments.some((item) => item.creditorId === id)
    || state.data.fixedCosts.some((item) => item.creditorId === id)
    || state.data.plannedPurchases.some((item) => item.creditorId === id)
    || state.data.fgts.contracts.some((item) => item.creditorId === id)
    || state.data.car.creditorId === id
    || state.data.projectionLines.some((item) => item.creditorId === id || item.match === id);
}

export function handleCreditorLogoUpload(event) {
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

export function renderCreditorLogoPreview(src) {
  el.creditorLogoPreview.innerHTML = src ? `<img alt="Logo" src="${escapeHtml(src)}">` : "CR";
}

export function handleIncomeLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 250 * 1024) {
    showToast("Use uma logo menor, ate 250 KB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    el.incomeForm.elements.logoUrl.value = String(reader.result || "");
    renderIncomeLogoPreview(el.incomeForm.elements.logoUrl.value);
  };
  reader.readAsDataURL(file);
}

export function renderIncomeLogoPreview(src) {
  if (src) {
    el.incomeLogoPreview.innerHTML = `<img alt="Logo" src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  } else {
    const label = el.incomeForm?.elements?.label?.value || "";
    el.incomeLogoPreview.textContent = initials(label) || "RD";
  }
}

export function renderTaxTables() {
  const container = document.querySelector("#taxTablesBlock");
  if (!container) return;
  const t = state.data.taxes ?? {};
  const inss = t.inss ?? [];
  const irrf = t.irrf ?? {};
  const brackets = irrf.brackets ?? [];

  container.innerHTML = `
    <div class="tax-table-section">
      <div class="tax-table-header">
        <strong>INSS &mdash; faixas progressivas</strong>
        <button class="small-button" type="button" id="addInssRowBtn">+ Faixa</button>
      </div>
      <div class="table-wrap">
        <table class="data-table clean-table">
          <thead><tr><th>Até (R$)</th><th>Alíquota (%)</th><th></th></tr></thead>
          <tbody id="inssRows">
            ${inss.map((b) => `
              <tr>
                <td><input type="number" class="inss-upto" step="0.01" min="0" value="${b.upTo}"></td>
                <td><input type="number" class="inss-rate" step="0.01" min="0" max="100" value="${b.rate}"></td>
                <td><button class="small-button danger-mini" type="button" data-remove-row>&minus;</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="tax-table-section">
      <div class="tax-table-header">
        <strong>IRRF &mdash; faixas e alíquotas</strong>
        <button class="small-button" type="button" id="addIrrfRowBtn">+ Faixa</button>
      </div>
      <div class="form-row">
        <label class="tax-simpl-label">Isenção total até (R$ bruto)<input type="number" id="irrfExemptionLimit" step="0.01" min="0" value="${irrf.exemptionLimit ?? 5000}"></label>
        <label class="tax-simpl-label">Desconto parcial até (R$ bruto)<input type="number" id="irrfPartialLimit" step="0.01" min="0" value="${irrf.partialLimit ?? 7350}"></label>
      </div>
      <div class="table-wrap">
        <table class="data-table clean-table">
          <thead><tr><th>Até (R$) &mdash; vazio = acima</th><th>Alíquota (%)</th><th>Dedução (R$)</th><th></th></tr></thead>
          <tbody id="irrfRows">
            ${brackets.map((b) => `
              <tr>
                <td><input type="number" class="irrf-upto" step="0.01" min="0" value="${b.upTo ?? ""}"></td>
                <td><input type="number" class="irrf-rate" step="0.01" min="0" max="100" value="${b.rate}"></td>
                <td><input type="number" class="irrf-deduction" step="0.01" min="0" value="${b.deduction || 0}"></td>
                <td><button class="small-button danger-mini" type="button" data-remove-row>&minus;</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <button class="primary-button full" type="button" id="saveTaxTablesBtn">Salvar tabelas tributárias</button>
    <small class="tax-tables-note">Atualize quando o governo publicar novos valores. Usado pelo Simulador de Férias.</small>
  `;

  document.querySelector("#addInssRowBtn")?.addEventListener("click", () => {
    const tbody = document.querySelector("#inssRows");
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" class="inss-upto" step="0.01" min="0" placeholder="Ex: 5000"></td>
      <td><input type="number" class="inss-rate" step="0.01" min="0" max="100" placeholder="Ex: 14"></td>
      <td><button class="small-button danger-mini" type="button" data-remove-row>&minus;</button></td>
    `;
    tr.querySelector("[data-remove-row]").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
  });

  document.querySelector("#addIrrfRowBtn")?.addEventListener("click", () => {
    const tbody = document.querySelector("#irrfRows");
    if (!tbody) return;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" class="irrf-upto" step="0.01" min="0" placeholder="vazio = acima"></td>
      <td><input type="number" class="irrf-rate" step="0.01" min="0" max="100" placeholder="Ex: 15"></td>
      <td><input type="number" class="irrf-deduction" step="0.01" min="0" placeholder="Ex: 394.16"></td>
      <td><button class="small-button danger-mini" type="button" data-remove-row>&minus;</button></td>
    `;
    tr.querySelector("[data-remove-row]").addEventListener("click", () => tr.remove());
    tbody.appendChild(tr);
  });

  container.querySelectorAll("[data-remove-row]").forEach((btn) => {
    btn.addEventListener("click", () => btn.closest("tr").remove());
  });

  document.querySelector("#saveTaxTablesBtn")?.addEventListener("click", saveTaxTables);
}

async function saveTaxTables() {
  const inss = [];
  document.querySelectorAll("#inssRows tr").forEach((tr) => {
    const upTo = parseFloat(tr.querySelector(".inss-upto")?.value ?? "");
    const rate = parseFloat(tr.querySelector(".inss-rate")?.value ?? "");
    if (!isNaN(upTo) && !isNaN(rate)) inss.push({ upTo, rate });
  });
  inss.sort((a, b) => a.upTo - b.upTo);

  const brackets = [];
  document.querySelectorAll("#irrfRows tr").forEach((tr) => {
    const upToVal = tr.querySelector(".irrf-upto")?.value ?? "";
    const upTo = upToVal === "" ? null : parseFloat(upToVal);
    const rate = parseFloat(tr.querySelector(".irrf-rate")?.value ?? "");
    const deduction = parseFloat(tr.querySelector(".irrf-deduction")?.value ?? "0") || 0;
    if (!isNaN(rate)) brackets.push({ upTo: (upToVal !== "" && !isNaN(upTo)) ? upTo : null, rate, deduction });
  });
  brackets.sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });

  const exemptionLimit = parseFloat(document.querySelector("#irrfExemptionLimit")?.value ?? "5000") || 5000;
  const partialLimit = parseFloat(document.querySelector("#irrfPartialLimit")?.value ?? "7350") || 7350;

  if (!state.data.taxes) state.data.taxes = {};
  state.data.taxes.inss = inss;
  state.data.taxes.irrf = { exemptionLimit, partialLimit, brackets };

  if (state.saveStateFn) await state.saveStateFn("Tabelas tributárias salvas.");
  document.querySelector("#taxTablesDialog")?.close();
}
