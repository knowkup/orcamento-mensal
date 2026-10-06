import { openDebtInstallments } from './debts.js';

function isMonthKey(value) {
  return /^\d{4}-\d{2}$/.test(String(value || ''));
}

export function addMonthsToMonth(month, amount = 1) {
  if (!isMonthKey(month)) return '';
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthAfterDueDate(dueDate) {
  return addMonthsToMonth(String(dueDate || '').slice(0, 7));
}

function installmentValueForForecast(debt, installments) {
  const configuredValue = Number(debt?.installmentValue || 0);
  if (configuredValue > 0) return configuredValue;
  const nextInstallment = [...installments]
    .filter(installment => String(installment.dueDate || '').length >= 7)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))[0];
  return Number(nextInstallment?.expectedValue || 0);
}

/**
 * Creates the step forecast used by the debt payoff chart.
 * Each point represents the month of the final pending installment. The
 * resulting budget capacity becomes available in the following month.
 */
export function buildDebtPayoffForecast({ debts = [], installmentsByDebt = new Map(), fromMonth }) {
  const startMonth = isMonthKey(fromMonth) ? fromMonth : new Date().toISOString().slice(0, 7);
  const eventsByMonth = new Map();
  const withoutForecast = [];
  let initialCommitment = 0;

  debts
    .filter(debt => debt?.status === 'Ativa' && !debt?.isConsignado)
    .forEach(debt => {
      const openInstallments = openDebtInstallments(installmentsByDebt.get(debt.id) || []);
      const datedInstallments = openInstallments
        .filter(installment => String(installment.dueDate || '').length >= 7)
        .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
      const monthlyValue = installmentValueForForecast(debt, datedInstallments);
      const lastInstallment = datedInstallments.at(-1);
      const dueMonth = String(lastInstallment?.dueDate || '').slice(0, 7);
      const releaseMonth = monthAfterDueDate(lastInstallment?.dueDate);

      if (!lastInstallment || !monthlyValue || !dueMonth || !releaseMonth || dueMonth < startMonth) {
        withoutForecast.push(debt);
        return;
      }

      initialCommitment += monthlyValue;
      const event = eventsByMonth.get(dueMonth) || { month: dueMonth, releaseMonth, released: 0, debts: [] };
      event.released += monthlyValue;
      event.debts.push({ debt, monthlyValue, lastDueDate: lastInstallment.dueDate });
      eventsByMonth.set(dueMonth, event);
    });

  const events = [...eventsByMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  let remaining = initialCommitment;
  const steps = [{ month: startMonth, commitment: remaining, released: 0, debts: [] }];
  events.forEach(event => {
    remaining = Math.max(0, remaining - event.released);
    steps.push({ ...event, commitment: remaining });
  });

  return {
    startMonth,
    initialCommitment,
    events,
    steps,
    withoutForecast,
    endMonth: events.length ? events.at(-1).month : startMonth
  };
}
