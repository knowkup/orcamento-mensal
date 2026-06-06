import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInss, calculateIrrf, calculateNetClt, DEFAULT_TAXES } from '../js/domain/taxes.js';

test('INSS applies progressive brackets', () => {
  assert.equal(calculateInss(1000), 75);
  assert.equal(calculateInss(2000), 155.69);
});

test('INSS is capped at the final configured bracket', () => {
  assert.equal(calculateInss(10000), calculateInss(8475.55));
});

test('IRRF respects exemption and partial reduction', () => {
  assert.equal(calculateIrrf(5000, calculateInss(5000)), 0);
  const partial = calculateIrrf(6000, calculateInss(6000));
  const fullFormula = Math.max(0, (6000 - calculateInss(6000)) * 0.275 - 908.73);
  assert.ok(partial > 0);
  assert.ok(partial < fullFormula);
});

test('net CLT subtracts taxes, food and payroll loan', () => {
  const gross = 6000;
  const consignado = 300;
  const net = calculateNetClt(gross, consignado, 1, DEFAULT_TAXES);
  const expected = gross
    - calculateInss(gross)
    - calculateIrrf(gross, calculateInss(gross))
    - Math.round(gross * 0.01)
    - consignado;
  assert.equal(net, Math.round(expected * 100) / 100);
});

test('custom tax tables are supported', () => {
  const taxes = {
    inss: [{ upTo: 10000, rate: 10 }],
    irrf: { exemptionLimit: 99999, partialLimit: 99999, brackets: [] }
  };
  assert.equal(calculateInss(2500, taxes), 250);
  assert.equal(calculateNetClt(2500, 0, 0, taxes), 2250);
});
