import { state, el, currency } from "./state.js";
import { parseCurrencyInput, formatCurrencyInput, nextMonths, escapeHtml, formatMonth, addMonthsToDate, icon, refreshIcons } from "./utils.js";
import { calcInss, calcIrrf } from "./taxes.js";
import { normalizedIncomeChanges } from "./data.js";
import { openPlannedDialog } from "./controle.js";
import { upsertIncomeChange, latestIncomeChange } from "./planejamento.js";

let _mode = "ferias";
let _prefilled = false;
let _lastCalc = null; // stores last calculated result for scheduling

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

function calcDecimo(baseSalary, days) {
  const gross = Math.round(baseSalary / 30 * days * 100) / 100;
  const adiantamento = Math.round(gross / 2 * 100) / 100;
  const inss = calcInss(gross);
  const irrf = calcIrrf(gross, inss);
  const totalDeductions = Math.round((inss + irrf) * 100) / 100;
  const saldo = Math.round((gross / 2 - inss - irrf) * 100) / 100;
  const net = Math.round((gross - totalDeductions) * 100) / 100;
  return { gross, adiantamento, inss, irrf, totalDeductions, saldo, net };
}

function calcSalario(baseSalary, days, alimentacaoPercent, consignado) {
  const prop = Math.round(baseSalary / 30 * days * 100) / 100;
  const inss = calcInss(prop);
  const irrf = calcIrrf(prop, inss);
  const alimentacao = Math.round(prop * (alimentacaoPercent / 100));
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
  document.querySelector("#feriasModeDecimo")?.addEventListener("click", () => _setMode("decimo"));

  // Init schedule month to next month
  const scheduleMonthEl = document.querySelector("#feriasScheduleMonth");
  if (scheduleMonthEl && !scheduleMonthEl.value) {
    scheduleMonthEl.value = nextMonths(1)[0];
  }

  document.querySelector("#feriasScheduleButton")?.addEventListener("click", () => {
    if (!_lastCalc) return;
    const month = document.querySelector("#feriasScheduleMonth")?.value || nextMonths(1)[0];
    const modeLabels = { ferias: "Férias", decimo: "13º Salário", salario: "Salário" };
    const label = modeLabels[_lastCalc.mode] || "Simulador";
    openPlannedDialog(null, "income");
    // openPlannedDialog resets and shows the dialog; now pre-fill with our values
    if (el.plannedForm) {
      el.plannedForm.elements.description.value = label;
      el.plannedForm.elements.date.value = `${month}-01`;
      el.plannedForm.elements.amount.value = formatCurrencyInput(_lastCalc.net);
      if (el.plannedForm.elements.fonte) {
        el.plannedForm.elements.fonte.value = "Simulador CLT";
      }
    }
  });
}

