import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../public/phase5d-ui.js", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/push-client.js", import.meta.url), "utf8");
const sw = fs.readFileSync(new URL("../public/push-sw.js", import.meta.url), "utf8");
const tracking = fs.readFileSync(new URL("../public/tracking.js", import.meta.url), "utf8");

test("Phase 5D notification assets remain loaded with a safe registration fallback", () => {
  assert.match(html, /Phase 5D-B/);
  assert.match(html, /phase5d\.css/);
  assert.match(html, /phase5d-ui\.js/);
  assert.match(ui, /if \(!capability\.enabled\)/);
  assert.match(ui, /裝置通知登記目前暫停/);
});

test("notification permission is requested only inside the explicit settings button click", () => {
  assert.match(ui, /button\.addEventListener\("click", async \(\) =>/);
  assert.match(ui, /Notification\.requestPermission\(\)/);
  const clickIndex = ui.indexOf('button.addEventListener("click"');
  const permissionIndex = ui.indexOf("Notification.requestPermission()");
  assert.ok(clickIndex >= 0 && permissionIndex > clickIndex);
  assert.doesNotMatch(client, /Notification\.requestPermission/);
});

test("Phase 5D-B sync uploads tracked show IDs but not viewing states", () => {
  assert.match(client, /showIds = loadTrackedShowIds\(\)/);
  assert.match(client, /JSON\.stringify\(\{ showIds, timezone: currentTimezone\(\), titleRegion \}\)/);
  assert.match(client, /authorization: `Bearer \$\{manageToken\}`/);
  assert.doesNotMatch(client, /viewing-state|viewingStates|searchInput|search_history/);
  assert.match(tracking, /series-hub-tracking-changed/);
});

test("Phase 5D-C UI explains the narrow 24-hour episode reminder behavior", () => {
  assert.match(ui, /可靠逐集播映時間/);
  assert.match(ui, /約 24 小時前提醒/);
  assert.match(ui, /約 24 小時前發送提醒/);
  assert.doesNotMatch(ui, /暫不發送節目提醒/);
});

test("disable flow deletes server state before clearing local management", () => {
  const deleteCall = client.indexOf('fetch("/api/push/subscription"');
  const clearCall = client.indexOf("clearPushManagement();");
  assert.ok(deleteCall >= 0 && clearCall > deleteCall);
  assert.match(client, /method: "DELETE"/);
});

test("notification service worker is notification-specific", () => {
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\("notificationclick"/);
  assert.doesNotMatch(sw, /\/api\/shows|\/api\/schedule|localStorage|viewing-state/);
});
