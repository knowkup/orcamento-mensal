import { state } from './state.js';
import { $, brl, escapeHtml, emptyCard, getCreditorName, creditorLogoHtml, compactTagsForDebt, formatDateBR, routeProgressHtml } from './utils.js';
import { debtBalance, nextInstallment, debtProgress, payoffTodayHtml, payoffTodayValue, routeInstallmentStatusLabel } from './calc.js';
import { debtMetric, sortedTrailDebts, orderedTrailDebts } from './debts.js';
import { moveItemToTargetPosition, moveItemByDirection } from '../domain/reorder.js';
import { renderDebtRouteItem } from './debt-components.js';
import { allowDebtDrop, beginDebtDrag, endDebtDrag, persistDebtOrder, takeDebtDropSource } from './debt-order.js';
import { creditorFilterEntries, filterDebtsByCreditor } from '../domain/debt-filters.js';
import { buildDebtPayoffForecast } from '../domain/debt-payoff-forecast.js';

// --- Render principal da Rota Financeira ---

export function renderTrail() {
  const metrics = $('trailMetrics');
  const road = $('trailRoad');
  const position = $('trailPositionTitle');
  const nextTarget = $('nextTarget');
  const payoffTimeline = $('payoffTimeline');
  const creditorFilters = $('trailCreditorFilters');
  const sortDirection = $('trailDebtSortDirection');
  if (!metrics || !road || !position || !nextTarget || !payoffTimeline || !creditorFilters || !sortDirection) return;

  const allRoute = sortedTrailDebts();
  const route = allRoute.filter(d => !d.isConsignado);
  const consignadoRoute = allRoute.filter(d => !!d.isConsignado);
  const visibleRoute = filterDebtsByCreditor(route, state.selectedTrailCreditorFilter);

  const totalBalance = route.reduce((sum, debt) => sum + debtBalance(debt), 0);
  const monthlyCommitment = route
    .filter(debt => debt.status === 'Ativa' && debtBalance(debt) > 0)
    .reduce((sum, debt) => sum + Number(debt.installmentValue || 0), 0);
  const next = route.find(debt => debtBalance(debt) > 0) || null;

  renderTrailCreditorFilters(creditorFilters, route);
  sortDirection.value = state.selectedTrailDebtSortDirection;
  sortDirection.disabled = state.selectedTrailDebtSort === 'trail';

  metrics.innerHTML =
    debtMetric('Saldo restante', brl(totalBalance), '◌', 'blue') +
    debtMetric('Quitação hoje', brl(route.reduce((sum, debt) => sum + (payoffTodayValue(debt) || debtBalance(debt)), 0)), '✓', 'green') +
    debtMetric('Dívidas ativas', String(route.length), '⇄', 'blue') +
    debtMetric('Compromisso mensal', brl(monthlyCommitment), '▤', 'green');

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

  if (visibleRoute.length) {
    roadHtml += '<div class="route-panel"><div class="route-list">' + visibleRoute.map((debt, index) => {
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
  } else {
    roadHtml += emptyCard('Nenhuma dívida para este credor', 'Escolha outro credor ou veja todas as dívidas da rota.');
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
  renderPayoffTimeline(route, payoffTimeline);
}

function renderTrailCreditorFilters(container, debts) {
  let html = trailCreditorFilterButton('all', 'Todos', debts.length, state.selectedTrailCreditorFilter === 'all');
  creditorFilterEntries(debts, getCreditorName).forEach(({ id, name, count }) => {
    html += trailCreditorFilterButton(id, creditorLogoHtml(id) + escapeHtml(name), count, state.selectedTrailCreditorFilter === id);
  });
  container.innerHTML = html;
  container.querySelectorAll('[data-trail-creditor-filter]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedTrailCreditorFilter = button.dataset.trailCreditorFilter;
      state.expandedDebtId = null;
      renderTrail();
    });
  });
}

function trailCreditorFilterButton(id, labelHtml, count, active) {
  return '<button class="filter-chip ' + (active ? 'is-active' : '') + '" type="button" data-trail-creditor-filter="' + escapeHtml(id) + '">' + labelHtml + '<span class="filter-count">' + count + '</span></button>';
}

