import { state } from './state.js';
import { $, brl, escapeHtml, emptyCard, getCreditorName, creditorLogoHtml, compactTagsForDebt, formatDateBR, dueHint, routeProgressHtml, showToast } from './utils.js';
import { debtBalance, nextInstallment, debtProgress, installmentProgress, payoffTodayHtml, routeInstallmentStatusLabel } from './calc.js';
import { debtMetric, sortedTrailDebts, orderedTrailDebts } from './debts.js';
import { debtDoc, writeBatch, serverTimestamp } from './firebase.js';
import { moveItemToTargetPosition, moveItemByDirection } from '../domain/reorder.js';

function debtExpandedDetail(debt) {
  const next = nextInstallment(debt);
  const count = installmentProgress(debt);
  const nextLabel = next ? formatDateBR(next.dueDate) : 'Sem Parcela';
  return '<div class="debt-detail">' +
    '<div class="debt-expanded-head">' +
      '<div class="expanded-facts">' +
        '<div><span>Criada em</span><strong>' + formatAnyDateBR(debt.createdAt) + '</strong></div>' +
        '<div><span>Tipo</span><strong>' + escapeHtml(debt.type || '-') + '</strong></div>' +
        '<div><span>Parcelas pagas</span><strong>' + count.paid + ' de ' + count.total + '</strong></div>' +
        '<div><span>Próximo vencimento</span><strong>' + escapeHtml(nextLabel) + '</strong><small>' + escapeHtml(next ? dueHint(next.dueDate) : '') + '</small></div>' +
      '</div>' +
      debtActionMenu(debt) +
    '</div>' +
    installmentRowsForDebt(debt) +
  '</div>';
}

