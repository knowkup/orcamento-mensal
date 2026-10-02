import { state } from './state.js';
import { $, brl, escapeHtml, emptyCard, getCreditorName, compactTagsForDebt, formatDateBR, routeProgressHtml } from './utils.js';
import { debtBalance, nextInstallment, debtProgress, openInstallmentsForDebt, payoffTodayHtml, payoffTodayValue, routeInstallmentStatusLabel } from './calc.js';
import { debtMetric, sortedTrailDebts, orderedTrailDebts } from './debts.js';
import { moveItemToTargetPosition, moveItemByDirection } from '../domain/reorder.js';
import { renderDebtRouteItem } from './debt-components.js';
import { allowDebtDrop, beginDebtDrag, endDebtDrag, persistDebtOrder, takeDebtDropSource } from './debt-order.js';

// --- Render principal da Rota Financeira ---

export function renderTrail() {
  const metrics = $('trailMetrics');
  const road = $('trailRoad');
  const position = $('trailPositionTitle');
  const nextTarget = $('nextTarget');
  const payoffTimeline = $('payoffTimeline');
  if (!metrics || !road || !position || !nextTarget || !payoffTimeline) return;

  const allRoute = sortedTrailDebts();
  const route = allRoute.filter(d => !d.isConsignado);
  const consignadoRoute = allRoute.filter(d => !!d.isConsignado);

  const totalBalance = route.reduce((sum, debt) => sum + debtBalance(debt), 0);
  const monthlyCommitment = route
    .filter(debt => debt.status === 'Ativa' && debtBalance(debt) > 0)
    .reduce((sum, debt) => sum + Number(debt.installmentValue || 0), 0);
  const next = route.find(debt => debtBalance(debt) > 0) || null;

  metrics.innerHTML =
    '<div class="route-summary-copy"><div class="metric-label">Frente atual</div><strong>' + (route.length ? route.length + (route.length === 1 ? ' dívida na rota' : ' dívidas na rota') : 'Nenhuma dívida ativa na rota') + '</strong><span>' + (route.length ? 'Aqui ficam apenas os compromissos que ainda pedem ação.' : 'Cadastre ou reative uma dívida para montar sua próxima frente.') + '</span></div>' +
    '<div class="route-summary-metrics">' +
    debtMetric('Dívidas ativas', String(route.length), '⇄', 'blue') +
    debtMetric('Saldo ativo', brl(totalBalance), '▣', 'red') +
    debtMetric('Próximo alvo', next ? getCreditorName(next.creditorId) : '-', '!', next ? 'amber' : '') +
    debtMetric('Compromisso mensal', brl(monthlyCommitment), '▤', 'green') +
    '</div>';

  position.textContent = next
    ? 'Próximo alvo: ' + getCreditorName(next.creditorId) + ' · ' + next.name
    : route.length ? 'Nenhuma dívida ativa com saldo em aberto' : 'Defina sua primeira dívida na rota';

  if (!allRoute.length) {
    nextTarget.innerHTML = '';
    road.innerHTML = emptyCard('Rota vazia', 'Cadastre dívidas na Rota Financeira para montar sua ordem de quitação.');
    payoffTimeline.innerHTML = '';
    return;
  }

  if (next) {
    const nextProgress = debtProgress(next);
    nextTarget.innerHTML = '<div class="next-target-card">' +
      '<div class="next-target-main">' +
        '<div class="target-icon">!</div>' +
        '<div><div class="eyebrow">Próximo alvo</div><h2>' + escapeHtml(getCreditorName(next.creditorId) + ' · ' + next.name) + '</h2><div class="debt-meta">' + compactTagsForDebt(next, true) + '</div></div>' +
      '</div>' +
      routeProgressHtml(nextProgress) +
      '<div class="next-target-stat"><span>Parcela</span><strong>' + brl(next.installmentValue) + '</strong></div>' +
      '<div class="next-target-stat"><span>Próxima Parcela</span><strong>' + escapeHtml(nextInstallment(next) ? formatDateBR(nextInstallment(next).dueDate) : 'Sem parcela') + '</strong></div>' +
      '<div class="next-target-stat"><span>Status</span><strong>' + routeInstallmentStatusLabel(next) + '</strong></div>' +
      '<div class="next-target-stat"><span>Saldo</span><strong>' + brl(debtBalance(next)) + '</strong></div>' +
      '<div class="next-target-stat payoff-stat"><span>Quitação Hoje</span>' + payoffTodayHtml(next) + '</div>' +
    '</div>';
  } else {
    nextTarget.innerHTML = '<div class="next-target-card complete"><div class="next-target-main"><div class="target-icon">✓</div><div><div class="eyebrow">Rota sem pressão</div><h2>Nenhuma dívida ativa com saldo em aberto</h2><div class="debt-meta">A frente atual fica vazia até você cadastrar ou reativar uma dívida.</div></div></div></div>';
  }

  let roadHtml = '';

  if (route.length) {
    roadHtml += '<div class="route-panel"><div class="route-list">' + route.map((debt, index) => {
      const balance = debtBalance(debt);
      const done = balance === 0;
      const current = !done && debt.id === next?.id;
      const rank = done ? '✓' : route.filter(item => item.status === 'Ativa').findIndex(item => item.id === debt.id) + 1;
      const canReorder = state.selectedTrailDebtSort === 'trail' && !done;
      const reorderActions = canReorder
        ? '<button class="ghost-btn subtle" type="button" data-route-move="' + escapeHtml(debt.id) + '" data-direction="-1">↑</button><button class="ghost-btn subtle" type="button" data-route-move="' + escapeHtml(debt.id) + '" data-direction="1">↓</button>'
        : '';
      const dragTitle = done ? 'Dívida concluída' : state.selectedTrailDebtSort === 'trail' ? 'Arrastar para reordenar' : 'Reordenação manual disponível em Ordem da Rota';
      return renderDebtRouteItem(debt, {
        rank,
        done,
        current,
        draggable: canReorder,
        dragTitle,
        reorderActions
      });
    }).join('') + '</div></div>';
  }

  if (consignadoRoute.length) {
    const consignadoTotal = consignadoRoute.reduce((sum, d) => sum + Number(d.installmentValue || 0), 0);
    roadHtml += '<div class="consignado-section">' +
      '<div class="consignado-section-head">' +
        '<div>' +
          '<div class="consignado-section-title">Consignados · Descontados em folha</div>' +
          '<div class="consignado-section-sub">Já deduzidos do salário líquido — não entram no compromisso mensal</div>' +
        '</div>' +
        '<div class="consignado-section-total"><span>Total em folha</span><strong>' + brl(consignadoTotal) + '/mês</strong></div>' +
      '</div>' +
      '<div class="route-panel consignado-panel"><div class="route-list">' +
      consignadoRoute.map(debt => renderDebtRouteItem(debt, {
        className: 'consignado',
        rank: 'CLT',
        rankClass: 'consignado-rank',
        completeProgress: debtBalance(debt) === 0,
        draggable: false
      })).join('') +
      '</div></div>' +
    '</div>';
  }

  road.innerHTML = roadHtml;
  renderPayoffTimeline(allRoute, payoffTimeline);
}

