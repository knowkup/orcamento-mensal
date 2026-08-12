import { state } from './state.js';
import { state as mainState } from '../state.js';
import { $, brl, emptyCard, escapeHtml, creditorLogoHtml, getCreditorName } from './utils.js';
import { debtBalance, payoffTodayValue, remainingInstallmentsCount } from './calc.js';
import { creditorFilterEntries } from '../domain/debt-filters.js';

const PANORAMA_STATUSES = ['Ativa', 'Em espera', 'Fora do radar'];

function overviewDebts() {
  return state.debts.filter((debt) => PANORAMA_STATUSES.includes(debt.status));
}

function selectedDebtIds() {
  const saved = mainState.data?.debtOverviewSelectedIds;
  return Array.isArray(saved) ? new Set(saved) : null;
}

function isSelected(debt, selectedIds) {
  return selectedIds === null || selectedIds.has(debt.id);
}

function payoffBalance(debt) {
  return payoffTodayValue(debt) || debtBalance(debt);
}

function statusLabel(status) {
  return status === 'Ativa' ? 'Em rota' : status;
}

function renderCreditorFilters(debts) {
  const container = $('debtOverviewCreditorFilters');
  if (!container) return;
  const selectedIds = selectedDebtIds();
  const allSelected = debts.every((debt) => isSelected(debt, selectedIds));
  let html = '<button class="filter-chip ' + (allSelected ? 'is-active' : '') + '" type="button" data-overview-creditor-id="all" aria-pressed="' + allSelected + '">Todos<span class="filter-count">' + debts.length + '</span></button>';
  creditorFilterEntries(debts, getCreditorName).forEach(({ id, name, count }) => {
    const creditorDebts = debts.filter((debt) => debt.creditorId === id);
    const selectedCount = creditorDebts.filter((debt) => isSelected(debt, selectedIds)).length;
    const active = selectedCount === creditorDebts.length;
    html += '<button class="filter-chip ' + (active ? 'is-active' : '') + (selectedCount && !active ? ' is-partial' : '') + '" type="button" data-overview-creditor-id="' + escapeHtml(id) + '" aria-pressed="' + active + '">' + creditorLogoHtml(id) + escapeHtml(name) + '<span class="filter-count">' + selectedCount + '/' + count + '</span></button>';
  });
  container.innerHTML = html;
}

function renderStatusSummary(debts) {
  const container = $('debtOverviewStatuses');
  if (!container) return;
  container.innerHTML = PANORAMA_STATUSES.map((status) => {
    const items = debts.filter((debt) => debt.status === status);
    const installmentsBalance = items.reduce((sum, debt) => sum + debtBalance(debt), 0);
    const payoff = items.reduce((sum, debt) => sum + payoffBalance(debt), 0);
    return '<div class="debt-overview-status">' +
      '<span>' + escapeHtml(statusLabel(status)) + '</span>' +
      '<strong>' + items.length + (items.length === 1 ? ' dívida' : ' dívidas') + '</strong>' +
      '<small>Parcelas: ' + brl(installmentsBalance) + '</small>' +
      '<small>Quitação: ' + brl(payoff) + '</small>' +
    '</div>';
  }).join('');
}

