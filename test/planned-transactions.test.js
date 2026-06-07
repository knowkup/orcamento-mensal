import test from "node:test";
import assert from "node:assert/strict";
import { removeManualPlanned } from "../js/domain/planned-transactions.js";

test("removes a manual expense and every linked occurrence", () => {
  const data = {
    initialBalance: 100,
    accountBalance: 70,
    incomeLines: [],
    plannedPurchases: [{ id: "plan-1" }, { id: "plan-2" }],
    receivedOccurrences: [],
    paidOccurrences: ["plan-1:2026-06", "plan-2:2026-06"],
    receivedAmounts: {},
    paidAmounts: { "plan-1:2026-06": 30, "plan-2:2026-06": 10 },
    paidDates: { "plan-1:2026-06": "2026-06-06" },
    appliedCashMovements: { "plan-1:2026-06": -30, "plan-2:2026-06": -10 }
  };

  const result = removeManualPlanned(data, "plan-1");

  assert.deepEqual(result.plannedPurchases, [{ id: "plan-2" }]);
  assert.deepEqual(result.paidOccurrences, ["plan-2:2026-06"]);
  assert.equal(result.paidAmounts["plan-1:2026-06"], undefined);
  assert.equal(result.paidDates["plan-1:2026-06"], undefined);
  assert.equal(result.appliedCashMovements["plan-1:2026-06"], undefined);
  assert.equal(result.accountBalance, 100);
  assert.equal(data.plannedPurchases.length, 2);
});

test("removes a received manual income and reverses its cash movement", () => {
  const data = {
    initialBalance: 100,
    accountBalance: 250,
    incomeLines: [{ id: "income-1" }],
    plannedPurchases: [],
    receivedOccurrences: ["income-1:2026-06"],
    paidOccurrences: [],
    receivedAmounts: { "income-1:2026-06": 150 },
    paidAmounts: {},
    paidDates: {},
    appliedCashMovements: { "income-1:2026-06": 150 }
  };

  const result = removeManualPlanned(data, "income-1");

  assert.deepEqual(result.incomeLines, []);
  assert.deepEqual(result.receivedOccurrences, []);
  assert.equal(result.receivedAmounts["income-1:2026-06"], undefined);
  assert.equal(result.accountBalance, 100);
});
