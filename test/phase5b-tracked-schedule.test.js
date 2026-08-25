import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { filterTrackedScheduleEpisodes } from "../public/phase5b-ui.js";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../public/phase5b-ui.js", import.meta.url), "utf8");

test("tracked schedule filtering uses stable show_id membership", () => {
  const episodes = [
    { id: 1, show_id: 7 },
    { id: 2, show_id: 66 },
    { id: 3, show_id: 431 }
  ];
  assert.deepEqual(
    filterTrackedScheduleEpisodes(episodes, [431, "7"]).map((episode) => episode.id),
    [1, 3]
  );
  assert.deepEqual(filterTrackedScheduleEpisodes(episodes, []), []);
});

test("Phase 5B is loaded as a frontend-only layer", () => {
  assert.match(html, /Phase 5B/);
  assert.match(html, /phase5b-ui\.js/);
  assert.match(ui, /id = "tracked-schedule-filter"/);
  assert.match(ui, /只看追蹤/);
});

test("tracked schedule reuses the existing schedule API and local storage", () => {
  assert.match(ui, /fetch\(`\/api\/schedule\?\$\{params\}`/);
  assert.match(ui, /loadTrackedShowIds/);
  assert.doesNotMatch(ui, /\/api\/tracking|\/api\/favorites|method:\s*["']POST["']/);
});

test("schedule observer only watches root child replacement to avoid feedback loops", () => {
  assert.match(ui, /observer\.observe\(scheduleList, \{ childList: true \}\)/);
  assert.doesNotMatch(ui, /observer\.observe\(scheduleList, \{[^}]*subtree:\s*true/);
});
