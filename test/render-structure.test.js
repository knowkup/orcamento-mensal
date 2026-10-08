import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("budget startup restores cached debt data and renders only the active view", async () => {
  const source = await readFile("js/app.js", "utf8");

  assert.match(source, /state\.renderFn = renderCurrentView/);
  assert.match(source, /state\.debtDataReady = restoreDebtCache/);
  assert.match(source, /function renderCurrentView\(\)/);
  assert.match(source, /renderView\(name\)/);
  assert.doesNotMatch(source, /function renderAll\(\)/);
});
