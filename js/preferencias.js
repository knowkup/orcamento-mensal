import { state, el, currency } from "./state.js";
import { escapeHtml, icon, formatCurrencyInput, parseCurrencyInput, showToast, nextMonths, formatMonth, refreshIcons } from "./utils.js";
import { getCreditorName, getCreditor, getCreditCard, sortedCreditors, sortedCreditCards, creditorLogoHtml, sourceLogoHtml, initials, isCreditCardInUse, creditorUsageCount, cardOpenBalance } from "./creditors.js";
import { createDefaultData } from "./data.js";
import { latestIncomeChange, upsertIncomeChange } from "./planejamento.js";

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

export function renderCreditCards() {
  el.cardList.innerHTML = `
    <thead><tr><th>Cartao/Crediario</th><th>Credor</th><th>Dono</th><th>Venc.</th><th>Saldo previsto</th><th>Acoes</th></tr></thead>
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
            <td>${card.dueDay || "-"}</td>
            <td>${currency.format(cardOpenBalance(card.id))}</td>
            <td class="row-actions">
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
    <thead><tr><th>Renda</th><th>Fonte</th><th>Dono</th><th>Receb.</th><th>Valor atual</th><th>Vale desde</th><th>Acoes</th></tr></thead>
    <tbody>
      ${state.data.recurringIncomes.map((income) => {
        const current = latestIncomeChange(income);
        return `
          <tr>
            <td><div class="entity-cell">${sourceLogoHtml(income.logoUrl, income.label)}<strong>${escapeHtml(income.label)}</strong></div></td>
            <td>${escapeHtml(income.origin || "-")}</td>
            <td>${escapeHtml(income.owner || "Felipe")}</td>
            <td>${income.receiveDay || 1}</td>
            <td>${currency.format(current.amount || 0)}</td>
            <td>${current.month ? formatMonth(current.month) : "-"}</td>
            <td class="row-actions">
              <button class="small-button" type="button" data-edit-income="${income.id}">Editar/Reajustar</button>
              <button class="small-button danger-mini" type="button" data-delete-income="${income.id}">Excluir</button>
            </td>
          </tr>
        `;
      }).join("") || `<tr><td colspan="7" class="muted-cell">Nenhuma renda recorrente cadastrada.</td></tr>`}
    </tbody>
  `;

  el.incomeList.querySelectorAll("[data-edit-income]").forEach((button) => {
    button.addEventListener("click", () => openIncomeDialog(button.dataset.editIncome));
  });
  el.incomeList.querySelectorAll("[data-delete-income]").forEach((button) => {
    button.addEventListener("click", () => deleteRecurringIncome(button.dataset.deleteIncome));
  });
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
  if (el.incomeForm.elements.month && !el.incomeForm.elements.month.value) el.incomeForm.elements.month.value = start;
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

export function openIncomeDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
  state.incomeEditingId = id;
  el.incomeForm.reset();
  const income = id ? state.data.recurringIncomes.find((item) => item.id === id) : null;
  const current = income ? latestIncomeChange(income) : { month: nextMonths(1)[0], amount: 0 };
  el.incomeDialogTitle.textContent = income ? "Editar/Reajustar renda" : "Nova renda";
  el.incomeForm.elements.label.value = income?.label || "";
  el.incomeForm.elements.origin.value = income?.origin || "";
  el.incomeForm.elements.logoUrl.value = income?.logoUrl || "";
  el.incomeForm.elements.owner.value = income?.owner || "Felipe";
  el.incomeForm.elements.receiveDay.value = income?.receiveDay || 1;
  el.incomeForm.elements.month.value = current.month || nextMonths(1)[0];
  el.incomeForm.elements.amount.value = current.amount ? formatCurrencyInput(current.amount) : "";
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
  const month = String(form.get("month"));
  const amount = parseCurrencyInput(form.get("amount"));
  const existing = state.incomeEditingId
    ? state.data.recurringIncomes.find((item) => item.id === state.incomeEditingId)
    : null;
  if (existing) {
    existing.label = String(form.get("label")).trim();
    existing.origin = String(form.get("origin")).trim();
    existing.logoUrl = String(form.get("logoUrl") || "");
    existing.owner = String(form.get("owner") || "Felipe");
    existing.receiveDay = Number(form.get("receiveDay") || 1);
    existing.changes = upsertIncomeChange(existing.changes || [], month, amount);
  } else {
    state.data.recurringIncomes.push({
      id: crypto.randomUUID(),
      label: String(form.get("label")).trim(),
      origin: String(form.get("origin")).trim(),
      logoUrl: String(form.get("logoUrl") || ""),
      owner: String(form.get("owner") || "Felipe"),
      receiveDay: Number(form.get("receiveDay") || 1),
      changes: [{ month, amount }]
    });
  }
  closeIncomeDialog();
  if (state.saveStateFn) await state.saveStateFn(existing ? "Renda recorrente atualizada." : "Renda recorrente cadastrada.");
}

export async function deleteRecurringIncome(id) {
  state.data.recurringIncomes = state.data.recurringIncomes.filter((item) => item.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Renda recorrente excluída.");
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
  el.incomeLogoPreview.innerHTML = src ? `<img alt="Logo" src="${escapeHtml(src)}">` : "RD";
}
