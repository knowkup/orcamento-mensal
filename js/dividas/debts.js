import { state } from './state.js';
import { $, brl, escapeHtml, emptyCard, tag, formatDateBR, getCreditorName, creditorLogoHtml, compactTagsForDebt, paymentForInstallment, dueHint, byDueDate, routeProgressHtml } from './utils.js';
import { debtBalance, debtTotal, debtPaid, paidOffDifference, paidOffDifferenceLabel, paidOffDifferenceClass, paidOffClosedDateKey, isOpenInstallment, openInstallmentsForDebt, debtProgress, nextInstallment, installmentProgress, payoffTodayHtml, payoffTodayValue, routeInstallmentStatusLabel } from './calc.js';
import { moveItemByDirection, moveItemToTargetPosition } from '../domain/reorder.js';
import { allowDebtDrop, beginDebtDrag, endDebtDrag, persistDebtOrder, takeDebtDropSource } from './debt-order.js';
import { creditorFilterEntries, filterDebtsByCreditor } from '../domain/debt-filters.js';

// --- Helpers de métrica ---

export function debtMetric(label, value, icon, tone) {
  return '<div class="debt-metric"><div class="metric-icon ' + tone + '">' + escapeHtml(icon) + '</div><div><div class="metric-label">' + escapeHtml(label) + '</div><div class="debt-value">' + escapeHtml(value) + '</div></div></div>';
}

function financeItem(label, value, isPrimary) {
  return '<div class="finance-item ' + (isPrimary ? 'primary' : '') + '"><div class="metric-label">' + escapeHtml(label) + '</div><div class="debt-value">' + escapeHtml(value) + '</div></div>';
}

function compactStat(label, value, extraHtml = '') {
  return '<div class="compact-stat"><div class="metric-label">' + escapeHtml(label) + '</div><strong>' + escapeHtml(value) + '</strong>' + extraHtml + '</div>';
}

// --- Ordenação e filtros ---

export function priorityScore(debt) {
  const next = nextInstallment(debt);
  const days = next ? Math.round((new Date(next.dueDate + 'T00:00:00') - new Date()) / 86400000) : 999;
  const overdueScore = days < 0 ? 280 : 0;
  const dueScore = Math.max(0, 180 - Math.max(days, 0) * 6);
  const monthlyImpact = Number(debt.installmentValue || 0);
  const balance = debtBalance(debt);
  const criticalityScore = debt.criticality === 'Máxima' ? 180 : debt.criticality === 'Alta' ? 110 : 45;
  return overdueScore + dueScore + monthlyImpact / 35 + balance / 2500 + criticalityScore;
}

