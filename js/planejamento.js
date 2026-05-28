import { state, el, currency } from "./state.js";
import { nextMonths, formatMonth, formatMonthLong, escapeHtml, icon, refreshIcons, syncProjectionTopScroll, isOccurrencePaid, isIncomeReceived, installmentDueDate, monthDayDate, addMonthsToDate } from "./utils.js";

let _expandedSummaryMonth = null;
import { calcNetClt } from "./taxes.js";
import { getCreditorName, getInstallmentCard, ownerRank } from "./creditors.js";
import { metric, groupRow, totalRow, isPlannedIncome, isManualPlannedRow } from "./components.js";
import { ensureCarPayments } from "./carro.js";
import { openPlannedDialog, deleteManualPlanned, rowOutstanding, rowIncomeOutstanding, firstDueDate, compareRowsByDueDate } from "./controle.js";
import { normalizedIncomeChanges } from "./data.js";

export function renderProjection() {
  const months = nextMonths(12);
  const rows = buildProjectionRows(months, true);
  const totals = buildTotals(rows, months);

  _renderKpis(totals);
  renderPlanningChart(totals, months);
  _renderEvents(totals, months, rows);
  _renderMonthlySummary(totals, months, rows);
  _renderProjectionTable(rows, months, totals);
  requestAnimationFrame(syncProjectionTopScroll);
}

function _renderKpis(totals) {
  const last = totals[totals.length - 1];
  const minT = totals.reduce((a, b) => (b.accumulated < a.accumulated ? b : a));
  const maxT = totals.reduce((a, b) => (b.accumulated > a.accumulated ? b : a));
  const trendDelta = last.accumulated - totals[0].accumulated;
  const totalIncome = totals.reduce((s, t) => s + t.income, 0);
  const trendRatio = totalIncome > 0 ? trendDelta / totalIncome : 0;
  const trendLabel = trendDelta > 500 ? "Em alta" : trendDelta < -500 ? "Em queda" : "Estável";
  const trendSub = trendDelta > 500 ? "crescimento consistente" : trendDelta < -500 ? "saldo declinando" : "leve variação";
  const trendIcon = trendDelta > 500 ? "↗" : trendDelta < -500 ? "↘" : "→";
  const trendTone = trendDelta >= 0 ? "positive" : "negative";
  const negativeMonths = totals.filter((t) => t.accumulated < 0).length;
  const fmt = (v) => currency.format(v);

  el.monthSummary.innerHTML = `
    <article class="metric ${last.accumulated >= 0 ? "positive" : "negative"}">
      <span>Saldo previsto ao final de ${formatMonthLong(last.month)}</span>
      <strong>${fmt(last.accumulated)}</strong>
      <small>considerando os próximos 12 meses</small>
    </article>
    <article class="metric ${minT.accumulated >= 0 ? "positive" : "negative"}">
      <span>Menor saldo previsto</span>
      <strong>${fmt(minT.accumulated)}</strong>
      <small>${formatMonthLong(minT.month)}</small>
    </article>
    <article class="metric ${maxT.accumulated >= 0 ? "positive" : "negative"}">
      <span>Maior saldo previsto</span>
      <strong>${fmt(maxT.accumulated)}</strong>
      <small>${formatMonthLong(maxT.month)}</small>
    </article>
    <article class="metric ${trendTone}">
      <span>Tendência do período</span>
      <strong class="kpi-trend">${trendIcon} ${trendLabel}</strong>
      <small>${trendSub}</small>
    </article>
    <article class="metric ${negativeMonths === 0 ? "positive" : "negative"}">
      <span>Meses negativos</span>
      <strong>${negativeMonths === 0 ? "0" : String(negativeMonths)}</strong>
      <small>${negativeMonths === 0 ? "ótimo!" : `de ${totals.length} meses`}</small>
    </article>
  `;
}