function renderSelectionList(debts, selectedIds) {
  const container = $('debtOverviewSelectionList');
  const selectionText = $('debtOverviewSelectionText');
  if (!container || !selectionText) return;
  const selectedCount = debts.filter((debt) => isSelected(debt, selectedIds)).length;
  selectionText.textContent = selectedCount + (selectedCount === 1 ? ' dívida selecionada no panorama.' : ' dívidas selecionadas no panorama.') + ' Clique nos credores para incluir ou remover todas as dívidas deles; use os checks para exceções.';
  if (!debts.length) {
    container.innerHTML = emptyCard('Nenhuma dívida para selecionar', 'Cadastre uma dívida em rota, em espera ou fora do radar.');
    return;
  }
  container.innerHTML = debts.map((debt) => {
    const balance = debtBalance(debt);
    const payoff = payoffBalance(debt);
    return '<label class="debt-overview-selection-row">' +
      '<input type="checkbox" data-overview-debt-id="' + escapeHtml(debt.id) + '" ' + (isSelected(debt, selectedIds) ? 'checked' : '') + '>' +
      '<div class="debt-head">' + creditorLogoHtml(debt.creditorId) + '<div><div class="debt-name">' + escapeHtml(debt.name) + '</div><div class="debt-meta"><span>' + escapeHtml(getCreditorName(debt.creditorId)) + '</span><span>' + escapeHtml(statusLabel(debt.status)) + '</span></div></div></div>' +
      '<div class="debt-overview-row-value"><span>Parcelas restantes</span><strong>' + remainingInstallmentsCount(debt) + ' · ' + brl(balance) + '</strong></div>' +
      '<div class="debt-overview-row-value"><span>Saldo para quitar</span><strong>' + brl(payoff) + '</strong></div>' +
    '</label>';
  }).join('');
}

export function renderDebtOverview() {
  const allDebts = overviewDebts();
  const selectedIds = selectedDebtIds();
  const selected = allDebts.filter((debt) => isSelected(debt, selectedIds));
  const metrics = $('debtOverviewMetrics');
  if (!metrics) return;
  const creditors = new Set(selected.map((debt) => debt.creditorId).filter(Boolean));
  const installmentsBalance = selected.reduce((sum, debt) => sum + debtBalance(debt), 0);
  const payoff = selected.reduce((sum, debt) => sum + payoffBalance(debt), 0);
  metrics.innerHTML =
    '<div class="debt-metric"><div class="metric-icon blue">▥</div><div><div class="metric-label">Dívidas exibidas</div><div class="debt-value">' + selected.length + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon green">◌</div><div><div class="metric-label">Credores</div><div class="debt-value">' + creditors.size + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon amber">◷</div><div><div class="metric-label">Parcelas restantes</div><div class="debt-value">' + brl(installmentsBalance) + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon red">▣</div><div><div class="metric-label">Saldo para quitar hoje</div><div class="debt-value">' + brl(payoff) + '</div></div></div>';
  renderStatusSummary(selected);
  renderCreditorFilters(allDebts);
  renderSelectionList(allDebts, selectedIds);
}

export async function toggleOverviewCreditor(creditorId) {
  const debts = overviewDebts();
  const allIds = debts.map((debt) => debt.id);
  if (creditorId === 'all') {
    mainState.data.debtOverviewSelectedIds = allIds;
  } else {
    const ids = selectedDebtIds() || new Set(allIds);
    const creditorIds = debts.filter((debt) => debt.creditorId === creditorId).map((debt) => debt.id);
    const allCreditorsWereSelected = allIds.every((id) => ids.has(id));
    const creditorAlreadySelected = creditorIds.every((id) => ids.has(id));
    if (allCreditorsWereSelected) {
      mainState.data.debtOverviewSelectedIds = creditorIds;
    } else if (creditorAlreadySelected) {
      creditorIds.forEach((id) => ids.delete(id));
      mainState.data.debtOverviewSelectedIds = allIds.filter((id) => ids.has(id));
    } else {
      creditorIds.forEach((id) => ids.add(id));
      mainState.data.debtOverviewSelectedIds = allIds.filter((id) => ids.has(id));
    }
  }
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}

export async function toggleDebtOverviewDebt(debtId, selected) {
  const allIds = overviewDebts().map((debt) => debt.id);
  const ids = selectedDebtIds() || new Set(allIds);
  if (selected) ids.add(debtId);
  else ids.delete(debtId);
  mainState.data.debtOverviewSelectedIds = allIds.filter((id) => ids.has(id));
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}

export async function selectAllDebtOverview() {
  mainState.data.debtOverviewSelectedIds = overviewDebts().map((debt) => debt.id);
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}
