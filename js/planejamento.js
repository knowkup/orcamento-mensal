import { state, el, currency } from "./state.js";
import { nextMonths, formatMonth, formatMonthLong, compactCurrency, escapeHtml, icon, syncProjectionTopScroll, isOccurrencePaid, isIncomeReceived, installmentDueDate, monthDayDate, addMonthsToDate } from "./utils.js";
import { getCreditorName, getInstallmentCard, ownerRank } from "./creditors.js";
import { metric, groupRow, totalRow, isPlannedIncome, isManualPlannedRow } from "./components.js";
import { ensureCarPayments } from "./carro.js";
import { openPlannedDialog, deleteManualPlanned, rowOutstanding, rowIncomeOutstanding, firstDueDate, compareRowsByDueDate } from "./controle.js";
import { normalizedIncomeChanges } from "./data.js";

export function renderProjection() {
  const months = nextMonths(12);
  const rows = buildProjectionRows(months, true);
  const totals = buildTotals(rows, months);
  const current = totals[0];

  el.monthSummary.innerHTML = [
    metric("Entradas", current.income, "positive"),
    metric("Saídas", -current.expense, "negative"),
    metric("Resultado do mês", current.balance, current.balance >= 0 ? "positive" : "negative"),
    metric("Saldo acumulado", current.accumulated, current.accumulated >= 0 ? "positive" : "negative")
  ].join("");
  renderPlanningChart(totals, months);

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
  requestAnimationFrame(syncProjectionTopScroll);
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
  const maxValue = Math.max(
    1,
    ...totals.flatMap((item) => [Math.abs(item.income), Math.abs(item.expense), Math.abs(item.balance)])
  );
  const points = totals.map((item, index) => {
    const x = 42 + index * 76;
    const y = 166 - ((item.balance + maxValue) / (maxValue * 2)) * 132;
    return { x, y, value: item.balance };
  });
  el.planningChart.innerHTML = `
    <div class="chart-legend">
      <span><i class="legend-dot income"></i>Entradas</span>
      <span><i class="legend-dot expense"></i>Saídas</span>
      <span><i class="legend-dot balance"></i>Saldo</span>
    </div>
    <div class="bar-chart-wrap">
      <svg class="balance-line" viewBox="0 0 900 190" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>
        ${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"></circle>`).join("")}
      </svg>
      <div class="bar-chart">
      ${totals.map((item, index) => {
        const incomeHeight = Math.max(4, (item.income / maxValue) * 150);
        const expenseHeight = Math.max(4, (item.expense / maxValue) * 150);
        return `
          <div class="bar-month">
            <div class="bar-stack" title="${formatMonth(months[index])}">
              <span class="bar-value income-value">${compactCurrency(item.income)}</span>
              <span class="bar income" style="height:${incomeHeight}px"></span>
              <span class="bar expense" style="height:${expenseHeight}px"></span>
              <span class="bar-value expense-value">-${compactCurrency(item.expense)}</span>
              <span class="line-value ${item.balance < 0 ? "negative" : "positive"}">${compactCurrency(item.balance)}</span>
            </div>
            <strong>${formatMonth(months[index])}</strong>
          </div>
        `;
      }).join("")}
      </div>
    </div>
  `;
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
    values[month] = current ? Number(current.amount || 0) : 0;
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
