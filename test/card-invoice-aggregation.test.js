import test from "node:test";
import assert from "node:assert/strict";
import { consolidateCardInvoices } from "../js/domain/card-invoice-aggregation.js";

function invoicePart(id, cardId, dueDate, value, children = []) {
  return {
    id,
    kind: "expense",
    cardId,
    label: "Cartao Nubank Felipe",
    values: { "2026-10": value },
    dueDates: { "2026-10": dueDate },
    children: { "2026-10": children }
  };
}

test("consolidates fixed costs and installments from the same card invoice", () => {
  const fixed = invoicePart("auto-fixed-card-1", "card-1", "2026-10-10", 176, [{ key: "fixed:2026-10", value: 176 }]);
  const installments = invoicePart("auto-installments-card-1", "card-1", "2026-10-10", 2628.5,
    Array.from({ length: 9 }, (_, index) => ({ key: `installment-${index}:2026-10`, value: 292.05 })));

  const result = consolidateCardInvoices([fixed, installments], "2026-10");

  assert.equal(result.length, 1);
  assert.equal(result[0].values["2026-10"], 2804.5);
  assert.equal(result[0].children["2026-10"].length, 10);
  assert.deepEqual(result[0].sourceRows["2026-10"].map((row) => row.id), [fixed.id, installments.id]);
});

test("does not consolidate invoices from different due dates or cards", () => {
  const currentInvoice = invoicePart("auto-fixed-card-1", "card-1", "2026-10-10", 176);
  const nextInvoice = invoicePart("auto-installments-card-1", "card-1", "2026-10-11", 2628.5);
  const otherCard = invoicePart("auto-installments-card-2", "card-2", "2026-10-10", 300);

  assert.equal(consolidateCardInvoices([currentInvoice, nextInvoice, otherCard], "2026-10").length, 3);
});
