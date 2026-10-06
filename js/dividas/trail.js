import { state } from './state.js';
import { state as mainState } from '../state.js';
import { $, brl, escapeHtml, emptyCard, getCreditorName, creditorLogoHtml, compactTagsForDebt, formatDateBR, routeProgressHtml } from './utils.js';
import { debtBalance, nextInstallment, debtProgress, payoffTodayHtml, payoffTodayValue, routeInstallmentStatusLabel } from './calc.js';
import { debtMetric, sortedTrailDebts, orderedTrailDebts } from './debts.js';
import { isDebtInstallmentOpen } from '../domain/debts.js';
import { moveItemToTargetPosition, moveItemByDirection } from '../domain/reorder.js';
import { renderDebtRouteItem } from './debt-components.js';
import { allowDebtDrop, beginDebtDrag, endDebtDrag, persistDebtOrder, takeDebtDropSource } from './debt-order.js';
import { creditorFilterEntries, filterDebtsByCreditor } from '../domain/debt-filters.js';
import { addMonthsToMonth, buildDebtPayoffForecast } from '../domain/debt-payoff-forecast.js';
import { bindMoneyInputs, formatCurrencyInput, parseCurrencyInput } from '../utils.js';

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
  renderPayoffTimeline(route, allRoute, payoffTimeline);
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

function renderPayoffTimeline(route, allRoute, container) {
  const forecast = buildDebtPayoffForecast({
    debts: allRoute,
    installmentsByDebt: state.installmentsByDebt,
    fromMonth: new Date().toISOString().slice(0, 7)
  });
  const car = payoffCarForecast();
  const timeline = buildPayoffTimeline(allRoute, forecast, car);

  if (timeline.points.length < 2) {
    container.innerHTML = '';
    return;
  }

  const first = timeline.points.find((point, index) => index > 0 && point.released > 0);
  const last = timeline.points.at(-1);
  const commitmentLimit = payoffCommitmentLimit(timeline.initialCommitment);
  const firstVacancy = first ? formatMonthYear(first.releaseMonth) : 'Sem previsão';
  const ending = last ? formatMonthYear(last.month) : 'Sem previsão';
  const chart = payoffForecastChart(timeline, commitmentLimit);
  const noDateNote = forecast.withoutForecast.length
    ? `<p class="payoff-forecast-note">${forecast.withoutForecast.length === 1 ? 'Uma dívida ativa está' : `${forecast.withoutForecast.length} dívidas ativas estão`} sem data de término no gráfico.</p>`
    : '';

  container.innerHTML =
    '<div class="payoff-forecast-heading">' +
      '<div><p class="eyebrow">Rota Financeira</p><h2>Previsão de quitação</h2><label class="payoff-commitment-limit"><span>Limite de compromissos mensais</span><div><em>R$</em><input type="text" inputmode="decimal" data-money-input data-payoff-commitment-limit value="' + escapeHtml(formatCurrencyInput(commitmentLimit)) + '"></div></label></div>' +
      '<div class="payoff-forecast-summary">' +
        '<div><span>Próxima vaga no orçamento</span><strong>' + escapeHtml(firstVacancy) + '</strong>' + (first ? `<small>${escapeHtml(brl(first.released))}/mês livres</small>` : '') + '</div>' +
        '<div><span>Última quitação prevista</span><strong>' + escapeHtml(ending) + '</strong></div>' +
      '</div>' +
    '</div>' +
    (chart || '<div class="payoff-forecast-empty">Não foi possível estimar os meses de encerramento com as parcelas atuais.</div>') +
    noDateNote;

  bindMoneyInputs(container);
  bindPayoffCommitmentLimit(container, commitmentLimit);
  if (chart) bindPayoffForecastEvents(container, allRoute, forecast, car, timeline, commitmentLimit);
}

function payoffCommitmentLimit(initialCommitment) {
  const configured = mainState.data?.debtCommitmentLimit;
  const value = Number(configured);
  return configured !== null && configured !== '' && Number.isFinite(value) && value >= 0
    ? value
    : initialCommitment;
}

function payoffCarForecast() {
  const car = mainState.data?.car || {};
  const payments = Array.isArray(car.payments) ? car.payments : [];
  const openPayments = payments.filter(payment => payment.status !== 'Pago');
  const lastOpen = [...openPayments].sort((a, b) => carPaymentMonth(a).localeCompare(carPaymentMonth(b))).at(-1);
  return {
    name: car.name || 'Financiamento do carro',
    payments,
    endMonth: lastOpen ? carPaymentMonth(lastOpen) : ''
  };
}

function carPaymentMonth(payment) {
  return String(payment?.month || payment?.dueDate || '').slice(0, 7);
}

