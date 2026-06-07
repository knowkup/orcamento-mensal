export function valuesFromMonthlyMap(map, months) {
  return Object.fromEntries(months.map((month) => {
    const monthNumber = Number(month.slice(5, 7));
    return [month, map?.[month] ?? map?.[`month-${monthNumber}`] ?? map?.default ?? 0];
  }));
}

import { addMonthsToIsoDate } from "./value-utils.js";

export function plannedInstallmentMonths(item) {
  const total = Math.max(1, Number(item.installments || 1));
  const startDate = item.date || `${item.month}-01`;
  return Array.from({ length: total }, (_, index) => addMonthsToIsoDate(startDate, index).slice(0, 7));
}

export function buildProjectionTotals(rows, months, initialBalance = 0, valueReaders = {}) {
  const incomeValue = valueReaders.incomeValue || ((row, month) => row.values?.[month]);
  const expenseValue = valueReaders.expenseValue || ((row, month) => row.values?.[month]);
  let accumulated = Number(initialBalance || 0);
  return months.map((month) => {
    const income = rows
      .filter((row) => row.kind === "income")
      .reduce((total, row) => total + Number(incomeValue(row, month) || 0), 0);
    const expense = rows
      .filter((row) => row.kind === "expense")
      .reduce((total, row) => total + Number(expenseValue(row, month) || 0), 0);
    const balance = income - expense;
    accumulated += balance;
    return { month, income, expense, balance, accumulated };
  });
}
