import test from "node:test";
import assert from "node:assert/strict";
import { hasIncomeReceipt, incomeOutstandingAmount, incomeReceivedAmount } from "../js/domain/income-receipts.js";

test("sums partial income receipts and keeps the remaining balance open", () => {
  const data = {
    receivedPayments: {
      "income-1:2026-08": [
        { amount: 250, date: "2026-08-05" },
        { amount: 300, date: "2026-08-12" }
      ]
    }
  };

  assert.equal(incomeReceivedAmount(data, "income-1:2026-08", 1000), 550);
  assert.equal(incomeOutstandingAmount(data, "income-1:2026-08", 1000), 450);
  assert.equal(hasIncomeReceipt(data, "income-1:2026-08"), true);
});

test("reads older completed receipts stored only as receivedAmounts", () => {
  const data = { receivedAmounts: { "income-1:2026-08": 1000 } };
  assert.equal(incomeReceivedAmount(data, "income-1:2026-08", 1000), 1000);
  assert.equal(incomeOutstandingAmount(data, "income-1:2026-08", 1000), 0);
});

test("a receipt explicitly marked complete has no balance pending even below the estimate", () => {
  const data = {
    receivedOccurrences: ["income-1:2026-08"],
    receivedAmounts: { "income-1:2026-08": 700 }
  };
  assert.equal(incomeOutstandingAmount(data, "income-1:2026-08", 1000), 0);
});