function _renderEvents(totals, months, rows) {
  const eventsEl = document.querySelector("#projEvents");
  if (!eventsEl) return;

  const events = [];
  const fmt = (v) => currency.format(v);

  const minT = totals.reduce((a, b) => (b.accumulated < a.accumulated ? b : a));
  if (minT.accumulated < 0) {
    events.push({ ic: "alert-triangle", label: "Mês crítico", detail: `${formatMonthLong(minT.month)}: ${fmt(minT.accumulated)}`, cls: "event-danger" });
  } else {
    events.push({ ic: "trending-down", label: "Menor saldo", detail: `${formatMonthLong(minT.month)}: ${fmt(minT.accumulated)}`, cls: "event-neutral" });
  }

  const maxInT = totals.reduce((a, b) => (b.income > a.income ? b : a));
  events.push({ ic: "trending-up", label: "Maior entrada", detail: `${formatMonthLong(maxInT.month)}: +${fmt(maxInT.income)}`, cls: "event-positive" });

  const maxExT = totals.reduce((a, b) => (b.expense > a.expense ? b : a));
  events.push({ ic: "receipt", label: "Maior saída", detail: `${formatMonthLong(maxExT.month)}: -${fmt(maxExT.expense)}`, cls: "event-negative" });

  const today = new Date().toISOString().slice(0, 7); // current month YYYY-MM
  const allPlanned = [...(state.data.incomeLines || []), ...(state.data.plannedPurchases || [])];

  const keywords = [
    { re: /f[eé]rias/i, label: "Férias", ic: "umbrella", nextOnly: true },
    { re: /13|d[eé]cimo/i, label: "13º Salário", ic: "gift", nextOnly: false },
    { re: /ipva/i, label: "IPVA", ic: "car", nextOnly: false },
    { re: /seguro/i, label: "Seguro", ic: "shield", nextOnly: false },
  ];
  keywords.forEach(({ re, label, ic, nextOnly }) => {
    const matches = allPlanned
      .filter((p) => re.test(p.label || p.description || ""))
      .map((p) => ({ p, month: p.date ? String(p.date).slice(0, 7) : p.month || "" }))
      .filter(({ month }) => !nextOnly || month >= today)
      .sort((a, b) => a.month.localeCompare(b.month));
    const found = matches[0];
    if (found) {
      events.push({ ic, label, detail: found.month ? formatMonthLong(found.month) : "previsto", cls: "event-info" });
    }
  });

  eventsEl.innerHTML = `
    <div class="proj-events-strip">
      ${events.map((e) => `
        <div class="proj-event-card ${e.cls}">
          <span class="proj-event-icon">${icon(e.ic)}</span>
          <div>
            <strong>${e.label}</strong>
            <span>${e.detail}</span>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function _renderMonthlySummary(totals, months, rows) {
  const summaryEl = document.querySelector("#projMonthlySummary");
  if (!summaryEl) return;
  const fmt = (v) => currency.format(v);

  const rowsHtml = totals.map((t) => {
    const isExpanded = _expandedSummaryMonth === t.month;
    const negAccum = t.accumulated < 0;
    const negBal = t.balance < 0;

    const incomeRows = rows.filter((r) => r.kind === "income" && (r.values[t.month] || 0) > 0);
    const expenseRows = rows.filter((r) => r.kind === "expense" && (r.values[t.month] || 0) > 0);

    const detailHtml = isExpanded ? `
      <div class="mst-detail">
        ${incomeRows.length ? `
          <div class="mst-detail-group">
            <p class="mst-detail-group-title">Entradas</p>
            ${incomeRows.map((r) => {
              const editBtn = isPlannedIncome(r.id)
                ? `<button class="icon-button mini-icon row-edit" type="button" title="Editar" data-mst-edit-income="${r.id}">${icon("pencil")}</button>`
                : "";
              const delBtn = isManualPlannedRow(r)
                ? `<button class="icon-button mini-icon danger-mini row-edit" type="button" title="Excluir" data-mst-delete-plan="${r.id}">${icon("trash-2")}</button>`
                : "";
              return `
                <div class="mst-detail-row">
                  <span class="mst-detail-row-left">${escapeHtml(r.label)}${editBtn}${delBtn}</span>
                  <span class="positive">+${fmt(r.values[t.month])}</span>
                </div>`;
            }).join("")}
          </div>` : ""}
        ${expenseRows.length ? `
          <div class="mst-detail-group">
            <p class="mst-detail-group-title">Saídas</p>
            ${expenseRows.map((r) => {
              const delBtn = isManualPlannedRow(r)
                ? `<button class="icon-button mini-icon danger-mini row-edit" type="button" title="Excluir" data-mst-delete-plan="${r.id}">${icon("trash-2")}</button>`
                : "";
              return `
                <div class="mst-detail-row">
                  <span class="mst-detail-row-left">${escapeHtml(r.label)}${delBtn}</span>
                  <span class="negative">-${fmt(r.values[t.month])}</span>
                </div>`;
            }).join("")}
          </div>` : ""}
        <div class="mst-detail-footer">
          Saldo acumulado após ${formatMonthLong(t.month)}:
          <strong class="${negAccum ? "negative" : "positive"}">${fmt(t.accumulated)}</strong>
        </div>
      </div>
    ` : "";

    return `
      <div class="mst-row ${isExpanded ? "expanded" : ""} ${negAccum ? "mst-row-neg" : ""}" data-summary-month="${t.month}">
        <div class="mst-row-main">
          <span class="mst-month">${formatMonthLong(t.month)}</span>
          <span class="positive">+${fmt(t.income)}</span>
          <span class="negative">-${fmt(t.expense)}</span>
          <span class="${negBal ? "negative" : "positive"}">${negBal ? "" : "+"}${fmt(t.balance)}</span>
          <span class="${negAccum ? "negative" : "positive"}">${fmt(t.accumulated)}</span>
          <span class="mst-chevron">${icon(isExpanded ? "chevron-up" : "chevron-down")}</span>
        </div>
        ${detailHtml}
      </div>
    `;
  }).join("");

  summaryEl.innerHTML = `
    <div class="mst-table">
      <div class="mst-header">
        <span>Mês</span>
        <span>Entradas</span>
        <span>Saídas</span>
        <span>Resultado</span>
        <span>Saldo acumulado</span>
        <span></span>
      </div>
      ${rowsHtml}
    </div>
  `;
  refreshIcons();

  summaryEl.querySelectorAll("[data-summary-month]").forEach((rowEl) => {
    rowEl.querySelector(".mst-row-main").addEventListener("click", () => {
      const month = rowEl.dataset.summaryMonth;
      _expandedSummaryMonth = _expandedSummaryMonth === month ? null : month;
      _renderMonthlySummary(totals, months, rows);
    });
  });

  summaryEl.querySelectorAll("[data-mst-edit-income]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPlannedDialog(btn.dataset.mstEditIncome, "income");
    });
  });
  summaryEl.querySelectorAll("[data-mst-delete-plan]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteManualPlanned(btn.dataset.mstDeletePlan);
    });
  });
}