function renderPayoffTimeline(route, container) {
  const items = route
    .filter(debt => debtBalance(debt) > 0)
    .map(debt => {
      const installments = openInstallmentsForDebt(debt)
        .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
      return { debt, installments, lastDue: installments.at(-1)?.dueDate || '' };
    })
    .sort((a, b) => {
      if (!a.lastDue) return 1;
      if (!b.lastDue) return -1;
      return a.lastDue.localeCompare(b.lastDue);
    });

  if (!items.length) {
    container.innerHTML = '';
    return;
  }

  const scheduled = items.filter(item => item.lastDue);
  const first = scheduled[0];
  const last = scheduled.at(-1);
  const groups = new Map();
  items.forEach(item => {
    const key = item.lastDue ? item.lastDue.slice(0, 7) : 'unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  container.innerHTML =
    '<div class="payoff-timeline-heading">' +
      '<div><p class="eyebrow">Rota Financeira</p><h2>Previsão de quitação</h2><p>Datas calculadas pelas parcelas ainda em aberto.</p></div>' +
      '<div class="payoff-timeline-summary">' +
        '<div><span>Próximo encerramento</span><strong>' + escapeHtml(first ? formatMonthYear(first.lastDue) : 'Sem previsão') + '</strong></div>' +
        '<div><span>Rota concluída em</span><strong>' + escapeHtml(last ? formatMonthYear(last.lastDue) : 'Sem previsão') + '</strong></div>' +
      '</div>' +
    '</div>' +
    '<div class="payoff-timeline-list">' +
      [...groups.entries()].map(([key, group]) => payoffTimelineGroup(key, group)).join('') +
    '</div>';
}

function payoffTimelineGroup(key, items) {
  const isUnknown = key === 'unknown';
  return '<section class="payoff-timeline-month">' +
    '<div class="payoff-timeline-marker" aria-hidden="true"><span></span></div>' +
    '<div class="payoff-timeline-content">' +
      '<div class="payoff-timeline-month-heading"><h3>' + escapeHtml(isUnknown ? 'Sem previsão' : formatMonthYear(items[0].lastDue)) + '</h3><span>' + items.length + (items.length === 1 ? ' dívida termina' : ' dívidas terminam') + '</span></div>' +
      '<div class="payoff-timeline-debts">' +
        items.map(payoffTimelineDebt).join('') +
      '</div>' +
    '</div>' +
  '</section>';
}

function payoffTimelineDebt({ debt, installments }) {
  const payoffToday = payoffTodayValue(debt);
  const installmentLabel = installments.length + (installments.length === 1 ? ' parcela restante' : ' parcelas restantes');
  const payoffLabel = payoffToday ? 'Quitação hoje ' + brl(payoffToday) : 'Saldo ' + brl(debtBalance(debt));
  return '<div class="payoff-timeline-debt">' +
    '<div><strong>' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</strong><span>' + escapeHtml(installmentLabel) + ' · ' + payoffLabel + '</span></div>' +
    '<strong>' + brl(debtBalance(debt)) + '</strong>' +
  '</div>';
}

function formatMonthYear(date) {
  if (!date) return 'Sem previsão';
  const value = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(date + 'T00:00:00'))
    .replace('.', '')
    .replace(' de ', '/');
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// --- Ordenação ---

export function setTrailDebtSort(mode) {
  state.selectedTrailDebtSort = mode;
  state.expandedDebtId = null;
  renderTrail();
}

// --- Drag & drop da Rota Financeira ---

export async function moveDebtInTrail(id, direction) {
  const targetDebt = state.debts.find(debt => debt.id === id);
  if (!targetDebt || targetDebt.status === 'Quitada') return;
  const route = orderedTrailDebts()
    .filter(debt => debt.status === 'Ativa')
    .map((debt, index) => ({ ...debt, payoffOrder: index + 1 }));
  const reordered = moveItemByDirection(route, id, direction);
  if (!reordered) return;
  await persistDebtOrder(reordered, { message: 'Ordem da rota atualizada.' });
}

export function startRouteDrag(event, id) {
  const debt = state.debts.find(item => item.id === id);
  if (!debt || debt.status === 'Quitada') return;
  beginDebtDrag(event, id, {
    stateKey: 'draggedRouteDebtId',
    itemSelector: '.route-item'
  });
}

export function routeDragOver(event) {
  allowDebtDrop(event);
}

export async function dropRouteDebt(event, targetId) {
  const options = {
    stateKey: 'draggedRouteDebtId',
    draggingSelector: '.route-item.dragging'
  };
  const sourceId = takeDebtDropSource(event, options);
  const targetDebt = state.debts.find(debt => debt.id === targetId);
  if (!targetDebt || targetDebt.status === 'Quitada') return;
  const route = orderedTrailDebts().filter(debt => debt.status === 'Ativa');
  const reordered = moveItemToTargetPosition(route, sourceId, targetId);
  if (!reordered) return;
  await persistDebtOrder(reordered, { message: 'Ordem da rota atualizada.' });
}

export function endRouteDrag() {
  endDebtDrag({
    stateKey: 'draggedRouteDebtId',
    draggingSelector: '.route-item.dragging'
  });
}
