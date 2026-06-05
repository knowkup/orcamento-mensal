import { state, el, currency, monthLabel, monthLabelLong } from "./state.js";

export function nextMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function currentMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function previousMonths(count) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

export function nextAnnualDate() {
  const now = new Date();
  const date = new Date(now.getFullYear() + 1, 5, 28);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addYearsToDate(value, years) {
  const [year, month, day] = String(value || nextAnnualDate()).split("-").map(Number);
  const date = new Date(year + years, (month || 1) - 1, day || 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addMonthsToDate(value, months) {
  const [year, month, day] = String(value || todayIsoDate()).slice(0, 10).split("-").map(Number);
  const date = new Date(year, (month || 1) - 1 + months, day || 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function monthDayDate(month, day) {
  const [year, monthNumber] = String(month).split("-").map(Number);
  if (!year || !monthNumber) return "";
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const safeDay = Math.min(Math.max(1, Number(day || 1)), lastDay);
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

export function installmentDueDate(value, monthOffset) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(year, month + monthOffset, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatMonth(month) {
  const [year, value] = month.split("-").map(Number);
  return monthLabel.format(new Date(year, value - 1, 1)).replace(".", "");
}

export function formatMonthLong(month) {
  const [year, value] = month.split("-").map(Number);
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, value - 1, 1));
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase() + " de " + year;
}

export function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "-";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

export function compactCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

export function parseCurrencyInput(value) {
  const text = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!text) return 0;
  if (text.includes(",")) return Number(text.replaceAll(".", "").replace(",", ".")) || 0;
  return Number(text) || 0;
}

export function formatCurrencyInput(value) {
  const number = typeof value === "number" ? value : parseCurrencyInput(value);
  return number ? currency.format(number).replace("R$", "").trim() : "";
}

export function bindMoneyInputs(root = document) {
  root.querySelectorAll("[data-money-input]").forEach((input) => {
    if (input.dataset.moneyBound) return;
    input.dataset.moneyBound = "true";
    input.addEventListener("blur", () => {
      input.value = formatCurrencyInput(input.value);
    });
    input.addEventListener("input", () => {
      input.value = input.value.replace(/[^\d,.-]/g, "");
    });
  });
}

export function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
}

export function dateTimeKey(value = new Date()) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
    "-",
    String(value.getHours()).padStart(2, "0"),
    String(value.getMinutes()).padStart(2, "0")
  ].join("");
}

export function todayIsoDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatTime(value = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(value);
}

export function updateSync(title, text, status = "online") {
  const tone = typeof status === "boolean" ? (status ? "online" : "offline") : status;
  if (el.syncPanel) {
    el.syncPanel.dataset.status = tone;
    el.syncPanel.title = `${title}: ${text}`;
  }
  if (el.syncTitle) el.syncTitle.textContent = title;
  if (el.syncText) el.syncText.textContent = text;
  if (el.syncDot) {
    el.syncDot.classList.toggle("offline", tone === "offline");
    el.syncDot.classList.toggle("syncing", tone === "syncing");
    el.syncDot.classList.toggle("error", tone === "error");
  }
}

export function showToast(message, tone = "info") {
  if (!el.toast) return;
  const live = tone === "error" ? "assertive" : "polite";
  el.toast.textContent = message;
  el.toast.dataset.tone = tone;
  el.toast.setAttribute("role", tone === "error" ? "alert" : "status");
  el.toast.setAttribute("aria-live", live);
  el.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.toast.classList.remove("show"), 2500);
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

export function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function syncProjectionTopScroll() {
  if (!el.projectionTable || !el.projectionTopScroll) return;
  const inner = el.projectionTopScroll.firstElementChild;
  if (inner) inner.style.width = `${el.projectionTable.scrollWidth}px`;
}

export function isOccurrencePaid(key) {
  return (state.data.paidOccurrences || []).includes(key);
}

export function paidAmount(key, fallback) {
  return Number(state.data.paidAmounts?.[key] ?? fallback ?? 0);
}

export function isIncomeReceived(key) {
  return (state.data.receivedOccurrences || []).includes(key);
}

export function receivedAmount(key, fallback) {
  return Number(state.data.receivedAmounts?.[key] ?? fallback ?? 0);
}
