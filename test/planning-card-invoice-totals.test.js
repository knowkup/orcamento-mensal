import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => []
};
globalThis.window = {};

const { createDefaultData } = await import("../js/data.js");
const { state } = await import("../js/state.js");
const { buildTotals } = await import("../js/planejamento/planejamento.js");

test("does not count a paid consolidated card invoice again in planning", () => {
  const month = "2026-10";
  state.data = {
    ...createDefaultData(),
    accountBalance: 100,
    paidAmounts: {
      "auto-card-invoice|card-1|2026-10-10:2026-10": 300
    }
  };

  const rows = [
    { id: "income", kind: "income", values: { [month]: 500 } },
    {
      id: "auto-fixed-card-1",
      kind: "expense",
      cardId: "card-1",
      values: { [month]: 100 },
      dueDates: { [month]: "2026-10-10" },
      children: { [month]: [{ key: "fixed:2026-10", value: 100 }] }
    },
    {
      id: "auto-installments-card-1",
      kind: "expense",
      cardId: "card-1",
      values: { [month]: 200 },
      dueDates: { [month]: "2026-10-10" },
      children: { [month]: [{ key: "installment:2026-10", value: 200 }] }
    }
  ];

  assert.deepEqual(buildTotals(rows, [month]), [{
    month,
    income: 500,
    expense: 0,
    balance: 500,
    accumulated: 600
  }]);
});
