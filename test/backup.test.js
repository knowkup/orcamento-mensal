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

test("creates a versioned backup and reads it back", () => {
  const backup = createBackupEnvelope(validData, "2026-06-06T12:00:00.000Z");
  assert.equal(backup.backupFormat, "orcamento-mensal");
  assert.equal(backup.backupVersion, 1);
  assert.equal(backup.exportedAt, "2026-06-06T12:00:00.000Z");
  assert.equal(readBackupPayload(backup), validData);
});

test("keeps compatibility with current raw backups", () => {
  assert.equal(readBackupPayload(validData), validData);
});

test("rejects obsolete or structurally corrupted backups", () => {
  assert.throws(() => readBackupPayload({ schemaVersion: 2 }), /versao antiga/);
  assert.throws(
    () => readBackupPayload({ ...validData, plannedPurchases: {} }),
    /plannedPurchases/
  );
});

test("summarizes the data that will be replaced before import", () => {
  assert.deepEqual(summarizeBackup({
    ...validData,
    creditors: [{}, {}],
    incomeLines: [{}],
    recurringIncomes: [{}, {}],
    installments: [{}, {}, {}],
    fixedCosts: [{}],
    plannedPurchases: [{}, {}]
  }), {
    creditors: 2,
    incomes: 3,
    installments: 3,
    fixedCosts: 1,
    plannedPurchases: 2
  });
});
