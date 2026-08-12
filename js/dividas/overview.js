import { state } from './state.js';
import { state as mainState } from '../state.js';
import { $, brl, emptyCard, escapeHtml, creditorLogoHtml, getCreditorName, showToast } from './utils.js';
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

function excludedDebtIds() {
  return new Set(mainState.data?.debtOverviewExcludedIds || []);
}

function consolidations() {
  return Array.isArray(mainState.data?.debtOverviewConsolidations) ? mainState.data.debtOverviewConsolidations : [];
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

function consolidationTerms(item) {
  const downPayment = Math.max(0, numberOrNull(item.downPayment) || 0);
  const installments = Math.max(0, Math.round(numberOrNull(item.remainingInstallments) || 0));
  const installmentValue = Math.max(0, numberOrNull(item.installmentValue) || 0);
  const installmentBalance = downPayment + installments * installmentValue;
  const payoff = Math.max(0, numberOrNull(item.payoffToday) ?? installmentBalance);
  return { downPayment, installments, installmentValue, installmentBalance, payoff };
}

function validConsolidations(debts) {
  const ids = new Set(debts.map((debt) => debt.id));
  return consolidations().filter((item) => item.id && item.debtIds?.length >= 2 && item.debtIds.every((id) => ids.has(id)));
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

function renderConsolidations(debts, groups) {
  const container = $('debtOverviewConsolidations');
  if (!container) return;
  const debtById = new Map(debts.map((debt) => [debt.id, debt]));
  container.innerHTML = groups.map((group) => {
    const terms = consolidationTerms(group);
    const sourceDebts = group.debtIds.map((id) => debtById.get(id)).filter(Boolean);
    const names = sourceDebts.map((debt) => debt.name).join(' · ');
    const current = sourceDebts.reduce((totals, debt) => {
      const sourceTerms = overviewTerms(debt);
      totals.monthly += sourceTerms.installmentValue;
      totals.balance += sourceTerms.installmentBalance;
      totals.payoff += sourceTerms.payoff;
      return totals;
    }, { monthly: 0, balance: 0, payoff: 0 });
    const totalDifference = current.balance - terms.installmentBalance;
    const monthlyDifference = current.monthly - terms.installmentValue;
    const differenceLabel = (value) => value >= 0 ? 'Economia de ' + brl(value) : 'Acréscimo de ' + brl(Math.abs(value));
    const field = (key, label, value, options = '') => '<label>' + escapeHtml(label) + '<input ' + options + ' data-overview-consolidation-field="' + escapeHtml(key) + '" data-overview-consolidation-id="' + escapeHtml(group.id) + '" value="' + escapeHtml(value ?? '') + '"></label>';
    return '<section class="debt-overview-consolidation">' +
      '<div class="debt-overview-consolidation-head"><div><span class="tag blue">Acordo simulado</span><strong>' + escapeHtml(group.name || 'Acordo simulado') + '</strong><small>Substitui no Painel: ' + escapeHtml(names) + '</small></div><button class="ghost-btn danger-btn mini-action" type="button" data-remove-overview-consolidation="' + escapeHtml(group.id) + '">Desfazer</button></div>' +
      '<p class="debt-overview-consolidation-note">Salvo somente no Painel. As ' + sourceDebts.length + ' dívidas de origem foram substituídas por este acordo neste cenário.</p>' +
      '<div class="debt-overview-comparison">' +
        '<div class="debt-overview-comparison-column"><span>Hoje</span><strong>' + sourceDebts.length + (sourceDebts.length === 1 ? ' dívida' : ' dívidas') + ' · ' + brl(current.monthly) + '/mês</strong><small>Saldo: ' + brl(current.balance) + ' · Quitação: ' + brl(current.payoff) + '</small></div>' +
        '<div class="debt-overview-comparison-column is-proposed"><span>No acordo do Painel</span><strong>' + terms.installments + ' × ' + brl(terms.installmentValue) + (terms.downPayment ? ' + entrada ' + brl(terms.downPayment) : '') + '</strong><small>Saldo: ' + brl(terms.installmentBalance) + ' · Quitação: ' + brl(terms.payoff) + '</small></div>' +
        '<div class="debt-overview-comparison-delta"><span>Parcelas/mês: ' + differenceLabel(monthlyDifference) + '</span><span>Total: ' + differenceLabel(totalDifference) + '</span></div>' +
      '</div>' +
      '<div class="debt-overview-simulation-grid">' +
        field('name', 'Nome do acordo', group.name, 'type="text"') +
        field('downPayment', 'Entrada', group.downPayment, 'type="number" min="0" step="0.01" inputmode="decimal"') +
        field('remainingInstallments', 'Parcelas', group.remainingInstallments, 'type="number" min="0" step="1" inputmode="numeric"') +
        field('installmentValue', 'Valor da parcela', group.installmentValue, 'type="number" min="0" step="0.01" inputmode="decimal"') +
        field('payoffToday', 'Quitação no Painel', group.payoffToday, 'type="number" min="0" step="0.01" inputmode="decimal"') +
      '</div>' +
      '<div class="debt-overview-consolidation-totals"><span>' + terms.installments + ' × ' + brl(terms.installmentValue) + (terms.downPayment ? ' + entrada ' + brl(terms.downPayment) : '') + '</span><strong>' + brl(terms.installmentBalance) + '</strong></div>' +
    '</section>';
  }).join('');
}

function renderSelectionList(debts, selectedIds, excludedIds, groups) {
  const container = $('debtOverviewSelectionList');
  const selectionText = $('debtOverviewSelectionText');
  if (!container || !selectionText) return;
  const selectedCount = debts.filter((debt) => isSelected(debt, selectedIds)).length;
  selectionText.textContent = selectedCount + (selectedCount === 1 ? ' dívida selecionada no Painel.' : ' dívidas selecionadas no Painel.') + ' Clique nos credores para incluir ou remover todas as dívidas deles; use “Simular” para editar apenas neste Painel.';
  const selectedCreditorIds = new Set(debts
    .filter((debt) => isSelected(debt, selectedIds))
    .map((debt) => debt.creditorId)
    .filter(Boolean));
  const visibleDebts = debts.filter((debt) => selectedCreditorIds.has(debt.creditorId));
  if (!visibleDebts.length) {
    container.innerHTML = emptyCard('Nenhum credor selecionado', 'Escolha um credor acima para ver e simular as dívidas dele no Painel.');
    return;
  }
  const groupByDebtId = new Map(groups.flatMap((group) => group.debtIds.map((id) => [id, group])));
  const standaloneDebts = visibleDebts.filter((debt) => !groupByDebtId.has(debt.id));
  if (!standaloneDebts.length) {
    container.innerHTML = emptyCard('Dívidas substituídas por acordo', 'As dívidas deste recorte já estão representadas pelos acordos simulados acima. Desfaça um acordo para trazê-las de volta ao Painel.');
    return;
  }
  container.innerHTML = standaloneDebts.map((debt) => {
    const terms = overviewTerms(debt);
    const excluded = excludedIds.has(debt.id);
    const selected = isSelected(debt, selectedIds);
    const canUnify = selected && !excluded;
    return '<div class="debt-overview-selection-row ' + (excluded ? 'is-excluded' : '') + '">' +
      '<label class="debt-overview-check"><input type="checkbox" data-overview-debt-id="' + escapeHtml(debt.id) + '" ' + (selected ? 'checked' : '') + '><span class="sr-only">Incluir ' + escapeHtml(debt.name) + ' no Painel</span></label>' +
      '<label class="debt-overview-unify"><input type="checkbox" data-overview-unify-debt-id="' + escapeHtml(debt.id) + '" ' + (state.selectedOverviewConsolidationDebtIds.has(debt.id) ? 'checked' : '') + (canUnify ? '' : ' disabled') + '><span>Unir</span></label>' +
      '<div class="debt-head">' + creditorLogoHtml(debt.creditorId) + '<div><div class="debt-name">' + escapeHtml(debt.name) + '</div><div class="debt-meta"><span>' + escapeHtml(getCreditorName(debt.creditorId)) + '</span><span>' + escapeHtml(statusLabel(debt.status)) + '</span>' + (terms.simulated ? '<span class="tag blue">Simulada</span>' : '') + '</div></div></div>' +
      '<div class="debt-overview-row-value"><span>Parcelas no Painel</span><strong>' + terms.installments + ' × ' + brl(terms.installmentValue) + '</strong><small>' + (terms.downPayment ? 'Entrada ' + brl(terms.downPayment) + ' · ' : '') + brl(terms.installmentBalance) + '</small></div>' +
      '<div class="debt-overview-row-value"><span>Quitação no Painel</span><strong>' + brl(terms.payoff) + '</strong></div>' +
      '<button class="ghost-btn mini-action" type="button" data-toggle-overview-simulation="' + escapeHtml(debt.id) + '">' + (state.expandedOverviewSimulationDebtId === debt.id ? 'Fechar simulação' : 'Simular') + '</button>' +
      (selected ? '<button class="ghost-btn mini-action" type="button" data-toggle-overview-exclusion="' + escapeHtml(debt.id) + '">' + (excluded ? 'Devolver ao Painel' : 'Não contar') + '</button>' : '') +
      simulationFieldsHtml(debt, terms) +
    '</div>';
  }).join('');
}

function renderOverviewSummary(selected, groups = []) {
  const metrics = $('debtOverviewMetrics');
  if (!metrics) return;
  const groupDebtIds = new Set(groups.flatMap((group) => group.debtIds));
  const creditors = new Set([...selected, ...overviewDebts().filter((debt) => groupDebtIds.has(debt.id))].map((debt) => debt.creditorId).filter(Boolean));
  const installmentsBalance = selected.reduce((sum, debt) => sum + overviewTerms(debt).installmentBalance, 0);
  const payoff = selected.reduce((sum, debt) => sum + overviewTerms(debt).payoff, 0);
  const groupInstallments = groups.reduce((sum, group) => sum + consolidationTerms(group).installmentBalance, 0);
  const groupPayoff = groups.reduce((sum, group) => sum + consolidationTerms(group).payoff, 0);
  metrics.innerHTML =
    '<div class="debt-metric"><div class="metric-icon blue">▥</div><div><div class="metric-label">Dívidas/acordos</div><div class="debt-value">' + (selected.length + groups.length) + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon green">◌</div><div><div class="metric-label">Credores</div><div class="debt-value">' + creditors.size + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon amber">◷</div><div><div class="metric-label">Saldo das parcelas</div><div class="debt-value">' + brl(installmentsBalance + groupInstallments) + '</div></div></div>' +
    '<div class="debt-metric"><div class="metric-icon red">▣</div><div><div class="metric-label">Saldo para quitar</div><div class="debt-value">' + brl(payoff + groupPayoff) + '</div></div></div>';
  renderStatusSummary(selected);
}

export function renderDebtOverview() {
  const allDebts = overviewDebts();
  const selectedIds = selectedDebtIds();
  const excludedIds = excludedDebtIds();
  const groups = validConsolidations(allDebts);
  const visibleGroups = groups.filter((group) => group.debtIds.every((id) => {
    const debt = allDebts.find((item) => item.id === id);
    return debt && isSelected(debt, selectedIds);
  }));
  const consolidatedIds = new Set(visibleGroups.flatMap((group) => group.debtIds));
  const selected = allDebts.filter((debt) => isSelected(debt, selectedIds) && !excludedIds.has(debt.id) && !consolidatedIds.has(debt.id));
  renderOverviewSummary(selected, visibleGroups);
  renderCreditorFilters(allDebts);
  renderConsolidations(allDebts, visibleGroups);
  renderSelectionList(allDebts, selectedIds, excludedIds, groups);
}

export function renderDebtOverviewSummary() {
  const allDebts = overviewDebts();
  const selectedIds = selectedDebtIds();
  const excludedIds = excludedDebtIds();
  const groups = validConsolidations(allDebts);
  const visibleGroups = groups.filter((group) => group.debtIds.every((id) => {
    const debt = allDebts.find((item) => item.id === id);
    return debt && isSelected(debt, selectedIds);
  }));
  const consolidatedIds = new Set(visibleGroups.flatMap((group) => group.debtIds));
  renderOverviewSummary(allDebts.filter((debt) => isSelected(debt, selectedIds) && !excludedIds.has(debt.id) && !consolidatedIds.has(debt.id)), visibleGroups);
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

export function toggleOverviewDebtExclusion(debtId) {
  const excluded = excludedDebtIds();
  if (excluded.has(debtId)) excluded.delete(debtId);
  else excluded.add(debtId);
  mainState.data.debtOverviewExcludedIds = [...excluded];
  if (!excluded.has(debtId)) {
    const allIds = overviewDebts().map((debt) => debt.id);
    const selected = selectedDebtIds() || new Set(allIds);
    selected.add(debtId);
    mainState.data.debtOverviewSelectedIds = allIds.filter((id) => selected.has(id));
  }
  renderDebtOverviewSummary();
}

export function toggleOverviewConsolidationDebt(debtId, selected) {
  if (selected) state.selectedOverviewConsolidationDebtIds.add(debtId);
  else state.selectedOverviewConsolidationDebtIds.delete(debtId);
  renderDebtOverview();
}

export async function createOverviewConsolidation() {
  const debts = overviewDebts();
  const selectedIds = selectedDebtIds();
  const excluded = excludedDebtIds();
  const grouped = new Set(validConsolidations(debts).flatMap((group) => group.debtIds));
  const selected = debts.filter((debt) => state.selectedOverviewConsolidationDebtIds.has(debt.id) && isSelected(debt, selectedIds) && !excluded.has(debt.id) && !grouped.has(debt.id));
  if (selected.length < 2) return showToast('Marque ao menos duas dívidas em “Unir”.');
  const total = selected.reduce((sum, debt) => sum + overviewTerms(debt).installmentBalance, 0);
  const installments = Math.max(1, ...selected.map((debt) => overviewTerms(debt).installments));
  const agreements = mainState.data.debtOverviewConsolidations || (mainState.data.debtOverviewConsolidations = []);
  agreements.push({
    id: crypto.randomUUID(),
    name: 'Acordo simulado',
    debtIds: selected.map((debt) => debt.id),
    downPayment: 0,
    remainingInstallments: installments,
    installmentValue: total / installments
  });
  state.selectedOverviewConsolidationDebtIds.clear();
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
}

export function updateOverviewConsolidationInput(consolidationId, field, value) {
  const agreement = consolidations().find((item) => item.id === consolidationId);
  if (!agreement) return;
  if (field === 'name') agreement.name = String(value || '').slice(0, 120) || 'Acordo simulado';
  else if (['downPayment', 'remainingInstallments', 'installmentValue', 'payoffToday'].includes(field)) {
    const parsed = numberOrNull(value);
    if (parsed === null && field === 'payoffToday') delete agreement[field];
    else agreement[field] = parsed === null ? 0 : Math.max(0, parsed);
  }
  renderDebtOverviewSummary();
}

export async function removeOverviewConsolidation(consolidationId) {
  mainState.data.debtOverviewConsolidations = consolidations().filter((item) => item.id !== consolidationId);
  if (mainState.saveStateFn) await mainState.saveStateFn();
  else renderDebtOverview();
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
