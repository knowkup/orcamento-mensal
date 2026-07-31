import test from "node:test";
import assert from "node:assert/strict";
import { accountBalanceAtMonthEnd } from "../js/domain/closed-months.js";

test("keeps a closed month balance free from movements registered in later months", () => {
  const data = {
    accountBalance: 1300,
    appliedCashMovements: {
      "income-july:2026-07": 500,
      "card-august:2026-08": -200
    }
  };

  assert.equal(accountBalanceAtMonthEnd(data, "2026-07"), 1500);
});
