import { state } from './state.js';
import {
  brl,
  compactTagsForDebt,
  creditorLogoHtml,
  escapeHtml,
  formatDateBR,
  getCreditorName,
  routeProgressHtml
} from './utils.js';
import {
  debtBalance,
  debtProgress,
  nextInstallment,
  payoffTodayHtml,
  routeInstallmentStatusLabel
} from './calc.js';
import { debtExpandedDetail } from './debts.js';

export function renderDebtRouteItem(debt, options = {}) {
  const balance = debtBalance(debt);
  const isExpanded = state.expandedDebtId === debt.id;
  const next = nextInstallment(debt);
  const nextLabel = next ? formatDateBR(next.dueDate) : 'Sem parcela';
  const progressValue = options.done || options.completeProgress ? 100 : debtProgress(debt);
  const classes = [
    'route-item',
    options.className || '',
    options.done ? 'done' : '',
    options.current ? 'current' : '',
    isExpanded ? 'expanded' : ''
  ].filter(Boolean).join(' ');
  const dragTitle = options.dragTitle ? ' title="' + escapeHtml(options.dragTitle) + '"' : '';
  const dragDisabled = options.draggable ? '' : ' disabled';

  return '<div class="' + classes + '" data-debt-id="' + escapeHtml(debt.id) + '" draggable="' + (options.draggable ? 'true' : 'false') + '">' +
    '<button class="drag-handle"' + dragTitle + dragDisabled + '>⋮⋮</button>' +
    '<div class="route-rank' + (options.rankClass ? ' ' + options.rankClass : '') + '">' + options.rank + '</div>' +
    '<div class="route-title">' + creditorLogoHtml(debt.creditorId) + '<div><button class="debt-name clickable debt-name-button" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</button><div class="debt-meta">' + compactTagsForDebt(debt, options.current) + '</div></div></div>' +
    routeProgressHtml(progressValue) +
    '<div class="route-stat"><span>Parcela</span><strong>' + brl(debt.installmentValue) + '</strong></div>' +
    '<div class="route-stat"><span>Próxima Parcela</span><strong>' + escapeHtml(nextLabel) + '</strong></div>' +
    '<div class="route-stat"><span>Status</span><strong>' + routeInstallmentStatusLabel(debt) + '</strong></div>' +
    '<div class="route-stat"><span>Saldo</span><strong>' + brl(balance) + '</strong></div>' +
    '<div class="route-stat payoff-stat"><span>Quitação Hoje</span>' + payoffTodayHtml(debt) + '</div>' +
    '<div class="route-actions">' + (options.reorderActions || '') + '<button class="ghost-btn row-toggle" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + (isExpanded ? '⌃' : '⌄') + '</button></div>' +
    (isExpanded ? debtExpandedDetail(debt) : '') +
  '</div>';
}
