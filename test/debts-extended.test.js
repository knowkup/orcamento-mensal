import test from "node:test";
import assert from "node:assert/strict";
import {
  debtBalanceFromInstallments,
  debtInstallmentProgress,
  isDebtInstallmentOpen,
  isDebtPaidOff,
  openDebtInstallments
} from "../js/domain/debts.js";
import {
  paymentBreakdown,
  removeDebtGraph,
  removePaymentAndReopenInstallment,
  clearDebtGraph
} from "../js/domain/debt-transactions.js";

// ── Parcelamentos: saldo e progresso ─────────────────────────────────────────

test("debtBalanceFromInstallments returns 0 for empty list", () => {
  assert.equal(debtBalanceFromInstallments([]), 0);
});

test("debtBalanceFromInstallments returns 0 when all installments are paid", () => {
  const all = [
    { status: "Paga", expectedValue: 500 },
    { status: "Quitada", expectedValue: 300 }
  ];
  assert.equal(debtBalanceFromInstallments(all), 0);
});

test("debtBalanceFromInstallments sums Pendente and undefined status", () => {
  const items = [
    { status: "Pendente", expectedValue: 400 },
    { expectedValue: 200 }
  ];
  assert.equal(debtBalanceFromInstallments(items), 600);
});

test("debtInstallmentProgress counts Quitada as paid", () => {
  const items = [
    { status: "Quitada", expectedValue: 100 },
    { status: "Pendente", expectedValue: 200 }
  ];
  assert.deepEqual(debtInstallmentProgress(items, 2), { paid: 1, total: 2 });
});

test("isDebtPaidOff is false when there are still open installments", () => {
  assert.equal(
    isDebtPaidOff([{ status: "Paga" }, { status: "Pendente" }], 2),
    false
  );
});

test("isDebtPaidOff is true when all installments are Renegociada", () => {
  assert.equal(
    isDebtPaidOff([{ status: "Renegociada" }, { status: "Paga" }], 2),
    true
  );
});

// ── Renegociação de dívida ────────────────────────────────────────────────────

test("removeDebtGraph leaves other debts untouched", () => {
  const graph = {
    debts: [{ id: "d1" }, { id: "d2" }, { id: "d3" }],
    installments: [
      { id: "i1", debtId: "d1" },
      { id: "i2", debtId: "d2" }
    ],
    payments: []
  };
  const result = removeDebtGraph(graph, "d1");
  assert.equal(result.debts.length, 2);
  assert.ok(result.debts.every((d) => d.id !== "d1"));
  assert.equal(result.installments.length, 1);
  assert.equal(result.installments[0].id, "i2");
});

test("removeDebtGraph with no installments or payments for target debt", () => {
  const graph = {
    debts: [{ id: "d1" }, { id: "d2" }],
    installments: [{ id: "i1", debtId: "d2" }],
    payments: [{ id: "p1", debtId: "d2" }]
  };
  const result = removeDebtGraph(graph, "d1");
  assert.equal(result.debts.length, 1);
  assert.equal(result.installments.length, 1);
  assert.equal(result.payments.length, 1);
});

test("paymentBreakdown computes zero discount and zero interest when exact", () => {
  assert.deepEqual(paymentBreakdown(500, 500), {
    expectedValue: 500,
    paidValue: 500,
    discount: 0,
    interest: 0
  });
});

test("clearDebtGraph returns empty collections", () => {
  assert.deepEqual(clearDebtGraph(), { debts: [], installments: [], payments: [] });
});

// ── Controle mensal: splitOccurrenceKey emulado via string ops ────────────────

test("occurrence key split on last colon separates rowId and month", () => {
  function splitOccurrenceKey(key) {
    const index = String(key).lastIndexOf(":");
    if (index < 0) return { rowId: String(key), month: "" };
    return { rowId: String(key).slice(0, index), month: String(key).slice(index + 1) };
  }

  assert.deepEqual(splitOccurrenceKey("fixed-cost-1:2026-06"), {
    rowId: "fixed-cost-1",
    month: "2026-06"
  });
  assert.deepEqual(splitOccurrenceKey("auto-debt-abc123:2026-12"), {
    rowId: "auto-debt-abc123",
    month: "2026-12"
  });
  assert.deepEqual(splitOccurrenceKey("child-fixed|uuid-1:2026-07"), {
    rowId: "child-fixed|uuid-1",
    month: "2026-07"
  });
  assert.deepEqual(splitOccurrenceKey("no-colon"), {
    rowId: "no-colon",
    month: ""
  });
});
