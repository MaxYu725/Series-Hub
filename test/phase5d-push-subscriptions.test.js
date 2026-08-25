import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  normalizeShowIds,
  normalizeTitleRegion,
  pushSubscriptionsEnabled,
  sha256Hex,
  validPushSubscription,
  validTimezone
} from "../src/push-subscriptions.js";
import {
  PUSH_MANAGEMENT_STORAGE_KEY,
  clearPushManagement,
  loadPushManagement,
  normalizePushManagement,
  savePushManagement
} from "../public/push-client.js";

const migration = fs.readFileSync(new URL("../migrations/0014_phase5d_push_subscriptions.sql", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../src/push-subscriptions.js", import.meta.url), "utf8");
const config = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

test("Phase 5D-B remains disabled unless explicitly feature-gated on", () => {
  assert.equal(pushSubscriptionsEnabled({}), false);
  assert.equal(pushSubscriptionsEnabled({ PUSH_SUBSCRIPTIONS_ENABLED: "false" }), false);
  assert.equal(pushSubscriptionsEnabled({ PUSH_SUBSCRIPTIONS_ENABLED: "true" }), true);
  assert.match(config, /"PUSH_SUBSCRIPTIONS_ENABLED": "false"/);
});

test("Phase 5D-B validates only bounded stable show IDs and title regions", () => {
  assert.deepEqual(normalizeShowIds([4, "2", 4, 0, -1, "bad", 8]), [4, 2, 8]);
  assert.equal(normalizeShowIds(Array.from({ length: 150 }, (_, index) => index + 1)).length, 100);
  assert.equal(normalizeTitleRegion("tw"), "TW");
  assert.equal(normalizeTitleRegion("xx"), "HK");
});

test("Phase 5D-B validates timezone and Push subscription shape", () => {
  assert.equal(validTimezone("Asia/Hong_Kong"), true);
  assert.equal(validTimezone("Not/A_Real_Zone"), false);
  assert.equal(validPushSubscription({
    endpoint: "https://push.example.test/subscriptions/abc123",
    keys: { p256dh: "A".repeat(65), auth: "B".repeat(16) }
  }), true);
  assert.equal(validPushSubscription({
    endpoint: "http://push.example.test/abc",
    keys: { p256dh: "A".repeat(65), auth: "B".repeat(16) }
  }), false);
});

test("Phase 5D-B hashes endpoint and capability tokens before server lookup", async () => {
  assert.equal(await sha256Hex("series-hub"), "2eae1c542858e63622ac849a96f16ff6f7df992eff790c1a7a82f6676ab25056");
  assert.match(worker, /endpointHash = await sha256Hex\(subscription\.endpoint\)/);
  assert.match(worker, /manageTokenHash = await sha256Hex\(manageToken\)/);
  assert.doesNotMatch(migration, /manage_token\s+TEXT/i);
  assert.match(migration, /manage_token_hash TEXT NOT NULL UNIQUE/);
});

test("Phase 5D-B schema stores no viewing state, search history, account or user profile", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS push_subscriptions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS push_subscription_shows/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS notification_deliveries/);
  assert.doesNotMatch(migration, /viewing_state|search_history|user_profile|account_id|email|username/i);
});

test("Phase 5D-B browser management token uses a separate versioned local key", () => {
  assert.equal(PUSH_MANAGEMENT_STORAGE_KEY, "series-hub-push-management-v1");
  const storage = memoryStorage();
  const value = {
    manageToken: "A".repeat(43),
    endpointHash: "a".repeat(64),
    registeredAt: "2026-08-25T00:00:00.000Z"
  };
  assert.deepEqual(savePushManagement(value, storage), value);
  assert.deepEqual(loadPushManagement(storage), value);
  clearPushManagement(storage);
  assert.equal(loadPushManagement(storage), null);
  assert.equal(normalizePushManagement({ manageToken: "short", endpointHash: "a".repeat(64) }), null);
});
