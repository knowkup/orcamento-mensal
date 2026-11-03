import { state, el, currency } from "../state.js";
import { bindMoneyInputs, escapeHtml, formatCurrencyInput, parseCurrencyInput, refreshIcons, showToast } from "../utils.js";
import { applyCashMovement } from "../controle/controle.js";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let recentExpanded = false;
let persistingRollback = false;
let persistingIncomeLink = false;

const isoToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const monthKey = (date = isoToday()) => String(date).slice(0, 7);
const nextMonthKey = (key) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};
const monthName = (key) => { const [year, month] = key.split("-"); return `${MONTHS[Number(month) - 1]} de ${year}`; };
const dateKey = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const money = (value) => currency.format(Number(value) || 0);
const uber = () => state.data.uber;
// O mês da operação pode avançar antes da virada do calendário. Assim, ao
// encerrar outubro, novembro começa limpo e outubro continua no histórico.
const activeMonthKey = () => {
  const today = monthKey(), configured = uber().activeMonth;
  if (configured && configured >= today) return configured;
  return uber().closings?.[today] ? nextMonthKey(today) : today;
};
// A data do campo é sempre a data real: encerrar um mês não pode antecipar o
// calendário do celular. Lançamentos em mês fechado são bloqueados ao salvar.
const entryDateForActiveMonth = () => isoToday();
const entries = (key = activeMonthKey()) => uber().entries.filter((item) => item.date?.startsWith(key));
const energyLabel = () => uber().config.vehicleType === "electric" ? "Recarga" : "Abastecimento";
const energyUnit = () => uber().config.vehicleType === "electric" ? "kWh" : "L";

function linkedUberIncome() {
  const incomes = state.data.recurringIncomes || [];
  const byId = incomes.find((income) => income.id === uber().linkedIncomeId);
  if (byId) return byId;
  const candidates = incomes.filter((income) => /uber/i.test(`${income.label || ""} ${income.origin || ""}`));
  const income = candidates.find((item) => String(item.label || "").trim().toLocaleLowerCase("pt-BR") === "uber") || candidates[0];
  if (income) uber().linkedIncomeId = income.id;
  return income;
}

function syncUberIncomeReceipts(month) {
  const income = linkedUberIncome();
  if (!income) return false;
  const key = `${income.id}:${month}`;
  const manualReceipts = (state.data.receivedPayments?.[key] || []).filter((payment) => payment.source !== "uber-entry");
  const uberReceipts = entries(month).filter((entry) => entry.type === "gain").map((entry) => ({ amount: Number(entry.amount || 0), date: entry.date, source: "uber-entry", entryId: entry.id }));
  const receipts = [...manualReceipts, ...uberReceipts];
  const total = receipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
  state.data.receivedPayments ||= {};
  state.data.receivedAmounts ||= {};
  if (receipts.length) {
    state.data.receivedPayments[key] = receipts;
    state.data.receivedAmounts[key] = total;
  } else {
    delete state.data.receivedPayments[key];
    delete state.data.receivedAmounts[key];
  }
  const expectedChange = [...(income.changes || [])].filter((change) => change.month <= month).sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  const expected = Number(expectedChange?.amount || income.amount || 0);
  const completed = total > 0 && total >= expected - 0.005;
  state.data.receivedOccurrences = completed
    ? [...new Set([...(state.data.receivedOccurrences || []), key])]
    : (state.data.receivedOccurrences || []).filter((item) => item !== key);
  applyCashMovement(key, total);
  return true;
}

function setEntryDateDefault(force = false) {
  const input = document.querySelector("#uberEntryForm [name='date']");
  if (input && (force || input.dataset.userChanged !== "true")) input.value = isoToday();
}

function config() {
  const value = uber().config;
  value.workDays ||= [];
  value.daysOff ||= [];
  value.extraWorkDays ||= [];
  value.autoDaysOff ||= [];
  value.goals ||= [];
  return value;
}

function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

function holidays(year) {
  const goodFriday = easter(year); goodFriday.setDate(goodFriday.getDate() - 2);
  return new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((day) => `${year}-${day}`).concat(dateKey(goodFriday.getFullYear(), goodFriday.getMonth() + 1, goodFriday.getDate())));
}

function baseWorkDay(date) {
  const day = date.getDay(), key = dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return config().workDays.includes(day) && (!holidays(date.getFullYear()).has(key) || config().workHolidays);
}

function workDay(date) {
  const key = dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  if (config().extraWorkDays.includes(key)) return true;
  if (config().daysOff.includes(key) || config().autoDaysOff.includes(key)) return false;
  return baseWorkDay(date);
}

