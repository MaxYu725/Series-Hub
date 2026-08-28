import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const deploy = fs.readFileSync(new URL("../.github/workflows/phase0-cloudflare-bootstrap.yml", import.meta.url), "utf8");
const lifecycle = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");
const titles = fs.readFileSync(new URL("../.github/workflows/title-alias-override.yml", import.meta.url), "utf8");
const reminder = fs.readFileSync(new URL("../.github/workflows/phase5d-reminder-production-check.yml", import.meta.url), "utf8");

const protectedWorkflows = [deploy, lifecycle, titles, reminder];

test("internal authorization derivation is rotated away from historical v1 context", () => {
  assert.match(index, /series-hub:tmdb-sync:v2:/);
  assert.doesNotMatch(index, /series-hub:tmdb-sync:v1:/);
  for (const workflow of protectedWorkflows) {
    assert.doesNotMatch(workflow, /series-hub:tmdb-sync:v1:/);
  }
});

test("every workflow deriving the internal key masks it before later use or output", () => {
  for (const workflow of protectedWorkflows) {
    assert.match(workflow, /series-hub:tmdb-sync:v2:/);
    assert.match(workflow, /::add-mask::/);
  }
});
