import { state, el, currency } from "../state.js";
import { bindMoneyInputs, escapeHtml, formatCurrencyInput, parseCurrencyInput, refreshIcons, showToast } from "../utils.js";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let recentExpanded = false;

const isoToday = () => new Date().toISOString().slice(0, 10);
const monthKey = (date = isoToday()) => String(date).slice(0, 7);
const monthName = (key) => { const [year, month] = key.split("-"); return `${MONTHS[Number(month) - 1]} de ${year}`; };
const dateKey = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
const money = (value) => currency.format(Number(value) || 0);
const uber = () => state.data.uber;
const entries = (key = monthKey()) => uber().entries.filter((item) => item.date?.startsWith(key));
const energyLabel = () => uber().config.vehicleType === "electric" ? "Recarga" : "Abastecimento";
const energyUnit = () => uber().config.vehicleType === "electric" ? "kWh" : "L";
const isCurrentMonth = (key) => key === monthKey();

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
  const gains = new Set(entries(monthKey()).filter((item) => item.type === "gain" && Number(item.amount) > 0).map((item) => item.date));
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
      <div class="uber-hero panel"><div><p class="eyebrow">Lançamento diário</p><h2>Registrar operação</h2><p>Registre ganhos, abastecimentos, despesas e quilometragem.</p></div><div class="uber-hero-total"><span>Ganhos no mês</span><strong id="uberHeroEarnings">${money(0)}</strong></div></div>
      <section class="panel"><form id="uberEntryForm" class="uber-entry-form"><div class="uber-type-picker"><button type="button" class="uber-type active" data-uber-type="gain"><i data-lucide="arrow-up-circle"></i> Ganho</button><button type="button" class="uber-type" data-uber-type="fuel"><i data-lucide="fuel"></i> <span class="uber-energy-label">Abastecimento</span></button><button type="button" class="uber-type" data-uber-type="expense"><i data-lucide="receipt"></i> Despesa</button><button type="button" class="uber-type" data-uber-type="km"><i data-lucide="gauge"></i> KM</button></div><input type="hidden" name="type" value="gain"><div class="form-grid uber-form-grid"><label>Data<input type="date" name="date" required></label><label class="uber-value-field">Valor<input data-money-input type="text" name="amount" inputmode="numeric" placeholder="0,00"></label><label class="uber-quantity-field" hidden><span class="uber-quantity-label">Litros abastecidos</span><input type="number" name="quantity" inputmode="decimal" step="0.01" min="0"></label><label class="uber-description-field" hidden>Descrição<input type="text" name="description" maxlength="80" placeholder="Ex.: Lavagem"></label><label class="uber-km-field">KM atual<input type="number" name="km" inputmode="numeric" min="0"></label></div><button class="primary-button" type="submit"><i data-lucide="plus"></i> Adicionar lançamento</button></form></section>
      <div class="finance-kpis" id="uberOperationalKpis"></div>
      <section class="panel"><div class="panel-heading"><div><p class="eyebrow">Últimos lançamentos</p><h2>Movimentação recente</h2></div><button class="ghost-button" type="button" data-uber-action="toggle-recent">Ver todos</button></div><div class="uber-list" id="uberRecentEntries"></div></section>
    </section>
    <section class="view" id="uberdashboardView" data-title="Dashboard Uber" data-eyebrow="Operação" data-subtitle="Ritmo, metas e previsão de fechamento do mês."><section class="panel uber-projection" id="uberProjection"></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Metas do mês</p><h2>Seu caminho até a retirada</h2></div></div><div class="uber-goals" id="uberGoalCards"></div></section><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Ritmo atual</p><h2>Médias e agenda</h2></div></div><div class="uber-insights" id="uberInsights"></div></section></section>
    <section class="view" id="uberoperacaoView" data-title="Operação do Carro" data-eyebrow="Uber" data-subtitle="Rentabilidade por quilômetro e seus abastecimentos."><div class="finance-kpis" id="uberFuelKpis"></div><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Mês atual</p><h2>Abastecimentos e recargas</h2></div></div><div class="uber-table-wrap"><table class="uber-table"><thead><tr><th>Data</th><th>Quantidade</th><th>Valor</th><th>Preço/unidade</th><th>KM</th></tr></thead><tbody id="uberFuelRows"></tbody></table></div></section></section>
    <section class="view" id="uberhistoricoView" data-title="Histórico Uber" data-eyebrow="Uber"><section class="panel"><div class="panel-heading"><div><p class="eyebrow">Meses encerrados</p><h2>Histórico operacional</h2></div><button class="primary-button" type="button" data-uber-action="close-month"><i data-lucide="calendar-check"></i> Fechar mês atual</button></div><div class="uber-history" id="uberHistoryCards"></div></section></section>
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
    else if (action.startsWith("goal-delete:")) await deleteGoal(action.slice(12));
    else if (action.startsWith("weekday:")) await toggleWeekday(Number(action.slice(8)));
    else if (action.startsWith("calendar:")) { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + Number(action.slice(9)), 1); renderConfig(); }
    else if (action.startsWith("date:")) await toggleDate(action.slice(5));
  });
  selectType("gain");
  document.querySelector("#uberEntryForm").elements.date.value = isoToday();
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