function isSpecialDay(date) {
  return date.getDay() === 0 || date.getDay() === 6 || holidays(date.getFullYear()).has(dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

function syncAutomaticDays() {
  const today = new Date();
  // Não marque dias como folga automática no mês que ainda não começou.
  if (activeMonthKey() !== monthKey()) return false;
  const gains = new Set(entries(activeMonthKey()).filter((item) => item.type === "gain" && Number(item.amount) > 0).map((item) => item.date));
  const automatic = [];
  for (let day = 1; day < today.getDate(); day++) {
    const date = new Date(today.getFullYear(), today.getMonth(), day), key = dateKey(today.getFullYear(), today.getMonth() + 1, day);
    if (baseWorkDay(date) && !config().daysOff.includes(key) && !config().extraWorkDays.includes(key) && !gains.has(key)) automatic.push(key);
  }
  const changed = JSON.stringify(config().autoDaysOff.slice().sort()) !== JSON.stringify(automatic);
  config().autoDaysOff = automatic;
  return changed;
}

export function mountUberViews() {
  if (document.querySelector("#uberinicioView")) return;
  const target = document.querySelector("#ajustesView");
  if (!target) return;
  target.insertAdjacentHTML("beforebegin", `
    <section class="view" id="uberinicioView" data-title="Uber" data-eyebrow="Operação">
      <section class="uber-hero panel" aria-label="Resumo da operação"><article class="uber-hero-projection"><p>Faturamento projetado do mês</p><strong id="uberHeroProjected">${money(0)}</strong><small id="uberHeroProjectionCopy">Comece registrando seus ganhos para gerar projeção.</small></article><article><span>Faturamento realizado</span><strong id="uberHeroRealized">${money(0)}</strong></article><article><span>Resultado previsto após custos</span><strong id="uberHeroOutcome">${money(0)}</strong><small id="uberHeroCostCopy">Considerando custos de ${money(0)}</small></article><article><span>Média atual</span><strong class="uber-hero-average"><small>Seg–Sex</small><b id="uberHeroWeekdayAverage">—</b><small>Dia especial</small><b id="uberHeroSpecialAverage">—</b></strong></article></section>
      <section class="panel"><form id="uberEntryForm" class="uber-entry-form"><div class="panel-heading uber-entry-heading"><div><p class="eyebrow">Lançamento diário</p><h2>Registrar Operação</h2></div></div><div class="uber-type-picker"><button type="button" class="uber-type active" data-uber-type="gain"><i data-lucide="arrow-up-circle"></i> Ganho</button><button type="button" class="uber-type" data-uber-type="fuel"><i data-lucide="fuel"></i> <span class="uber-energy-label">Abastecimento</span></button><button type="button" class="uber-type" data-uber-type="expense"><i data-lucide="receipt"></i> Despesa</button><button type="button" class="uber-type" data-uber-type="km"><i data-lucide="gauge"></i> KM</button></div><input type="hidden" name="type" value="gain"><div class="form-grid uber-form-grid"><label>Data<input type="date" name="date" required></label><label class="uber-value-field">Valor<input data-money-input data-money-prefix="R$" type="text" name="amount" inputmode="numeric" placeholder="R$ 0,00"></label><label class="uber-quantity-field" hidden><span class="uber-quantity-label">Litros abastecidos</span><input type="number" name="quantity" inputmode="decimal" step="0.01" min="0"></label><label class="uber-description-field" hidden>Descrição<select name="description"><option>Manutenção</option><option>Lavagem</option><option>Seguro</option><option>Parcela</option><option>Outros</option></select></label><label class="uber-km-field">KM atual <small>opcional</small><input type="number" name="km" inputmode="numeric" min="0"></label></div><button class="primary-button" type="submit"><i data-lucide="plus"></i> Adicionar lançamento</button></form></section>
      <div class="finance-kpis" id="uberOperationalKpis"></div>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Últimos lançamentos</p><h2>Movimentação recente</h2></div><button class="ghost-button" type="button" data-uber-action="toggle-recent">Ver todos</button></div><div class="uber-list" id="uberRecentEntries"></div></section>
    </section>
    <section class="view" id="uberdashboardView" data-title="Dashboard Uber" data-eyebrow="Operação" data-subtitle="Ritmo, metas e previsão de fechamento do mês."><section class="panel uber-projection" id="uberProjection"></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Ritmo do mês</p><h2>Onde a projeção chega</h2></div></div><div class="uber-rhythm" id="uberRhythm"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Metas do mês</p><h2>Sobrevivência, estabilidade e conforto</h2></div></div><div class="uber-goals" id="uberGoalCards"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Composição das metas</p><h2>O que a operação precisa pagar</h2></div></div><div class="uber-composition" id="uberComposition"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Semanas do mês</p><h2>Leitura semanal dos ganhos</h2></div></div><div class="uber-weeks" id="uberWeeks"></div></section></section>
    <section class="view" id="uberoperacaoView" data-title="Operação do Carro" data-eyebrow="Uber" data-subtitle="Rentabilidade por quilômetro e seus abastecimentos."><div class="finance-kpis" id="uberFuelKpis"></div><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Mês atual</p><h2>Abastecimentos e recargas</h2></div></div><div class="uber-table-wrap"><table class="uber-table"><thead><tr><th>Data</th><th>Quantidade</th><th>Valor</th><th>Preço/unidade</th><th>KM</th></tr></thead><tbody id="uberFuelRows"></tbody></table></div></section></section>
    <section class="view" id="uberhistoricoView" data-title="Histórico Uber" data-eyebrow="Uber"><section class="panel"><div class="panel-heading uber-history-heading"><div><p class="eyebrow">Histórico mensal</p><h2>Evolução da operação</h2><p class="uber-close-status" id="uberCloseStatus"></p></div><button class="primary-button" id="uberCloseMonthButton" type="button" data-uber-action="close-month"><i data-lucide="calendar-check"></i><span>Fechar mês atual</span></button></div><div class="uber-history-summary" id="uberHistorySummary"></div><div class="uber-history uber-history-detailed" id="uberHistoryCards"></div></section></section>
    <section class="view" id="ubersimulacaoView" data-title="Simulação Uber" data-eyebrow="Uber"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Cenário futuro</p><h2>Simular um mês</h2></div></div><form id="uberSimulationForm" class="form-grid uber-simulation-form"><label>Dias de trabalho<input name="days" type="number" min="0" value="0"></label><label>Média diária<input data-money-input name="daily" type="text" inputmode="numeric" placeholder="0,00"></label><label>Custos previstos<input data-money-input name="costs" type="text" inputmode="numeric" placeholder="0,00"></label><button class="primary-button" type="submit">Calcular cenário</button></form><div class="finance-kpis" id="uberSimulationKpis"></div></section></section>
    <section class="view" id="uberconfigView" data-title="Regras da Operação" data-eyebrow="Uber" data-subtitle="Defina sua rotina, veículo e as metas que orientam a operação."><div class="vertical-stack"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Rotina</p><h2>Configurações do mês</h2></div></div><div class="uber-routine"><div class="uber-routine-card"><h3>Rotina de trabalho</h3><p>Escolha seus dias. O calendário considera feriados nacionais e permite exceções.</p><strong id="uberPlannedDays">0 dias planejados</strong><div class="uber-weekdays" id="uberWeekdays"></div><label class="checkbox-field"><input id="uberWorkHolidays" type="checkbox"> Também trabalho nos feriados nacionais</label><div class="uber-calendar-head"><button class="icon-button" type="button" aria-label="Mês anterior" data-uber-action="calendar:-1"><i data-lucide="chevron-left"></i></button><strong id="uberCalendarTitle"></strong><button class="icon-button" type="button" aria-label="Próximo mês" data-uber-action="calendar:1"><i data-lucide="chevron-right"></i></button></div><div class="uber-calendar-weekdays">${WEEKDAYS.map((day) => `<span>${day}</span>`).join("")}</div><div class="uber-calendar" id="uberCalendar"></div><small>Toque em um dia para alternar entre trabalho e folga. Feriados permanecem como folga até você criar uma exceção.</small></div><form id="uberConfigForm" class="form-grid uber-vehicle-form"><label>Tipo de veículo<select name="vehicleType"><option value="combustion">Combustão</option><option value="electric">Elétrico</option></select></label><button class="primary-button" type="submit">Salvar veículo</button></form></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Metas</p><h2>Custos, retirada e conforto</h2></div></div><form id="uberGoalForm" class="form-grid uber-goal-form"><label>Nome do custo<input name="name" maxlength="50" placeholder="Ex.: Seguro"></label><label>Valor mensal<input data-money-input name="amount" inputmode="numeric" placeholder="0,00"></label><button class="secondary-button" type="submit">Adicionar custo</button></form><div class="uber-goal-settings" id="uberGoalSettings"></div><form id="uberTargetsForm" class="form-grid uber-target-form"><label>Retirada desejada<input data-money-input name="withdrawal" inputmode="numeric" placeholder="0,00"></label><label>Adicional de conforto<input data-money-input name="comfort" inputmode="numeric" placeholder="0,00"></label><button class="primary-button" type="submit">Salvar metas</button></form></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Migração</p><h2>Dados do Controle Uber</h2><p>Importe um backup JSON do app original. Nada é apagado durante a importação.</p></div></div><input id="uberImportFile" type="file" accept="application/json,.json" hidden><button class="ghost-button" type="button" data-uber-action="import"><i data-lucide="upload"></i> Importar backup do Controle Uber</button></section></div></section>`);
  el.views = document.querySelectorAll(".view");
  bindMoneyInputs(target.parentElement);
}

export function bindUberEvents(showView) {
  const root = document.querySelector("#uberinicioView");
  if (!root || root.dataset.bound) return;
  root.dataset.bound = "true";
  document.querySelector("#uberEntryForm").addEventListener("submit", saveEntry);
  document.querySelector("#uberEntryForm").elements.date.addEventListener("change", (event) => { event.target.dataset.userChanged = "true"; });
  document.querySelector("#uberConfigForm").addEventListener("submit", saveConfig);
  document.querySelector("#uberGoalForm").addEventListener("submit", addGoal);
  document.querySelector("#uberTargetsForm").addEventListener("submit", saveTargets);
  document.querySelector("#uberSimulationForm").addEventListener("submit", simulate);
  document.querySelector("#uberImportFile").addEventListener("change", importBackup);
  document.querySelector("#uberWorkHolidays").addEventListener("change", async (event) => { config().workHolidays = event.target.checked; syncAutomaticDays(); await save("Rotina de feriados atualizada."); });
  document.addEventListener("click", async (event) => {
    const type = event.target.closest("[data-uber-type]"); if (type) return selectType(type.dataset.uberType);
    const view = event.target.closest("[data-uber-view]"); if (view) return showView(view.dataset.uberView);
    const action = event.target.closest("[data-uber-action]")?.dataset.uberAction;
    if (!action) return;
    if (action === "import") document.querySelector("#uberImportFile").click();
    else if (action === "toggle-recent") { recentExpanded = !recentExpanded; renderUber("uberinicio"); }
    else if (action === "close-month") await closeMonth();
    else if (action.startsWith("delete:")) await deleteEntry(action.slice(7));
    else if (action.startsWith("reopen:")) await reopenMonth(action.slice(7));
    else if (action.startsWith("goal-delete:")) await deleteGoal(action.slice(12));
    else if (action.startsWith("weekday:")) await toggleWeekday(Number(action.slice(8)));
    else if (action.startsWith("calendar:")) { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(action.slice(9)), 1); renderConfig(); }
    else if (action.startsWith("date:")) await toggleDate(action.slice(5));
  });
  selectType("gain");
  setEntryDateDefault(true);
}

function selectType(type) {
  const form = document.querySelector("#uberEntryForm"); if (!form) return;
  form.elements.type.value = type;
  document.querySelectorAll(".uber-type").forEach((item) => item.classList.toggle("active", item.dataset.uberType === type));
  form.querySelector(".uber-value-field").hidden = type === "km";
  form.querySelector(".uber-quantity-field").hidden = type !== "fuel";
  form.querySelector(".uber-description-field").hidden = type !== "expense";
  form.querySelector(".uber-km-field").hidden = type === "expense";
}

function stats(key = activeMonthKey()) {
  const list = entries(key), gains = list.filter((item) => item.type === "gain").reduce((n, item) => n + Number(item.amount || 0), 0);
  const fuel = list.filter((item) => item.type === "fuel"), fuelCost = fuel.reduce((n, item) => n + Number(item.amount || 0), 0);
  const expenses = list.filter((item) => item.type === "expense").reduce((n, item) => n + Number(item.amount || 0), 0);
  const quantities = fuel.reduce((n, item) => n + Number(item.quantity || 0), 0), kms = list.map((item) => Number(item.km || 0)).filter(Boolean);
  const km = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0, days = new Set(list.filter((item) => item.type === "gain").map((item) => item.date)).size;
  return { list, gains, fuelCost, expenses, costs: fuelCost + expenses, quantities, km, days, net: gains - fuelCost - expenses };
}

function plannedDays(key = activeMonthKey()) { const [year, month] = key.split("-").map(Number), last = new Date(year, month, 0).getDate(); let total = 0; for (let day = 1; day <= last; day++) if (workDay(new Date(year, month - 1, day))) total++; return total; }
function pace(key = activeMonthKey()) {
  const byDay = new Map(); entries(key).filter((item) => item.type === "gain").forEach((item) => byDay.set(item.date, (byDay.get(item.date) || 0) + Number(item.amount || 0)));
  let normalTotal = 0, normalDays = 0, specialTotal = 0, specialDays = 0;
  byDay.forEach((value, date) => { if (isSpecialDay(new Date(`${date}T12:00:00`))) { specialTotal += value; specialDays++; } else { normalTotal += value; normalDays++; } });
  const average = byDay.size ? [...byDay.values()].reduce((n, value) => n + value, 0) / byDay.size : 0, normal = normalDays ? normalTotal / normalDays : average, special = specialDays ? specialTotal / specialDays : (normal || average);
  const [year, month] = key.split("-").map(Number), last = new Date(year, month, 0).getDate(); let normalRemaining = 0, specialRemaining = 0;
  const start = key === monthKey() ? new Date().getDate() : key > monthKey() ? 1 : last + 1;
  for (let day = start; day <= last; day++) { const date = new Date(year, month - 1, day), dateIso = dateKey(year, month, day); if (workDay(date) && !byDay.has(dateIso)) isSpecialDay(date) ? specialRemaining++ : normalRemaining++; }
  return { normal, special, normalDays, specialDays, normalRemaining, specialRemaining, projected: stats(key).gains + (normalRemaining * normal) + (specialRemaining * special), average, remaining: normalRemaining + specialRemaining };
}
function goalTotals() { const costs = config().goals.reduce((n, item) => n + Number(item.amount || 0), 0), stable = costs + Number(config().withdrawal || 0); return { survival: costs, stable, comfort: stable + Number(config().comfort || 0) }; }

export function rollbackBudgetIntegration() {
  let changed = false;
  const generated = (state.data.incomeLines || []).filter((item) => item.source === "uber-operation" || item.id === "uber-operacao-ganhos");
  if (generated.length) {
    const generatedIds = new Set(generated.map((item) => item.id));
    state.data.incomeLines = state.data.incomeLines.filter((item) => !generatedIds.has(item.id));
    Object.keys(state.data.receivedPayments || {}).filter((key) => generatedIds.has(key.split(":")[0])).forEach((key) => delete state.data.receivedPayments[key]);
    Object.keys(state.data.receivedAmounts || {}).filter((key) => generatedIds.has(key.split(":")[0])).forEach((key) => delete state.data.receivedAmounts[key]);
    state.data.receivedOccurrences = (state.data.receivedOccurrences || []).filter((key) => !generatedIds.has(key.split(":")[0]));
    changed = true;
  }
  // Repara somente o mês afetado pela integração publicada indevidamente.
  const rollbackMonth = "2026-10";
  const uberSources = [...(state.data.incomeLines || []), ...(state.data.recurringIncomes || [])]
    .filter((item) => `${item.label || ""} ${item.origin || ""}`.toLocaleLowerCase("pt-BR").includes("uber"));
  const completed = new Set(state.data.receivedOccurrences || []);
  uberSources.forEach((item) => {
    const key = `${item.id}:${rollbackMonth}`;
    const hasReceipt = (state.data.receivedPayments?.[key] || []).length > 0 || Number(state.data.receivedAmounts?.[key] || 0) > 0;
    if (hasReceipt && !completed.has(key)) { completed.add(key); changed = true; }
  });
  state.data.receivedOccurrences = [...completed];
  uber().budgetIntegrationRolledBack = true;
  return changed;
}

export function renderUber(view) {
  if (!document.querySelector("#uberinicioView")) return;
  syncAutomaticDays();
  const previousIncomeId = uber().linkedIncomeId;
  const incomeLink = linkedUberIncome();
  if (incomeLink && incomeLink.id !== previousIncomeId && !persistingIncomeLink) {
    persistingIncomeLink = true;
    Promise.resolve(state.saveStateFn?.("Renda recorrente Uber vinculada aos lançamentos da operação.")).finally(() => { persistingIncomeLink = false; });
  }
  if (rollbackBudgetIntegration() && !persistingRollback) {
    persistingRollback = true;
    Promise.resolve(state.saveStateFn?.("Integração Uber removida do orçamento mensal.")).finally(() => { persistingRollback = false; });
  }
  const data = stats(), forecast = pace(), goals = goalTotals();
  document.querySelectorAll(".uber-energy-label").forEach((item) => { item.textContent = energyLabel(); });
  document.querySelectorAll(".uber-quantity-label").forEach((item) => { item.textContent = config().vehicleType === "electric" ? "kWh recarregados" : "Litros abastecidos"; });
  if (view === "uberinicio") renderStart(data, forecast, goals);
  if (view === "uberdashboard") renderDashboard(data, forecast, goals);
  if (view === "uberoperacao") renderOperation(data);
  if (view === "uberhistorico") renderHistory();
  if (view === "ubersimulacao") renderSimulation();
  if (view === "uberconfig") renderConfig();
  bindMoneyInputs(document); refreshIcons();
}

function renderStart(data, forecast, goals) {
  setEntryDateDefault();
  const expectedCosts = Math.max(goals.survival, data.costs), outcome = forecast.projected - expectedCosts;
  document.querySelector("#uberHeroProjected").textContent = money(forecast.projected);
  document.querySelector("#uberHeroProjectionCopy").textContent = data.days ? `Usa suas médias de ${forecast.normalDays} dia(s) seg–sex e ${forecast.specialDays} dia(s) especial(is).` : "Comece registrando seus ganhos para gerar projeção.";
  document.querySelector("#uberHeroRealized").textContent = money(data.gains);
  const outcomeElement = document.querySelector("#uberHeroOutcome");
  outcomeElement.textContent = money(outcome);
  outcomeElement.classList.toggle("negative", outcome < 0);
  outcomeElement.classList.toggle("positive", outcome >= 0);
  document.querySelector("#uberHeroCostCopy").textContent = `Considerando custos de ${money(expectedCosts)}`;
  document.querySelector("#uberHeroWeekdayAverage").textContent = forecast.normalDays ? money(forecast.normal) : "—";
  document.querySelector("#uberHeroSpecialAverage").textContent = forecast.specialDays ? money(forecast.special) : "—";
  document.querySelector("#uberOperationalKpis").innerHTML = kpis([["Resultado do mês", money(data.net), "ganhos menos custos"], ["Ganhos", money(data.gains), "realizado no mês"], ["Custos", money(data.costs), "não duplicados no orçamento"], ["KM rodados", data.km.toLocaleString("pt-BR"), "base do mês"]]);
  const list = data.list.slice().sort((a, b) => b.date.localeCompare(a.date)); document.querySelector("#uberRecentEntries").innerHTML = entryCards(recentExpanded ? list : list.slice(0, 5));
  const button = document.querySelector('[data-uber-action="toggle-recent"]'); if (button) button.textContent = recentExpanded ? "Mostrar menos" : "Ver todos";
}
function renderDashboard(data, forecast, goals) {
  const expectedCosts = Math.max(goals.survival, data.costs), outcome = forecast.projected - expectedCosts;
  const stages = [
    { label: "Sobrevivência", value: goals.survival, copy: "Cobrir os custos da operação." },
    { label: "Estabilidade", value: goals.stable, copy: "Custos mais a retirada desejada." },
    { label: "Conforto", value: goals.comfort, copy: "Estabilidade mais o adicional de conforto." }
  ];
  document.querySelector("#uberProjection").innerHTML = `<div class="uber-projection-main"><p class="eyebrow">Faturamento projetado do mês</p><strong>${money(forecast.projected)}</strong><p>${data.days ? `Usa suas médias de ${forecast.normalDays} dia(s) seg–sex e ${forecast.specialDays} dia(s) especial(is).` : "Comece registrando seus ganhos para gerar projeção."}</p></div><div class="uber-projection-details"><article><span>Faturamento realizado</span><strong>${money(data.gains)}</strong></article><article><span>Resultado previsto após custos</span><strong class="${outcome >= 0 ? "positive" : "negative"}">${money(outcome)}</strong><small>Considerando custos de ${money(expectedCosts)}</small></article><article><span>Média atual</span><strong><small>Seg–sex</small>${forecast.normalDays ? money(forecast.normal) : "—"}</strong><strong><small>Dia especial</small>${forecast.specialDays ? money(forecast.special) : "—"}</strong></article></div>`;
  document.querySelector("#uberRhythm").innerHTML = `<div class="uber-rhythm-scale"><div class="uber-rhythm-track"><i style="width:${Math.min((forecast.projected / Math.max(goals.comfort, 1)) * 100, 100)}%"></i></div><div class="uber-rhythm-labels"><span>Projeção <strong>${money(forecast.projected)}</strong></span>${stages.map((stage) => `<span>${stage.label} <strong>${money(stage.value)}</strong></span>`).join("")}</div></div><div class="uber-rhythm-summary"><span>${forecast.remaining} dia(s) de trabalho sem ganho</span><strong>${data.km ? `${money(data.net / data.km)} de lucro por KM` : "Registre KM para medir o lucro por KM"}</strong></div>`;
  document.querySelector("#uberGoalCards").innerHTML = stages.map((stage) => goalCard(stage, forecast)).join("");
  document.querySelector("#uberComposition").innerHTML = composition(data, goals);
  document.querySelector("#uberWeeks").innerHTML = weeklyReadout(data.list);
}

function goalCard(stage, forecast) {
  const missing = Math.max(stage.value - forecast.projected, 0), percent = stage.value ? Math.min((forecast.projected / stage.value) * 100, 100) : 100;
  const normalWeight = forecast.normal || forecast.average || 1, specialWeight = forecast.special || normalWeight;
  const weightedDays = forecast.normalRemaining * normalWeight + forecast.specialRemaining * specialWeight;
  const multiplier = weightedDays ? missing / weightedDays : 0;
  const normalNeeded = normalWeight * multiplier, specialNeeded = specialWeight * multiplier;
  const action = !missing ? "Meta projetada alcançada." : forecast.remaining ? `Para chegar: seg–sex ${money(normalNeeded)}/dia · dia especial ${money(specialNeeded)}/dia` : "Sem dias planejados para alcançar esta meta.";
  return `<article class="uber-goal-card"><div class="uber-goal-card-head"><span>${stage.label}</span><b>${percent.toFixed(0)}%</b></div><strong>${money(stage.value)}</strong><small>${stage.copy}</small><div class="uber-progress"><i style="width:${percent}%"></i></div><dl><div><dt>Executado</dt><dd>${money(forecast.projected)} · ${percent.toFixed(0)}%</dd></div><div><dt>Faltam</dt><dd>${missing ? money(missing) : "Meta atingida"}</dd></div></dl><p class="uber-goal-action">${action}</p></article>`;
}

function composition(data, goals) {
  const goalItems = config().goals;
  if (!goalItems.length) return '<p class="empty-state">Cadastre os custos essenciais em Regras da Operação para formar as metas.</p>';
  return goalItems.map((goal) => {
    const name = String(goal.name || "").toLocaleLowerCase("pt-BR");
    const actual = name.includes("gas") || name.includes("combust") || name.includes("recarga") ? data.fuelCost : data.list.filter((item) => item.type === "expense" && String(item.description || "").toLocaleLowerCase("pt-BR") === name).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const planned = Number(goal.amount || 0), percent = planned ? Math.min((actual / planned) * 100, 100) : 0;
    return `<article class="uber-cost-composition"><div><strong>${escapeHtml(goal.name)}</strong><small>Custo essencial</small></div><div><span>${money(actual)} / ${money(planned)}</span><div class="uber-progress"><i style="width:${percent}%"></i></div></div></article>`;
  }).join("") + `<div class="uber-composition-total"><span>Base de sobrevivência</span><strong>${money(goals.survival)}</strong></div>`;
}

function weeklyReadout(list) {
  const key = activeMonthKey(), [year, month] = key.split("-").map(Number), last = new Date(year, month, 0).getDate();
  const weeks = []; let start = 1;
  while (start <= last) { const startDate = new Date(year, month - 1, start), length = start === 1 ? 7 - startDate.getDay() : 7; const end = Math.min(start + length - 1, last); weeks.push([start, end]); start = end + 1; }
  return weeks.map(([first, lastDay], index) => { const gains = list.filter((item) => item.type === "gain" && Number(item.date.slice(8, 10)) >= first && Number(item.date.slice(8, 10)) <= lastDay).reduce((sum, item) => sum + Number(item.amount || 0), 0); const days = new Set(list.filter((item) => item.type === "gain" && Number(item.date.slice(8, 10)) >= first && Number(item.date.slice(8, 10)) <= lastDay).map((item) => item.date)).size; return `<article class="uber-week"><span>S${index + 1} · ${first}–${lastDay} ${MONTHS[month - 1].toLocaleLowerCase("pt-BR")}</span><strong>${money(gains)}</strong><small>${days} dia(s) com ganho</small></article>`; }).join("");
}
function renderOperation(data) {
  const fuel = data.list.filter((item) => item.type === "fuel");
  document.querySelector("#uberFuelKpis").innerHTML = kpis([["Lucro por KM", data.km ? money(data.net / data.km) : "—", "foco da operação"], ["Receita por KM", data.km ? money(data.gains / data.km) : "—", "ganhos ÷ KM"], ["Custo por KM", data.km ? money(data.costs / data.km) : "—", "todos os custos ÷ KM"], [energyLabel() + "s", `${data.quantities.toLocaleString("pt-BR")} ${energyUnit()}`, `${fuel.length} lançamento(s) no mês`]]);
  document.querySelector("#uberFuelRows").innerHTML = fuel.length ? fuel.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => `<tr><td data-label="Data">${formatDate(item.date)}</td><td data-label="Quantidade">${Number(item.quantity || 0).toLocaleString("pt-BR")} ${energyUnit()}</td><td data-label="Valor" class="negative">-${money(item.amount)}</td><td data-label="Preço/unidade">${item.quantity ? money(item.amount / item.quantity) : "—"}</td><td data-label="KM">${item.km || "—"}</td></tr>`).join("") : emptyRow(5, `Nenhum lançamento de ${energyLabel().toLowerCase()} neste mês.`);
}
function renderHistory() {
  const currentKey = activeMonthKey(), currentClosed = uber().closings?.[currentKey];
  const button = document.querySelector("#uberCloseMonthButton");
  const status = document.querySelector("#uberCloseStatus");
  if (button) { button.disabled = Boolean(currentClosed); button.querySelector("span").textContent = currentClosed ? "Mês fechado" : "Fechar mês atual"; }
  if (status) status.textContent = currentClosed ? `${monthName(currentKey)} foi encerrado em ${formatDate(currentClosed.closedAt?.slice(0, 10))}.` : `${monthName(currentKey)} ainda está em aberto.`;
  const months = new Set(Object.keys(uber().closings || {})); months.add(currentKey); uber().entries.forEach((item) => months.add(monthKey(item.date)));
  const records = [...months].sort().reverse().map((key) => ({ key, closed: uber().closings[key], summary: uber().closings[key] || stats(key) }));
  const best = records.slice().sort((a, b) => Number(b.summary.net || 0) - Number(a.summary.net || 0))[0];
  const accumulated = records.reduce((sum, item) => sum + Number(item.summary.net || 0), 0);
  document.querySelector("#uberHistorySummary").innerHTML = records.length ? `<article><span>Melhor mês</span><strong>${best ? monthName(best.key) : "—"}</strong></article><article><span>Acumulado</span><strong class="${accumulated >= 0 ? "positive" : "negative"}">${money(accumulated)}</strong></article><article><span>Meses</span><strong>${records.length}</strong></article>` : "";
  document.querySelector("#uberHistoryCards").innerHTML = records.map((record) => historyCard(record)).join("") || '<p class="empty-state">O histórico aparecerá conforme houver lançamentos.</p>';
}

