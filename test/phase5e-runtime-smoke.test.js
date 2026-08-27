import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/phase0-cloudflare-bootstrap.yml", "utf8");

test("production runtime smoke stores large API payloads in files instead of process environment", () => {
  const productionBlock = workflow.split("      - name: Verify production runtime")[1] || "";
  assert.match(productionBlock, /TMP_DIR="\$\(mktemp -d\)"/);
  assert.match(productionBlock, /api\/shows\?limit=60.*-o "\$\{TMP_DIR\}\/shows\.json"/);
  assert.match(productionBlock, /fs\.readFileSync/);
  assert.doesNotMatch(productionBlock, /SHOWS_JSON="\$\{SHOWS_JSON\}"/);
});

test("PR production smoke is also safe as the catalog grows", () => {
  const previewArea = workflow.split("      - name: Smoke-test production runtime")[1]?.split("      - name: Publish validation summary")[0] || "";
  assert.match(previewArea, /TMP_DIR="\$\(mktemp -d\)"/);
  assert.match(previewArea, /\/api\/shows.*-o "\$\{TMP_DIR\}\/shows\.json"/);
  assert.doesNotMatch(previewArea, /HEALTH_JSON="\$\{HEALTH_JSON\}" SHOWS_JSON=/);
});
