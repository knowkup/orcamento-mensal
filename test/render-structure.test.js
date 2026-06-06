import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("budget saves render only the active view after the initial full render", async () => {
  const source = await readFile("js/app.js", "utf8");

  assert.match(source, /state\.renderFn = renderCurrentView/);
  assert.match(source, /function renderAll\(\)/);
  assert.match(source, /function renderCurrentView\(\)/);
  assert.match(source, /renderView\(name\)/);
});
