import test from "node:test";
import assert from "node:assert/strict";
import { nextRevision, shouldApplyCloudSnapshot } from "../js/domain/sync.js";

test("creates monotonic local revisions even within the same millisecond", () => {
  assert.equal(nextRevision(100, 100), 101);
  assert.equal(nextRevision(100, 200), 200);
});

test("ignores stale cloud snapshots while a newer local write is pending", () => {
  assert.equal(shouldApplyCloudSnapshot(99, 100), false);
  assert.equal(shouldApplyCloudSnapshot(100, 100), true);
  assert.equal(shouldApplyCloudSnapshot(1, 0), true);
});

test("does not restore an older cloud snapshot after a local save is acknowledged", () => {
  assert.equal(shouldApplyCloudSnapshot(100, 0, 101), false);
  assert.equal(shouldApplyCloudSnapshot(101, 0, 101), true);
  assert.equal(shouldApplyCloudSnapshot(102, 0, 101), true);
});

test("keeps the locally persisted revision as the minimum accepted cloud revision", () => {
  const persistedRevision = 509;
  assert.equal(shouldApplyCloudSnapshot(508, 0, persistedRevision), false);
  assert.equal(shouldApplyCloudSnapshot(509, 0, persistedRevision), true);
});