export function sortDebts(items, mode, direction = 'desc') {
  if (mode === 'trail') return [...items].sort((a, b) => trailOrderValue(a) - trailOrderValue(b));
  const multiplier = direction === 'asc' ? 1 : -1;
  if (mode === 'priority') return [...items].sort((a, b) => multiplier * (priorityScore(a) - priorityScore(b)));
  if (mode === 'due') return [...items].sort((a, b) => {
    const na = nextInstallment(a), nb = nextInstallment(b);
    if (!na && !nb) return 0;
    if (!na) return 1;
    if (!nb) return -1;
    return multiplier * String(na?.dueDate || '9999').localeCompare(String(nb?.dueDate || '9999'));
  });
  if (mode === 'balance') return [...items].sort((a, b) => multiplier * (debtBalance(a) - debtBalance(b)));
  if (mode === 'name') return [...items].sort((a, b) => multiplier * String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  return items;
}

export function trailOrderValue(debt) {
  const order = Number(debt.payoffOrder || 0);
  return order > 0 ? order : 999999;
}

export function orderedTrailDebts() {
  return [...state.debts.filter(d => d.status === 'Ativa')]
    .sort((a, b) => trailOrderValue(a) - trailOrderValue(b));
}

export function sortPaidOffDebts(items) {
  return [...items].sort((a, b) => {
    const ka = String(a.paidOffAt || a.updatedAt || '');
    const kb = String(b.paidOffAt || b.updatedAt || '');
    return kb.localeCompare(ka);
  });
}

export function sortedTrailDebts() {
  if (state.selectedTrailDebtSort === 'trail') return orderedTrailDebts();
  return sortDebts(state.debts.filter(d => d.status === 'Ativa'), state.selectedTrailDebtSort, state.selectedTrailDebtSortDirection);
}

export function eligibleRenegotiationDebts() {
  return state.debts.filter(d => ['Ativa', 'Em espera'].includes(d.status));
}

export function selectedRenegotiationDebts() {
  return state.debts.filter(d => state.selectedRenegotiationDebtIds.has(d.id));
}

export function nextPayoffOrder() {
  const max = state.debts.reduce((m, d) => Math.max(m, Number(d.payoffOrder || 0)), 0);
  return max + 1;
}

export function nextActiveRouteOrder(exceptId = null) {
  const active = state.debts.filter(d => d.status === 'Ativa' && d.id !== exceptId);
  const max = active.reduce((m, d) => Math.max(m, Number(d.payoffOrder || 0)), 0);
  return max + 1;
}

export function orderedWaitingDebts() {
  return [...state.debts.filter(d => d.status === 'Em espera')]
    .sort((a, b) => trailOrderValue(a) - trailOrderValue(b));
}

// --- Renderers de parcelas e expansão ---

export function installmentRowsForDebt(debt) {
  const allItems = state.installmentsByDebt.get(debt.id) || [];
  if (!allItems.length) return '<div class="debt-meta" style="margin-top:14px;">Nenhuma parcela gerada para esta dívida.</div>';

  const pending = allItems.filter(isOpenInstallment).sort(byDueDate);
  const paid = allItems.filter(item => item.status === 'Paga' || item.status === 'Quitada').sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));
  const currentTab = state.expandedDebtTab === 'paid' ? 'paid' : 'pending';
  const source = currentTab === 'paid' ? paid : pending;
  const isPreview = state.expandedDebtListMode !== 'all';
  const visible = isPreview ? source.slice(0, 5) : source;
  const emptyText = currentTab === 'paid' ? 'Nenhuma parcela paga registrada.' : 'Nenhuma parcela pendente.';
  const buttonText = currentTab === 'paid' ? 'Ver parcelas pagas' : 'Ver todas as parcelas pendentes';
  const countText = currentTab === 'paid' ? '5 últimas' : '5 próximas';

  let html = '<div class="installment-tabs">' +
    '<button class="installment-tab ' + (currentTab === 'pending' ? 'is-active' : '') + '" type="button" data-installment-tab="pending">Pendentes <span>' + (currentTab === 'pending' ? escapeHtml(countText) : pending.length) + '</span></button>' +
    '<button class="installment-tab ' + (currentTab === 'paid' ? 'is-active' : '') + '" type="button" data-installment-tab="paid">Pagas <span>' + (currentTab === 'paid' ? escapeHtml(countText) : paid.length) + '</span></button>' +
  '</div>';

  html += '<div class="installment-list compact-installments">' +
    '<div class="installment-row header"><div>Parcela</div><div>Vencimento</div><div>Valor</div><div>Status</div><div>Ação</div></div>';

  if (!visible.length) {
    html += '<div class="installment-empty">' + escapeHtml(emptyText) + '</div>';
  } else {
    visible.forEach(item => {
      const statusClass = item.status === 'Paga' || item.status === 'Quitada' ? 'green' : item.status === 'Renegociada' ? 'blue' : 'amber';
      const payment = paymentForInstallment(item.id);
      const originalDueDate = item.originalDueDate || item.dueDate;
      const wasRescheduled = Boolean(item.originalDueDate);
      const canReschedule = currentTab === 'pending' && item.status === 'Pendente';
      const actionHtml = currentTab === 'paid'
        ? (payment ? '<button class="ghost-btn mini-action" type="button" data-delete-type="payment" data-delete-id="' + escapeHtml(payment.id) + '">Excluir pagamento</button>' : '')
        : '<div class="installment-actions">' +
          '<button class="ghost-btn mini-action" type="button" data-payment-installment-id="' + escapeHtml(item.id) + '">Registrar pagamento</button>' +
          (canReschedule ? '<button class="ghost-btn mini-action" type="button" data-reschedule-installment-id="' + escapeHtml(item.id) + '">Reagendar</button>' : '') +
        '</div>';
      html += '<div class="installment-row">' +
        '<div data-label="Parcela"><strong>' + (item.isDownPayment ? 'Entrada' : item.number + '/' + item.total) + '</strong></div>' +
        '<div data-label="Vencimento">' + formatDateBR(item.dueDate) + (wasRescheduled ? '<small class="installment-rescheduled">Venceu em ' + formatDateBR(originalDueDate) + '</small>' : '') + '</div>' +
        '<div data-label="Valor">' + brl(item.expectedValue) + '</div>' +
        '<div data-label="Status"><span class="tag ' + statusClass + '">' + escapeHtml(item.status || 'Pendente') + '</span></div>' +
        '<div data-label="Ação">' + actionHtml + '</div>' +
      '</div>';
    });
  }

  if (source.length && isPreview) {
    html += '<button class="installment-more" type="button" data-show-all-installments>' + escapeHtml(buttonText) + '<span>›</span></button>';
  }

  html += '</div>';
  return html;
}