function renderPayoffTimeline(route, container) {
  const forecast = buildDebtPayoffForecast({
    debts: route,
    installmentsByDebt: state.installmentsByDebt,
    fromMonth: new Date().toISOString().slice(0, 7)
  });

  if (!forecast.initialCommitment) {
    container.innerHTML = '';
    return;
  }

  const first = forecast.events[0];
  const last = forecast.events.at(-1);
  const firstVacancy = first ? formatMonthYear(first.month) : 'Sem previsão';
  const lastDueMonth = last
    ? last.debts.map(item => String(item.lastDueDate || '').slice(0, 7)).sort().at(-1)
    : '';
  const ending = lastDueMonth ? formatMonthYear(lastDueMonth) : 'Sem previsão';
  const chart = first ? payoffForecastChart(forecast) : '';
  const noDateNote = forecast.withoutForecast.length
    ? `<p class="payoff-forecast-note">${forecast.withoutForecast.length === 1 ? 'Uma dívida ativa está' : `${forecast.withoutForecast.length} dívidas ativas estão`} sem data de término no gráfico.</p>`
    : '';

  container.innerHTML =
    '<div class="payoff-forecast-heading">' +
      '<div><p class="eyebrow">Rota Financeira</p><h2>Previsão de quitação</h2><p>O azul é o compromisso que continua no orçamento; o verde é a capacidade mensal liberada pelas quitações.</p></div>' +
      '<div class="payoff-forecast-summary">' +
        '<div><span>Próxima vaga no orçamento</span><strong>' + escapeHtml(firstVacancy) + '</strong>' + (first ? `<small>${escapeHtml(brl(first.released))}/mês livres</small>` : '') + '</div>' +
        '<div><span>Última quitação prevista</span><strong>' + escapeHtml(ending) + '</strong></div>' +
      '</div>' +
    '</div>' +
    (chart || '<div class="payoff-forecast-empty">Não foi possível estimar os meses de encerramento com as parcelas atuais.</div>') +
    noDateNote;
}

