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

function overviewOverrides() {
  return mainState.data?.debtOverviewOverrides || {};
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasSimulation(debt) {
  return Object.keys(overviewOverrides()[debt.id] || {}).length > 0;
}

export function overviewTerms(debt) {
  const override = overviewOverrides()[debt.id] || {};
  const actualBalance = debtBalance(debt);
  const actualInstallments = remainingInstallmentsCount(debt);
  const actualInstallmentValue = Number(debt.installmentValue || 0) || (actualInstallments ? actualBalance / actualInstallments : 0);
  const simulatedInstallments = numberOrNull(override.remainingInstallments);
  const simulatedInstallmentValue = numberOrNull(override.installmentValue);
  const downPayment = Math.max(0, numberOrNull(override.downPayment) || 0);
  const installments = simulatedInstallments === null ? actualInstallments : Math.max(0, Math.round(simulatedInstallments));
  const installmentValue = simulatedInstallmentValue === null ? actualInstallmentValue : Math.max(0, simulatedInstallmentValue);
  const installmentBalance = hasSimulation(debt) ? downPayment + installments * installmentValue : actualBalance;
  const simulatedPayoff = numberOrNull(override.payoffToday);
  const payoff = simulatedPayoff === null
    ? (hasSimulation(debt) ? installmentBalance : (payoffTodayValue(debt) || actualBalance))
    : Math.max(0, simulatedPayoff);
  return { installments, installmentValue, downPayment, installmentBalance, payoff, simulated: hasSimulation(debt) };
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
    const installmentsBalance = items.reduce((sum, debt) => sum + overviewTerms(debt).installmentBalance, 0);
    const payoff = items.reduce((sum, debt) => sum + overviewTerms(debt).payoff, 0);
    return '<div class="debt-overview-status">' +
      '<span>' + escapeHtml(statusLabel(status)) + '</span>' +
      '<strong>' + items.length + (items.length === 1 ? ' dívida' : ' dívidas') + '</strong>' +
      '<small>No Painel: ' + brl(installmentsBalance) + '</small>' +
      '<small>Quitação: ' + brl(payoff) + '</small>' +
    '</div>';
  }).join('');
}

function simulationFieldsHtml(debt, terms) {
  if (state.expandedOverviewSimulationDebtId !== debt.id) return '';
  const override = overviewOverrides()[debt.id] || {};
  const field = (key, label, value, options = '') =>
    '<label>' + escapeHtml(label) + '<input ' + options + ' data-overview-simulation-field="' + escapeHtml(key) + '" data-overview-simulation-debt-id="' + escapeHtml(debt.id) + '" value="' + escapeHtml(value ?? '') + '"></label>';
  return '<div class="debt-overview-simulation">' +
    '<div class="debt-overview-simulation-head"><strong>Condição somente neste Painel</strong><button class="ghost-btn mini-action" type="button" data-reset-overview-simulation="' + escapeHtml(debt.id) + '" ' + (!terms.simulated ? 'disabled' : '') + '>Restaurar original</button></div>' +
    '<div class="debt-overview-simulation-grid">' +
      field('downPayment', 'Entrada', override.downPayment, 'type="number" min="0" step="0.01" inputmode="decimal"') +
      field('remainingInstallments', 'Parcelas restantes', override.remainingInstallments, 'type="number" min="0" step="1" inputmode="numeric"') +
      field('installmentValue', 'Valor da parcela', override.installmentValue, 'type="number" min="0" step="0.01" inputmode="decimal"') +
      field('payoffToday', 'Quitação no Painel', override.payoffToday, 'type="number" min="0" step="0.01" inputmode="decimal"') +
    '</div>' +
    '<small>Em branco, o Painel mantém o valor original. Esses ajustes não alteram a dívida real.</small>' +
  '</div>';
}

