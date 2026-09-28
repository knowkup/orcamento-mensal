import test from "node:test";
import assert from "node:assert/strict";
import { expensePaymentEntries, expenseOutstandingAmount, expensePaidAmount, hasExpensePayment } from "../js/domain/expense-payments.js";

test("exposes each recorded payment and keeps legacy data compatible", () => {
  assert.deepEqual(
    expensePaymentEntries({ expensePayments: { "card-1:2026-08": [{ amount: 250, date: "2026-08-05" }] } }, "card-1:2026-08"),
    [{ amount: 250, date: "2026-08-05" }]
  );
  assert.deepEqual(
    expensePaymentEntries({ paidAmounts: { "card-1:2026-08": 250 }, paidDates: { "card-1:2026-08": "2026-08-05" } }, "card-1:2026-08"),
    [{ amount: 250, date: "2026-08-05" }]
  );
});

test("sums partial expense payments and keeps the unpaid balance open", () => {
  const data = {
    expensePayments: {
      "card-1:2026-08": [
        { amount: 250, date: "2026-08-05" },
        { amount: 300, date: "2026-08-12" }
      ]
    }
  };

  assert.equal(expensePaidAmount(data, "card-1:2026-08", 1000), 550);
  assert.equal(expenseOutstandingAmount(data, "card-1:2026-08", 1000), 450);
  assert.equal(hasExpensePayment(data, "card-1:2026-08"), true);
});

test("a payment explicitly marked complete has no balance pending even below the estimate", () => {
  const data = {
    paidOccurrences: ["card-1:2026-08"],
    paidAmounts: { "card-1:2026-08": 700 }
  };
  assert.equal(expenseOutstandingAmount(data, "card-1:2026-08", 1000), 0);
});