function payoffForecastChart(forecast) {
  const W = 960;
  const H = 264;
  const LEFT = 58;
  const RIGHT = 18;
  const TOP = 20;
  const BOTTOM = 42;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOTTOM;
  const monthDistance = (from, to) => {
    const [fromYear, fromValue] = from.split('-').map(Number);
    const [toYear, toValue] = to.split('-').map(Number);
    return (toYear - fromYear) * 12 + toValue - fromValue;
  };
  const duration = Math.max(1, monthDistance(forecast.startMonth, forecast.endMonth));
  const xPos = month => LEFT + (monthDistance(forecast.startMonth, month) / duration) * chartW;
  const yMax = Math.max(1, forecast.initialCommitment * 1.15);
  const yPos = value => TOP + (1 - value / yMax) * chartH;
  const zeroY = yPos(0);
  const initialY = yPos(forecast.initialCommitment);
  const events = forecast.events;
  const displayEvents = events.length <= 4
    ? events
    : events.filter((event, index) => index === 0 || index === events.length - 1 || index % Math.ceil(events.length / 3) === 0);
  let previousMonth = forecast.startMonth;
  let previousCommitment = forecast.initialCommitment;
  let line = `M${xPos(previousMonth).toFixed(1)},${yPos(previousCommitment).toFixed(1)}`;
  let blueArea = `M${xPos(previousMonth).toFixed(1)},${zeroY.toFixed(1)} L${xPos(previousMonth).toFixed(1)},${yPos(previousCommitment).toFixed(1)}`;
  const releasedAreas = [];

  events.forEach(event => {
    const x = xPos(event.month);
    const nextCommitment = Math.max(0, previousCommitment - event.released);
    const afterY = yPos(nextCommitment);
    line += ` H${x.toFixed(1)} V${afterY.toFixed(1)}`;
    blueArea += ` H${x.toFixed(1)} V${afterY.toFixed(1)}`;
    const nextEvent = events[events.indexOf(event) + 1];
    const segmentEnd = xPos(nextEvent?.month || forecast.endMonth);
    releasedAreas.push(`<rect class="payoff-released-area" x="${x.toFixed(1)}" y="${initialY.toFixed(1)}" width="${Math.max(0, segmentEnd - x).toFixed(1)}" height="${Math.max(0, afterY - initialY).toFixed(1)}"/>`);
    previousMonth = event.month;
    previousCommitment = nextCommitment;
  });
  const endX = xPos(forecast.endMonth);
  line += ` H${endX.toFixed(1)}`;
  blueArea += ` H${endX.toFixed(1)} L${endX.toFixed(1)},${zeroY.toFixed(1)} Z`;

  const ticks = [0, forecast.initialCommitment / 2, forecast.initialCommitment];
  const grid = ticks.map(value => {
    const y = yPos(value);
    return `<line class="payoff-chart-grid" x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W - RIGHT}" y2="${y.toFixed(1)}"/><text class="payoff-chart-y-label" x="${LEFT - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${escapeHtml(compactCurrency(value))}</text>`;
  }).join('');
  const markers = events.map(event => {
    const step = forecast.steps.find(item => item.month === event.month);
    const x = xPos(event.month);
    const y = yPos(step.commitment);
    const names = event.debts.map(item => `${getCreditorName(item.debt.creditorId)} · ${item.debt.name}`).join(', ');
    return `<circle class="payoff-chart-event" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" data-tooltip="${escapeHtml(`${formatMonthYear(event.month)}: libera ${brl(event.released)}/mês — ${names}`)}"/>`;
  }).join('');
  const annotations = displayEvents.map((event, index) => {
    const x = xPos(event.month);
    const names = event.debts.map(item => item.debt.name).join(' + ');
    const endingMonth = event.debts.map(item => String(item.lastDueDate || '').slice(0, 7)).sort().at(-1);
    const labelX = Math.min(W - RIGHT - 6, Math.max(LEFT + 6, x + 10));
    const offset = index % 2 ? 34 : 0;
    return `<text class="payoff-chart-release" x="${labelX.toFixed(1)}" y="${(initialY + 22 + offset).toFixed(1)}">+ ${escapeHtml(brl(event.released))}/mês</text><text class="payoff-chart-debt" x="${labelX.toFixed(1)}" y="${(initialY + 38 + offset).toFixed(1)}">${escapeHtml(names)} termina em ${escapeHtml(formatMonthYear(endingMonth))}</text>`;
  }).join('');
  const xLabels = [forecast.startMonth, ...displayEvents.map(event => event.month), forecast.endMonth]
    .filter((month, index, all) => all.indexOf(month) === index)
    .map(month => `<text class="payoff-chart-x-label" x="${xPos(month).toFixed(1)}" y="${H - 12}" text-anchor="middle">${escapeHtml(formatMonthYear(month))}</text>`)
    .join('');

  return `<div class="payoff-chart-wrap"><div class="payoff-chart-legend"><span><i class="payoff-chart-swatch remaining"></i>Compromisso que permanece</span><span><i class="payoff-chart-swatch released"></i>Espaço liberado</span></div><div class="payoff-chart-area"><svg class="payoff-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Compromissos mensais restantes e capacidade liberada pelas quitações">${grid}<path class="payoff-chart-blue-area" d="${blueArea}"/><g>${releasedAreas.join('')}</g><path class="payoff-chart-line" d="${line}"/>${markers}${annotations}${xLabels}</svg></div><p class="payoff-chart-hint">Passe o mouse nos pontos para ver qual dívida termina e quanto ela libera por mês.</p></div>`;
}

function compactCurrency(value) {
  if (!value) return 'R$ 0';
  if (Math.abs(value) < 1000) return brl(value);
  return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
}

function formatMonthYear(month) {
  if (!month) return 'Sem previsão';
  const value = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
    .format(new Date(`${month}-01T12:00:00`))
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

export function setTrailDebtSortDirection(direction) {
  state.selectedTrailDebtSortDirection = direction === 'asc' ? 'asc' : 'desc';
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
