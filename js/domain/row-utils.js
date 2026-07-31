/**
 * Utilitários de linha compartilhados entre planejamento e controle.
 * Extraído para quebrar a dependência circular planejamento ↔ controle.
 */
import { paidOutstandingAmount, receivedOutstandingAmount } from "../utils.js";
import { ownerRank } from "../creditors.js";

export function firstDueDate(children = []) {
  return children
    .map((item) => item.dueDate)
    .filter(Boolean)
    .sort()[0] || "";
}

export function rowDueDate(row, month) {
  return row.dueDates?.[month] || firstDueDate(row.children?.[month]) || `${month}-01`;
}

export function compareRowsByDueDate(a, b, month) {
  return rowDueDate(a, month).localeCompare(rowDueDate(b, month))
    || ownerRank(a.owner) - ownerRank(b.owner)
    || String(a.origin || "").localeCompare(String(b.origin || ""), "pt-BR");
}

export function rowOutstanding(row, month, value) {
  const key = `${row.id}:${month}`;
  const children = row.children?.[month] || [];
  if (children.length) {
    return children.reduce((total, item) => (
      total + paidOutstandingAmount(item.key, item.value)
    ), 0);
  }
  return paidOutstandingAmount(key, value);
}

export function rowIncomeOutstanding(row, month, value) {
  const key = `${row.id}:${month}`;
  return receivedOutstandingAmount(key, value);
}