function stats(key = monthKey()) {
  const list = entries(key), gains = list.filter((item) => item.type === "gain").reduce((n, item) => n + Number(item.amount || 0), 0);
  const fuel = list.filter((item) => item.type === "fuel"), fuelCost = fuel.reduce((n, item) => n + Number(item.amount || 0), 0);
  const expenses = list.filter((item) => item.type === "expense").reduce((n, item) => n + Number(item.amount || 0), 0);
  const quantities = fuel.reduce((n, item) => n + Number(item.quantity || 0), 0), kms = list.map((item) => Number(item.km || 0)).filter(Boolean);
  const km = kms.length > 1 ? Math.max(...kms) - Math.min(...kms) : 0, days = new Set(list.filter((item) => item.type === "gain").map((item) => item.date)).size;
  return { list, gains, fuelCost, expenses, costs: fuelCost + expenses, quantities, km, days, net: gains - fuelCost - expenses };
}

function plannedDays(key = monthKey()) { const [year, month] = key.split("-").map(Number), last = new Date(year, month, 0).getDate(); let total = 0; for (let day = 1; day <= last; day++) if (workDay(new Date(year, month - 1, day))) total++; return total; }
function pace(key = monthKey()) {
  const byDay = new Map(); entries(key).filter((item) => item.type === "gain").forEach((item) => byDay.set(item.date, (byDay.get(item.date) || 0) + Number(item.amount || 0)));
  let normalTotal = 0, normalDays = 0, specialTotal = 0, specialDays = 0;
  byDay.forEach((value, date) => { if (isSpecialDay(new Date(`${date}T12:00:00`))) { specialTotal += value; specialDays++; } else { normalTotal += value; normalDays++; } });
  const average = byDay.size ? [...byDay.values()].reduce((n, value) => n + value, 0) / byDay.size : 0, normal = normalDays ? normalTotal / normalDays : average, special = specialDays ? specialTotal / specialDays : (normal || average);
  const [year, month] = key.split("-").map(Number), last = new Date(year, month, 0).getDate(); let normalRemaining = 0, specialRemaining = 0;
  const start = isCurrentMonth(key) ? new Date().getDate() : last + 1;
  for (let day = start; day <= last; day++) { const date = new Date(year, month - 1, day), dateIso = dateKey(year, month, day); if (workDay(date) && !byDay.has(dateIso)) isSpecialDay(date) ? specialRemaining++ : normalRemaining++; }
  return { normal, special, normalDays, specialDays, normalRemaining, specialRemaining, projected: stats(key).gains + (normalRemaining * normal) + (specialRemaining * special), average, remaining: normalRemaining + specialRemaining };
}
function goalTotals() { const costs = config().goals.reduce((n, item) => n + Number(item.amount || 0), 0), stable = costs + Number(config().withdrawal || 0); return { survival: costs, stable, comfort: stable + Number(config().comfort || 0) }; }