function _renderProjectionTable(rows, months, totals) {
  const monthHeaders = months.map((month) => `<th>${formatMonth(month)}</th>`).join("");
  const body = [
    groupRow("Entradas", months.length),
    ...rows.filter((row) => row.kind === "income").map((row) => projectionRow(row, months)),
    totalRow("Total entradas", months, (month) => totals.find((item) => item.month === month).income, "positive"),
    groupRow("Saídas", months.length),
    ...rows.filter((row) => row.kind === "expense").map((row) => projectionRow(row, months)),
    totalRow("Total saídas", months, (month) => -totals.find((item) => item.month === month).expense, "negative"),
    totalRow("Resultado do mês", months, (month) => totals.find((item) => item.month === month).balance, "balance"),
    totalRow("Saldo acumulado", months, (month) => totals.find((item) => item.month === month).accumulated, "balance")
  ].join("");

  el.projectionTable.innerHTML = `
    <thead>
      <tr>
        <th class="sticky-col">Linha</th>
        <th>Origem</th>
        ${monthHeaders}
      </tr>
    </thead>
    <tbody>${body}</tbody>
  `;
  el.projectionTable.querySelectorAll("[data-edit-income-line]").forEach((button) => {
    button.addEventListener("click", () => openPlannedDialog(button.dataset.editIncomeLine, "income"));
  });
  el.projectionTable.querySelectorAll("[data-delete-manual-plan]").forEach((button) => {
    button.addEventListener("click", () => deleteManualPlanned(button.dataset.deleteManualPlan));
  });
}

function projectionRow(row, months) {
  const sectionClass = `${row.kind === "income" ? "income-row" : "expense-row"} ${row.owner === "Kah" ? "owner-kah" : ""}`;
  const editAction = row.kind === "income" && isPlannedIncome(row.id)
    ? `<button class="icon-button mini-icon row-edit" type="button" title="Editar entrada" data-edit-income-line="${row.id}">${icon("pencil")}</button>`
    : "";
  const deleteAction = isManualPlannedRow(row)
    ? `<button class="icon-button mini-icon danger-mini row-edit" type="button" title="Excluir lançamento" data-delete-manual-plan="${row.id}">${icon("trash-2")}</button>`
    : "";
  return `
    <tr class="${sectionClass}">
      <th class="sticky-col">
        <span>${escapeHtml(row.label)}</span>
        ${editAction}
        ${deleteAction}
      </th>
      <td>${escapeHtml(row.origin || "-")}</td>
      ${months.map((month) => projectionCell(row, month)).join("")}
    </tr>
  `;
}

