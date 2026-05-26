import { state, el } from "./state.js";
import { formatDate, formatCurrencyInput, parseCurrencyInput, todayIsoDate, nextMonths, addMonthsToDate, showToast } from "./utils.js";
import { getCreditorName, creditorLogoHtml } from "./creditors.js";
import { metric, carDebtCard, carInstallmentEconomy, carProgress } from "./components.js";
import { applyCashMovement } from "./controle.js";
import { carPaymentMonth } from "./planejamento.js";

export function renderCar() {
  ensureCarPayments();
  const car = state.data.car;
  el.carTitle.textContent = car.name || "Carro";

  const paid = car.payments.filter((item) => item.status === "Pago");
  const pending = car.payments.filter((item) => item.status !== "Pago");
  const financing = Number(car.monthly || 0) * Number(car.totalInstallments || 0);
  const paidValue = paid.reduce((total, item) => total + Number(item.paidAmount || 0), 0);
  const pendingValue = pending.reduce((total, item) => total + Number(item.value), 0);
  const economy = paid.reduce((total, item) => total + carInstallmentEconomy(item), 0);
  const realProjected = paidValue + pendingValue;
  const creditor = car.creditorId ? getCreditorName(car.creditorId) : "sem credor";

  el.carKpis.innerHTML = [
    metric("Credor", creditor, "neutral", false),
    metric("Valor financiado", Number(car.financed || 0), "neutral"),
    metric("Valor de compra", Number(car.purchase || 0), "neutral"),
    metric("Financiamento", financing, "negative"),
    metric("Real projetado", realProjected, "neutral"),
    metric("Valor pago", paidValue, "positive"),
    metric("Faltam", `${pending.length} parcelas`, "negative", false),
    metric("Falta pagar", -pendingValue, "negative"),
    metric("Economia", economy, economy > 0 ? "positive" : economy < 0 ? "negative" : "neutral")
  ].join("");
  el.carKpis.insertAdjacentHTML("beforeend", carProgress(paid.length, car.payments.length));

  el.carTable.innerHTML = car.payments.length
    ? carDebtCard(car)
    : `<div class="empty-state">Nenhum financiamento cadastrado.</div>`;

  el.carTable.querySelectorAll("[data-car-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.carFilter = button.dataset.carTab;
      renderCar();
    });
  });
  el.carTable.querySelectorAll("[data-pay-car]").forEach((button) => {
    button.addEventListener("click", () => openCarPaymentDialog(button.dataset.payCar));
  });
  el.carTable.querySelectorAll("[data-unpay-car]").forEach((button) => {
    button.addEventListener("click", () => unpayCarInstallment(button.dataset.unpayCar));
  });
}

export async function updateCar(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.car.name = String(form.get("name")).trim();
  state.data.car.creditorId = String(form.get("creditorId") || "");
  state.data.car.financed = parseCurrencyInput(form.get("financed"));
  state.data.car.purchase = parseCurrencyInput(form.get("purchase"));
  state.data.car.monthly = parseCurrencyInput(form.get("monthly"));
  state.data.car.totalInstallments = Number(form.get("totalInstallments") || state.data.car.totalInstallments);
  state.data.car.firstDueDate = String(form.get("firstDueDate") || "");
  syncCarPayments();
  el.carContractDialog.close();
  if (state.saveStateFn) await state.saveStateFn("Cadastro do carro atualizado.");
}

export function openCarContractDialog() {
  const car = state.data.car;
  el.carForm.elements.name.value = car.name || "";
  el.carForm.elements.creditorId.value = car.creditorId || el.carForm.elements.creditorId.value;
  el.carForm.elements.financed.value = formatCurrencyInput(car.financed || "");
  el.carForm.elements.purchase.value = formatCurrencyInput(car.purchase || "");
  el.carForm.elements.monthly.value = formatCurrencyInput(car.monthly || "");
  el.carForm.elements.totalInstallments.value = car.totalInstallments || "";
  el.carForm.elements.firstDueDate.value = car.firstDueDate || car.payments?.[0]?.dueDate || "";
  el.carContractDialog.showModal();
}

