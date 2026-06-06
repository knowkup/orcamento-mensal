import { state } from './state.js';
import { $, brl, escapeHtml, emptyCard, getCreditorName, compactTagsForDebt, formatDateBR, routeProgressHtml, showToast } from './utils.js';
import { debtBalance, nextInstallment, debtProgress, payoffTodayHtml, routeInstallmentStatusLabel } from './calc.js';
import { debtMetric, sortedTrailDebts, orderedTrailDebts } from './debts.js';
import { debtDoc, writeBatch, serverTimestamp } from './firebase.js';
import { moveItemToTargetPosition, moveItemByDirection } from '../domain/reorder.js';
import { renderDebtRouteItem } from './debt-components.js';

// --- Render principal da Rota Financeira ---

export function renderTrail() {
  const metrics = $('trailMetrics');
  const road = $('trailRoad');
  const position = $('trailPositionTitle');
  const nextTarget = $('nextTarget');
  if (!metrics || !road || !position || !nextTarget) return;

  const allRoute = sortedTrailDebts();
  const route = allRoute.filter(d => !d.isConsignado);
  const consignadoRoute = allRoute.filter(d => !!d.isConsignado);

  const totalBalance = route.reduce((sum, debt) => sum + debtBalance(debt), 0);
  const monthlyCommitment = route
    .filter(debt => debt.status === 'Ativa' && debtBalance(debt) > 0)
    .reduce((sum, debt) => sum + Number(debt.installmentValue || 0), 0);
  const next = route.find(debt => debtBalance(debt) > 0) || null;

  metrics.innerHTML =
    '<div class="route-summary-copy"><div class="metric-label">Frente atual</div><strong>' + (route.length ? route.length + ' dívida(s) na rota' : 'Nenhuma dívida ativa na rota') + '</strong><span>' + (route.length ? 'Aqui ficam apenas os compromissos que ainda pedem ação.' : 'Cadastre ou reative uma dívida para montar sua próxima frente.') + '</span></div>' +
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
}

// --- Ordenação ---

export function setTrailDebtSort(mode) {
  state.selectedTrailDebtSort = mode;
  state.expandedDebtId = null;
  renderTrail();
}

// --- Drag & drop da Rota Financeira ---

async function persistRouteOrder(route) {
  const batch = writeBatch();
  route.forEach((debt, index) => {
    const payoffOrder = index + 1;
    batch.update(debtDoc(debt.id), { payoffOrder, updatedAt: serverTimestamp() });
    const local = state.debts.find(item => item.id === debt.id);
    if (local) local.payoffOrder = payoffOrder;
  });
  await batch.commit();
  if (state.renderFn) state.renderFn();
  showToast('Ordem da rota atualizada.');
}

export async function moveDebtInTrail(id, direction) {
  const targetDebt = state.debts.find(debt => debt.id === id);
  if (!targetDebt || targetDebt.status === 'Quitada') return;
  const route = orderedTrailDebts()
    .filter(debt => debt.status === 'Ativa')
    .map((debt, index) => ({ ...debt, payoffOrder: index + 1 }));
  const reordered = moveItemByDirection(route, id, direction);
  if (!reordered) return;
  await persistRouteOrder(reordered);
}

export function startRouteDrag(event, id) {
  const debt = state.debts.find(item => item.id === id);
  if (!debt || debt.status === 'Quitada') return;
  state.draggedRouteDebtId = id;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  }
  const item = event.target.closest('.route-item');
  if (item) item.classList.add('dragging');
}

export function routeDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}

export async function dropRouteDebt(event, targetId) {
  event.preventDefault();
  const sourceId = state.draggedRouteDebtId || event.dataTransfer?.getData('text/plain');
  state.draggedRouteDebtId = null;
  document.querySelectorAll('.route-item.dragging').forEach(item => item.classList.remove('dragging'));
  if (!sourceId || sourceId === targetId) return;
  const targetDebt = state.debts.find(debt => debt.id === targetId);
  if (!targetDebt || targetDebt.status === 'Quitada') return;
  const route = orderedTrailDebts().filter(debt => debt.status === 'Ativa');
  const reordered = moveItemToTargetPosition(route, sourceId, targetId);
  if (!reordered) return;
  await persistRouteOrder(reordered);
}

export function endRouteDrag() {
  state.draggedRouteDebtId = null;
  document.querySelectorAll('.route-item.dragging').forEach(item => item.classList.remove('dragging'));
}
