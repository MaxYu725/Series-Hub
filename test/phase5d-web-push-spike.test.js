import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../spikes/web-push/worker.mjs", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../spikes/web-push/public/index.html", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../spikes/web-push/public/sw.js", import.meta.url), "utf8");
const config = fs.readFileSync(new URL("../spikes/web-push/wrangler.jsonc", import.meta.url), "utf8");
const workflow = fs.readFileSync(new URL("../.github/workflows/phase5d-web-push-spike.yml", import.meta.url), "utf8");

test("Phase 5D-A spike is isolated from production storage and notification persistence", () => {
  assert.doesNotMatch(worker, /env\.DB|D1|INSERT\s+INTO|push_subscriptions/i);
  assert.doesNotMatch(config, /d1_databases|series-hub-db/);
  assert.match(worker, /persistentStorage:\s*false/);
  assert.match(workflow, /series-hub-push-spike-pr-/);
});

test("Phase 5D-A requests permission only from the explicit Run Push Test click", () => {
  assert.match(html, /runButton\.addEventListener\("click"/);
  assert.match(html, /Notification\.requestPermission\(\)/);
  assert.match(html, /userVisibleOnly:\s*true/);
  assert.doesNotMatch(html, /DOMContentLoaded[\s\S]{0,500}Notification\.requestPermission/);
});

test("Phase 5D-A sends only a supplied test subscription and does not retain it", () => {
  assert.match(worker, /\/send-test/);
  assert.match(worker, /sameOriginRequest/);
  assert.match(worker, /webpush\.sendNotification\(subscription/);
  assert.doesNotMatch(worker, /subscriptions\s*=|push_subscription|localStorage/);
});

test("Phase 5D-A Service Worker always turns the push into a visible notification", () => {
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\("notificationclick"/);
});

test("Phase 5D-A keeps the VAPID private key out of source and injects an ephemeral secret in CI", () => {
  assert.doesNotMatch(config, /VAPID_PRIVATE_KEY/);
  assert.match(workflow, /Generate ephemeral preview VAPID keys/);
  assert.match(workflow, /secret put VAPID_PRIVATE_KEY/);
  assert.match(config, /nodejs_compat/);
});
