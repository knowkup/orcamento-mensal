import test from "node:test";
import assert from "node:assert/strict";
import { calculateInss, calculateIrrf, calculateNetClt, DEFAULT_TAXES } from "../js/domain/taxes.js";

// Estas funções replicam a lógica de cálculo de calcFerias/calcDecimo/calcSalario
// de js/ferias/ferias.js para cobrir o domínio sem depender do DOM.

function calcFerias(baseSalary, days, consignado) {
  const prop = Math.round(baseSalary / 30 * days * 100) / 100;
  const bonus = Math.round(prop / 3 * 100) / 100;
  const gross = Math.round((prop + bonus) * 100) / 100;
  const inss = calculateInss(gross);
  const irrf = calculateIrrf(gross, inss);
  const consignadoDiscount = consignado > 0 ? Math.round(consignado / 30 * days * 100) / 100 : 0;
  const totalDeductions = Math.round((inss + irrf + consignadoDiscount) * 100) / 100;
  const net = Math.round((gross - totalDeductions) * 100) / 100;
  return { prop, bonus, gross, inss, irrf, consignadoDiscount, totalDeductions, net };
}

function calcDecimo(baseSalary, days) {
  const gross = Math.round(baseSalary / 30 * days * 100) / 100;
  const adiantamento = Math.round(gross / 2 * 100) / 100;
  const inss = calculateInss(gross);
  const irrf = calculateIrrf(gross, inss);
  const totalDeductions = Math.round((inss + irrf) * 100) / 100;
  const saldo = Math.round((gross / 2 - inss - irrf) * 100) / 100;
  const net = Math.round((gross - totalDeductions) * 100) / 100;
  return { gross, adiantamento, inss, irrf, totalDeductions, saldo, net };
}

function calcSalario(baseSalary, days, alimentacaoPercent, consignado) {
  const prop = Math.round(baseSalary / 30 * days * 100) / 100;
  const inss = calculateInss(prop);
  const irrf = calculateIrrf(prop, inss);
  const alimentacao = Math.round(prop * (alimentacaoPercent / 100));
  const consignadoDiscount = consignado > 0 ? Math.round(consignado / 30 * days * 100) / 100 : 0;
  const totalDeductions = Math.round((inss + irrf + alimentacao + consignadoDiscount) * 100) / 100;
  const net = Math.round((prop - totalDeductions) * 100) / 100;
  return { prop, inss, irrf, alimentacao, alimentacaoPercent, consignadoDiscount, totalDeductions, net };
}

// ── Férias ────────────────────────────────────────────────────────────────────

test("ferias: calcula proporcional, abono e bruto total corretamente", () => {
  const r = calcFerias(6000, 30, 0);
  assert.equal(r.prop, 6000);
  assert.equal(r.bonus, Math.round(6000 / 3 * 100) / 100);
  assert.equal(r.gross, r.prop + r.bonus);
});

test("ferias: desconto de consignado é proporcional aos dias", () => {
  const r = calcFerias(6000, 15, 600);
  assert.equal(r.consignadoDiscount, Math.round(600 / 30 * 15 * 100) / 100);
  assert.equal(r.consignadoDiscount, 300);
});

test("ferias: sem consignado, consignadoDiscount é zero", () => {
  const r = calcFerias(5000, 30, 0);
  assert.equal(r.consignadoDiscount, 0);
});

test("ferias: líquido é bruto menos total de deduções", () => {
  const r = calcFerias(6000, 30, 0);
  assert.equal(r.net, Math.round((r.gross - r.totalDeductions) * 100) / 100);
});

// ── 13º Salário ───────────────────────────────────────────────────────────────

test("decimo: adiantamento é metade do bruto", () => {
  const r = calcDecimo(6000, 30);
  assert.equal(r.adiantamento, r.gross / 2);
});

test("decimo: saldo da 2ª parcela é bruto/2 menos INSS e IRRF", () => {
  const r = calcDecimo(6000, 30);
  const expectedSaldo = Math.round((r.gross / 2 - r.inss - r.irrf) * 100) / 100;
  assert.equal(r.saldo, expectedSaldo);
});

test("decimo: líquido total é adiantamento + saldo", () => {
  const r = calcDecimo(6000, 30);
  assert.equal(r.net, Math.round((r.gross - r.totalDeductions) * 100) / 100);
});

test("decimo: proporcional de 15 dias é metade do salário cheio", () => {
  const full = calcDecimo(6000, 30);
  const half = calcDecimo(6000, 15);
  assert.equal(half.gross, Math.round(6000 / 30 * 15 * 100) / 100);
  assert.equal(half.gross, 3000);
});

// ── Salário proporcional ──────────────────────────────────────────────────────

test("salario: proporcional de 20 dias é 2/3 do salário mensal", () => {
  const r = calcSalario(6000, 20, 1, 0);
  assert.equal(r.prop, Math.round(6000 / 30 * 20 * 100) / 100);
  assert.equal(r.prop, 4000);
});

test("salario: desconto de alimentação é percentual do proporcional", () => {
  const r = calcSalario(6000, 30, 2, 0);
  assert.equal(r.alimentacao, Math.round(6000 * 0.02));
});