function carCommitmentForMonth(car, month) {
  return car.payments
    .filter(payment => carPaymentMonth(payment) === month)
    .reduce((sum, payment) => sum + Number(payment.value || 0), 0);
}

function payoffMonthTotals(route, car, month) {
  const debtTotal = route
    .filter(debt => debt.status === 'Ativa')
    .reduce((total, debt) => total + (state.installmentsByDebt.get(debt.id) || [])
      .filter(installment => String(installment.dueDate || '').startsWith(month))
      .reduce((sum, installment) => sum + Number(installment.expectedValue || 0), 0), 0);
  const carTotal = carCommitmentForMonth(car, month);
  return { debtTotal, carTotal, total: debtTotal + carTotal };
}

function buildPayoffTimeline(route, forecast, car) {
  const startMonth = forecast.startMonth;
  const eventMonths = [...new Set([
    ...forecast.events.map(event => event.month),
    car.endMonth
  ].filter(month => month && month >= startMonth))].sort();
  const months = [startMonth, ...eventMonths.filter(month => month !== startMonth)];
  let previous = payoffMonthTotals(route, car, startMonth).total;
  const points = months.map((month, index) => {
    const nextTotal = payoffMonthTotals(route, car, addMonthsToMonth(month)).total;
    const commitment = index === 0 ? previous : nextTotal;
    const point = {
      month,
      commitment,
      nextTotal,
      released: index ? Math.max(0, previous - commitment) : 0,
      releaseMonth: index ? addMonthsToMonth(month) : month
    };
    previous = commitment;
    return point;
  });
  return { startMonth, initialCommitment: points[0]?.commitment || 0, points };
}

function bindPayoffCommitmentLimit(container, currentLimit) {
  const input = container.querySelector('[data-payoff-commitment-limit]');
  if (!input) return;
  input.addEventListener('change', async () => {
    const value = parseCurrencyInput(input.value);
    if (!Number.isFinite(value) || value < 0) {
      input.value = formatCurrencyInput(currentLimit);
      return;
    }
    mainState.data.debtCommitmentLimit = value;
    input.value = formatCurrencyInput(value);
    if (mainState.saveStateFn) await mainState.saveStateFn('Limite de compromissos atualizado.');
  });
}

