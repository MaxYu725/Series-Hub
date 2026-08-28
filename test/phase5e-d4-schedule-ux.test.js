import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/phase5e.css", import.meta.url), "utf8");
const trackedUi = fs.readFileSync(new URL("../public/phase5b-ui.js", import.meta.url), "utf8");
const worker = fs.readFileSync(new URL("../src/phase5e-worker.js", import.meta.url), "utf8");

test("D4 landing flow starts with the active Today/Week content instead of the long hero explainer", () => {
  assert.doesNotMatch(html, /<section class="hero">/);
  const contentIndex = html.indexOf('<section class="content-panel"');
  const statusIndex = html.indexOf('<section class="service-status"');
  assert.ok(contentIndex > 0);
  assert.ok(statusIndex > contentIndex);
  assert.match(html, /id="view-title">今日播映/);
});

test("same-show episodes are grouped into one schedule card while preserving per-episode rows", () => {
  assert.match(app, /schedule-show-group/);
  assert.match(app, /scheduleBatchLabel/);
  assert.match(app, /一次上架/);
  assert.match(app, /showGroups\.values\(\)/);
  assert.match(css, /\.schedule-show-group/);
  assert.match(css, /\.schedule-episode-list \.schedule-row/);
});

test("tracked schedule filtering hides or restores whole grouped show cards", () => {
  assert.match(trackedUi, /querySelectorAll\("\.schedule-show-group"\)/);
  assert.match(trackedUi, /group\.hidden = groupRows\.length > 0 && groupRows\.every/);
  assert.match(trackedUi, /for \(const group of scheduleList\.querySelectorAll\("\.schedule-show-group"\)\) group\.hidden = false/);
});

test("airing catalog cards expose confirmed next-episode timestamps without inventing missing time", () => {
  assert.match(worker, /url\.pathname !== "\/api\/shows"/);
  assert.match(worker, /tvmaze_next_episode_timestamp/);
  assert.match(worker, /datetime\(e\.air_timestamp\) >= datetime\('now'\)/);
  assert.match(app, /formatLocalDateTime\(show\.tvmaze_next_episode_timestamp\)/);
  assert.match(app, /TVmaze 暫未有下一集排程；不會推測或補造播映時間。/);
});