function projectionCell(row, month) {
  const value = row.values[month] || 0;
  const key = `${row.id}:${month}`;
  const done = row.kind === "expense" ? isOccurrencePaid(key) : isIncomeReceived(key);
  const displayValue = row.kind === "expense" ? rowOutstanding(row, month, value) : rowIncomeOutstanding(row, month, value);
  if (!displayValue && !done) return `<td class="muted-cell">-</td>`;
  const sign = row.kind === "income" ? "" : "-";
  const className = row.kind === "income" ? "positive" : "negative";
  const status = done ? `<small class="cell-status">${row.kind === "income" ? "recebido no controle" : "pago no controle"}</small>` : "";
  return `<td><span class="${className}">${sign}${currency.format(displayValue)}</span>${status}</td>`;
}

export function renderPlanningChart(totals, months) {
  const accValues = totals.map((t) => t.accumulated);
  const minVal = Math.min(0, ...accValues);
  const maxVal = Math.max(0, ...accValues);
  const range = Math.max(1, maxVal - minVal);

  // SVG viewport
  const W = 960;
  const SVG_H = 150;
  const PAD_T = 22; const PAD_B = 10;
  const chartH = SVG_H - PAD_T - PAD_B;
  const n = totals.length;

  const xPos = (i) => (i + 0.5) * (W / n);
  const yPos = (v) => PAD_T + (1 - (v - minVal) / range) * chartH;
  const zeroY = yPos(0);

  const pts = totals.map((t, i) => [xPos(i), yPos(t.accumulated)]);
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaD = [
    `M${pts[0][0].toFixed(1)},${zeroY.toFixed(1)}`,
    ...pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`),
    `L${pts[pts.length - 1][0].toFixed(1)},${zeroY.toFixed(1)}Z`
  ].join(" ");

  const hasNeg = minVal < 0;
  const areaClass = hasNeg ? "acc-area-neg" : "acc-area-pos";

  const dotsHtml = totals.map((t, i) => {
    const x = xPos(i).toFixed(1);
    const y = yPos(t.accumulated).toFixed(1);
    const activeClass = _expandedSummaryMonth === t.month ? " acc-dot-active" : "";
    const posClass = t.accumulated >= 0 ? " acc-dot-pos" : " acc-dot-neg";
    return `<circle class="acc-dot${posClass}${activeClass}" cx="${x}" cy="${y}" r="5.5" data-month="${t.month}"><title>${formatMonthLong(t.month)}: ${currency.format(t.accumulated)}</title></circle>`;
  }).join("");

  // Value labels positioned by percentage (works with preserveAspectRatio="none")
  const valLabels = totals.map((t, i) => {
    const xPct = (xPos(i) / W * 100).toFixed(2);
    const yPct = (yPos(t.accumulated) / SVG_H * 100).toFixed(2);
    const cls = t.accumulated >= 0 ? "acc-val-pos" : "acc-val-neg";
    const active = _expandedSummaryMonth === t.month ? " acc-val-active" : "";
    return `<span class="acc-val-lbl ${cls}${active}" style="left:${xPct}%;top:${yPct}%">${currency.format(t.accumulated)}</span>`;
  }).join("");

  el.planningChart.innerHTML = `
    <div class="acc-chart-wrap">
      <div class="acc-chart-area">
        <svg class="acc-svg" viewBox="0 0 ${W} ${SVG_H}" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" class="acc-zero-line"/>
          <path d="${areaD}" class="acc-area ${areaClass}"/>
          <path d="${lineD}" class="acc-line"/>
          ${dotsHtml}
        </svg>
        ${valLabels}
      </div>
      <div class="acc-months-row">
        ${totals.map((t) => {
          const active = _expandedSummaryMonth === t.month ? " acc-lbl-active" : "";
          const neg = t.accumulated < 0 ? " negative" : "";
          const [y, m] = t.month.split("-").map(Number);
          const mName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(y, m - 1, 1));
          const mLabel = mName.charAt(0).toUpperCase() + mName.slice(1) + "/" + y;
          return `<button class="acc-month-btn${neg}${active}" type="button" data-chart-month="${t.month}" title="${currency.format(t.accumulated)}">${mLabel}</button>`;
        }).join("")}
      </div>
    </div>
    <p class="acc-chart-hint">Clique em um mês no gráfico ou na tabela para ver os detalhes</p>
  `;

  el.planningChart.querySelectorAll("[data-chart-month]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const month = btn.dataset.chartMonth;
      _expandedSummaryMonth = _expandedSummaryMonth === month ? null : month;
      const months12 = nextMonths(12);
      const rows12 = buildProjectionRows(months12, true);
      const totals12 = buildTotals(rows12, months12);
      renderPlanningChart(totals12, months12);
      _renderMonthlySummary(totals12, months12, rows12);
      document.querySelector("#projMonthlySummary")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
}

export function buildProjectionRows(months, keepPaidValues = false) {
  const rows = [];
  state.data.incomeLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "income",
      owner: line.owner || "Felipe",
      creditorId: line.creditorId || "",
      manualType: "planned-income",
      label: line.label,
      origin: line.origin,
      sourceLabel: "",
      values: valuesFromMonthlyMap(line.values, months),
      dueDates: line.date ? { [line.date.slice(0, 7)]: line.date } : {}
    });
  });
  state.data.recurringIncomes.forEach((income) => {
    rows.push({
      id: income.id,
      kind: "income",
      owner: income.owner || "Felipe",
      logoUrl: income.logoUrl || "",
      label: income.label,
      origin: income.origin,
      sourceLabel: "",
      values: recurringIncomeValues(income, months),
      dueDates: Object.fromEntries(months.map((month) => [month, monthDayDate(month, income.receiveDay || 1)]))
    });
  });

  state.data.projectionLines.forEach((line) => {
    rows.push({
      id: line.id,
      kind: "expense",
      owner: line.owner || "Felipe",
      label: line.label,
      origin: line.creditorId ? getCreditorName(line.creditorId) : line.origin,
      sourceLabel: "",
      values: valuesForProjectionLine(line, months, keepPaidValues)
    });
  });

  appendDynamicProjectionRows(rows, months, keepPaidValues);
  appendKahDifferenceRow(rows, months);
  return rows.sort((a, b) => compareRowsByDueDate(a, b, months[0]));
}

export function valuesForProjectionLine(line, months, keepPaidValues = false) {
  const values = {};
  months.forEach((month, index) => {
    let value = 0;
    if (line.source === "installments") value = installmentTotal(line.match, index);
    if (line.source === "fixedByName") value = fixedTotalByName(line.match);
    if (line.source === "fixedByOrigin") value = fixedTotalByOrigin(line.match);
    if (line.source === "planned") value = plannedTotal(line.match, month);
    if (line.source === "manual") value = line.values?.[month] ?? line.monthlyAmount ?? 0;
    if (line.source === "car") value = carValueForMonth(month);
    if (line.source === "difference") value = differenceValue(line, months, month, index);
    if (!keepPaidValues && isOccurrencePaid(`${line.id}:${month}`)) value = 0;
    values[month] = value;
  });
  return values;
}

export function valuesFromMonthlyMap(map, months) {
  const values = {};
  months.forEach((month) => {
    const monthNumber = Number(month.slice(5, 7));
    values[month] = map?.[month] ?? map?.[`month-${monthNumber}`] ?? map?.default ?? 0;
  });
  return values;
}

export function recurringIncomeValues(income, months) {
  const changes = normalizedIncomeChanges(income);
  const values = {};
  months.forEach((month) => {
    const current = [...changes].reverse().find((change) => change.month <= month);
    const gross = current ? Number(current.amount || 0) : 0;
    values[month] = income.isClt && gross > 0
      ? Math.max(0, calcNetClt(gross, income.clt?.consignado || 0, income.clt?.alimentacao ?? 1))
      : gross;
  });
  return values;
}

export function latestIncomeChange(income) {
  return normalizedIncomeChanges(income).at(-1) || { month: "", amount: 0 };
}

export function upsertIncomeChange(changes, month, amount) {
  const next = normalizedIncomeChanges({ changes }).filter((change) => change.month !== month);
  next.push({ month, amount });
  return next.sort((a, b) => a.month.localeCompare(b.month));
}

export function appendDynamicProjectionRows(rows, months, keepPaidValues) {
  ensureCarPayments();
  const strict = months.length > 1;
  const installmentGroups = uniqueGroups(state.data.installments, (item) => groupKey(item));
  installmentGroups.forEach((group) => {
    const installmentValues = {};
    const installmentChildren = {};
    const installmentDueDates = {};
    months.forEach((month, index) => {
      installmentValues[month] = installmentTotalForGroup(group, index, month, strict);
      installmentChildren[month] = installmentChildrenForGroup(group, index, month, strict);
      installmentDueDates[month] = group.cardId ? cardDueDateForMonth(group.cardId, month) : firstDueDate(installmentChildren[month]);
      const key = `auto-installments-${group.id}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) installmentValues[month] = 0;
    });
    if (Object.values(installmentValues).some(Boolean)) {
      rows.push({
        id: `auto-installments-${group.id}`,
        kind: "expense",
        owner: group.owner,
        creditorId: group.creditorId,
        cardId: group.cardId,
        paymentMethod: "Cartão de crédito",
        label: group.name,
        origin: getCreditorName(group.creditorId),
        sourceLabel: "",
        values: installmentValues,
        dueDates: installmentDueDates,
        children: installmentChildren
      });
    }
  });

  uniqueFixedCostGroups().forEach((group) => {
    const fixedValues = {};
    const fixedChildren = {};
    const fixedDueDates = {};
    months.forEach((month) => {
      fixedValues[month] = fixedTotalForGroup(group.key, month);
      fixedChildren[month] = fixedChildrenForGroup(group.key, month);
      fixedDueDates[month] = group.cardId ? cardDueDateForMonth(group.cardId, month) : firstDueDate(fixedChildren[month]);
      const key = `auto-fixed-${group.id}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) fixedValues[month] = 0;
    });
    if (Object.values(fixedValues).some(Boolean)) {
      rows.push({
        id: `auto-fixed-${group.id}`,
        kind: "expense",
        owner: group.owner,
        creditorId: group.creditorId,
        cardId: group.cardId,
        paymentMethod: group.paymentMethod,
        label: group.label,
        origin: group.origin,
        sourceLabel: "",
        values: fixedValues,
        dueDates: fixedDueDates,
        children: fixedChildren
      });
    }
  });

  state.data.plannedPurchases.forEach((item) => {
    const plannedValues = {};
    const plannedDueDates = {};
    months.forEach((month) => {
      plannedValues[month] = plannedValueForMonth(item, month);
      plannedDueDates[month] = plannedDueDateForMonth(item, month);
      const key = `${item.id}:${month}`;
      if (!keepPaidValues && isOccurrencePaid(key)) plannedValues[month] = 0;
    });
    if (Object.values(plannedValues).some(Boolean)) {
      rows.push({
        id: item.id,
        kind: "expense",
        owner: item.owner || "Felipe",
        creditorId: item.creditorId,
        manualType: "planned-expense",
        label: item.description || "Lançamento planejado",
        origin: getCreditorName(item.creditorId),
        sourceLabel: "",
        values: plannedValues,
        dueDates: plannedDueDates
      });
    }
  });

  const carValues = {};
  const carChildren = {};
  const carDueDates = {};
  months.forEach((month) => {
    carValues[month] = carValueForMonth(month);
    carChildren[month] = carChildrenForMonth(month);
    carDueDates[month] = firstDueDate(carChildren[month]);
    const key = `auto-car:${month}`;
    if (!keepPaidValues && isOccurrencePaid(key)) carValues[month] = 0;
  });
  if (Object.values(carValues).some(Boolean)) rows.push({ id: "auto-car", kind: "expense", owner: "Felipe", creditorId: state.data.car.creditorId, label: state.data.car.name || "Carro", origin: state.data.car.creditorId ? getCreditorName(state.data.car.creditorId) : "Financiamento", sourceLabel: "", values: carValues, dueDates: carDueDates, children: carChildren });
}

export function groupKey(item) {
  return getInstallmentCard(item).id;
}

export function uniqueGroups(items, keyGetter) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) {
      const card = getInstallmentCard(item);
      groups.set(key, {
        id: key.replaceAll("|", "-").replaceAll(/\s+/g, "-"),
        cardId: card.real ? card.id : "",
        creditorId: card.creditorId,
        owner: card.owner,
        name: card.name,
        key
      });
    }
  });
  return [...groups.values()];
}

function installmentNumForMonth(item, month, strict) {
  const [py, pm] = (item.purchaseDate || "").split("-").map(Number);
  const [cy, cm] = month.split("-").map(Number);
  if (!py || !pm || !cy || !cm) return null;
  // installment n is due in month where n = elapsed months from purchase
  // (installmentDueDate uses 1-based pm as Date 0-based, so it adds 1 extra month)
  const naturalN = (cy * 12 + cm) - (py * 12 + pm);
  const paid = Number(item.paidInstallments || 0);
  const total = Number(item.totalInstallments || 0);
  if (naturalN < 1 || naturalN > total) return null;
  if (strict) {
    return naturalN > paid ? naturalN : null;
  }
  // Non-strict (Controle Mensal): show first unpaid installment due on or before this month
  const firstUnpaid = paid + 1;
  if (firstUnpaid > total || firstUnpaid > naturalN) return null;
  return firstUnpaid;
}

export function installmentTotalForGroup(group, monthIndex, month = null, strict = true) {
  return state.data.installments
    .filter((item) => groupKey(item) === group.key && item.active !== false)
    .reduce((total, item) => {
      if (month && item.purchaseDate) {
        const n = installmentNumForMonth(item, month, strict);
        return n ? total + Number(item.amount) : total;
      }
      const left = Math.max(0, Number(item.totalInstallments) - Number(item.paidInstallments));
      return monthIndex < left ? total + Number(item.amount) : total;
    }, 0);
}

export function installmentChildrenForGroup(group, monthIndex, month, strict = true) {
  return state.data.installments
    .filter((item) => groupKey(item) === group.key && item.active !== false)
    .flatMap((item) => {
      let number;
      if (item.purchaseDate) {
        number = installmentNumForMonth(item, month, strict);
        if (!number) return [];
      } else {
        number = Number(item.paidInstallments || 0) + monthIndex + 1;
        if (number > Number(item.totalInstallments || 0)) return [];
      }
      return [{
        key: `child-installment|${item.id}|${number}:${month}`,
        label: `${item.item || "Parcelamento"} ${number}/${item.totalInstallments}`,
        value: Number(item.amount || 0),
        dueDate: installmentDueDate(item.purchaseDate || `${month}-01`, number - 1)
      }];
    });
}

export function appendKahDifferenceRow(rows, months) {
  const limit = Number(state.data.kahLimit || 0);
  if (!limit) return;
  const values = {};
  months.forEach((month) => {
    const used = rows
      .filter((row) => row.kind === "expense" && row.owner === "Kah")
      .reduce((total, row) => total + Number(row.values[month] || 0), 0);
    values[month] = Math.max(0, limit - used);
  });
  if (Object.values(values).some(Boolean)) {
    rows.unshift({ id: "kah-difference", kind: "expense", owner: "Kah", label: "Diferença Kah", origin: "Limite Kah", sourceLabel: "", values });
  }
}

export function installmentTotal(origin, monthIndex) {
  return state.data.installments
    .filter((item) => item.creditorId === origin && item.active !== false)
    .reduce((total, item) => {
      const left = Math.max(0, Number(item.totalInstallments) - Number(item.paidInstallments));
      return monthIndex < left ? total + Number(item.amount) : total;
    }, 0);
}

export function fixedTotalByName(name) {
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && item.name === name)
    .reduce((total, item) => total + Number(item.amount), 0);
}

export function fixedTotalByOrigin(origin) {
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && item.creditorId === origin)
    .reduce((total, item) => total + Number(item.amount), 0);
}

export function plannedTotal(origin, month) {
  return state.data.plannedPurchases
    .filter((item) => item.creditorId === origin)
    .reduce((total, item) => total + plannedValueForMonth(item, month), 0);
}

export function carValueForMonth(month) {
  ensureCarPayments();
  return state.data.car.payments
    .filter((item) => carPaymentMonth(item) === month)
    .reduce((total, item) => total + Number(item.value || 0), 0);
}

export function plannedMonth(item) {
  return item.date ? String(item.date).slice(0, 7) : item.month;
}

export function plannedValueForMonth(item, month) {
  const months = plannedInstallmentMonths(item);
  return months.includes(month) ? Number(item.amount || 0) : 0;
}

export function plannedDueDateForMonth(item, month) {
  const index = plannedInstallmentMonths(item).indexOf(month);
  if (index < 0) return "";
  return addMonthsToDate(item.date || `${plannedMonth(item)}-01`, index);
}

export function plannedInstallmentMonths(item) {
  const total = Math.max(1, Number(item.installments || 1));
  const startDate = item.date || `${plannedMonth(item)}-01`;
  return Array.from({ length: total }, (_, index) => addMonthsToDate(startDate, index).slice(0, 7));
}

export function carPaymentMonth(item) {
  return item.dueDate ? String(item.dueDate).slice(0, 7) : item.month;
}

export function cardDueDateForMonth(cardId, month) {
  const card = state.data.creditCards.find((c) => c.id === cardId) || null;
  return monthDayDate(month, card?.dueDay || 1);
}

export function uniqueFixedCostGroups() {
  const groups = new Map();
  state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false)
    .forEach((item) => {
      const key = fixedCostGroupKey(item);
      if (!groups.has(key)) groups.set(key, fixedCostGroupInfo(key, item));
    });
  return [...groups.values()].sort((a, b) => a.origin.localeCompare(b.origin, "pt-BR") || a.label.localeCompare(b.label, "pt-BR"));
}

export function fixedCostGroupKey(item) {
  if (item.paymentMethod === "Cartão de crédito" && item.cardId) return `card|${item.cardId}`;
  return [item.creditorId || "", item.paymentMethod || "", item.owner || "Felipe"].join("|");
}

export function fixedCostGroupInfo(key, item) {
  const card = item.cardId ? (state.data.creditCards.find((c) => c.id === item.cardId) || null) : null;
  const creditorId = card?.creditorId || item.creditorId;
  const owner = card?.owner || item.owner || "Felipe";
  const fixedItems = state.data.fixedCosts.filter((entry) => fixedCostGroupKey(entry) === key);
  const fallbackLabel = fixedItems.length === 1 ? fixedItems[0].name : item.name;
  return {
    key,
    id: key.replaceAll("|", "-").replaceAll(/\s+/g, "-"),
    cardId: card?.id || "",
    creditorId,
    owner,
    paymentMethod: item.paymentMethod || "",
    label: card ? card.name : fallbackLabel || getCreditorName(creditorId),
    origin: card ? getCreditorName(card.creditorId) : getCreditorName(creditorId)
  };
}

export function fixedTotalForGroup(key, month = null) {
  const overrides = state.data.fixedCostAmountOverrides || {};
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && fixedCostGroupKey(item) === key)
    .reduce((total, item) => {
      const ov = month !== null ? overrides[`${item.id}:${month}`] : undefined;
      return total + (ov !== undefined ? ov : Number(item.amount || 0));
    }, 0);
}

export function fixedChildrenForGroup(key, month) {
  const overrides = state.data.fixedCostAmountOverrides || {};
  return state.data.fixedCosts
    .filter((item) => item.includeInProjection !== false && fixedCostGroupKey(item) === key)
    .map((item) => {
      const ov = overrides[`${item.id}:${month}`];
      return {
        key: `child-fixed|${item.id}:${month}`,
        label: item.name || "Custo fixo",
        value: ov !== undefined ? ov : Number(item.amount || 0),
        dueDate: monthDayDate(month, item.dueDay || 1)
      };
    });
}

export function carChildrenForMonth(month) {
  ensureCarPayments();
  return state.data.car.payments
    .filter((item) => carPaymentMonth(item) === month)
    .map((item) => ({
      key: `child-car|${item.id}:${month}`,
      label: `${state.data.car.name || "Carro"} ${item.number || ""}`.trim(),
      value: Number(item.value || 0),
      dueDate: item.dueDate || `${month}-01`
    }));
}

export function differenceValue(line, months, month, index) {
  const limit = Number(line.limit || 0);
  const used = (line.subtractLineIds || []).reduce((total, id) => {
    const sibling = state.data.projectionLines.find((item) => item.id === id);
    return total + (sibling ? valuesForProjectionLine(sibling, months)[month] || 0 : 0);
  }, 0);
  return Math.max(0, limit - used);
}

export function buildTotals(rows, months) {
  let accumulated = Number(state.data.accountBalance || state.data.initialBalance || 0);
  return months.map((month) => {
    const income = rows.filter((row) => row.kind === "income").reduce((total, row) => total + rowIncomeOutstanding(row, month, row.values[month] || 0), 0);
    const expense = rows.filter((row) => row.kind === "expense").reduce((total, row) => total + rowOutstanding(row, month, row.values[month] || 0), 0);
    const balance = income - expense;
    accumulated += balance;
    return { month, income, expense, balance, accumulated };
  });
}