function payoffForecastChart(timeline, commitmentLimit) {
  const W = 960;
  const H = 264;
  const LEFT = 58;
  const RIGHT = 18;
  const TOP = 20;
  const BOTTOM = 42;
  const chartW = W - LEFT - RIGHT;
  const chartH = H - TOP - BOTTOM;
  const points = timeline.points;
  const events = points.slice(1);
  const chartMonths = points.map(point => point.month);
  const monthIndex = new Map(chartMonths.map((month, index) => [month, index]));
  const xPos = month => chartMonths.length === 1
    ? LEFT + chartW / 2
    : LEFT + (monthIndex.get(month) / (chartMonths.length - 1)) * chartW;
  const yMax = payoffChartMax(points.map(point => point.commitment));
  const yPos = value => TOP + (1 - value / yMax) * chartH;
  const zeroY = yPos(0);
  const initialY = yPos(points[0].commitment);
  let previousMonth = points[0].month;
  let previousCommitment = points[0].commitment;
  let line = `M${xPos(previousMonth).toFixed(1)},${yPos(previousCommitment).toFixed(1)}`;
  let blueArea = `M${xPos(previousMonth).toFixed(1)},${zeroY.toFixed(1)} L${xPos(previousMonth).toFixed(1)},${yPos(previousCommitment).toFixed(1)}`;
  const releasedAreas = [];

  events.forEach((event, index) => {
    const x = xPos(event.month);
    const nextCommitment = event.commitment;
    const afterY = yPos(nextCommitment);
    line += ` H${x.toFixed(1)} V${afterY.toFixed(1)}`;
    blueArea += ` H${x.toFixed(1)} V${afterY.toFixed(1)}`;
    const nextEvent = events[index + 1];
    const segmentEnd = xPos(nextEvent?.month || event.month);
    releasedAreas.push(`<rect class="payoff-released-area" x="${x.toFixed(1)}" y="${initialY.toFixed(1)}" width="${Math.max(0, segmentEnd - x).toFixed(1)}" height="${Math.max(0, afterY - initialY).toFixed(1)}"/>`);
    previousMonth = event.month;
    previousCommitment = nextCommitment;
  });
  const endX = xPos(points.at(-1).month);
  line += ` H${endX.toFixed(1)}`;
  blueArea += ` H${endX.toFixed(1)} L${endX.toFixed(1)},${zeroY.toFixed(1)} Z`;

  const ticks = [0, yMax / 2, yMax];
  const grid = ticks.map(value => {
    const y = yPos(value);
    return `<line class="payoff-chart-grid" x1="${LEFT}" y1="${y.toFixed(1)}" x2="${W - RIGHT}" y2="${y.toFixed(1)}"/><text class="payoff-chart-y-label" x="${LEFT - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end">${escapeHtml(compactCurrency(value))}</text>`;
  }).join('');
  const startMarker = `<circle class="payoff-chart-event" cx="${xPos(timeline.startMonth).toFixed(1)}" cy="${initialY.toFixed(1)}" r="6" tabindex="0" data-payoff-event-month="${escapeHtml(timeline.startMonth)}" data-payoff-event-x="${(xPos(timeline.startMonth) / W * 100).toFixed(2)}" data-payoff-event-y="${(initialY / H * 100).toFixed(2)}" aria-label="Ver compromissos previstos em ${escapeHtml(formatMonthYear(timeline.startMonth))}"/>`;
  const markers = startMarker + events
    .filter(event => event.month !== timeline.startMonth)
    .map(event => {
      const x = xPos(event.month);
      const y = yPos(event.commitment);
      return `<circle class="payoff-chart-event" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" tabindex="0" data-payoff-event-month="${escapeHtml(event.month)}" data-payoff-event-x="${(x / W * 100).toFixed(2)}" data-payoff-event-y="${(y / H * 100).toFixed(2)}" aria-label="Ver compromissos previstos em ${escapeHtml(formatMonthYear(event.month))}"/>`;
    }).join('');
  let previousYear = timeline.startMonth.slice(0, 4);
  const yearGuides = events.map(event => {
    const year = event.month.slice(0, 4);
    if (year === previousYear) return '';
    previousYear = year;
    const x = xPos(event.month);
    return `<line class="payoff-chart-year-guide" x1="${x.toFixed(1)}" y1="${TOP}" x2="${x.toFixed(1)}" y2="${zeroY.toFixed(1)}"/>`;
  }).join('');
  const chartMarkers = points.map(point => {
      const available = Math.max(0, commitmentLimit - point.nextTotal);
      const pointY = yPos(point.commitment);
      const pointX = xPos(point.month);
      const isLeftEdge = pointX < LEFT + 55;
      const isRightEdge = pointX > W - RIGHT - 55;
      const labelX = isLeftEdge ? pointX + 10 : isRightEdge ? pointX - 10 : pointX;
      const anchor = isLeftEdge ? 'start' : isRightEdge ? 'end' : 'middle';
      const labelY = Math.min(pointY + 22, H - 29);
      return `<text class="payoff-chart-free-label" x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}">↗ ${escapeHtml(brl(available))}</text><text class="payoff-chart-x-label" x="${pointX.toFixed(1)}" y="${H - 10}" text-anchor="middle">${escapeHtml(formatMonthYear(point.month))}</text>`;
    })
    .join('');

  return `<div class="payoff-chart-wrap"><div class="payoff-chart-legend"><span><i class="payoff-chart-swatch remaining"></i>Compromisso que permanece</span><span><i class="payoff-chart-swatch released"></i>Espaço liberado</span><span class="payoff-chart-capacity-legend">↗ Folga no próximo mês</span></div><div class="payoff-chart-area"><svg class="payoff-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Compromissos mensais restantes e capacidade liberada pelas quitações">${grid}${yearGuides}<path class="payoff-chart-blue-area" d="${blueArea}"/><g>${releasedAreas.join('')}</g><path class="payoff-chart-line" d="${line}"/>${markers}${chartMarkers}</svg><div class="payoff-chart-tooltip" id="payoffChartTooltip" hidden></div></div><p class="payoff-chart-hint">Passe o mouse ou use Tab nas bolinhas para ver as dívidas previstas naquele mês.</p></div>`;
}

function payoffChartMax(values) {
  const maximum = Math.max(1, ...values);
  if (maximum <= 10000) return Math.ceil(maximum / 1000) * 1000;
  if (maximum <= 30000) return Math.ceil(maximum / 5000) * 5000;
  return Math.ceil(maximum / 10000) * 10000;
}

