import { state, currency } from "./state.js";
import { escapeHtml, icon, formatDate, formatMonth, compactCurrency, installmentDueDate } from "./utils.js";
import { creditorLogoHtml, sourceLogoHtml, getCreditorName } from "./creditors.js";

export function metric(label, value, tone, money = true) {
  return `
    <article class="metric ${tone}">
      <span>${label}</span>
      <strong>${money ? currency.format(value) : value}</strong>
    </article>
  `;
}

export function sourceLabel(line) {
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

export function tabButtons(prefix, active) {
  const attr = prefix === "car" ? "data-car-tab" : "data-installment-tab";
  return `
    <div class="segmented">
      <button class="segment ${active === "open" ? "active" : ""}" type="button" ${attr}="open">Pendentes</button>
      <button class="segment ${active === "paid" ? "active" : ""}" type="button" ${attr}="paid">Pagas</button>
    </div>
  `;
}

export function metaBox(label, value) {
  return `<div class="meta-box"><span>${label}</span><strong>${value}</strong></div>`;
}

export function genericDebtCard(config) {
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

export function carDebtCard(car) {
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

export function carInstallmentEconomy(item) {
  if (item.status !== "Pago") return 0;
  return Number(item.value || 0) - Number(item.paidAmount || item.value || 0);
}

export function economyClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

export function carProgress(paid, total) {
  const percent = total ? (paid / total) * 100 : 0;
  return `
    <article class="metric car-progress-card">
      <span>Progresso</span>
      <div class="progress-line"><span style="width:${percent}%"></span></div>
      <strong>${percent.toFixed(2).replace(".", ",")}%</strong>
    </article>
  `;
}

export function debtTabs(prefix, id, active, openCount, paidCount) {
  return `
    <div class="debt-tabs">
      <button class="debt-tab ${active === "open" ? "active" : ""}" type="button" data-${prefix}-tab="open" data-contract-id="${id}">Pendentes <span>${openCount}</span></button>
      <button class="debt-tab ${active === "paid" ? "active" : ""}" type="button" data-${prefix}-tab="paid" data-contract-id="${id}">Pagas <span>${paidCount}</span></button>
    </div>
  `;
}

export function installmentDetail(item) {
  return Array.from({ length: item.totalInstallments }, (_, index) => {
    const paid = index < item.paidInstallments;
    return `<span class="detail-pill ${paid ? "ok" : "warn"}">${index + 1}/${item.totalInstallments} · ${paid ? "Paga" : "Pendente"} · ${currency.format(item.amount)}</span>`;
  }).join("");
}

export function groupRow(label, monthsCount) {
  return `<tr class="group-row"><th colspan="${monthsCount + 2}">${label}</th></tr>`;
}

export function totalRow(label, months, getter, tone) {
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

export function isPlannedIncome(id) {
  return state.data.incomeLines.some((line) => line.id === id);
}

export function isManualPlannedRow(row) {
  return row.manualType === "planned-income" || row.manualType === "planned-expense";
}

