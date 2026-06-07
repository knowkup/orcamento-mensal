import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectionTotals,
  plannedInstallmentMonths,
  valuesFromMonthlyMap
} from "../js/domain/projection.js";

test("reads explicit, legacy month and default projection values", () => {
  assert.deepEqual(
    valuesFromMonthlyMap(
      { "2026-06": 10, "month-7": 20, default: 30 },
      ["2026-06", "2026-07", "2026-08"]
    ),
    { "2026-06": 10, "2026-07": 20, "2026-08": 30 }
  );
});

test("expands planned installments preserving end-of-month dates", () => {
  assert.deepEqual(
    plannedInstallmentMonths({ date: "2026-01-31", installments: 3 }),
    ["2026-01", "2026-02", "2026-03"]
  );
});

test("calculates monthly and accumulated projection totals", () => {
  const rows = [
    { kind: "income", values: { "2026-06": 1000, "2026-07": 1200 } },
    { kind: "expense", values: { "2026-06": 400, "2026-07": 500 } }
  ];

  assert.deepEqual(buildProjectionTotals(rows, ["2026-06", "2026-07"], 100), [
    { month: "2026-06", income: 1000, expense: 400, balance: 600, accumulated: 700 },
    { month: "2026-07", income: 1200, expense: 500, balance: 700, accumulated: 1400 }
  ]);
});

test("accepts outstanding value readers without coupling the domain to UI state", () => {
  const rows = [
    { kind: "income", values: { "2026-06": 1000 }, received: true },
    { kind: "expense", values: { "2026-06": 500 }, paid: 200 }
  ];
  const totals = buildProjectionTotals(rows, ["2026-06"], 0, {
    incomeValue: (row, month) => row.received ? 0 : row.values[month],
    expenseValue: (row, month) => row.values[month] - row.paid
  });

  assert.deepEqual(totals[0], {
    month: "2026-06",
    income: 0,
    expense: 300,
    balance: -300,
    accumulated: -300
  });
});
