import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EPISODE_REMINDER_CRON,
  EPISODE_REMINDER_KIND,
  MAX_DELIVERIES_PER_RUN,
  classifyPushFailure,
  episodeEntityKey,
  episodeRemindersEnabled,
  notificationPayload,
  reminderWindow
} from "../src/push-delivery.js";

const worker = fs.readFileSync(new URL("../src/phase4-worker.js", import.meta.url), "utf8");
const delivery = fs.readFileSync(new URL("../src/push-delivery.js", import.meta.url), "utf8");
const configText = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const config = JSON.parse(configText);
const migration = fs.readFileSync(new URL("../migrations/0014_phase5d_push_subscriptions.sql", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Phase 5D-C reminder window is the hourly 23-to-24-hour slice", () => {
  const now = new Date("2026-08-25T04:00:00.000Z");
  const window = reminderWindow(now);
  assert.equal(window.after.toISOString(), "2026-08-26T03:00:00.000Z");
  assert.equal(window.through.toISOString(), "2026-08-26T04:00:00.000Z");
  assert.equal(EPISODE_REMINDER_CRON, "7 * * * *");
  assert.equal(EPISODE_REMINDER_KIND, "episode_24h");
  assert.equal(MAX_DELIVERIES_PER_RUN, 30);
});

test("Phase 5D-C feature gate remains deny-by-default on the implementation branch", () => {
  assert.equal(episodeRemindersEnabled({}), false);
  assert.equal(episodeRemindersEnabled({ EPISODE_REMINDERS_ENABLED: "true" }), true);
  assert.equal(config.vars.EPISODE_REMINDERS_ENABLED, "false");
  assert.ok(config.triggers.crons.includes(EPISODE_REMINDER_CRON));
});

test("Phase 5D-C Worker keeps reminder cron isolated from TMDB and TVmaze sync", () => {
  assert.match(worker, /controller\.cron === EPISODE_REMINDER_CRON/);
  assert.match(worker, /runEpisodeReminderDelivery\(env\)/);
  assert.match(worker, /return coreWorker\.scheduled\(controller, env, ctx\)/);
  assert.match(worker, /Episode reminder scheduled run failed/);
});

test("delivery candidates require precise TVmaze timestamps and stable show mappings", () => {
  assert.match(delivery, /JOIN push_subscription_shows pss ON pss\.subscription_id = ps\.id/);
  assert.match(delivery, /JOIN episodes e ON e\.season_id = se\.id/);
  assert.match(delivery, /e\.air_timestamp IS NOT NULL/);
  assert.match(delivery, /e\.episode_number > 0/);
  assert.match(delivery, /se\.season_number > 0/);
  assert.match(delivery, /nd\.status = 'failed_transient'/);
});

test("delivery identity is stable and the existing unique D1 constraint remains the dedup guard", () => {
  assert.equal(episodeEntityKey(42), "episode:42");
  assert.throws(() => episodeEntityKey(0), /invalid_episode_id/);
  assert.match(migration, /UNIQUE \(subscription_id, kind, entity_key\)/);
  assert.match(delivery, /INSERT OR IGNORE INTO notification_deliveries/);
  assert.match(delivery, /status !== "failed_transient"/);
});

test("Push errors distinguish stale subscriptions from bounded retry failures", () => {
  assert.deepEqual(classifyPushFailure({ statusCode: 410 }), {
    status: "permanent_subscription",
    errorCode: "http_410",
    statusCode: 410
  });
  assert.equal(classifyPushFailure({ statusCode: 429 }).status, "failed_transient");
  assert.equal(classifyPushFailure({ statusCode: 503 }).status, "failed_transient");
  assert.equal(classifyPushFailure({ statusCode: 403 }).status, "failed_terminal");
  assert.equal(classifyPushFailure(new Error("network")).status, "failed_transient");
});

test("notification payload uses the subscription title region and precise local timestamp", () => {
  const payload = notificationPayload({
    title_region: "HK",
    timezone: "Asia/Hong_Kong",
    episode_id: 99,
    show_id: 7,
    season_number: 2,
    episode_number: 3,
    episode_name: "The Test",
    air_timestamp: "2026-08-26T01:00:00.000Z",
    english_title: "Example Show",
    original_title: "Example Show",
    title_zh_hk: "示例劇集",
    title_zh_hk_source: "tmdb",
    title_zh_hk_confidence: "normal",
    title_zh_tw: null,
    title_zh_cn: null
  });
  assert.match(payload.title, /示例劇集/);
  assert.match(payload.title, /24 小時提醒/);
  assert.match(payload.body, /S02E03/);
  assert.match(payload.body, /09:00/);
  assert.equal(payload.data.showId, 7);
  assert.equal(payload.data.episodeId, 99);
});

test("production sender uses the already-proven Worker-compatible web-push package", () => {
  assert.equal(packageJson.dependencies["web-push"], "3.6.7");
  assert.ok(config.compatibility_flags.includes("nodejs_compat"));
  assert.match(delivery, /webpush\.sendNotification/);
  assert.match(delivery, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(configText, /VAPID_PRIVATE_KEY/);
});

test("dry-run path is protected and cannot enable sending while the production gate is false", () => {
  assert.match(worker, /\/api\/internal\/episode-reminders/);
  assert.match(worker, /authorizeEditorialWrite\(request, env\)/);
  assert.match(worker, /send && !episodeRemindersEnabled\(env\)/);
  assert.match(worker, /dryRun: !send/);
  assert.match(delivery, /purgedStale: 0/);
});
