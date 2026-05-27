import { state, currency } from "./state.js";
import { parseCurrencyInput, formatCurrencyInput } from "./utils.js";
import { calcInss, calcIrrf } from "./taxes.js";
import { normalizedIncomeChanges } from "./data.js";

let _mode = "ferias";
let _prefilled = false;

function calcFerias(baseSalary, days, consignado) {
  const prop = Math.round(baseSalary / 30 * days * 100) / 100;
  const bonus = Math.round(prop / 3 * 100) / 100;
  const gross = Math.round((prop + bonus) * 100) / 100;
  const inss = calcInss(gross);
  const irrf = calcIrrf(gross, inss);
  const consignadoDiscount = consignado > 0 ? Math.round(consignado / 30 * days * 100) / 100 : 0;
  const totalDeductions = Math.round((inss + irrf + consignadoDiscount) * 100) / 100;
  const net = Math.round((gross - totalDeductions) * 100) / 100;
  return { prop, bonus, gross, inss, irrf, consignadoDiscount, totalDeductions, net };
}

function calcSalario(baseSalary, days, alimentacaoPercent, consignado) {
  const prop = Math.round(baseSalary / 30 * days * 100) / 100;
  const inss = calcInss(prop);
  const irrf = calcIrrf(prop, inss);
  const alimentacao = Math.round(prop * (alimentacaoPercent / 100) * 100) / 100;
  const consignadoDiscount = consignado > 0 ? Math.round(consignado / 30 * days * 100) / 100 : 0;
  const totalDeductions = Math.round((inss + irrf + alimentacao + consignadoDiscount) * 100) / 100;
  const net = Math.round((prop - totalDeductions) * 100) / 100;
  return { prop, inss, irrf, alimentacao, alimentacaoPercent, consignadoDiscount, totalDeductions, net };
}

export function renderFerias() {
  if (!_prefilled) _prefillFromClt();
  _recalc();
}

function _prefillFromClt() {
  const cltIncomes = (state.data?.recurringIncomes || []).filter((inc) => inc.isClt);
  if (!cltIncomes.length) return;
  const best = cltIncomes.reduce((top, inc) => {
    const amount = normalizedIncomeChanges(inc).at(-1)?.amount || 0;
    const topAmount = normalizedIncomeChanges(top).at(-1)?.amount || 0;
    return amount > topAmount ? inc : top;
  });
  const baseSalaryEl = document.querySelector("#feriasBaseSalary");
  const consignadoEl = document.querySelector("#feriasConsignado");
  const alimentacaoEl = document.querySelector("#feriasAlimentacao");
  const grossAmount = normalizedIncomeChanges(best).at(-1)?.amount || 0;
  if (baseSalaryEl && grossAmount) baseSalaryEl.value = formatCurrencyInput(grossAmount);
  if (consignadoEl && best.clt?.consignado) consignadoEl.value = formatCurrencyInput(best.clt.consignado);
  if (alimentacaoEl && best.clt?.alimentacao != null) alimentacaoEl.value = best.clt.alimentacao;
  _prefilled = true;
}

export function bindFeriasEvents() {
  document.querySelector("#feriasBaseSalary")?.addEventListener("input", _recalc);
  document.querySelector("#feriasDays")?.addEventListener("input", _recalc);
  document.querySelector("#feriasConsignado")?.addEventListener("input", _recalc);
  document.querySelector("#feriasAlimentacao")?.addEventListener("input", _recalc);
  document.querySelector("#feriaModeFerias")?.addEventListener("click", () => _setMode("ferias"));
  document.querySelector("#feriaModeSalario")?.addEventListener("click", () => _setMode("salario"));
}

function _setMode(mode) {
  _mode = mode;
  const daysEl = document.querySelector("#feriasDays");
  const alimentacaoRow = document.querySelector("#feriasAlimentacaoRow");

  document.querySelector("#feriaModeFerias")?.classList.toggle("active", mode === "ferias");
  document.querySelector("#feriaModeSalario")?.classList.toggle("active", mode === "salario");

  if (mode === "salario") {
    if (!daysEl?.value) daysEl.value = "30";
    if (alimentacaoRow) alimentacaoRow.hidden = false;
  } else {
    if (alimentacaoRow) alimentacaoRow.hidden = true;
  }

  _recalc();
}