function debtActionMenu(debt) {
  const actionsByStatus = {
    Ativa: [
      ['Mover para Em Espera', 'changeDebtStatus', 'Em espera'],
      ['Mover para Fora do Radar', 'changeDebtStatus', 'Fora do radar'],
      ['Quitar dívida', 'openPayoffModal'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ],
    'Em espera': [
      ['Mover para Rota Financeira', 'changeDebtStatus', 'Ativa'],
      ['Mover para Fora do Radar', 'changeDebtStatus', 'Fora do radar'],
      ['Quitar dívida', 'openPayoffModal'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ],
    'Fora do radar': [
      ['Mover para Rota Financeira', 'changeDebtStatus', 'Ativa'],
      ['Mover para Em Espera', 'changeDebtStatus', 'Em espera'],
      ['Quitar dívida', 'openPayoffModal'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ],
    Quitada: [
      ['Restaurar para Rota Financeira', 'changeDebtStatus', 'Ativa'],
      ['Restaurar para Em Espera', 'changeDebtStatus', 'Em espera'],
      ['Restaurar para Fora do Radar', 'changeDebtStatus', 'Fora do radar'],
      ['Editar dívida', 'openDebtForm'],
      ['Excluir dívida', 'openDeleteModal', 'danger']
    ]
  };
  const actions = actionsByStatus[debt.status] || actionsByStatus.Ativa;
  const buttons = actions.map(action => {
    const [label, type, valueOrTone, maybeTone] = action;
    const tone = valueOrTone === 'danger' || maybeTone === 'danger' ? ' danger-btn' : '';
    let onclick = '';
    if (type === 'changeDebtStatus') onclick = 'window.changeDebtStatus(\'' + debt.id + '\', \'' + valueOrTone + '\')';
    if (type === 'openPayoffModal') onclick = 'window.openPayoffModal(\'' + debt.id + '\')';
    if (type === 'openDebtForm') onclick = 'window.openDebtForm(\'edit\', \'' + debt.id + '\')';
    if (type === 'openDeleteModal') onclick = 'window.openDeleteModal(\'debt\', \'' + debt.id + '\')';
    return '<button class="ghost-btn' + tone + '" onclick="' + onclick + '">' + escapeHtml(label) + '</button>';
  }).join('');
  return '<details class="more-actions debt-menu"><summary class="ghost-btn">Ações <span>⋮</span></summary><div class="more-menu">' + buttons + '</div></details>';
}

function installmentRowsForDebt(debt) {
  const allItems = state.installmentsByDebt.get(debt.id) || [];
  if (!allItems.length) return '<div class="debt-meta" style="margin-top:14px;">Nenhuma parcela gerada para esta dívida.</div>';
  const pending = allItems.filter(i => !['Paga','Renegociada','Quitada','Cancelada'].includes(i.status)).sort((a, b) => String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
  const paid = allItems.filter(item => item.status === 'Paga' || item.status === 'Quitada').sort((a, b) => String(b.dueDate||'').localeCompare(String(a.dueDate||'')));
  const currentTab = state.expandedDebtTab === 'paid' ? 'paid' : 'pending';
  const source = currentTab === 'paid' ? paid : pending;
  const isPreview = state.expandedDebtListMode !== 'all';
  const visible = isPreview ? source.slice(0, 5) : source;
  const emptyText = currentTab === 'paid' ? 'Nenhuma parcela paga registrada.' : 'Nenhuma parcela pendente.';
  const buttonText = currentTab === 'paid' ? 'Ver parcelas pagas' : 'Ver todas as parcelas pendentes';
  const countText = currentTab === 'paid' ? '5 últimas' : '5 próximas';

  let html = '<div class="installment-tabs">' +
    '<button class="installment-tab ' + (currentTab === 'pending' ? 'is-active' : '') + '" onclick="window.setDebtInstallmentTab(\'pending\')">Pendentes <span>' + (currentTab === 'pending' ? escapeHtml(countText) : pending.length) + '</span></button>' +
    '<button class="installment-tab ' + (currentTab === 'paid' ? 'is-active' : '') + '" onclick="window.setDebtInstallmentTab(\'paid\')">Pagas <span>' + (currentTab === 'paid' ? escapeHtml(countText) : paid.length) + '</span></button>' +
  '</div>';
  html += '<div class="installment-list compact-installments">' +
    '<div class="installment-row header"><div>Parcela</div><div>Vencimento</div><div>Valor</div><div>Status</div><div>Ação</div></div>';
  if (!visible.length) {
    html += '<div class="installment-empty">' + escapeHtml(emptyText) + '</div>';
  } else {
    visible.forEach(item => {
      const statusClass = item.status === 'Paga' || item.status === 'Quitada' ? 'green' : item.status === 'Renegociada' ? 'blue' : 'amber';
      const payment = state.paymentByInstallment.get(item.id) || null;
      const actionHtml = currentTab === 'paid'
        ? (payment ? '<button class="ghost-btn mini-action" onclick="window.openDeleteModal(\'payment\', \'' + payment.id + '\')">Excluir pagamento</button>' : '')
        : '<button class="ghost-btn mini-action" onclick="window.openPaymentForm(\'' + item.id + '\')">Registrar pagamento</button>';
      html += '<div class="installment-row">' +
        '<div data-label="Parcela"><strong>' + item.number + '/' + item.total + '</strong></div>' +
        '<div data-label="Vencimento">' + formatDateBR(item.dueDate) + '</div>' +
        '<div data-label="Valor">' + brl(item.expectedValue) + '</div>' +
        '<div data-label="Status"><span class="tag ' + statusClass + '">' + escapeHtml(item.status || 'Pendente') + '</span></div>' +
        '<div data-label="Ação">' + actionHtml + '</div>' +
      '</div>';
    });
  }
  if (source.length && isPreview) {
    html += '<button class="installment-more" onclick="window.showAllDebtInstallments()">' + escapeHtml(buttonText) + '<span>›</span></button>';
  }
  html += '</div>';
  return html;
}

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
      const isExpanded = state.expandedDebtId === debt.id;
      const nextItem = nextInstallment(debt);
      const nextLabel = nextItem ? formatDateBR(nextItem.dueDate) : 'Sem parcela';
      const progressValue = done ? 100 : debtProgress(debt);
      const rank = done ? '✓' : route.filter(item => item.status === 'Ativa').findIndex(item => item.id === debt.id) + 1;
      const canReorder = state.selectedTrailDebtSort === 'trail' && !done;
      const dragAttrs = canReorder ? 'draggable="true"' : 'draggable="false"';
      const reorderActions = canReorder
        ? '<button class="ghost-btn subtle" type="button" data-route-move="' + escapeHtml(debt.id) + '" data-direction="-1">↑</button><button class="ghost-btn subtle" type="button" data-route-move="' + escapeHtml(debt.id) + '" data-direction="1">↓</button>'
        : '';
      const dragTitle = done ? 'Dívida concluída' : state.selectedTrailDebtSort === 'trail' ? 'Arrastar para reordenar' : 'Reordenação manual disponível em Ordem da Rota';
      return '<div class="route-item' + (done ? ' done' : '') + (current ? ' current' : '') + (isExpanded ? ' expanded' : '') + '" data-debt-id="' + debt.id + '" ' + dragAttrs + '>' +
        '<button class="drag-handle" title="' + dragTitle + '"' + (canReorder ? '' : ' disabled') + '>⋮⋮</button>' +
        '<div class="route-rank">' + rank + '</div>' +
        '<div class="route-title">' + creditorLogoHtml(debt.creditorId) + '<div><button class="debt-name clickable debt-name-button" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</button><div class="debt-meta">' + compactTagsForDebt(debt, current) + '</div></div></div>' +
        routeProgressHtml(progressValue) +
        '<div class="route-stat"><span>Parcela</span><strong>' + brl(debt.installmentValue) + '</strong></div>' +
        '<div class="route-stat"><span>Próxima Parcela</span><strong>' + escapeHtml(nextLabel) + '</strong></div>' +
        '<div class="route-stat"><span>Status</span><strong>' + routeInstallmentStatusLabel(debt) + '</strong></div>' +
        '<div class="route-stat"><span>Saldo</span><strong>' + brl(balance) + '</strong></div>' +
        '<div class="route-stat payoff-stat"><span>Quitação Hoje</span>' + payoffTodayHtml(debt) + '</div>' +
        '<div class="route-actions">' + reorderActions + '<button class="ghost-btn row-toggle" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + (isExpanded ? '⌃' : '⌄') + '</button></div>' +
        (isExpanded ? debtExpandedDetail(debt) : '') +
      '</div>';
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
      consignadoRoute.map(debt => {
        const balance = debtBalance(debt);
        const isExpanded = state.expandedDebtId === debt.id;
        const nextItem = nextInstallment(debt);
        const nextLabel = nextItem ? formatDateBR(nextItem.dueDate) : 'Sem parcela';
        const progressValue = balance === 0 ? 100 : debtProgress(debt);
        return '<div class="route-item consignado' + (isExpanded ? ' expanded' : '') + '" data-debt-id="' + debt.id + '" draggable="false">' +
          '<button class="drag-handle" disabled>⋮⋮</button>' +
          '<div class="route-rank consignado-rank">CLT</div>' +
          '<div class="route-title">' + creditorLogoHtml(debt.creditorId) + '<div><button class="debt-name clickable debt-name-button" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + escapeHtml(getCreditorName(debt.creditorId) + ' · ' + debt.name) + '</button><div class="debt-meta">' + compactTagsForDebt(debt, false) + '</div></div></div>' +
          routeProgressHtml(progressValue) +
          '<div class="route-stat"><span>Parcela</span><strong>' + brl(debt.installmentValue) + '</strong></div>' +
          '<div class="route-stat"><span>Próxima Parcela</span><strong>' + escapeHtml(nextLabel) + '</strong></div>' +
          '<div class="route-stat"><span>Status</span><strong>' + routeInstallmentStatusLabel(debt) + '</strong></div>' +
          '<div class="route-stat"><span>Saldo</span><strong>' + brl(balance) + '</strong></div>' +
          '<div class="route-stat payoff-stat"><span>Quitação Hoje</span>' + payoffTodayHtml(debt) + '</div>' +
          '<div class="route-actions"><button class="ghost-btn row-toggle" type="button" data-toggle-debt="' + escapeHtml(debt.id) + '">' + (isExpanded ? '⌃' : '⌄') + '</button></div>' +
          (isExpanded ? debtExpandedDetail(debt) : '') +
        '</div>';
      }).join('') +
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

function formatAnyDateBR(value) {
  if (!value) return '-';
  if (typeof value === 'string') return formatDateBR(value.slice(0, 10));
  if (typeof value.toDate === 'function') return value.toDate().toLocaleDateString('pt-BR');
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleDateString('pt-BR');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
}
