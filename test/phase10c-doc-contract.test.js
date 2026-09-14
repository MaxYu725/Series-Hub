import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Phase 10C documents the shared selector without changing provider budgets", () => {
  const doc = fs.readFileSync(new URL("../docs/PHASE10C_MARKET_SELECTOR.md", import.meta.url), "utf8");
  assert.match(doc, /all.*default/s);
  assert.match(doc, /US/);
  assert.match(doc, /KR/);
  assert.match(doc, /My Shows.*not filtered by market/s);
  assert.match(doc, /US TMDB 48-request ceiling/);
  assert.match(doc, /Korea TMDB 24-request ceiling/);
  assert.match(doc, /No new table, migration or external provider/);
});