export function renderUber(view) {
  if (!document.querySelector("#uberinicioView")) return;
  syncAutomaticDays(); const data = stats(), forecast = pace(), goals = goalTotals();
  document.querySelectorAll(".uber-energy-label").forEach((item) => { item.textContent = energyLabel(); });
  document.querySelectorAll(".uber-quantity-label").forEach((item) => { item.textContent = config().vehicleType === "electric" ? "kWh recarregados" : "Litros abastecidos"; });
  const hero = document.querySelector("#uberHeroEarnings"); if (hero) hero.textContent = money(data.gains);
  if (view === "uberinicio") renderStart(data);
  if (view === "uberdashboard") renderDashboard(data, forecast, goals);
  if (view === "uberoperacao") renderOperation(data);
  if (view === "uberhistorico") renderHistory();
  if (view === "ubersimulacao") renderSimulation();
  if (view === "uberconfig") renderConfig();
  bindMoneyInputs(document); refreshIcons();
}

function renderStart(data) {
  document.querySelector("#uberOperationalKpis").innerHTML = kpis([["Resultado do mês", money(data.net), "ganhos menos custos"], ["Ganhos", money(data.gains), "realizado no mês"], ["Custos", money(data.costs), "não duplicados no orçamento"], ["KM rodados", data.km.toLocaleString("pt-BR"), "base do mês"]]);
  const list = data.list.slice().sort((a, b) => b.date.localeCompare(a.date)); document.querySelector("#uberRecentEntries").innerHTML = entryCards(recentExpanded ? list : list.slice(0, 5));
  const button = document.querySelector('[data-uber-action="toggle-recent"]'); if (button) button.textContent = recentExpanded ? "Mostrar menos" : "Ver todos";
}
function renderDashboard(data, forecast, goals) {
  const expectedCosts = Math.max(goals.survival, data.costs), outcome = forecast.projected - expectedCosts;
  document.querySelector("#uberProjection").innerHTML = `<div class="uber-projection-main"><p class="eyebrow">Faturamento projetado do mês</p><strong>${money(forecast.projected)}</strong><p>Usa suas médias de ${forecast.normalDays} dia(s) normal(is) e ${forecast.specialDays} dia(s) especial(is).</p></div><div class="uber-projection-details"><article><span>Faturamento realizado</span><strong>${money(data.gains)}</strong></article><article><span>Resultado previsto após custos</span><strong class="${outcome >= 0 ? "positive" : "negative"}">${money(outcome)}</strong><small>Considerando ${money(expectedCosts)} em custos</small></article><article><span>Média atual</span><strong>Normal ${money(forecast.normal)}</strong><strong>Especial ${money(forecast.special)}</strong></article></div>`;
  document.querySelector("#uberGoalCards").innerHTML = [["Sobrevivência", goals.survival], ["Estabilidade", goals.stable], ["Conforto", goals.comfort]].map(([label, value]) => { const missing = Math.max(value - forecast.projected, 0), daily = forecast.remaining ? missing / forecast.remaining : 0, percent = value ? Math.min((forecast.projected / value) * 100, 100) : 100; return `<article class="uber-goal-card"><span>${label}</span><strong>${money(value)}</strong><div class="uber-progress"><i style="width:${percent}%"></i></div><small>${missing ? `Faltam ${money(missing)} · ${money(daily)}/dia` : "Meta projetada alcançada"}</small></article>`; }).join("");
  const next = nextWorkDay(); document.querySelector("#uberInsights").innerHTML = `<div><span>Dias planejados</span><strong>${plannedDays()}</strong><small>${forecast.remaining} ainda sem ganho</small></div><div><span>Próximo dia</span><strong>${next || "—"}</strong><small>pela rotina atual</small></div><div><span>Lucro por KM</span><strong>${data.km ? money(data.net / data.km) : "—"}</strong><small>resultado operacional</small></div>`;
}
function renderOperation(data) {
  const fuel = data.list.filter((item) => item.type === "fuel");
  document.querySelector("#uberFuelKpis").innerHTML = kpis([["Lucro por KM", data.km ? money(data.net / data.km) : "—", "foco da operação"], ["Receita por KM", data.km ? money(data.gains / data.km) : "—", "ganhos ÷ KM"], ["Custo por KM", data.km ? money(data.costs / data.km) : "—", "todos os custos ÷ KM"], [energyLabel() + "s", `${data.quantities.toLocaleString("pt-BR")} ${energyUnit()}`, `${fuel.length} lançamento(s) no mês`]]);
  document.querySelector("#uberFuelRows").innerHTML = fuel.length ? fuel.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => `<tr><td>${formatDate(item.date)}</td><td>${Number(item.quantity || 0).toLocaleString("pt-BR")} ${energyUnit()}</td><td class="negative">-${money(item.amount)}</td><td>${item.quantity ? money(item.amount / item.quantity) : "—"}</td><td>${item.km || "—"}</td></tr>`).join("") : emptyRow(5, `Nenhum lançamento de ${energyLabel().toLowerCase()} neste mês.`);
}
function renderHistory() { const months = new Set(Object.keys(uber().closings || {})); uber().entries.forEach((item) => months.add(monthKey(item.date))); document.querySelector("#uberHistoryCards").innerHTML = [...months].sort().reverse().map((key) => { const closed = uber().closings[key] || stats(key); return `<article class="uber-history-card"><span>${monthName(key)}</span><strong>${money(closed.gains)}</strong><small>Ganhos · ${money(closed.net)} resultado operacional</small><div><span>${closed.days || 0} dias</span><span>${Number(closed.km || 0).toLocaleString("pt-BR")} KM</span></div></article>`; }).join("") || '<p class="empty-state">O histórico aparecerá conforme houver lançamentos.</p>'; }
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
async function saveEntry(event) { event.preventDefault(); const form = event.currentTarget, type = form.elements.type.value, amount = parseCurrencyInput(form.elements.amount.value); const entry = { id: crypto.randomUUID(), date: form.elements.date.value, type, description: String(form.elements.description.value || "").trim() || (type === "gain" ? "Ganhos Uber" : type === "fuel" ? energyLabel() : ""), amount: type === "km" ? 0 : Math.abs(amount), quantity: Number(form.elements.quantity.value || 0), km: Number(form.elements.km.value || 0) }; if (!entry.date || (type !== "km" && !entry.amount) || (type === "fuel" && !entry.quantity) || ((type === "gain" || type === "fuel" || type === "km") && !entry.km)) return showToast("Preencha valor e KM atual para este lançamento.", "error"); uber().entries.push(entry); form.reset(); form.elements.date.value = isoToday(); selectType("gain"); await save("Lançamento Uber salvo."); }
async function saveConfig(event) { event.preventDefault(); config().vehicleType = event.currentTarget.elements.vehicleType.value; await save("Veículo atualizado."); }
async function toggleWeekday(day) { const days = new Set(config().workDays); days.has(day) ? days.delete(day) : days.add(day); config().workDays = [...days].sort((a, b) => a - b); syncAutomaticDays(); await save("Rotina de trabalho atualizada."); }
async function toggleDate(key) { const [year, month, day] = key.split("-").map(Number), date = new Date(year, month - 1, day), wasWorking = workDay(date), base = baseWorkDay(date); config().daysOff = config().daysOff.filter((item) => item !== key); config().extraWorkDays = config().extraWorkDays.filter((item) => item !== key); config().autoDaysOff = config().autoDaysOff.filter((item) => item !== key); if (!wasWorking && !base) config().extraWorkDays.push(key); else if (wasWorking && base) config().daysOff.push(key); await save("Exceção de rotina atualizada."); }
async function addGoal(event) { event.preventDefault(); const form = event.currentTarget, name = String(form.elements.name.value || "").trim(), amount = parseCurrencyInput(form.elements.amount.value); if (!name || !amount) return showToast("Informe custo e valor.", "error"); config().goals.push({ id: crypto.randomUUID(), name, amount }); form.reset(); await save("Custo Uber adicionado."); }
async function saveTargets(event) { event.preventDefault(); const form = event.currentTarget; config().withdrawal = parseCurrencyInput(form.elements.withdrawal.value); config().comfort = parseCurrencyInput(form.elements.comfort.value); await save("Metas Uber atualizadas."); }
async function deleteEntry(id) { uber().entries = uber().entries.filter((item) => item.id !== id); await save("Lançamento Uber excluído."); }
async function deleteGoal(id) { config().goals = config().goals.filter((item) => item.id !== id); await save("Custo Uber excluído."); }
async function closeMonth() { const key = monthKey(); uber().closings[key] = { ...stats(key), closedAt: new Date().toISOString() }; await save("Mês Uber fechado."); }
function simulate(event) { event?.preventDefault(); const form = document.querySelector("#uberSimulationForm"), days = Number(form.elements.days.value || 0), daily = parseCurrencyInput(form.elements.daily.value), costs = parseCurrencyInput(form.elements.costs.value); document.querySelector("#uberSimulationKpis").innerHTML = kpis([["Faturamento projetado", money(days * daily), `${days} dias × ${money(daily)}`], ["Custos previstos", money(costs), "cenário informado"], ["Sobra projetada", money(days * daily - costs), "após custos"]]); }
async function importBackup(event) { const file = event.target.files?.[0]; if (!file) return; try { const raw = JSON.parse(await file.text()), source = Array.isArray(raw) ? { dados: raw } : raw; const imported = (source.dados || []).map((item) => ({ id: String(item.id || crypto.randomUUID()), date: item.data, type: ({ ganho: "gain", gasolina: "fuel", despesas: "expense", km: "km", credito: "gain", debito: "expense" })[item.tipo] || "expense", description: item.descricao || "", amount: Math.abs(Number(item.valor || 0)), quantity: Number(item.litros || 0), km: Number(item.km || 0) })).filter((item) => item.date); const byId = new Map(uber().entries.map((item) => [item.id, item])); imported.forEach((item) => byId.set(item.id, item)); uber().entries = [...byId.values()]; const sourceConfig = source.config || {}; uber().config = { ...config(), vehicleType: sourceConfig.tipoVeiculo === "eletrico" ? "electric" : config().vehicleType, workDays: (sourceConfig.diasSemana || config().workDays).map((day) => Number(day) % 7), workHolidays: !!sourceConfig.trabalhoEmFeriados, daysOff: sourceConfig.diasFolgaExtra || config().daysOff, extraWorkDays: sourceConfig.diasTrabalhoExtra || config().extraWorkDays, autoDaysOff: sourceConfig.diasFolgaAutomatica || config().autoDaysOff, withdrawal: Number(sourceConfig.retiradaDesejada || config().withdrawal || 0), comfort: Number(sourceConfig.confortoDesejado || config().comfort || 0), goals: (sourceConfig.metas || config().goals).map((goal) => ({ id: String(goal.id || crypto.randomUUID()), name: goal.nome || goal.name, amount: Number(goal.valor || goal.amount || 0) })) }; await save(`${imported.length} lançamento(s) do Controle Uber importado(s).`); } catch { showToast("Não foi possível ler esse backup do Controle Uber.", "error"); } finally { event.target.value = ""; } }