function _setMode(mode) {
  _mode = mode;
  const daysEl = document.querySelector("#feriasDays");
  const alimentacaoRow = document.querySelector("#feriasAlimentacaoRow");
  const consignadoRow = document.querySelector("#feriasConsignadoRow");

  document.querySelector("#feriaModeFerias")?.classList.toggle("active", mode === "ferias");
  document.querySelector("#feriaModeSalario")?.classList.toggle("active", mode === "salario");
  document.querySelector("#feriasModeDecimo")?.classList.toggle("active", mode === "decimo");

  if (alimentacaoRow) alimentacaoRow.hidden = mode !== "salario";
  if (consignadoRow) consignadoRow.hidden = mode === "decimo";
  if ((mode === "salario" || mode === "decimo") && !daysEl?.value) daysEl.value = "30";

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
    const r = calcSalario(baseSalary, days, alimentacaoPercent, consignado);
    resultEl.innerHTML = _payslipSalario(r, baseSalary, days, fmt);
    _lastCalc = { mode: "salario", net: r.net, baseSalary, days };
  } else if (_mode === "decimo") {
    const r = calcDecimo(baseSalary, days);
    resultEl.innerHTML = _payslipDecimo(r, baseSalary, days, fmt);
    _lastCalc = { mode: "decimo", net: r.net, adiantamento: r.adiantamento, baseSalary, days };
  } else {
    const r = calcFerias(baseSalary, days, consignado);
    resultEl.innerHTML = _payslipFerias(r, baseSalary, days, fmt);
    _lastCalc = { mode: "ferias", net: r.net, baseSalary, days };
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

function _payslipDecimo(r, baseSalary, days, fmt) {
  return `
    <div class="payslip">
      <div class="payslip-header">
        <div>
          <strong>Demonstrativo do 13º Salário</strong>
          <span>${days} dias &middot; Salário bruto ${fmt(baseSalary)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">1ª Parcela &mdash; Adiantamento</p>
        <div class="payslip-row">
          <span>50% do bruto (sem descontos)</span>
          <span class="payslip-pos">${fmt(r.adiantamento)}</span>
        </div>
      </div>
      <div class="payslip-section">
        <p class="payslip-section-title">2ª Parcela &mdash; Saldo</p>
        <div class="payslip-row">
          <span>50% do bruto</span>
          <span class="payslip-pos">${fmt(r.adiantamento)}</span>
        </div>
        <div class="payslip-row">
          <span>INSS (tabela progressiva 2026)</span>
          <span class="payslip-neg">&minus;${fmt(r.inss)}</span>
        </div>
        <div class="payslip-row">
          <span>IRRF</span>
          ${r.irrf > 0 ? `<span class="payslip-neg">&minus;${fmt(r.irrf)}</span>` : `<span class="muted-cell">Isento</span>`}
        </div>
        <div class="payslip-row payslip-subtotal">
          <span>Líquido da 2ª parcela</span>
          <span>${fmt(r.saldo)}</span>
        </div>
      </div>
      <div class="payslip-net">
        <span>Total líquido (1ª + 2ª parcela)</span>
        <strong>${fmt(r.net)}</strong>
      </div>
    </div>
  `;
}

// ── Modal de Gestão de Férias ─────────────────────────────────────────────────

let _feriasIncomeId = null;

function _currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Abre o modal de férias para uma renda CLT específica.
 */
export function openFeriasDialog(incomeId) {
  _feriasIncomeId = incomeId;
  applyFeriasAutoCleanup();
  _renderFeriasDialog("list");
  document.querySelector("#feriasDialog")?.showModal();
  refreshIcons();
}

export function closeFeriasDialog() {
  document.querySelector("#feriasDialog")?.close();
  _feriasIncomeId = null;
}

/**
 * Renderiza o conteúdo do modal de férias (estado lista ou estado registrar).
 */
function _renderFeriasDialog(view) {
  const inner = document.querySelector("#feriasDialogInner");
  if (!inner) return;
  const income = state.data.recurringIncomes?.find((i) => i.id === _feriasIncomeId);
  if (!view || view === "list") inner.innerHTML = _feriasListHtml(income);
  else inner.innerHTML = _feriasFormHtml(income);
  _bindFeriasDialogEvents(view);
  refreshIcons();
}

function _feriasListHtml(income) {
  const vacations = (state.data.vacations || []).filter((v) => v.incomeId === _feriasIncomeId);
  const cur = _currentMonth();
  const fmt = (v) => currency.format(v);

  const listHtml = vacations.length === 0
    ? `<div class="fd-empty">Nenhuma férias cadastrada</div>`
    : vacations.map((v) => {
        const pastVacation = v.vacationMonth < cur;
        const pastSalary = v.salaryMonth < cur;
        const ended = pastVacation && pastSalary;
        const badge = ended
          ? `<span class="ferias-badge badge-passed">Encerrada</span>`
          : `<span class="ferias-badge badge-upcoming">Próxima</span>`;
        const editBtn = !ended
          ? `<button class="fd-act-btn" type="button" data-ferias-edit="${escapeHtml(v.id)}" title="Editar">${icon("pencil")}</button>`
          : "";
        const vacLancTag = pastVacation
          ? `<span class="lanc-tag">Removido automaticamente</span>`
          : `<span class="lanc-tag">Nova renda</span>`;
        const salLancTag = pastSalary
          ? `<span class="lanc-tag">Removido automaticamente</span>`
          : `<span class="lanc-tag">Exceção</span>`;
        return `
          <div class="ferias-item${ended ? " ferias-item-ended" : ""}">
            <div class="ferias-item-head">
              ${badge}
              <span class="ferias-item-title">${escapeHtml(_formatDate(v.startDate))}</span>
              <span class="ferias-item-days">${v.days} dias</span>
              ${editBtn}
              <button class="fd-act-btn danger" type="button" data-ferias-delete="${escapeHtml(v.id)}" title="Excluir">${icon("trash-2")}</button>
            </div>
            <div class="ferias-item-body">
              <div class="ferias-lancamento">
                <span class="lanc-label">Pagamento de férias</span>
                <span class="lanc-mes">${formatMonth(v.vacationMonth)}</span>
                <span class="lanc-valor gold">${fmt(v.vacationNet)}</span>
                ${vacLancTag}
              </div>
              <div class="ferias-lancamento">
                <span class="lanc-label">Salário proporcional</span>
                <span class="lanc-mes">${formatMonth(v.salaryMonth)} · ${30 - v.days} dias</span>
                <span class="lanc-valor green">${fmt(v.salaryNet)}</span>
                ${salLancTag}
              </div>
            </div>
          </div>
        `;
      }).join("");

  return `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">${escapeHtml(income?.label || "CLT")}</p>
        <h2>Férias</h2>
      </div>
      <button class="icon-button" type="button" id="closeFeriasButton" title="Fechar">${icon("x")}</button>
    </div>
    <div class="stack-form">
      <div class="ferias-list">${listHtml}</div>
      <p class="fd-auto-hint">
        ${icon("info")} Lançamentos são removidos automaticamente após o mês passar
      </p>
      <button class="secondary-button full" type="button" id="feriasNovaBtn">
        ${icon("plus")} Registrar novas férias
      </button>
    </div>
  `;
}

function _feriasFormHtml(income) {
  return `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">${escapeHtml(income?.label || "CLT")}</p>
        <h2>Registrar férias</h2>
      </div>
      <button class="icon-button" type="button" id="closeFeriasButton" title="Fechar">${icon("x")}</button>
    </div>
    <div class="stack-form">
      <div class="form-row">
        <label>Início das férias<input type="date" id="feriasStartDate" required></label>
        <label>Dias de férias<input type="number" id="feriasDaysModal" min="1" max="30" placeholder="Ex: 16"></label>
      </div>
      <div id="feriasPreviewCards" hidden></div>
      <button class="primary-button full" type="button" id="feriasConfirmBtn" disabled>
        ${icon("save")} Confirmar e lançar
      </button>
      <button class="secondary-button full" type="button" id="feriasVoltarBtn">
        ${icon("arrow-left")} Voltar
      </button>
    </div>
  `;
}

function _bindFeriasDialogEvents(view) {
  document.querySelector("#closeFeriasButton")?.addEventListener("click", closeFeriasDialog);
  if (view === "list") {
    document.querySelector("#feriasNovaBtn")?.addEventListener("click", () => {
      _renderFeriasDialog("form");
    });
    document.querySelectorAll("[data-ferias-delete]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.feriasDelete;
        if (confirm("Excluir este registro de férias?")) deleteFeriasEntry(id);
      });
    });
    document.querySelectorAll("[data-ferias-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        _feriasEditId = btn.dataset.feriasEdit;
        _renderFeriasDialog("form");
      });
    });
  } else {
    // Preenche campos se for edição
    if (_feriasEditId) {
      const v = (state.data.vacations || []).find((x) => x.id === _feriasEditId);
      if (v) {
        const sd = document.querySelector("#feriasStartDate");
        const dd = document.querySelector("#feriasDaysModal");
        if (sd) sd.value = v.startDate;
        if (dd) dd.value = v.days;
        _updateFeriasPreview();
      }
    }
    document.querySelector("#feriasStartDate")?.addEventListener("input", _updateFeriasPreview);
    document.querySelector("#feriasDaysModal")?.addEventListener("input", _updateFeriasPreview);
    document.querySelector("#feriasConfirmBtn")?.addEventListener("click", () => saveFeriasEntry());
    document.querySelector("#feriasVoltarBtn")?.addEventListener("click", () => {
      _feriasEditId = null;
      _renderFeriasDialog("list");
    });
  }
}

