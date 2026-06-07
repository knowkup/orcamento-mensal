import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectionTotals,
  plannedInstallmentMonths,
  valuesFromMonthlyMap
} from "../js/domain/projection.js";

test("valuesFromMonthlyMap returns 0 for months not in map", () => {
  assert.deepEqual(
    valuesFromMonthlyMap({}, ["2026-06", "2026-07"]),
    { "2026-06": 0, "2026-07": 0 }
  );
});

test("valuesFromMonthlyMap handles null map gracefully", () => {
  assert.deepEqual(
    valuesFromMonthlyMap(null, ["2026-06"]),
    { "2026-06": 0 }
  );
});

test("valuesFromMonthlyMap resolves month-12 key correctly", () => {
  assert.deepEqual(
    valuesFromMonthlyMap({ "month-12": 999 }, ["2026-12"]),
    { "2026-12": 999 }
  );
});

test("valuesFromMonthlyMap prefers explicit year-month over month-N", () => {
  assert.deepEqual(
    valuesFromMonthlyMap({ "2026-06": 100, "month-6": 200, default: 300 }, ["2026-06"]),
    { "2026-06": 100 }
  );
});

test("plannedInstallmentMonths uses item.month when item.date is missing", () => {
  assert.deepEqual(
    plannedInstallmentMonths({ month: "2026-03", installments: 2 }),
    ["2026-03", "2026-04"]
  );
});

test("plannedInstallmentMonths defaults to 1 installment when field is absent", () => {
  assert.deepEqual(
    plannedInstallmentMonths({ date: "2026-06-15" }),
    ["2026-06"]
  );
});

test("buildProjectionTotals returns empty array for empty months list", () => {
  const rows = [{ kind: "income", values: { "2026-06": 500 } }];
  assert.deepEqual(buildProjectionTotals(rows, [], 0), []);
});

test("buildProjectionTotals with no income/expense rows yields zero per month", () => {
  assert.deepEqual(buildProjectionTotals([], ["2026-06", "2026-07"], 100), [
    { month: "2026-06", income: 0, expense: 0, balance: 0, accumulated: 100 },
    { month: "2026-07", income: 0, expense: 0, balance: 0, accumulated: 100 }
  ]);
});

test("buildProjectionTotals accumulates negative balance correctly", () => {
  const rows = [
    { kind: "expense", values: { "2026-06": 300, "2026-07": 200 } }
  ];
  const totals = buildProjectionTotals(rows, ["2026-06", "2026-07"], 500);
  assert.equal(totals[0].accumulated, 200);
  assert.equal(totals[1].accumulated, 0);
});

test("buildProjectionTotals ignores rows of unknown kind", () => {
  const rows = [
    { kind: "income", values: { "2026-06": 1000 } },
    { kind: "other", values: { "2026-06": 9999 } }
  ];
  const totals = buildProjectionTotals(rows, ["2026-06"], 0);
  assert.equal(totals[0].income, 1000);
  assert.equal(totals[0].expense, 0);
});
