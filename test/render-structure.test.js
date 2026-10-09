import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("budget startup restores one cached financial snapshot and renders only the active view", async () => {
  const source = await readFile("js/app.js", "utf8");

  assert.match(source, /state\.renderFn = renderCurrentView/);
  assert.match(source, /const startupCache = restoreStartupCache\(state\.data\)/);
  assert.match(source, /state\.preloadDividasFn = preloadDividas/);
  assert.match(source, /function renderCurrentView\(\)/);
  assert.match(source, /renderView\(name\)/);
  assert.doesNotMatch(source, /function renderAll\(\)/);
});

test("startup fetches debt records while the primary state is synchronizing", async () => {
  const source = await readFile("js/firebase.js", "utf8");

  assert.match(source, /const cloudStatePromise = listenCloudState\(\)/);
  assert.match(source, /const debtSnapshotsPromise = state\.preloadDividasFn\?\.\(\)/);
  assert.match(source, /await state\.loadDividasFn\(debtSnapshotsPromise \? await debtSnapshotsPromise : undefined\)/);
});