let _feriasEditId = null;

function _updateFeriasPreview() {
  const income = state.data.recurringIncomes?.find((i) => i.id === _feriasIncomeId);
  if (!income) return;

  const startDate = document.querySelector("#feriasStartDate")?.value || "";
  const days = parseInt(document.querySelector("#feriasDaysModal")?.value || "0", 10);
  const previewEl = document.querySelector("#feriasPreviewCards");
  const confirmBtn = document.querySelector("#feriasConfirmBtn");

  if (!startDate || !days || days < 1 || days > 30) {
    if (previewEl) previewEl.hidden = true;
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  const gross = latestIncomeChange(income)?.amount || 0;
  const consignado = income.clt?.consignado || 0;
  const alimentacao = income.clt?.alimentacao ?? 1;
  const remainDays = 30 - days;

  const rv = calcFerias(gross, days, consignado);
  const rs = calcSalario(gross, remainDays, alimentacao, consignado);

  const vacMonth = startDate.slice(0, 7);
  const salMonth = addMonthsToDate(`${vacMonth}-01`, 1).slice(0, 7);
  const fmt = (v) => currency.format(v);

  if (previewEl) {
    previewEl.hidden = false;
    previewEl.innerHTML = `
      <div class="preview-card card-ferias">
        <div class="card-icon">🏖️</div>
        <div class="card-body">
          <div class="card-title">Pagamento de férias</div>
          <div class="card-sub">${escapeHtml(_formatDate(startDate))} · ${days} dias</div>
          <span class="card-tag tag-nova-renda">Nova renda — ${formatMonth(vacMonth)}</span>
        </div>
        <div class="card-value">${fmt(rv.net)}</div>
      </div>
      <div class="preview-card card-salario">
        <div class="card-icon">📅</div>
        <div class="card-body">
          <div class="card-title">Salário proporcional — ${remainDays} dias</div>
          <div class="card-sub">Período ${formatMonth(vacMonth)}</div>
          <span class="card-tag tag-excecao">Exceção — ${formatMonth(salMonth)}</span>
        </div>
        <div class="card-value">${fmt(rs.net)}</div>
      </div>
    `;
  }
  if (confirmBtn) {
    confirmBtn.disabled = false;
    confirmBtn._vacData = { startDate, days, vacMonth, salMonth, vacationNet: rv.net, salaryNet: rs.net };
  }
}

export async function saveFeriasEntry() {
  const confirmBtn = document.querySelector("#feriasConfirmBtn");
  const vacData = confirmBtn?._vacData;
  if (!vacData) return;

  const income = state.data.recurringIncomes?.find((i) => i.id === _feriasIncomeId);
  if (!income) return;

  // Se for edição, remove a entrada anterior primeiro
  if (_feriasEditId) {
    _removeFeriasLancamentos(_feriasEditId);
    state.data.vacations = (state.data.vacations || []).filter((v) => v.id !== _feriasEditId);
    _feriasEditId = null;
  }

  // Cria entrada de renda avulsa para o mês das férias
  if (!state.data.incomeLines) state.data.incomeLines = [];
  const incomeLineId = crypto.randomUUID();
  state.data.incomeLines.push({
    id: incomeLineId,
    label: `Férias — ${income.label}`,
    origin: income.origin || income.label,
    creditorId: "",
    owner: income.owner || "Felipe",
    date: vacData.startDate,
    values: { [vacData.vacMonth]: vacData.vacationNet }
  });

  // --- Salário proporcional ---
  // NÃO armazenar como income.changes pois recurringIncomeValues re-aplica calcNetClt (que usa
  // consignado cheio), resultando em valor errado/negativo. Em vez disso:
  // 1. Cria incomeLine separada com o líquido proporcional correto
  // 2. Exceção 0 no income.changes para suprimir o salário regular naquele mês
  // 3. Revert no mês seguinte para restaurar salário normal

  // Cria incomeLine com o líquido proporcional
  const salaryIncomeLineId = crypto.randomUUID();
  state.data.incomeLines.push({
    id: salaryIncomeLineId,
    label: `Salário proporcional — ${income.label}`,
    origin: income.origin || income.label,
    creditorId: "",
    owner: income.owner || "Felipe",
    date: `${vacData.salMonth}-05`,
    values: { [vacData.salMonth]: vacData.salaryNet }
  });

  // Pega salário bruto normal ANTES de criar exceção (para o revert)
  const priorChanges = normalizedIncomeChanges(income);
  const priorChange = [...priorChanges].reverse().find((c) => c.month < vacData.salMonth);
  const normalAmount = priorChange?.amount || 0;

  // Exceção 0: suprime o salário recorrente para não duplicar (a incomeLine já mostra o proporcional)
  income.changes = upsertIncomeChange(income.changes || [], vacData.salMonth, 0);
  // Revert: restaura salário normal no mês seguinte ao proporcional
  const revertMonth = addMonthsToDate(`${vacData.salMonth}-01`, 1).slice(0, 7);
  if (normalAmount > 0 && !income.changes.find((c) => c.month === revertMonth)) {
    income.changes = upsertIncomeChange(income.changes, revertMonth, normalAmount);
  }

  // Registra na lista de férias
  if (!state.data.vacations) state.data.vacations = [];
  state.data.vacations.push({
    id: crypto.randomUUID(),
    incomeId: _feriasIncomeId,
    startDate: vacData.startDate,
    days: vacData.days,
    vacationNet: vacData.vacationNet,
    salaryNet: vacData.salaryNet,
    vacationMonth: vacData.vacMonth,
    salaryMonth: vacData.salMonth,
    incomeLineId,
    salaryIncomeLineId
  });

  _renderFeriasDialog("list");
  if (state.saveStateFn) await state.saveStateFn("Férias registradas.");
}

function _removeFeriasLancamentos(vacId) {
  const v = (state.data.vacations || []).find((x) => x.id === vacId);
  if (!v) return;
  // Remove renda de férias (incomeLine)
  if (v.incomeLineId) {
    state.data.incomeLines = (state.data.incomeLines || []).filter((l) => l.id !== v.incomeLineId);
  }
  // Remove salário proporcional (incomeLine)
  if (v.salaryIncomeLineId) {
    state.data.incomeLines = (state.data.incomeLines || []).filter((l) => l.id !== v.salaryIncomeLineId);
  }
  // Remove exceção 0 do salário recorrente (e o revert do mês seguinte)
  const income = state.data.recurringIncomes?.find((i) => i.id === v.incomeId);
  if (income) {
    const revertMonth = addMonthsToDate(`${v.salaryMonth}-01`, 1).slice(0, 7);
    income.changes = (income.changes || []).filter(
      (c) => c.month !== v.salaryMonth && c.month !== revertMonth
    );
  }
}

export async function deleteFeriasEntry(id) {
  _removeFeriasLancamentos(id);
  state.data.vacations = (state.data.vacations || []).filter((v) => v.id !== id);
  _renderFeriasDialog("list");
  if (state.saveStateFn) await state.saveStateFn("Férias excluídas.");
}

/**
 * Remove lançamentos de férias cujos meses já passaram.
 * Chamado automaticamente ao abrir o modal.
 */
export function applyFeriasAutoCleanup() {
  const cur = _currentMonth();
  if (!state.data.vacations) return;

  state.data.vacations = state.data.vacations.filter((v) => {
    const pastVacation = v.vacationMonth < cur;
    const pastSalary = v.salaryMonth < cur;

    // Remove renda de férias quando o mês das férias passou
    if (pastVacation && v.incomeLineId) {
      state.data.incomeLines = (state.data.incomeLines || []).filter((l) => l.id !== v.incomeLineId);
      v.incomeLineId = null;
    }
    // Remove salário proporcional + exceção 0 quando o mês do salário passou
    if (pastSalary) {
      if (v.salaryIncomeLineId) {
        state.data.incomeLines = (state.data.incomeLines || []).filter((l) => l.id !== v.salaryIncomeLineId);
        v.salaryIncomeLineId = null;
      }
      const income = state.data.recurringIncomes?.find((i) => i.id === v.incomeId);
      if (income) {
        // Remove tanto a exceção 0 quanto o revert do mês seguinte
        const revertMonth = addMonthsToDate(`${v.salaryMonth}-01`, 1).slice(0, 7);
        income.changes = (income.changes || []).filter(
          (c) => c.month !== v.salaryMonth && c.month !== revertMonth
        );
      }
    }
    // Remover da lista quando ambos os meses passaram
    return !(pastVacation && pastSalary);
  });
}

function _formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

// ── Modal de 13º Salário ──────────────────────────────────────────────────────

let _decimoIncomeId = null;

export function openDecimoTerceiroDialog(incomeId) {
  _decimoIncomeId = incomeId;
  _renderDecimoDialog();
  document.querySelector("#decimoTerceiroDialog")?.showModal();
  refreshIcons();
}

export function closeDecimoTerceiroDialog() {
  document.querySelector("#decimoTerceiroDialog")?.close();
  _decimoIncomeId = null;
}

function _renderDecimoDialog() {
  const inner = document.querySelector("#decimoTerceiroDialogInner");
  if (!inner) return;
  const income = state.data.recurringIncomes?.find((i) => i.id === _decimoIncomeId);
  if (!income) { inner.innerHTML = ""; return; }

  const gross = latestIncomeChange(income)?.amount || 0;
  const year = new Date().getFullYear();
  const fmt = (v) => currency.format(v);

  // Cálculos do 13º (30 dias = base completa)
  const r = calcDecimo(gross, 30);

  inner.innerHTML = `
    <div class="panel-heading">
      <div>
        <p class="eyebrow">${escapeHtml(income.label)}</p>
        <h2>13º Salário</h2>
      </div>
      <button class="icon-button" type="button" id="closeDecimoButton" title="Fechar">${icon("x")}</button>
    </div>
    <div class="stack-form">
      <div class="payslip">
        <div class="payslip-header">
          <div>
            <strong>Demonstrativo do 13º Salário</strong>
            <span>Salário bruto ${fmt(gross)}</span>
          </div>
        </div>
        <div class="payslip-section">
          <p class="payslip-section-title">1ª Parcela — Adiantamento · 20/nov/${year}</p>
          <div class="payslip-row">
            <span>50% do bruto (sem descontos)</span>
            <span class="payslip-pos">${fmt(r.adiantamento)}</span>
          </div>
        </div>
        <div class="payslip-section">
          <p class="payslip-section-title">2ª Parcela — Saldo · 20/dez/${year}</p>
          <div class="payslip-row">
            <span>50% do bruto</span>
            <span class="payslip-pos">${fmt(r.adiantamento)}</span>
          </div>
          <div class="payslip-row">
            <span>INSS</span>
            <span class="payslip-neg">&minus;${fmt(r.inss)}</span>
          </div>
          <div class="payslip-row">
            <span>IRRF</span>
            ${r.irrf > 0 ? `<span class="payslip-neg">&minus;${fmt(r.irrf)}</span>` : `<span class="muted-cell">Isento</span>`}
          </div>
          <div class="payslip-row payslip-subtotal">
            <span>Líquido da 2ª parcela</span>
            <span>${fmt(r.saldo)}</span>
          </div>
        </div>
        <div class="payslip-net">
          <span>Total líquido (1ª + 2ª parcela)</span>
          <strong>${fmt(r.net)}</strong>
        </div>
      </div>
      <button class="primary-button full" type="button" id="decimoLancarBtn">
        ${icon("save")} Lançar 1ª e 2ª parcela
      </button>
    </div>
  `;

  document.querySelector("#closeDecimoButton")?.addEventListener("click", closeDecimoTerceiroDialog);
  document.querySelector("#decimoLancarBtn")?.addEventListener("click", () => _saveDecimo(income, r, year));
  refreshIcons();
}

async function _saveDecimo(income, r, year) {
  if (!state.data.incomeLines) state.data.incomeLines = [];

  // 1ª parcela: 20 de novembro
  state.data.incomeLines.push({
    id: crypto.randomUUID(),
    label: `13º Salário — 1ª Parcela`,
    origin: income.origin || income.label,
    creditorId: "",
    owner: income.owner || "Felipe",
    date: `${year}-11-20`,
    values: { [`${year}-11`]: r.adiantamento }
  });

  // 2ª parcela: 20 de dezembro
  state.data.incomeLines.push({
    id: crypto.randomUUID(),
    label: `13º Salário — 2ª Parcela`,
    origin: income.origin || income.label,
    creditorId: "",
    owner: income.owner || "Felipe",
    date: `${year}-12-20`,
    values: { [`${year}-12`]: r.saldo }
  });

  closeDecimoTerceiroDialog();
  if (state.saveStateFn) await state.saveStateFn("13º salário lançado.");
}
