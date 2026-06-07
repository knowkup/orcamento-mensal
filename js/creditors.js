import { state } from "./state.js";
import { state as debtState } from "./dividas/state.js";
import { escapeHtml, icon } from "./utils.js";
import { initialsFromText } from "./domain/value-utils.js";

export function getCreditorName(id) {
  return state.data.creditors.find((creditor) => creditor.id === id)?.name || id || "Credor";
}

export function getCreditor(id) {
  return state.data.creditors.find((creditor) => creditor.id === id) || null;
}

export function getCreditCard(id) {
  return state.data.creditCards.find((card) => card.id === id) || null;
}

export function sortedCreditors() {
  return [...state.data.creditors].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

export function sortedCreditCards() {
  return [...state.data.creditCards].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
}

export function getInstallmentCard(item) {
  const card = item.cardId ? getCreditCard(item.cardId) : null;
  if (card) return { ...card, real: true };
  const creditorId = item.creditorId || "";
  const owner = item.owner || "Felipe";
  return {
    id: `legacy-${creditorId || "sem-credor"}-${owner}`.replaceAll(/\s+/g, "-"),
    name: `${getCreditorName(creditorId)} ${owner}`.trim(),
    creditorId,
    owner,
    real: false
  };
}

export function initials(value) {
  return initialsFromText(value);
}

export function creditorLogoHtml(id) {
  const creditor = getCreditor(id);
  const name = creditor?.name || id || "?";
  if (creditor?.logoUrl) {
    return `<span class="creditor-logo"><img alt="${escapeHtml(name)}" src="${escapeHtml(creditor.logoUrl)}"></span>`;
  }
  return `<span class="creditor-logo">${escapeHtml(initials(name))}</span>`;
}

export function sourceLogoHtml(src, name) {
  const label = name || "?";
  if (src) {
    return `<span class="creditor-logo"><img alt="${escapeHtml(label)}" src="${escapeHtml(src)}"></span>`;
  }
  return `<span class="creditor-logo">${escapeHtml(initials(label))}</span>`;
}

export function creditorUsageCount(id) {
  return state.data.creditCards.filter((card) => card.creditorId === id).length
    + state.data.installments.filter((item) => item.creditorId === id).length
    + state.data.fixedCosts.filter((item) => item.creditorId === id).length
    + state.data.plannedPurchases.filter((item) => item.creditorId === id).length
    + state.data.fgts.contracts.filter((item) => item.creditorId === id).length
    + (state.data.car.creditorId === id ? 1 : 0)
    + state.data.projectionLines.filter((item) => item.creditorId === id || item.match === id).length
    + debtState.debts.filter((item) => item.creditorId === id).length;
}

function _fgtsPendingTotalForCreditor(contract) {
  const installments = contract.installments || [];
  return installments
    .filter((item) => item.status !== "Pago")
    .reduce((total, item) => total + Number(item.amount || 0), 0);
}

export function creditorOpenBalance(id) {
  const installments = state.data.installments
    .filter((item) => getInstallmentCard(item).creditorId === id)
    .reduce((total, item) => total + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
  const fgts = state.data.fgts.contracts
    .filter((item) => item.creditorId === id)
    .reduce((total, item) => total + _fgtsPendingTotalForCreditor(item), 0);
  return installments + fgts;
}

export function cardOpenBalance(id) {
  return state.data.installments
    .filter((item) => getInstallmentCard(item).id === id)
    .reduce((total, item) => total + Number(item.amount || 0) * Math.max(0, Number(item.totalInstallments || 0) - Number(item.paidInstallments || 0)), 0);
}

export function isCreditCardInUse(id) {
  return state.data.installments.some((item) => getInstallmentCard(item).id === id);
}

export function ownerForCreditor(creditorId) {
  const candidates = [
    ...state.data.installments,
    ...state.data.creditCards,
    ...state.data.fixedCosts,
    ...state.data.plannedPurchases
  ].filter((item) => item.creditorId === creditorId);
  return candidates.find((item) => item.owner === "Kah") ? "Kah" : "Felipe";
}

export function ownerRank(owner) {
  return owner === "Kah" ? 0 : 1;
}
