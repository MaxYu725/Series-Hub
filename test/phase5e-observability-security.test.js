import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { classifyPushState, classifySyncSource } from "../src/ops-status.js";

const index = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../src/phase4-worker.js", import.meta.url), "utf8");
const ops = fs.readFileSync(new URL("../src/ops-status.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const opsUi = fs.readFileSync(new URL("../public/phase5e-ops-ui.js", import.meta.url), "utf8");
const deploy = fs.readFileSync(new URL("../.github/workflows/phase0-cloudflare-bootstrap.yml", import.meta.url), "utf8");
const lifecycle = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");
const titles = fs.readFileSync(new URL("../.github/workflows/title-alias-override.yml", import.meta.url), "utf8");
const reminder = fs.readFileSync(new URL("../.github/workflows/phase5d-reminder-production-check.yml", import.meta.url), "utf8");

const protectedWorkflows = [deploy, lifecycle, titles, reminder];

test("internal authorization derivation is rotated away from historical v1 context", () => {
  assert.match(index, /SYNC_KEY_CONTEXT = "series-hub:tmdb-sync:v2:"/);
  assert.doesNotMatch(index, /series-hub:tmdb-sync:v1:/);
  for (const workflow of protectedWorkflows) {
    assert.match(workflow, /series-hub:tmdb-sync:v2:/);
    assert.doesNotMatch(workflow, /series-hub:tmdb-sync:v1:/);
  }
});

test("every workflow deriving the internal key masks it before later use or output", () => {
  assert.match(deploy, /echo "::add-mask::\$\{SYNC_KEY\}"[\s\S]*echo "key=\$\{SYNC_KEY\}"/);
  assert.match(lifecycle, /echo "::add-mask::\$\{KEY\}"[\s\S]*echo "key=\$\{KEY\}"/);
  assert.match(titles, /echo "::add-mask::\$\{KEY\}"[\s\S]*echo "key=\$\{KEY\}"/);
  assert.match(reminder, /echo "::add-mask::\$\{SYNC_KEY\}"[\s\S]*x-series-hub-sync-key: \$\{SYNC_KEY\}/);
});

test("the old one-shot reminder verification no longer races every workflow edit", () => {
  assert.match(reminder, /workflow_dispatch:/);
  assert.doesNotMatch(reminder, /paths:\s*\n\s*- \.github\/workflows\/phase5d-reminder-production-check\.yml/);
});

test("source freshness degrades after missed six-hour sync cycles", () => {
  const now = Date.parse("2026-08-28T12:00:00Z");
  assert.equal(classifySyncSource({ status: "success", finished_at: "2026-08-28 06:30:00" }, now).state, "ok");
  assert.equal(classifySyncSource({ status: "success", finished_at: "2026-08-28 02:00:00" }, now).state, "warn");
  assert.equal(classifySyncSource({ status: "success", finished_at: "2026-08-27 12:00:00" }, now).state, "error");
  assert.equal(classifySyncSource({ status: "failed", finished_at: "2026-08-28 11:55:00" }, now).state, "error");
});

test("Push readiness is assessed independently from TMDB and TVmaze", () => {
  const env = { PUSH_SUBSCRIPTIONS_ENABLED: "true", EPISODE_REMINDERS_ENABLED: "true", VAPID_PRIVATE_KEY: "configured" };
  assert.equal(classifyPushState({ public_key_configured: 1, active_subscriptions: 1, active_show_mappings: 2 }, env).state, "ok");
  assert.equal(classifyPushState({ public_key_configured: 1, active_subscriptions: 0, active_show_mappings: 0 }, env).state, "idle");
  assert.equal(classifyPushState({ public_key_configured: 1, active_subscriptions: 1, active_show_mappings: 2, failed_24h: 1 }, env).state, "warn");
  assert.equal(classifyPushState({ public_key_configured: 0, active_subscriptions: 1, active_show_mappings: 2 }, env).state, "error");
});

test("operational endpoint exposes aggregate source health without Push credentials", () => {
  assert.match(worker, /GET" && url\.pathname === "\/api\/ops-status"/);
  assert.match(ops, /source_key IN \('tmdb', 'tvmaze'\)/);
  assert.match(ops, /active_subscriptions/);
  assert.match(ops, /active_show_mappings/);
  assert.match(ops, /failed_24h/);
  assert.doesNotMatch(ops, /\bendpoint\b|\bp256dh\b|manage_token|\bauth\b/);
});

test("homepage renders TMDB, TVmaze and Push as separate operational indicators", () => {
  assert.match(html, /id="ops-status"/);
  assert.match(html, /phase5e-ops-ui\.js/);
  assert.match(opsUi, /fetch\("\/api\/ops-status"/);
  assert.match(opsUi, /makePill\("TMDB"/);
  assert.match(opsUi, /makePill\("TVmaze"/);
  assert.match(opsUi, /makePill\("Push"/);
});