function historyCard({ key, closed, summary }) {
  const goals = summary.goals || { ...goalTotals(), items: config().goals }, tier = summary.gains >= goals.comfort ? "Conforto" : summary.gains >= goals.stable ? "Estabilidade" : summary.gains >= goals.survival ? "Sobrevivência" : "Abaixo da mínima";
  const tierCopy = tier === "Conforto" ? "Meta de conforto atingida." : tier === "Estabilidade" ? "Boa, o mês ficou firme na estabilidade." : tier === "Sobrevivência" ? "O mês se pagou. Sobrevivência atingida." : "O mês ficou abaixo da mínima.";
  const costRows = (goals.items || config().goals).map((goal) => { const name = String(goal.name || "").toLocaleLowerCase("pt-BR"), actual = name.includes("gas") || name.includes("combust") || name.includes("recarga") ? Number(summary.fuelCost || 0) : (summary.list || []).filter((item) => item.type === "expense" && String(item.description || "").toLocaleLowerCase("pt-BR") === name).reduce((sum, item) => sum + Number(item.amount || 0), 0); return `<span>${escapeHtml(goal.name)} <b>-${money(actual)} / ${money(goal.amount)}</b></span>`; }).join("");
  const progress = [
    ["Sobrevivência", goals.survival], ["Estabilidade", goals.stable], ["Conforto", goals.comfort]
  ].map(([label, goal]) => `<span><b>${label}</b>${money(goal)} <em>${goal ? Math.min((summary.gains / goal) * 100, 999).toFixed(0) : 100}%</em></span>`).join("");
  return `<article class="uber-history-card uber-history-detail ${closed ? "is-closed" : ""}"><header><div><span>${monthName(key)} · ${summary.days || 0} dias trabalhados</span><small>${closed ? `Fechado · ${tier}` : "Em andamento"}</small></div>${closed ? `<button class="small-button" data-uber-action="reopen:${key}">Reabrir mês</button>` : ""}</header><p class="uber-history-tier"><b>${tier}</b> ${tierCopy}</p><div class="uber-history-result"><span>Resultado do mês</span><strong class="${summary.net >= 0 ? "positive" : "negative"}">${money(summary.net)}</strong><small>${money(summary.gains)} em ganhos · -${money(summary.costs)} em saídas</small></div><div class="uber-history-progress">${progress}</div><div class="uber-history-metrics"><span><b>Entradas</b>${money(summary.gains)}<small>Ganhos Uber</small></span><span><b>Saídas</b>-${money(summary.costs)}<small>Custos lançados</small></span><span><b>Média por dia</b>${money(summary.days ? summary.gains / summary.days : 0)}<small>${summary.days || 0} dia(s) trabalhado(s)</small></span><span><b>KM rodado</b>${Number(summary.km || 0).toLocaleString("pt-BR")}<small>${Number(summary.quantities || 0).toLocaleString("pt-BR")} ${energyUnit()}</small></span><span><b>Receita/KM</b>${summary.km ? money(summary.gains / summary.km) : "—"}<small>Ganho por quilômetro</small></span><span><b>Custo/KM</b>${summary.km ? money(summary.fuelCost / summary.km) : "—"}<small>Energia por quilômetro</small></span><span><b>Lucro/KM</b>${summary.km ? money(summary.net / summary.km) : "—"}<small>Resultado por KM</small></span></div>${costRows ? `<div class="uber-history-costs"><b>Custos do mês</b>${costRows}</div>` : ""}</article>`;
}
function renderSimulation() { const form = document.querySelector("#uberSimulationForm"); if (!form.dataset.ready) { const data = stats(); form.elements.days.value = plannedDays() || data.days || 0; form.elements.daily.value = data.days ? formatCurrencyInput(data.gains / data.days) : ""; form.elements.costs.value = formatCurrencyInput(goalTotals().survival); form.dataset.ready = "true"; } simulate(); }
function renderConfig() {
  const form = document.querySelector("#uberConfigForm"); form.elements.vehicleType.value = config().vehicleType; document.querySelector("#uberWorkHolidays").checked = !!config().workHolidays;
  document.querySelector("#uberWeekdays").innerHTML = WEEKDAYS.map((day, number) => `<button type="button" class="${config().workDays.includes(number) ? "active" : ""}" data-uber-action="weekday:${number}">${day}</button>`).join("");
  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth() + 1, last = new Date(year, month, 0).getDate(), offset = new Date(year, month - 1, 1).getDay(); document.querySelector("#uberCalendarTitle").textContent = `${MONTHS[month - 1]} de ${year}`; document.querySelector("#uberPlannedDays").textContent = `${plannedDays(`${year}-${String(month).padStart(2, "0")}`)} dias planejados`;
  document.querySelector("#uberCalendar").innerHTML = `${Array.from({ length: offset }, () => '<span class="uber-calendar-empty"></span>').join("")}${Array.from({ length: last }, (_, index) => { const day = index + 1, date = new Date(year, month - 1, day), key = dateKey(year, month, day), holiday = holidays(year).has(key), auto = config().autoDaysOff.includes(key), manual = config().daysOff.includes(key) || config().extraWorkDays.includes(key), working = workDay(date), label = auto ? "Folga automática" : manual ? "Exceção" : holiday ? "Feriado" : working ? "Trabalho" : "Folga"; return `<button type="button" class="${working ? "work" : "off"}${holiday ? " holiday" : ""}${manual || auto ? " exception" : ""}" data-uber-action="date:${key}"><strong>${day}</strong><small>${label}</small></button>`; }).join("")}`;
  document.querySelector("#uberGoalSettings").innerHTML = config().goals.map((item) => `<div class="uber-setting-row"><span>${escapeHtml(item.name)}</span><strong>${money(item.amount)}</strong><button class="small-button danger-mini" data-uber-action="goal-delete:${item.id}">Excluir</button></div>`).join("") || '<p class="empty-state">Cadastre os custos que formam sua meta de sobrevivência.</p>';
  const targets = document.querySelector("#uberTargetsForm"); targets.elements.withdrawal.value = formatCurrencyInput(config().withdrawal || 0); targets.elements.comfort.value = formatCurrencyInput(config().comfort || 0);
}
function nextWorkDay() { const start = new Date(); for (let days = 0; days < 62; days++) { const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days); if (workDay(date)) return `${WEEKDAYS[date.getDay()]} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`; } return "—"; }
function kpis(items) { return items.map(([label, value, copy]) => `<article class="kpi-card"><span>${label}</span><strong>${value}</strong><small>${copy}</small></article>`).join(""); }
function entryIcon(type) { return ({ gain: "arrow-up-circle", fuel: "fuel", expense: "receipt", km: "gauge" })[type] || "circle"; }
function entryCards(list) { return list.length ? list.map((item) => { const detail = [formatDate(item.date), item.description && escapeHtml(item.description), item.type === "fuel" && `${Number(item.quantity || 0).toLocaleString("pt-BR")} ${energyUnit()}`, item.km && `KM ${item.km}`].filter(Boolean).join(" · "); const value = item.type === "km" ? `${item.km} KM` : `${item.type === "gain" ? "" : "-"}${money(item.amount)}`; return `<article class="uber-entry-card"><div class="uber-entry-icon ${item.type}"><i data-lucide="${entryIcon(item.type)}"></i></div><div class="uber-entry-copy"><strong>${typeLabel(item.type)}</strong><span>${detail}</span></div><strong class="${item.type === "gain" ? "positive" : item.type === "km" ? "" : "negative"}">${value}</strong><button class="small-button danger-mini icon-only" aria-label="Excluir lançamento" title="Excluir" data-uber-action="delete:${item.id}"><i data-lucide="trash-2"></i></button></article>`; }).join("") : '<p class="empty-state">Comece registrando sua operação.</p>'; }
function emptyRow(cols, message) { return `<tr><td colspan="${cols}" class="empty-state">${message}</td></tr>`; }
function typeLabel(type) { return ({ gain: "Ganho", fuel: energyLabel(), expense: "Despesa", km: "Atualização de KM" })[type] || type; }
function formatDate(date) { return date ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—"; }
async function save(message) { await state.saveStateFn?.(message); renderUber(document.querySelector(".view.active")?.id.replace(/View$/, "")); }
async function saveEntry(event) {
  event.preventDefault();
  const form = event.currentTarget, type = form.elements.type.value, amount = parseCurrencyInput(form.elements.amount.value), entryMonth = monthKey(form.elements.date.value);
  const entry = { id: crypto.randomUUID(), date: form.elements.date.value, type, description: type === "expense" ? String(form.elements.description.value || "Outros").trim() : type === "gain" ? "Ganhos Uber" : type === "fuel" ? energyLabel() : "", amount: type === "km" ? 0 : Math.abs(amount), quantity: Number(form.elements.quantity.value || 0), km: Number(form.elements.km.value || 0) };
  if (!entry.date || (type !== "km" && !entry.amount) || (type === "fuel" && !entry.quantity)) return showToast("Preencha a data, o valor e, no abastecimento, os litros.", "error");
  if (type === "km" && !entry.km) return showToast("Informe o KM atual para registrar uma atualização de quilometragem.", "error");
  if (uber().closings?.[entryMonth]) return showToast(`${monthName(entryMonth)} está fechado. Reabra o mês no Histórico para lançar nele.`, "error");
  uber().entries.push(entry);
  const linked = type === "gain" && syncUberIncomeReceipts(entryMonth);
  form.reset();
  delete form.elements.date.dataset.userChanged;
  setEntryDateDefault(true);
  selectType("gain");
  await save(linked ? "Ganho Uber salvo e recebido parcial atualizado no Controle Mensal." : "Lançamento Uber salvo.");
}
async function saveConfig(event) { event.preventDefault(); config().vehicleType = event.currentTarget.elements.vehicleType.value; await save("Veículo atualizado."); }
async function toggleWeekday(day) { const days = new Set(config().workDays); days.has(day) ? days.delete(day) : days.add(day); config().workDays = [...days].sort((a, b) => a - b); syncAutomaticDays(); await save("Rotina de trabalho atualizada."); }
async function toggleDate(key) { const [year, month, day] = key.split("-").map(Number), date = new Date(year, month - 1, day), wasWorking = workDay(date), base = baseWorkDay(date); config().daysOff = config().daysOff.filter((item) => item !== key); config().extraWorkDays = config().extraWorkDays.filter((item) => item !== key); config().autoDaysOff = config().autoDaysOff.filter((item) => item !== key); if (!wasWorking && !base) config().extraWorkDays.push(key); else if (wasWorking && base) config().daysOff.push(key); await save("Exceção de rotina atualizada."); }
async function addGoal(event) { event.preventDefault(); const form = event.currentTarget, name = String(form.elements.name.value || "").trim(), amount = parseCurrencyInput(form.elements.amount.value); if (!name || !amount) return showToast("Informe custo e valor.", "error"); config().goals.push({ id: crypto.randomUUID(), name, amount }); form.reset(); await save("Custo Uber adicionado."); }
async function saveTargets(event) { event.preventDefault(); const form = event.currentTarget; config().withdrawal = parseCurrencyInput(form.elements.withdrawal.value); config().comfort = parseCurrencyInput(form.elements.comfort.value); await save("Metas Uber atualizadas."); }
async function deleteEntry(id) {
  const removed = uber().entries.find((item) => item.id === id);
  uber().entries = uber().entries.filter((item) => item.id !== id);
  if (removed?.type === "gain") syncUberIncomeReceipts(monthKey(removed.date));
  await save("Lançamento Uber excluído.");
}
async function deleteGoal(id) { config().goals = config().goals.filter((item) => item.id !== id); await save("Custo Uber excluído."); }
async function closeMonth() {
  const key = activeMonthKey();
  if (uber().closings?.[key]) return showToast("Este mês Uber já está fechado.", "error");
  uber().closings ||= {};
  uber().closings[key] = { ...stats(key), goals: { ...goalTotals(), items: config().goals.map((goal) => ({ ...goal })) }, closedAt: new Date().toISOString() };
  uber().activeMonth = nextMonthKey(key);
  const form = document.querySelector("#uberEntryForm");
  if (form) { form.reset(); form.elements.date.value = entryDateForActiveMonth(); selectType("gain"); }
  await state.saveStateFn?.("Mês Uber fechado.");
  renderUber("uberhistorico");
}
async function reopenMonth(key) {
  if (!uber().closings?.[key]) return;
  delete uber().closings[key];
  uber().activeMonth = key;
  const form = document.querySelector("#uberEntryForm");
  if (form) { form.reset(); form.elements.date.value = entryDateForActiveMonth(); selectType("gain"); }
  await state.saveStateFn?.("Mês Uber reaberto.");
  renderUber("uberhistorico");
}
function simulate(event) { event?.preventDefault(); const form = document.querySelector("#uberSimulationForm"), days = Number(form.elements.days.value || 0), daily = parseCurrencyInput(form.elements.daily.value), costs = parseCurrencyInput(form.elements.costs.value); document.querySelector("#uberSimulationKpis").innerHTML = kpis([["Faturamento projetado", money(days * daily), `${days} dias × ${money(daily)}`], ["Custos previstos", money(costs), "cenário informado"], ["Sobra projetada", money(days * daily - costs), "após custos"]]); }
async function importBackup(event) { const file = event.target.files?.[0]; if (!file) return; try { const raw = JSON.parse(await file.text()), source = Array.isArray(raw) ? { dados: raw } : raw; const imported = (source.dados || []).map((item) => ({ id: String(item.id || crypto.randomUUID()), date: item.data, type: ({ ganho: "gain", gasolina: "fuel", despesas: "expense", km: "km", credito: "gain", debito: "expense" })[item.tipo] || "expense", description: item.descricao || "", amount: Math.abs(Number(item.valor || 0)), quantity: Number(item.litros || 0), km: Number(item.km || 0) })).filter((item) => item.date); const byId = new Map(uber().entries.map((item) => [item.id, item])); imported.forEach((item) => byId.set(item.id, item)); uber().entries = [...byId.values()]; const sourceConfig = source.config || {}; uber().config = { ...config(), vehicleType: sourceConfig.tipoVeiculo === "eletrico" ? "electric" : config().vehicleType, workDays: (sourceConfig.diasSemana || config().workDays).map((day) => Number(day) % 7), workHolidays: !!sourceConfig.trabalhoEmFeriados, daysOff: sourceConfig.diasFolgaExtra || config().daysOff, extraWorkDays: sourceConfig.diasTrabalhoExtra || config().extraWorkDays, autoDaysOff: sourceConfig.diasFolgaAutomatica || config().autoDaysOff, withdrawal: Number(sourceConfig.retiradaDesejada || config().withdrawal || 0), comfort: Number(sourceConfig.confortoDesejado || config().comfort || 0), goals: (sourceConfig.metas || config().goals).map((goal) => ({ id: String(goal.id || crypto.randomUUID()), name: goal.nome || goal.name, amount: Number(goal.valor || goal.amount || 0) })) }; await save(`${imported.length} lançamento(s) do Controle Uber importado(s).`); } catch { showToast("Não foi possível ler esse backup do Controle Uber.", "error"); } finally { event.target.value = ""; } }
