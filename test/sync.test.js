import test from "node:test";
import assert from "node:assert/strict";
import { nextRevision, shouldApplyCloudSnapshot } from "../js/domain/sync.js";

test("creates monotonic local revisions even within the same millisecond", () => {
  assert.equal(nextRevision(100, 100), 101);
  assert.equal(nextRevision(100, 200), 200);
});

test("ignores stale cloud snapshots only while a newer local write is pending", () => {
  assert.equal(shouldApplyCloudSnapshot(99, 100), false);
  assert.equal(shouldApplyCloudSnapshot(100, 100), true);
  assert.equal(shouldApplyCloudSnapshot(1, 0), true);
});
