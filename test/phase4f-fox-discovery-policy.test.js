import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/tmdb.js", import.meta.url), "utf8");
const doc = fs.readFileSync(new URL("../docs/PHASE4F_FOX_COVERAGE.md", import.meta.url), "utf8");

test("Phase 4F keeps the FOX repair scoped to the FOX core-network seed", () => {
  assert.match(source, /\{ name: "FOX", tmdbNetworkId: 19, recentFirstAirYears: 3 \}/);
  assert.doesNotMatch(source, /\{ name: "HBO", tmdbNetworkId: 49, recentFirstAirYears:/);
  assert.doesNotMatch(source, /\{ name: "Netflix", tmdbNetworkId: 213, recentFirstAirYears:/);
});

test("Phase 4F policy documents unchanged 48-request maximum", () => {
  assert.match(doc, /48 total external requests/);
  assert.match(doc, /adds no external request/);
});
