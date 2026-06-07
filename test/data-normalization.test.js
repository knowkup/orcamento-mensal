import test from "node:test";
import assert from "node:assert/strict";
import {
  getCreditorNameFromList,
  normalizedIncomeChanges,
  buildCardsFromInstallments,
  migrateCashMovements,
  normalizeData,
  createDefaultData
} from "../js/data.js";

// ── getCreditorNameFromList ───────────────────────────────────────────────────

test("getCreditorNameFromList returns creditor name when found", () => {
  const creditors = [{ id: "c1", name: "Nubank" }, { id: "c2", name: "Itaú" }];
  assert.equal(getCreditorNameFromList("c1", creditors), "Nubank");
});

test("getCreditorNameFromList returns the id when not found", () => {
  assert.equal(getCreditorNameFromList("unknown", []), "unknown");
});

test("getCreditorNameFromList returns 'Credor' for null/empty id", () => {
  assert.equal(getCreditorNameFromList(null, []), "Credor");
  assert.equal(getCreditorNameFromList("", []), "Credor");
});

// ── normalizedIncomeChanges ───────────────────────────────────────────────────

test("normalizedIncomeChanges falls back to startMonth and amount when changes is empty", () => {
  const income = { startMonth: "2026-01", amount: 5000 };
  const result = normalizedIncomeChanges(income);
  assert.equal(result.length, 1);
  assert.equal(result[0].month, "2026-01");
  assert.equal(result[0].amount, 5000);
});

test("normalizedIncomeChanges uses explicit changes array when present", () => {
  const income = {
    changes: [
      { month: "2026-03", amount: 6000 },
      { month: "2026-01", amount: 5000 }
    ]
  };
  const result = normalizedIncomeChanges(income);
  assert.equal(result.length, 2);
  assert.equal(result[0].month, "2026-01");
  assert.equal(result[1].month, "2026-03");
});

test("normalizedIncomeChanges filters out entries without a month", () => {
  const income = {
    changes: [
      { month: "2026-06", amount: 4000 },
      { month: "", amount: 999 },
      { amount: 888 }
    ]
  };
  const result = normalizedIncomeChanges(income);
  assert.equal(result.length, 1);
  assert.equal(result[0].month, "2026-06");
});

test("normalizedIncomeChanges coerces amount to number", () => {
  const income = { changes: [{ month: "2026-06", amount: "3500.50" }] };
  const result = normalizedIncomeChanges(income);
  assert.equal(result[0].amount, 3500.5);
});

// ── buildCardsFromInstallments ────────────────────────────────────────────────

test("buildCardsFromInstallments creates one card per unique creditor/owner/method", () => {
  const installments = [
    { creditorId: "c1", owner: "Felipe", paymentMethod: "Cartão de crédito" },
    { creditorId: "c1", owner: "Felipe", paymentMethod: "Cartão de crédito" },
    { creditorId: "c2", owner: "Felipe", paymentMethod: "Cartão de crédito" }
  ];
  const cards = buildCardsFromInstallments(installments, [], new Map());
  assert.equal(cards.length, 2);
});

test("buildCardsFromInstallments skips installments without creditorId or origin", () => {
  const installments = [{ owner: "Felipe", paymentMethod: "Cartão de crédito" }];
  const cards = buildCardsFromInstallments(installments, [], new Map());
  assert.equal(cards.length, 0);
});

test("buildCardsFromInstallments resolves creditorId from creditorByName map", () => {
  const installments = [{ origin: "Nubank", owner: "Felipe", paymentMethod: "Cartão de crédito" }];
  const creditorByName = new Map([["Nubank", "c1"]]);
  const cards = buildCardsFromInstallments(installments, [], creditorByName);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].creditorId, "c1");
});

// ── migrateCashMovements ──────────────────────────────────────────────────────

test("migrateCashMovements adds received amounts to accountBalance", () => {
  const data = {
    accountBalance: 1000,
    receivedOccurrences: ["inc-1:2026-06"],
    paidOccurrences: [],
    receivedAmounts: { "inc-1:2026-06": 500 },
    paidAmounts: {}
  };
  migrateCashMovements(data);
  assert.equal(data.accountBalance, 1500);
  assert.deepEqual(data.appliedCashMovements, { "inc-1:2026-06": 500 });
});

test("migrateCashMovements subtracts paid amounts from accountBalance", () => {
  const data = {
    accountBalance: 2000,
    receivedOccurrences: [],
    paidOccurrences: ["exp-1:2026-06"],
    receivedAmounts: {},
    paidAmounts: { "exp-1:2026-06": 300 }
  };
  migrateCashMovements(data);
  assert.equal(data.accountBalance, 1700);
  assert.deepEqual(data.appliedCashMovements, { "exp-1:2026-06": -300 });
});

test("migrateCashMovements skips paid occurrences prefixed with child-car|", () => {
  const data = {
    accountBalance: 1000,
    receivedOccurrences: [],
    paidOccurrences: ["child-car|payment-1:2026-06"],
    receivedAmounts: {},
    paidAmounts: { "child-car|payment-1:2026-06": 200 }
  };
  migrateCashMovements(data);
  assert.equal(data.accountBalance, 1000);
  assert.deepEqual(data.appliedCashMovements, {});
});

// ── normalizeData ─────────────────────────────────────────────────────────────

test("normalizeData returns createDefaultData for schemaVersion below 3", () => {
  const result = normalizeData({ schemaVersion: 2 });
  assert.equal(result.schemaVersion, 3);
  assert.deepEqual(result.creditors, []);
});

test("normalizeData returns createDefaultData for null input", () => {
  const result = normalizeData(null);
  assert.equal(result.schemaVersion, 3);
});

test("normalizeData fills missing array fields with empty arrays", () => {
  const minimal = { schemaVersion: 3 };
  const result = normalizeData(minimal);
  assert.ok(Array.isArray(result.creditors));
  assert.ok(Array.isArray(result.fixedCosts));
  assert.ok(Array.isArray(result.installments));
  assert.ok(Array.isArray(result.plannedPurchases));
});

test("normalizeData preserves existing creditors", () => {
  const data = {
    schemaVersion: 3,
    creditors: [{ id: "c1", name: "Nubank", paymentForms: ["PIX"] }]
  };
  const result = normalizeData(data);
  assert.equal(result.creditors.length, 1);
  assert.equal(result.creditors[0].name, "Nubank");
});