export function syncCarPayments() {
  const car = state.data.car;
  const total = Number(car.totalInstallments || 0);
  if (!total || !car.monthly) {
    car.payments = [];
    return;
  }
  const existing = new Map((car.payments || []).map((payment) => [Number(payment.number), payment]));
  const firstDueDate = car.firstDueDate || `${nextMonths(1)[0]}-01`;
  car.payments = Array.from({ length: total }, (_, index) => {
    const number = index + 1;
    const current = existing.get(number);
    const dueDate = addMonthsToDate(firstDueDate, index);
    const month = dueDate.slice(0, 7);
    if (current?.status === "Pago") return { ...current, number, dueDate, month };
    return {
      id: current?.id || crypto.randomUUID(),
      number,
      dueDate,
      month,
      value: car.monthly,
      paidAmount: 0,
      status: "Pendente"
    };
  });
}

export function ensureCarPayments() {
  const car = state.data.car || {};
  const total = Number(car.totalInstallments || 0);
  const monthly = Number(car.monthly || 0);
  if (!total || !monthly) return;
  const shouldSync = !Array.isArray(car.payments)
    || car.payments.length !== total
    || car.payments.some((payment) => !payment.dueDate && !payment.month)
    || car.payments.some((payment) => !Number(payment.value || 0));
  if (shouldSync) syncCarPayments();
}

export async function updateSettings(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.data.kahLimit = parseCurrencyInput(form.get("kahLimit"));
  if (state.saveStateFn) await state.saveStateFn("Preferências salvas.");
}

export function openCarPaymentDialog(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  el.carPaymentTitle.textContent = `Parcela ${payment.number}/${state.data.car.payments.length}`;
  el.carPaymentForm.elements.paymentId.value = payment.id;
  el.carPaymentForm.elements.paidAmount.value = formatCurrencyInput(payment.paidAmount || payment.value || "");
  el.carPaymentForm.elements.paymentDate.value = payment.paymentDate || todayIsoDate();
  el.carPaymentDialog.showModal();
}

export async function payCarInstallment(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const payment = state.data.car.payments.find((item) => item.id === String(form.get("paymentId")));
  if (!payment) return;
  payment.status = "Pago";
  payment.paidAmount = parseCurrencyInput(form.get("paidAmount")) || Number(payment.value || 0);
  payment.paymentDate = String(form.get("paymentDate") || todayIsoDate());
  markCarOccurrencePaid(payment);
  el.carPaymentDialog.close();
  if (state.saveStateFn) await state.saveStateFn("Parcela do carro paga.");
}

export async function unpayCarInstallment(id) {
  const payment = state.data.car.payments.find((item) => item.id === id);
  if (!payment) return;
  payment.status = "Pendente";
  payment.paidAmount = 0;
  payment.paymentDate = "";
  clearCarOccurrencePayment(payment);
  if (state.saveStateFn) await state.saveStateFn("Pagamento do carro removido.");
}

export function markCarOccurrencePaid(payment) {
  const month = carPaymentMonth(payment);
  const keys = [`auto-car:${month}`, `child-car|${payment.id}:${month}`];
  state.data.paidOccurrences = [...new Set([...(state.data.paidOccurrences || []), ...keys])];
  state.data.paidAmounts = { ...(state.data.paidAmounts || {}) };
  state.data.paidDates = { ...(state.data.paidDates || {}) };
  keys.forEach((key) => {
    state.data.paidAmounts[key] = Number(payment.paidAmount || payment.value || 0);
    state.data.paidDates[key] = payment.paymentDate || todayIsoDate();
  });
  applyCashMovement(keys[0], -Number(payment.paidAmount || payment.value || 0));
}

export function clearCarOccurrencePayment(payment) {
  const month = carPaymentMonth(payment);
  const keys = [`auto-car:${month}`, `child-car|${payment.id}:${month}`];
  state.data.paidOccurrences = (state.data.paidOccurrences || []).filter((key) => !keys.includes(key));
  keys.forEach((key) => {
    if (state.data.paidAmounts) delete state.data.paidAmounts[key];
    if (state.data.paidDates) delete state.data.paidDates[key];
  });
  applyCashMovement(keys[0], 0);
}