export function debtActionMenu(debt) {
  const actionsByStatus = {
    Ativa: [
      ['Mover para Em Espera', 'changeDebtStatus', 'Em espera'],
      ['Quitar dívida', 'openPayoffModal'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ],
    'Em espera': [
      ['Mover para Rota Financeira', 'changeDebtStatus', 'Ativa'],
      ['Quitar dívida', 'openPayoffModal'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ],
    Quitada: [
      ['Restaurar para Rota Financeira', 'changeDebtStatus', 'Ativa'],
      ['Restaurar para Em Espera', 'changeDebtStatus', 'Em espera'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ]
  };
  const actions = actionsByStatus[debt.status] || actionsByStatus.Ativa;
  const buttons = actions.map(action => {
    const [label, type, valueOrTone, maybeTone] = action;
    const tone = valueOrTone === 'danger' || maybeTone === 'danger' ? ' danger-btn' : '';
    const status = type === 'changeDebtStatus' ? ' data-debt-status="' + escapeHtml(valueOrTone) + '"' : '';
    return '<button class="ghost-btn' + tone + '" type="button" data-debt-action="' + type + '" data-debt-id="' + escapeHtml(debt.id) + '"' + status + '>' + escapeHtml(label) + '</button>';
  }).join('');
  return '<details class="more-actions debt-menu"><summary class="ghost-btn">Ações <span>⋮</span></summary><div class="more-menu">' + buttons + '</div></details>';
}

export function debtExpandedDetail(debt) {
  const next = nextInstallment(debt);
  const installmentCount = installmentProgress(debt);
  const nextLabel = next ? formatDateBR(next.dueDate) : 'Sem Parcela';
  return '<div class="debt-detail">' +
    '<div class="debt-expanded-head">' +
      '<div class="expanded-facts">' +
        '<div><span>Criada em</span><strong>' + formatAnyDateBR(debt.createdAt) + '</strong></div>' +
        '<div><span>Tipo</span><strong>' + escapeHtml(debt.type || '-') + '</strong></div>' +
        '<div><span>Parcelas pagas</span><strong>' + installmentCount.paid + ' de ' + installmentCount.total + '</strong></div>' +
        '<div><span>Próximo vencimento</span><strong>' + escapeHtml(nextLabel) + '</strong><small>' + escapeHtml(next ? dueHint(next.dueDate) : '') + '</small></div>' +
      '</div>' +
      debtActionMenu(debt) +
    '</div>' +
    installmentRowsForDebt(debt) +
  '</div>';
}

export function debtRouteGridRow(debt, index, mode) {
  const balance = debtBalance(debt);
  const isExpanded = state.expandedDebtId === debt.id;
  const next = nextInstallment(debt);
  const nextLabel = next ? formatDateBR(next.dueDate) : 'Sem parcela';
  const progressValue = debt.status === 'Quitada' ? 100 : debtProgress(debt);
  const config = {
    waiting: { className: 'waiting-route-item' }
  }[mode] || {};
  return '<div class="route-item ' + config.className + (isExpanded ? ' expanded' : '') + '" data-debt-id="' + escapeHtml(debt.id) + '" data-debt-route="' + mode + '" draggable="true">' +
    '<button class="drag-handle" title="Arrastar para reordenar">⋮⋮</button>' +
    '<div class="route-rank">' + (index + 1) + '</div>' +
    '<div class="route-title">' + creditorLogoHtml(debt.creditorId) + '<div><button class="debt-name clickable debt-name-button" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</button><div class="debt-meta">' + compactTagsForDebt(debt) + '</div></div></div>' +
    routeProgressHtml(progressValue) +
    '<div class="route-stat"><span>Parcela</span><strong>' + brl(debt.installmentValue) + '</strong></div>' +
    (mode === 'waiting' ? '' : '<div class="route-stat"><span>Próxima Parcela</span><strong>' + escapeHtml(nextLabel) + '</strong></div>') +
    '<div class="route-stat"><span>Status</span><strong>' + routeInstallmentStatusLabel(debt) + '</strong></div>' +
    '<div class="route-stat"><span>Saldo</span><strong>' + brl(balance) + '</strong></div>' +
    '<div class="route-stat payoff-stat"><span>Quitação Hoje</span>' + payoffTodayHtml(debt) + '</div>' +
    '<div class="route-actions"><button class="ghost-btn subtle" type="button" data-secondary-route-move="' + escapeHtml(debt.id) + '" data-route-scope="' + mode + '" data-direction="-1">↑</button><button class="ghost-btn subtle" type="button" data-secondary-route-move="' + escapeHtml(debt.id) + '" data-route-scope="' + mode + '" data-direction="1">↓</button><button class="ghost-btn row-toggle" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + (isExpanded ? '⌃' : '⌄') + '</button></div>' +
    (isExpanded ? debtExpandedDetail(debt) : '') +
  '</div>';
}

export function paidOffDebtRow(debt, index) {
  const originalValue = debtTotal(debt);
  const paidValue = debtPaid(debt);
  const difference = paidOffDifference(debt);
  const closedDate = paidOffClosedDateKey(debt);
  return '<div class="route-item paid-route-item done" data-debt-id="' + debt.id + '">' +
    '<div class="route-rank">' + (index + 1) + '</div>' +
    '<div class="route-title">' + creditorLogoHtml(debt.creditorId) + '<div><div class="debt-name">' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</div><div class="debt-meta">' + tag('Quitada', 'green') + '</div></div></div>' +
    '<div class="route-stat"><span>Valor Original</span><strong>' + brl(originalValue) + '</strong></div>' +
    '<div class="route-stat"><span>Valor Pago</span><strong>' + brl(paidValue) + '</strong></div>' +
    '<div class="route-stat paid-difference ' + paidOffDifferenceClass(difference) + '"><span>Diferença</span><strong>' + escapeHtml(paidOffDifferenceLabel(difference)) + '</strong></div>' +
    '<div class="route-stat"><span>Encerrada em</span><strong>' + escapeHtml(closedDate ? formatDateBR(closedDate) : '-') + '</strong></div>' +
    '<div class="route-actions paid-off-actions"><button class="ghost-btn danger-btn" type="button" data-delete-type="debt" data-delete-id="' + escapeHtml(debt.id) + '">Excluir</button></div>' +
  '</div>';
}

// --- Métricas por seção ---

function renderWaitingDebtMetrics(waitingDebts) {
  const container = $('waitingDebtMetrics');
  if (!container) return;
  const totalBalance = waitingDebts.reduce((sum, debt) => sum + debtBalance(debt), 0);
  const payoffToday = waitingDebts.reduce((sum, debt) => sum + (payoffTodayValue(debt) || debtBalance(debt)), 0);
  const monthlyCommitment = waitingDebts
    .filter(debt => debtBalance(debt) > 0)
    .reduce((sum, debt) => sum + Number(debt.installmentValue || 0), 0);
  container.innerHTML =
    debtMetric('Saldo restante', brl(totalBalance), '◌', 'blue') +
    debtMetric('Quitação hoje', brl(payoffToday), '✓', 'green') +
    debtMetric('Dívidas em Espera', String(waitingDebts.length), '▥', '') +
    debtMetric('Compromisso mensal', brl(monthlyCommitment), '▤', 'green');
}

function creditorFilterButton(scope, id, labelHtml, count, active) {
  return '<button class="filter-chip ' + (active ? 'is-active' : '') + '" type="button" data-creditor-filter-scope="' + scope + '" data-creditor-filter-id="' + escapeHtml(id) + '">' + labelHtml + '<span class="filter-count">' + count + '</span></button>';
}

function bindCreditorFilterButtons(container) {
  container.querySelectorAll('[data-creditor-filter-scope]').forEach(button => {
    button.addEventListener('click', () => applyCreditorFilter(button.dataset.creditorFilterScope, button.dataset.creditorFilterId));
  });
}

function applyCreditorFilter(scope, id) {
  if (scope === 'waiting') state.selectedWaitingCreditorFilter = id;
  if (scope === 'paidOff') state.selectedPaidOffCreditorFilter = id;
  state.expandedDebtId = null;
  renderDebts();
}

function renderCreditorFilters({ containerId, scope, debts, selectedId }) {
  const container = $(containerId);
  if (!container) return;
  let html = creditorFilterButton(scope, 'all', 'Todos', debts.length, selectedId === 'all');
  creditorFilterEntries(debts, getCreditorName).forEach(({ id, name, count }) => {
    html += creditorFilterButton(scope, id, creditorLogoHtml(id) + escapeHtml(name), count, selectedId === id);
  });
  container.innerHTML = html;
  bindCreditorFilterButtons(container);
}

function renderPaidOffDebtMetrics(filteredPaidOffDebts) {
  const container = $('paidOffDebtMetrics');
  if (!container) return;
  const totalOriginal = filteredPaidOffDebts.reduce((sum, debt) => sum + debtTotal(debt), 0);
  const totalPaid = filteredPaidOffDebts.reduce((sum, debt) => sum + debtPaid(debt), 0);
  const creditorsCount = new Set(filteredPaidOffDebts.map(d => d.creditorId).filter(Boolean)).size;
  container.innerHTML =
    debtMetric('Dívidas Quitadas', String(filteredPaidOffDebts.length), '✓', 'green') +
    debtMetric('Valor Original', brl(totalOriginal), '▣', 'blue') +
    debtMetric('Valor Pago', brl(totalPaid), '▤', '') +
    debtMetric('Credores', String(creditorsCount), '◌', '');
}

// --- Render principal ---

export function renderDebts() {
  const waitingAll = state.debts.filter(d => d.status === 'Em espera');
  const waitingFiltered = filterDebtsByCreditor(waitingAll, state.selectedWaitingCreditorFilter);
  const waiting = sortDebts(waitingFiltered, state.selectedWaitingDebtSort, state.selectedWaitingDebtSortDirection);
  const paidOffAll = state.debts.filter(d => d.status === 'Quitada');
  const paidOffFiltered = filterDebtsByCreditor(paidOffAll, state.selectedPaidOffCreditorFilter);
  const paidOff = sortPaidOffDebts(paidOffFiltered);
  const waitingDirection = $('waitingDebtSortDirection');
  if (waitingDirection) {
    waitingDirection.value = state.selectedWaitingDebtSortDirection;
    waitingDirection.disabled = state.selectedWaitingDebtSort === 'trail';
  }
  renderCreditorFilters({ containerId: 'waitingCreditorFilters', scope: 'waiting', debts: waitingAll, selectedId: state.selectedWaitingCreditorFilter });
  renderWaitingDebtMetrics(waitingFiltered);
  renderCreditorFilters({ containerId: 'paidOffCreditorFilters', scope: 'paidOff', debts: paidOffAll, selectedId: state.selectedPaidOffCreditorFilter });
  renderPaidOffDebtMetrics(paidOff);
  $('waitingDebts').innerHTML = waiting.length ? '<div class="route-panel"><div class="route-list">' + waiting.map((debt, index) => debtRouteGridRow(debt, index, 'waiting')).join('') + '</div></div>' : emptyCard('Nenhuma dívida em espera', state.selectedWaitingCreditorFilter === 'all' ? 'As dívidas fora da frente atual aparecerão aqui.' : 'Não há dívidas em espera para este credor.');
  $('paidOffDebts').innerHTML = paidOff.length ? '<div class="route-panel"><div class="route-list">' + paidOff.map((debt, index) => paidOffDebtRow(debt, index)).join('') + '</div></div>' : emptyCard('Nenhuma dívida quitada', state.selectedPaidOffCreditorFilter === 'all' ? 'Quando uma dívida ficar sem parcelas abertas, ela aparecerá aqui.' : 'Não há dívidas quitadas para este credor.');
}

// --- Ações de filtro e ordenação ---

export function filterWaitingByCreditor(id) {
  applyCreditorFilter('waiting', id);
}

export function filterPaidOffByCreditor(id) {
  applyCreditorFilter('paidOff', id);
}

export function setWaitingDebtSort(mode) {
  state.selectedWaitingDebtSort = mode;
  state.expandedDebtId = null;
  renderDebts();
}

export function setWaitingDebtSortDirection(direction) {
  state.selectedWaitingDebtSortDirection = direction === 'asc' ? 'asc' : 'desc';
  state.expandedDebtId = null;
  renderDebts();
}

export function toggleDebt(id) {
  const nextExpanded = state.expandedDebtId === id ? null : id;
  if (state.expandedDebtId !== id) {
    state.expandedDebtTab = 'pending';
    state.expandedDebtListMode = 'preview';
  }
  state.expandedDebtId = nextExpanded;
  if (state.renderFn) state.renderFn();
}

export function setDebtInstallmentTab(tab) {
  state.expandedDebtTab = tab === 'paid' ? 'paid' : 'pending';
  state.expandedDebtListMode = 'preview';
  if (state.renderFn) state.renderFn();
}

export function showAllDebtInstallments() {
  state.expandedDebtListMode = 'all';
  if (state.renderFn) state.renderFn();
}

// --- Drag & drop Em espera ---

export async function moveWaitingDebt(id, direction) {
  const route = orderedWaitingDebts().map((debt, index) => ({ ...debt, payoffOrder: index + 1 }));
  const reordered = moveItemByDirection(route, id, direction);
  if (!reordered) return;
  await persistDebtOrder(reordered, {
    sortStateKey: 'selectedWaitingDebtSort',
    sortSelectId: 'waitingDebtSort',
    message: 'Ordem de espera atualizada.'
  });
}

export function startWaitingDebtDrag(event, id) {
  beginDebtDrag(event, id, {
    stateKey: 'draggedWaitingDebtId',
    itemSelector: '.waiting-route-item'
  });
}

export function waitingDebtDragOver(event) {
  allowDebtDrop(event);
}

export async function dropWaitingDebt(event, targetId) {
  const options = {
    stateKey: 'draggedWaitingDebtId',
    draggingSelector: '.waiting-route-item.dragging'
  };
  const sourceId = takeDebtDropSource(event, options);
  const route = orderedWaitingDebts();
  const reordered = moveItemToTargetPosition(route, sourceId, targetId);
  if (!reordered) return;
  await persistDebtOrder(reordered, {
    sortStateKey: 'selectedWaitingDebtSort',
    sortSelectId: 'waitingDebtSort',
    message: 'Ordem de espera atualizada.'
  });
}

export function endWaitingDebtDrag() {
  endDebtDrag({
    stateKey: 'draggedWaitingDebtId',
    draggingSelector: '.waiting-route-item.dragging'
  });
}

function formatAnyDateBR(value) {
  if (!value) return '-';
  if (typeof value === 'string') return formatDateBR(value.slice(0, 10));
  if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString('pt-BR');
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString('pt-BR');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}