function _recalc() {
  const baseSalaryEl = document.querySelector("#feriasBaseSalary");
  const daysEl = document.querySelector("#feriasDays");
  const consignadoEl = document.querySelector("#feriasConsignado");
  const alimentacaoEl = document.querySelector("#feriasAlimentacao");
  const resultEl = document.querySelector("#feriasResult");
  const resultPanel = document.querySelector("#feriasResultPanel");
  if (!baseSalaryEl || !daysEl || !resultEl) return;

  const baseSalary = parseCurrencyInput(baseSalaryEl.value);
  const days = parseInt(daysEl.value || "0", 10);
  const consignado = parseCurrencyInput(consignadoEl?.value || "");

  if (!baseSalary || !days) {
    if (resultPanel) resultPanel.hidden = true;
    return;
  }

  if (resultPanel) resultPanel.hidden = false;
  const fmt = (v) => currency.format(v);

  if (_mode === "salario") {
    const alimentacaoPercent = parseFloat(alimentacaoEl?.value ?? "1") || 1;
    resultEl.innerHTML = _payslipSalario(calcSalario(baseSalary, days, alimentacaoPercent, consignado), baseSalary, days, fmt);
  } else {
    resultEl.innerHTML = _payslipFerias(calcFerias(baseSalary, days, consignado), baseSalary, days, fmt);
  }
}

function _payslipFerias(r, baseSalary, days, fmt) {
  return `
    <div class="payslip">
      <div class="payslip-header">
        <div>
          <strong>Demonstrativo de Férias</strong>
          <span>${days} dias &middot; Salário bruto ${fmt(baseSalary)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">Créditos</p>
        <div class="payslip-row">
          <span>Salário proporcional (${days}/30)</span>
          <span class="payslip-pos">${fmt(r.prop)}</span>
        </div>
        <div class="payslip-row">
          <span>Abono constitucional (⅓)</span>
          <span class="payslip-pos">${fmt(r.bonus)}</span>
        </div>
        <div class="payslip-row payslip-subtotal">
          <span>Bruto total</span>
          <span>${fmt(r.gross)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">Débitos</p>
        <div class="payslip-row">
          <span>INSS (tabela progressiva 2026)</span>
          <span class="payslip-neg">&minus;${fmt(r.inss)}</span>
        </div>
        <div class="payslip-row">
          <span>IRRF</span>
          ${r.irrf > 0 ? `<span class="payslip-neg">&minus;${fmt(r.irrf)}</span>` : `<span class="muted-cell">Isento</span>`}
        </div>
        ${r.consignadoDiscount > 0 ? `
        <div class="payslip-row">
          <span>Empréstimo consignado (${days} dias)</span>
          <span class="payslip-neg">&minus;${fmt(r.consignadoDiscount)}</span>
        </div>` : ""}
        <div class="payslip-row payslip-subtotal">
          <span>Total descontos</span>
          <span class="payslip-neg">&minus;${fmt(r.totalDeductions)}</span>
        </div>
      </div>
      <div class="payslip-net">
        <span>Valor líquido</span>
        <strong>${fmt(r.net)}</strong>
      </div>
    </div>
  `;
}

function _payslipSalario(r, baseSalary, days, fmt) {
  return `
    <div class="payslip">
      <div class="payslip-header">
        <div>
          <strong>Demonstrativo de Salário</strong>
          <span>${days} dias &middot; Salário bruto ${fmt(baseSalary)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">Créditos</p>
        <div class="payslip-row">
          <span>Salário proporcional (${days}/30)</span>
          <span class="payslip-pos">${fmt(r.prop)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">Débitos</p>
        <div class="payslip-row">
          <span>INSS (tabela progressiva 2026)</span>
          <span class="payslip-neg">&minus;${fmt(r.inss)}</span>
        </div>
        <div class="payslip-row">
          <span>IRRF</span>
          ${r.irrf > 0 ? `<span class="payslip-neg">&minus;${fmt(r.irrf)}</span>` : `<span class="muted-cell">Isento</span>`}
        </div>
        <div class="payslip-row">
          <span>Desconto alimentação (${r.alimentacaoPercent}%)</span>
          <span class="payslip-neg">&minus;${fmt(r.alimentacao)}</span>
        </div>
        ${r.consignadoDiscount > 0 ? `
        <div class="payslip-row">
          <span>Empréstimo consignado (${days} dias)</span>
          <span class="payslip-neg">&minus;${fmt(r.consignadoDiscount)}</span>
        </div>` : ""}
        <div class="payslip-row payslip-subtotal">
          <span>Total descontos</span>
          <span class="payslip-neg">&minus;${fmt(r.totalDeductions)}</span>
        </div>
      </div>
      <div class="payslip-net">
        <span>Valor líquido</span>
        <strong>${fmt(r.net)}</strong>
      </div>
    </div>
  `;
}
