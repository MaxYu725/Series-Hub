import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(new URL("../.github/workflows/phase5d-vapid-bootstrap.yml", import.meta.url), "utf8");
const config = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../src/push-subscriptions.js", import.meta.url), "utf8");

test("Phase 5D-B production gate is explicit and VAPID provisioning runs only on main pushes", () => {
  assert.match(config, /"PUSH_SUBSCRIPTIONS_ENABLED": "true"/);
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- main/);
  assert.doesNotMatch(workflow, /pull_request:/);
});

test("production VAPID private material is generated at runtime and stored only as a Cloudflare secret", () => {
  assert.match(workflow, /generateKeyPairSync\('ec'/);
  assert.match(workflow, /secret put VAPID_PRIVATE_KEY/);
  assert.match(workflow, /::add-mask::\$\{PRIVATE_KEY\}/);
  assert.doesNotMatch(config, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(worker, /VAPID_PRIVATE_KEY/);
});

test("VAPID bootstrap preserves an existing pair and refuses rotation once subscriptions exist", () => {
  assert.match(workflow, /Stable production VAPID keypair already exists; preserving it/);
  assert.match(workflow, /if \[ "\$\{SUBSCRIPTION_COUNT\}" -ne 0 \]/);
  assert.match(workflow, /refusing key rotation/);
  assert.match(workflow, /bootstrap changed subscription count/);
});

test("live readiness requires the enabled production capability to expose the provisioned public key", () => {
  assert.match(workflow, /\/api\/push\/public-key/);
  assert.match(workflow, /data\.enabled === true/);
  assert.match(workflow, /data\.configured === true/);
  assert.match(workflow, /data\.publicKey === process\.env\.EXPECTED_PUBLIC_KEY/);
});
