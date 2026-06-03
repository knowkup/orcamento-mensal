import { state, el, currency } from "../state.js";
import { escapeHtml, icon, formatCurrencyInput, parseCurrencyInput, showToast, refreshIcons } from "../utils.js";
import { getInstallmentCard, getCreditorName, creditorLogoHtml, getCreditCard } from "../creditors.js";
import { genericDebtCard } from "../components.js";

export function renderInstallments() {
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

export function renderInstallmentSummary() {
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

export function renderInstallmentChips() {
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
      ${chip.id === "all" ? `<span class="filter-symbol">◌</span>` : creditorLogoHtml(chip.id)}
      <strong>${escapeHtml(chip.label)}</strong>
      <span class="filter-count">${chip.count}</span>
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

export async function addInstallment(event) {
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
  if (state.saveStateFn) await state.saveStateFn(editing ? "Parcelamento atualizado." : "Parcelamento cadastrado.");
}

export function openInstallmentDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
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

export function closeInstallmentDialog() {
  state.installmentEditingId = null;
  el.installmentForm.reset();
  el.installmentDialog.close();
}

export async function payInstallment(key) {
  const [id, number] = key.split(":");
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = Math.min(item.totalInstallments, Math.max(Number(item.paidInstallments), Number(number)));
  state.expandedInstallments[id] = true;
  if (state.saveStateFn) await state.saveStateFn("Parcela paga.");
}

export async function unpayInstallment(key) {
  const [id, number] = key.split(":");
  const item = state.data.installments.find((entry) => entry.id === id);
  if (!item) return;
  item.paidInstallments = Math.max(0, Number(number) - 1);
  state.expandedInstallments[id] = true;
  if (state.saveStateFn) await state.saveStateFn("Pagamento removido.");
}

export async function deleteInstallment(id) {
  state.data.installments = state.data.installments.filter((item) => item.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Parcela excluída.");
}
