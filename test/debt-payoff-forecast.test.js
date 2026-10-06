import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonthsToMonth, buildDebtPayoffForecast, monthAfterDueDate } from '../js/domain/debt-payoff-forecast.js';

test('debt payoff forecast marks the final due month and releases capacity in the following month', () => {
  const debt = { id: 'santander', status: 'Ativa', installmentValue: 1687.24 };
  const forecast = buildDebtPayoffForecast({
    debts: [debt],
    installmentsByDebt: new Map([['santander', [
      { dueDate: '2027-03-09', status: 'Paga', expectedValue: 1687.24 },
      { dueDate: '2027-04-09', status: 'Pendente', expectedValue: 1687.24 }
    ]]]),
    fromMonth: '2026-10'
  });

  assert.equal(forecast.initialCommitment, 1687.24);
  assert.deepEqual(forecast.events.map(event => event.month), ['2027-04']);
  assert.equal(forecast.events[0].releaseMonth, '2027-05');
  assert.equal(forecast.events[0].released, 1687.24);
  assert.equal(forecast.steps.at(-1).commitment, 0);
});

test('debt payoff forecast groups debts ending in the same month', () => {
  const debts = [
    { id: 'a', status: 'Ativa', installmentValue: 500 },
    { id: 'b', status: 'Ativa', installmentValue: 250 }
  ];
  const forecast = buildDebtPayoffForecast({
    debts,
    installmentsByDebt: new Map([
      ['a', [{ dueDate: '2027-04-05', status: 'Pendente', expectedValue: 500 }]],
      ['b', [{ dueDate: '2027-04-20', status: 'Pendente', expectedValue: 250 }]]
    ]),
    fromMonth: '2027-01'
  });

  assert.equal(forecast.events.length, 1);
  assert.equal(forecast.events[0].released, 750);
  assert.equal(forecast.events[0].debts.length, 2);
});

test('debt payoff forecast shows consignado endings without adding them to budget capacity', () => {
  const forecast = buildDebtPayoffForecast({
    debts: [
      { id: 'no-date', status: 'Ativa', installmentValue: 300 },
      { id: 'clt', status: 'Ativa', isConsignado: true, installmentValue: 700 }
    ],
    installmentsByDebt: new Map([
      ['no-date', [{ status: 'Pendente', expectedValue: 300 }]],
      ['clt', [{ dueDate: '2027-06-10', status: 'Pendente', expectedValue: 700 }]]
    ]),
    fromMonth: '2027-01'
  });

  assert.equal(forecast.initialCommitment, 0);
  assert.deepEqual(forecast.withoutForecast.map(debt => debt.id), ['no-date']);
  assert.deepEqual(forecast.events.map(event => event.month), ['2027-06']);
  assert.equal(forecast.events[0].released, 0);
  assert.deepEqual(forecast.events[0].debts.map(item => item.debt.id), ['clt']);
});

test('month helpers move into the next calendar month', () => {
  assert.equal(monthAfterDueDate('2027-12-31'), '2028-01');
  assert.equal(addMonthsToMonth('2027-11', 2), '2028-01');
});
