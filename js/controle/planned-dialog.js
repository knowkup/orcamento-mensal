/**
 * Diálogo de lançamentos planejados (entradas e saídas manuais).
 * Extraído de controle.js para quebrar a dependência circular com planejamento.js.
 */
import { state, el } from "../state.js";
import { todayIsoDate, parseCurrencyInput, formatCurrencyInput } from "../utils.js";
import { removeManualPlanned } from "../domain/planned-transactions.js";

function populateFonteSelect(selectedValue = "") {
  const sel = el.plannedForm.elements.fonte;
  if (!sel || sel.tagName !== "SELECT") return;
  sel.innerHTML = "";
  const outros = (state.data.creditors || []).find((c) => c.name?.toLowerCase() === "outros");
  const outrosLabel = outros?.name || "Outros";
  const opt = document.createElement("option");
  opt.value = outrosLabel;
  opt.textContent = outrosLabel;
  sel.appendChild(opt);
  (state.data.recurringIncomes || []).forEach((inc) => {
    const o = document.createElement("option");
    o.value = inc.label;
    o.textContent = inc.label;
    sel.appendChild(o);
  });
  if (selectedValue) sel.value = selectedValue;
}

export function updatePlannedFields() {
  const isIncome = el.plannedForm.elements.kind.value === "income";
  el.plannedCredorField.hidden = isIncome;
  el.plannedFonteField.hidden = !isIncome;
  el.plannedForm.elements.creditorId.required = !isIncome;
  const editing = Boolean(state.plannedEditingId);
  const expBtn = document.querySelector("#plannedKindExpense");
  const incBtn = document.querySelector("#plannedKindIncome");
  expBtn?.classList.toggle("active", !isIncome);
  incBtn?.classList.toggle("active", isIncome);
  if (expBtn) expBtn.disabled = editing;
  if (incBtn) incBtn.disabled = editing;
  const titleEl = document.querySelector("#plannedDialogTitle");
  if (titleEl) titleEl.textContent = isIncome ? "Nova entrada" : "Nova saída";
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
  el.plannedForm.elements.kind.value = income ? "income" : kind === "income" ? "income" : "expense";
  el.plannedForm.elements.description.value = income?.label || expense?.description || "";
  el.plannedForm.elements.creditorId.value = expense?.creditorId || el.plannedForm.elements.creditorId.value;
  populateFonteSelect(income?.origin || "");
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

export async function addPlannedPurchase(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const kind = state.plannedEditingKind || String(form.get("kind") || "expense");
  const date = String(form.get("date"));
  const month = date.slice(0, 7);
  const amount = parseCurrencyInput(form.get("amount"));
  const installments = Math.max(1, Number(form.get("installments") || 1));
  if (kind === "income") {
    const fonte = String(form.get("fonte") || "").trim();
    const existing = state.plannedEditingKind === "income" && state.plannedEditingId
      ? state.data.incomeLines.find((item) => item.id === state.plannedEditingId)
      : null;
    const item = {
      id: existing?.id || crypto.randomUUID(),
      label: String(form.get("description")).trim(),
      origin: fonte,
      creditorId: "",
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
  if (state.saveStateFn) await state.saveStateFn(editing ? "Lançamento atualizado." : "Lançamento adicionado.");
}

export async function deleteManualPlanned(id) {
  state.data = removeManualPlanned(state.data, id);
  if (state.saveStateFn) await state.saveStateFn("Lançamento excluído.");
}
