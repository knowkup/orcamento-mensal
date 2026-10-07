import { state, el, currency } from "../state.js";
import { escapeHtml, icon, formatCurrencyInput, parseCurrencyInput, showToast } from "../utils.js";
import { getCreditorName, creditorLogoHtml, getCreditCard } from "../creditors.js";

export function renderFixedCosts() {
  const allFixedCosts = [...state.data.fixedCosts].sort((a, b) => {
    const creditorSort = getCreditorName(a.creditorId).localeCompare(getCreditorName(b.creditorId), "pt-BR");
    return creditorSort || Number(a.dueDay || 0) - Number(b.dueDay || 0);
  });
  renderFixedCostSummary(allFixedCosts);
  renderFixedCostFilters(allFixedCosts);
  const fixedCosts = state.fixedCostCreditorFilter === "all"
    ? allFixedCosts
    : allFixedCosts.filter((item) => item.creditorId === state.fixedCostCreditorFilter);

  el.fixedCostsTable.innerHTML = fixedCosts.length
    ? fixedCosts.map((item) => `
      <article class="debt-card fixed-cost-card">
        <div class="fixed-cost-summary">
          <div class="entity-cell fixed-cost-title">
            ${creditorLogoHtml(item.creditorId)}
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(getCreditorName(item.creditorId))}</small></div>
          </div>
          <div class="fixed-cost-detail"><span>Pagamento</span><strong>${escapeHtml(item.paymentMethod || "-")}</strong></div>
          <div class="fixed-cost-detail"><span>Grupo</span><strong>${escapeHtml(item.group || "Sem grupo")}</strong></div>
          <div class="fixed-cost-detail"><span>Vencimento</span><strong>Dia ${Number(item.dueDay || 0) || "-"}</strong></div>
          <div class="fixed-cost-value"><span>Mensal</span><strong>${currency.format(Number(item.amount || 0))}</strong></div>
          <div class="row-actions">
            <button class="icon-button mini-icon" type="button" title="Editar" data-edit-fixed="${item.id}">${icon("pencil")}</button>
            <button class="icon-button mini-icon danger-mini" type="button" title="Excluir" data-delete-fixed="${item.id}">${icon("trash-2")}</button>
          </div>
        </div>
      </article>
    `).join("")
    : `<div class="empty-state"><strong>Nenhum custo fixo encontrado</strong><span>${state.fixedCostCreditorFilter === "all" ? "Cadastre despesas recorrentes para elas entrarem automaticamente no controle mensal." : "Escolha outro credor ou veja todos os custos fixos."}</span></div>`;

  el.fixedCostsTable.querySelectorAll("[data-edit-fixed]").forEach((button) => {
    button.addEventListener("click", () => openFixedCostDialog(button.dataset.editFixed));
  });
  el.fixedCostsTable.querySelectorAll("[data-delete-fixed]").forEach((button) => {
    button.addEventListener("click", () => deleteFixedCost(button.dataset.deleteFixed));
  });
}

function renderFixedCostSummary(items) {
  if (!el.fixedCostsSummary) return;
  const monthlyTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cardTotal = items
    .filter((item) => item.paymentMethod === "Cartão de crédito")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const directTotal = monthlyTotal - cardTotal;
  el.fixedCostsSummary.innerHTML = [
    { label: "Total mensal", helper: "Todos os custos", value: monthlyTotal, tone: "short" },
    { label: "Em cartão", helper: "Fatura e crediário", value: cardTotal, tone: "medium" },
    { label: "Pagamento direto", helper: "PIX, boleto e débito", value: directTotal, tone: "long" }
  ].map((summary) => `
    <article class="installment-range-card ${summary.tone}">
      <h3>${summary.label}</h3><span>${summary.helper}</span><strong>${currency.format(summary.value)}</strong><small>${items.length} custo${items.length === 1 ? "" : "s"}</small>
    </article>
  `).join("");
}

