import test from "node:test";
import assert from "node:assert/strict";
import { createBackupEnvelope, readBackupPayload, summarizeBackup } from "../js/domain/backup.js";

const validData = {
  schemaVersion: 3,
  creditors: [],
  creditCards: [],
  incomeLines: [],
  recurringIncomes: [],
  projectionLines: [],
  installments: [],
  fixedCosts: [],
  plannedPurchases: []
};

// ── Serialização e ciclo de importação ───────────────────────────────────────

test("backup envelope round-trip preserves data reference", () => {
  const envelope = createBackupEnvelope(validData);
  assert.equal(readBackupPayload(envelope), validData);
});

test("readBackupPayload rejects array input", () => {
  assert.throws(() => readBackupPayload([]), /valido/);
});

test("readBackupPayload rejects string input", () => {
  assert.throws(() => readBackupPayload("{}"), /valido/);
});

test("readBackupPayload rejects schemaVersion === 0", () => {
  assert.throws(() => readBackupPayload({ schemaVersion: 0 }), /versao antiga/);
});

test("readBackupPayload accepts data with all optional arrays absent", () => {
  const minimal = { schemaVersion: 3 };
  assert.equal(readBackupPayload(minimal), minimal);
});

test("readBackupPayload rejects non-array creditCards", () => {
  assert.throws(
    () => readBackupPayload({ ...validData, creditCards: {} }),
    /creditCards/
  );
});

// ── Resumo de backup ──────────────────────────────────────────────────────────

test("summarizeBackup counts zero for all empty collections", () => {
  assert.deepEqual(summarizeBackup(validData), {
    creditors: 0,
    incomes: 0,
    installments: 0,
    fixedCosts: 0,
    plannedPurchases: 0
  });
});

test("summarizeBackup sums incomeLines and recurringIncomes together", () => {
  const data = {
    ...validData,
    incomeLines: [{}],
    recurringIncomes: [{}, {}]
  };
  const summary = summarizeBackup(data);
  assert.equal(summary.incomes, 3);
});

test("summarizeBackup handles absent optional fields gracefully", () => {
  const summary = summarizeBackup({ schemaVersion: 3 });
  assert.equal(summary.creditors, 0);
  assert.equal(summary.incomes, 0);
});

// ── Exportação com timestamp ──────────────────────────────────────────────────

test("createBackupEnvelope uses provided timestamp", () => {
  const ts = "2026-01-15T10:00:00.000Z";
  const envelope = createBackupEnvelope(validData, ts);
  assert.equal(envelope.exportedAt, ts);
  assert.equal(envelope.backupVersion, 1);
  assert.equal(envelope.backupFormat, "orcamento-mensal");
});

test("createBackupEnvelope uses current ISO time when timestamp omitted", () => {
  const before = Date.now();
  const envelope = createBackupEnvelope(validData);
  const after = Date.now();
  const parsed = new Date(envelope.exportedAt).getTime();
  assert.ok(parsed >= before && parsed <= after);
});
