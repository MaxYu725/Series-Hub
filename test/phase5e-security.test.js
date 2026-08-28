import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const deploy = fs.readFileSync(new URL("../.github/workflows/phase0-cloudflare-bootstrap.yml", import.meta.url), "utf8");
const lifecycle = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");
const titles = fs.readFileSync(new URL("../.github/workflows/title-alias-override.yml", import.meta.url), "utf8");
const reminder = fs.readFileSync(new URL("../.github/workflows/phase5d-reminder-production-check.yml", import.meta.url), "utf8");

const protectedFiles = [index, deploy, lifecycle, titles, reminder];

test("Phase 5E-D3 rotates every active internal-auth derivation to v2", () => {
  for (const source of protectedFiles) {
    assert.doesNotMatch(source, /series-hub:tmdb-sync:v1:/);
  }
  assert.match(index, /SYNC_KEY_CONTEXT = "series-hub:tmdb-sync:v2:"/);
  assert.match(deploy, /series-hub:tmdb-sync:v2:/);
  assert.match(lifecycle, /series-hub:tmdb-sync:v2:/);
  assert.match(titles, /series-hub:tmdb-sync:v2:/);
  assert.match(reminder, /series-hub:tmdb-sync:v2:/);
});

test("derived authorization material is masked before workflow output or HTTP use", () => {
  assert.match(deploy, /echo "::add-mask::\$\{SYNC_KEY\}"[\s\S]*echo "key=\$\{SYNC_KEY\}"/);
  assert.match(lifecycle, /echo "::add-mask::\$\{KEY\}"[\s\S]*echo "key=\$\{KEY\}"/);
  assert.match(titles, /echo "::add-mask::\$\{KEY\}"[\s\S]*echo "key=\$\{KEY\}"/);
  assert.match(reminder, /echo "::add-mask::\$\{SYNC_KEY\}"[\s\S]*x-series-hub-sync-key: \$\{SYNC_KEY\}/);
});