function bindPayoffForecastEvents(container, route, forecast, car, timeline, commitmentLimit) {
  const tooltip = container.querySelector('#payoffChartTooltip');
  if (!tooltip) return;
  const show = circle => {
    const month = circle.dataset.payoffEventMonth;
    const event = forecast.events.find(item => item.month === month) || { debts: [] };
    tooltip.innerHTML = payoffEventTooltip(route, car, month, event, month === timeline.startMonth, commitmentLimit);
    tooltip.style.left = `${circle.dataset.payoffEventX}%`;
    tooltip.style.top = `${circle.dataset.payoffEventY}%`;
    tooltip.classList.toggle('is-right', Number(circle.dataset.payoffEventX) > 64);
    tooltip.hidden = false;

    const area = tooltip.closest('.payoff-chart-area');
    const pointY = area.clientHeight * Number(circle.dataset.payoffEventY) / 100;
    const gap = 12;
    const spaceBelow = area.clientHeight - pointY - gap;
    tooltip.classList.toggle('is-above', tooltip.offsetHeight > spaceBelow);
  };
  const hide = () => { tooltip.hidden = true; };
  container.querySelectorAll('[data-payoff-event-month]').forEach(circle => {
    circle.addEventListener('mouseenter', () => show(circle));
    circle.addEventListener('mouseleave', hide);
    circle.addEventListener('focus', () => show(circle));
    circle.addEventListener('blur', hide);
  });
}

function payoffEventTooltip(route, car, month, event, includePaid = false, commitmentLimit = 0) {
  const endingDebtIds = new Set(event.debts.map(item => item.debt.id));
  const sortRows = (a, b) => Number(b.ending) - Number(a.ending) || b.value - a.value;
  const buildRows = predicate => {
    const monthlyRows = route
      .filter(debt => debt.status === 'Ativa')
      .map(debt => {
        const installments = (state.installmentsByDebt.get(debt.id) || [])
          .filter(installment => String(installment.dueDate || '').startsWith(month))
          .filter(predicate);
        const value = installments.reduce((sum, installment) => sum + Number(installment.expectedValue || 0), 0);
        return installments.length ? { debt, value, ending: endingDebtIds.has(debt.id) } : null;
      })
      .filter(Boolean);
    return [
      ...monthlyRows.filter(item => !item.debt.isConsignado).sort(sortRows),
      ...monthlyRows.filter(item => !!item.debt.isConsignado).sort(sortRows)
    ];
  };
  const pendingDebts = buildRows(isDebtInstallmentOpen);
  const paidDebts = includePaid
    ? buildRows(installment => installment.status === 'Paga' || installment.status === 'Quitada')
    : [];
  const pendingTotal = pendingDebts.reduce((sum, item) => sum + item.value, 0);
  const paidTotal = paidDebts.reduce((sum, item) => sum + item.value, 0);
  const debtTotal = pendingTotal + paidTotal;
  const carTotal = carCommitmentForMonth(car, month);
  const total = debtTotal + carTotal;
  const rows = (items, paid = false) => items.map(item => {
    const notes = [
      item.ending && !paid ? 'Encerra neste mês' : '',
      item.debt.isConsignado ? 'Consignado em folha' : ''
    ].filter(Boolean);
    return '<div class="payoff-tooltip-row' + (item.ending && !paid ? ' is-ending' : '') + (paid ? ' is-paid' : '') + '">' +
      '<span>' + escapeHtml(getCreditorName(item.debt.creditorId) + ' · ' + item.debt.name) + (notes.length ? '<small>' + escapeHtml(notes.join(' · ')) + '</small>' : '') + '</span>' +
      '<strong>' + escapeHtml(brl(item.value)) + '</strong>' +
    '</div>';
  }).join('');
  const nextMonth = addMonthsToMonth(month);
  const nextTotals = payoffMonthTotals(route, car, nextMonth);
  const available = Math.max(0, commitmentLimit - nextTotals.total);
  return '<div class="payoff-tooltip-head"><strong>Parcelas de ' + escapeHtml(formatMonthYear(month)) + '</strong><span>' + escapeHtml(brl(debtTotal)) + '</span></div>' +
    (carTotal ? '<div class="payoff-tooltip-commitment"><span>Financiamento do carro</span><strong>' + escapeHtml(brl(carTotal)) + '</strong></div>' : '') +
    '<div class="payoff-tooltip-commitment is-total"><span>Total de compromissos</span><strong>' + escapeHtml(brl(total)) + '</strong></div>' +
    (includePaid ? '<div class="payoff-tooltip-total"><span>Pendente</span><strong>' + escapeHtml(brl(pendingTotal)) + '</strong></div>' : '') +
    '<div class="payoff-tooltip-list">' + rows(pendingDebts) + '</div>' +
    (paidDebts.length
      ? '<div class="payoff-tooltip-paid-head"><span>Parcelas pagas</span><strong>' + escapeHtml(brl(paidTotal)) + '</strong></div><div class="payoff-tooltip-list is-paid">' + rows(paidDebts, true) + '</div>'
      : '') +
    '<div class="payoff-tooltip-after"><span>Total previsto em ' + escapeHtml(formatMonthYear(nextMonth)) + '</span><strong>' + escapeHtml(brl(nextTotals.total)) + '/mês</strong><span>Espaço livre no mês seguinte</span><strong>' + escapeHtml(brl(available)) + '/mês</strong></div>';
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