function renderFixedCostFilters(items) {
  if (!el.fixedCostFilters) return;
  const counts = new Map();
  items.forEach((item) => {
    if (item.creditorId) counts.set(item.creditorId, (counts.get(item.creditorId) || 0) + 1);
  });
  const filters = [
    { id: "all", label: "Todos", count: items.length },
    ...[...counts.entries()]
      .sort((a, b) => getCreditorName(a[0]).localeCompare(getCreditorName(b[0]), "pt-BR"))
      .map(([id, count]) => ({ id, label: getCreditorName(id), count }))
  ];
  el.fixedCostFilters.innerHTML = filters.map((filter) => `
    <button class="filter-chip ${state.fixedCostCreditorFilter === filter.id ? "active" : ""}" type="button" data-fixed-cost-creditor="${filter.id}">
      ${filter.id === "all" ? '<span class="filter-symbol">◌</span>' : creditorLogoHtml(filter.id)}
      <strong>${escapeHtml(filter.label)}</strong><span class="filter-count">${filter.count}</span>
    </button>
  `).join("");
  el.fixedCostFilters.querySelectorAll("[data-fixed-cost-creditor]").forEach((button) => {
    button.addEventListener("click", () => {
      state.fixedCostCreditorFilter = button.dataset.fixedCostCreditor;
      renderFixedCosts();
    });
  });
}

export function openFixedCostDialog(id = null) {
  if (state.hydrateFn) state.hydrateFn();
  state.fixedCostEditingId = id;
  el.fixedCostForm.reset();
  el.fixedCostForm.elements.paymentMethod.value = "";
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

export function closeFixedCostDialog() {
  state.fixedCostEditingId = null;
  el.fixedCostForm.reset();
  [el.fixedCardField, el.fixedCreditorField, el.fixedNewCreditorField, el.fixedOwnerField].forEach((field) => setFixedCostFieldVisible(field, true));
  el.fixedCostDialog.close();
}

export function updateFixedCostFields() {
  const methodField = el.fixedCostForm.elements.paymentMethod;
  if (!methodField.options.length) if (state.hydrateFn) state.hydrateFn();
  methodField.required = true;
  const hasMethod = Boolean(methodField.value);
  const hasCreditors = state.data.creditors.length > 0;
  const isCard = methodField.value === "Cartão de crédito";
  setFixedCostFieldVisible(el.fixedCardField, hasMethod && isCard);
  setFixedCostFieldVisible(el.fixedCreditorField, hasMethod && !isCard && hasCreditors);
  setFixedCostFieldVisible(el.fixedNewCreditorField, hasMethod && !isCard && !hasCreditors);
  setFixedCostFieldVisible(el.fixedOwnerField, hasMethod && !isCard);
  el.fixedCostForm.elements.cardId.required = hasMethod && isCard;
  el.fixedCostForm.elements.creditorId.required = hasMethod && !isCard && hasCreditors;
  el.fixedCostForm.elements.newCreditorName.required = hasMethod && !isCard && !hasCreditors;
  el.fixedCostForm.elements.owner.required = hasMethod && !isCard;
}

export function setFixedCostFieldVisible(field, visible) {
  field.hidden = !visible;
  field.classList.toggle("is-hidden", !visible);
  field.querySelectorAll("input, select, textarea").forEach((input) => {
    input.disabled = !visible;
  });
}

export async function addFixedCost(event) {
  event.preventDefault();
  updateFixedCostFields();
  const form = new FormData(event.currentTarget);
  const paymentMethod = String(el.fixedCostForm.elements.paymentMethod.value || "");
  const card = paymentMethod === "Cartão de crédito" ? getCreditCard(String(form.get("cardId"))) : null;
  const newCreditorName = String(form.get("newCreditorName") || "").trim();
  const creditorId = card?.creditorId || String(form.get("creditorId") || "") || ensureCreditorForFixedCost(newCreditorName, paymentMethod);
  if (!paymentMethod) {
    showToast("Selecione o metodo de pagamento.");
    return;
  }
  if (!creditorId) {
    showToast(paymentMethod === "Cartão de crédito" ? "Cadastre e selecione um cartao/crediario." : "Informe ou cadastre um credor.");
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
  if (state.saveStateFn) await state.saveStateFn(editing ? "Custo fixo atualizado." : "Custo fixo cadastrado.");
}

export function ensureCreditorForFixedCost(name, paymentMethod) {
  if (!name) return "";
  const existing = state.data.creditors.find((creditor) => creditor.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const creditor = {
    id: crypto.randomUUID(),
    name,
    paymentForms: [paymentMethod].filter(Boolean),
    logoUrl: ""
  };
  state.data.creditors.push(creditor);
  return creditor.id;
}

export async function deleteFixedCost(id) {
  state.data.fixedCosts = state.data.fixedCosts.filter((item) => item.id !== id);
  if (state.saveStateFn) await state.saveStateFn("Custo fixo excluído.");
}