function renderSelectionList(debts, selectedIds) {
  const container = $('debtOverviewSelectionList');
  const selectionText = $('debtOverviewSelectionText');
  if (!container || !selectionText) return;
  const selectedCount = debts.filter((debt) => isSelected(debt, selectedIds)).length;
  selectionText.textContent = selectedCount + (selectedCount === 1 ? ' dívida selecionada no Painel.' : ' dívidas selecionadas no Painel.') + ' Clique nos credores para incluir ou remover todas as dívidas deles; use “Simular” para editar apenas neste Painel.';
  if (!debts.length) {
    container.innerHTML = emptyCard('Nenhuma dívida para selecionar', 'Cadastre uma dívida em rota, em espera ou fora do radar.');
    return;
  }
  container.innerHTML = debts.map((debt) => {
    const terms = overviewTerms(debt);
    return '<div class="debt-overview-selection-row">' +
      '<label class="debt-overview-check"><input type="checkbox" data-overview-debt-id="' + escapeHtml(debt.id) + '" ' + (isSelected(debt, selectedIds) ? 'checked' : '') + '><span class="sr-only">Incluir ' + escapeHtml(debt.name) + ' no Painel</span></label>' +
      '<div class="debt-head">' + creditorLogoHtml(debt.creditorId) + '<div><div class="debt-name">' + escapeHtml(debt.name) + '</div><div class="debt-meta"><span>' + escapeHtml(getCreditorName(debt.creditorId)) + '</span><span>' + escapeHtml(statusLabel(debt.status)) + '</span>' + (terms.simulated ? '<span class="tag blue">Simulada</span>' : '') + '</div></div></div>' +
      '<div class="debt-overview-row-value"><span>Parcelas no Painel</span><strong>' + terms.installments + ' × ' + brl(terms.installmentValue) + '</strong><small>' + (terms.downPayment ? 'Entrada ' + brl(terms.downPayment) + ' · ' : '') + brl(terms.installmentBalance) + '</small></div>' +
      '<div class="debt-overview-row-value"><span>Quitação no Painel</span><strong>' + brl(terms.payoff) + '</strong></div>' +
      '<button class="ghost-btn mini-action" type="button" data-toggle-overview-simulation="' + escapeHtml(debt.id) + '">' + (state.expandedOverviewSimulationDebtId === debt.id ? 'Fechar simulação' : 'Simular') + '</button>' +
      simulationFieldsHtml(debt, terms) +
    '</div>';
  }).join('');
}

function renderOverviewSummary(selected) {
  const metrics = $('debtOverviewMetrics');
  if (!metrics) return;
  const creditors = new Set(selected.map((debt) => debt.creditorId).filter(Boolean));
  const installmentsBalance = selected.reduce((sum, debt) => sum + overviewTerms(debt).installmentBalance, 0);
  const payoff = selected.reduce((sum, debt) => sum + overviewTerms(debt).payoff, 0);
  metrics.innerHTML =
    '<div class="debt-metric"><div class="metric-icon blue">▥</div><div><div class="metric-label">Dívidas exibidas</div><div class="debt-value">' + selected.length + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon green">◌</div><div><div class="metric-label">Credores</div><div class="debt-value">' + creditors.size + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon amber">◷</div><div><div class="metric-label">Saldo das parcelas</div><div class="debt-value">' + brl(installmentsBalance) + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon red">▣</div><div><div class="metric-label">Saldo para quitar</div><div class="debt-value">' + brl(payoff) + '</div></div></div>';
  renderStatusSummary(selected);
}

export function renderDebtOverview() {
  const allDebts = overviewDebts();
  const selectedIds = selectedDebtIds();
  const selected = allDebts.filter((debt) => isSelected(debt, selectedIds));
  renderOverviewSummary(selected);
  renderCreditorFilters(allDebts);
  renderSelectionList(allDebts, selectedIds);
}

export function renderDebtOverviewSummary() {
  const selectedIds = selectedDebtIds();
  renderOverviewSummary(overviewDebts().filter((debt) => isSelected(debt, selectedIds)));
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

export function toggleOverviewSimulation(debtId) {
  state.expandedOverviewSimulationDebtId = state.expandedOverviewSimulationDebtId === debtId ? null : debtId;
  renderDebtOverview();
}

export function updateOverviewSimulationInput(debtId, field, value) {
  const allowedFields = new Set(['downPayment', 'remainingInstallments', 'installmentValue', 'payoffToday']);
  if (!allowedFields.has(field)) return;
  const overrides = mainState.data.debtOverviewOverrides || (mainState.data.debtOverviewOverrides = {});
  const override = { ...(overrides[debtId] || {}) };
  const parsed = numberOrNull(value);
  if (parsed === null) delete override[field];
  else override[field] = Math.max(0, parsed);
  if (Object.keys(override).length) overrides[debtId] = override;
  else delete overrides[debtId];
  renderDebtOverviewSummary();
}

export async function saveOverviewSimulation() {
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}

export async function resetOverviewSimulation(debtId) {
  if (mainState.data?.debtOverviewOverrides) delete mainState.data.debtOverviewOverrides[debtId];
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}

export async function selectAllDebtOverview() {
  mainState.data.debtOverviewSelectedIds = overviewDebts().map((debt) => debt.id);
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}
