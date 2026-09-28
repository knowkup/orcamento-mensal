import test from "node:test";
import assert from "node:assert/strict";
import {
  fixedCostAdditionAmount,
  fixedCostAdditionStorageKey,
  fixedCostBaseValue,
  fixedCostMonthlyValue
} from "../js/domain/fixed-cost-additions.js";

test("keeps a fixed-cost addition limited to its own month", () => {
  const additions = { "gasolina:2026-10": 300 };

  assert.equal(fixedCostAdditionStorageKey("gasolina", "2026-10"), "gasolina:2026-10");
  assert.equal(fixedCostAdditionAmount(additions, "gasolina", "2026-10"), 300);
  assert.equal(fixedCostAdditionAmount(additions, "gasolina", "2026-11"), 0);
});

test("adds the monthly addition without changing the recurring base", () => {
  const cost = { id: "gasolina", amount: 1600 };
  const additions = { "gasolina:2026-10": 300 };

  assert.equal(fixedCostMonthlyValue(cost, {}, additions, "2026-10"), 1900);
  assert.equal(fixedCostMonthlyValue(cost, {}, additions, "2026-11"), 1600);
});

test("combines a monthly value adjustment with its addition", () => {
  const cost = { id: "gasolina", amount: 1600 };

  assert.equal(
    fixedCostMonthlyValue(cost, { "gasolina:2026-10": 1500 }, { "gasolina:2026-10": 300 }, "2026-10"),
    1800
  );
  assert.equal(fixedCostBaseValue(cost, { "gasolina:2026-10": 1500 }, "2026-10"), 1500);
});
