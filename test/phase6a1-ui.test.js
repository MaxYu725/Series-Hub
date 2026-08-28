import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, ui, css, worker] = await Promise.all([
  readFile(new URL("../public/show.html", import.meta.url), "utf8"),
  readFile(new URL("../public/phase6a1-ui.js", import.meta.url), "utf8"),
  readFile(new URL("../public/phase6a1.css", import.meta.url), "utf8"),
  readFile(new URL("../src/phase6-worker.js", import.meta.url), "utf8")
]);

test("Phase 6A.1 loads its polish layer and promotes official status ahead of media", () => {
  assert.match(html, /phase6a1\.css/);
  assert.match(html, /phase6a1-ui\.js/);
  assert.match(html, /Phase 6(?:A\.1|B)/);
  assert.ok(html.indexOf('id="detail-seasons"') < html.indexOf('id="detail-lifecycle-section"'));
  assert.ok(html.indexOf('id="detail-lifecycle-section"') < html.indexOf('id="detail-trailer-section"'));
  assert.ok(html.indexOf('id="detail-trailer-section"') < html.indexOf('id="detail-images-section"'));
});

test("Phase 6A.1 groups upcoming and recent episodes instead of mixing both timelines", () => {
  assert.match(ui, /buildEpisodeGroup\("即將播出"/);
  assert.match(ui, /buildEpisodeGroup\("最近播出"/);
  assert.match(ui, /episodeSortValue/);
  assert.match(ui, /detail-episode-group/);
});

test("Phase 6A.1 condenses seasons and localizes common metadata labels", () => {
  assert.match(ui, /Returning Series.*持續播映/s);
  assert.match(ui, /Scripted.*劇情劇/s);
  assert.match(ui, /Action & Adventure.*動作與冒險/s);
  assert.match(ui, /`第 \$\{Number\(number\)\} 季`/);
  assert.match(ui, /detail-season-overview/);
});

test("Phase 6A.1 keeps one primary trailer and treats the remainder as other videos", () => {
  assert.match(ui, /primaryIsTrailer/);
  assert.match(ui, /option\.remove\(\)/);
  assert.match(ui, /其他影片/);
  assert.match(ui, /Trailer: "預告片"/);
});

test("Phase 6A.1 initially limits the media wall to six curated images", () => {
  assert.match(ui, /backdrops\.slice\(0, 4\)/);
  assert.match(ui, /posters\.slice\(0, 2\)/);
  assert.match(ui, /index >= 6/);
  assert.match(ui, /查看全部 \$\{total\} 張/);
  assert.match(css, /detail-image-toggle/);
});

test("Phase 6A.1 localizes synopsis text on demand without changing scheduled Phase 5 behavior", () => {
  assert.match(worker, /HK: "zh-HK"/);
  assert.match(worker, /TW: "zh-TW"/);
  assert.match(worker, /CN: "zh-CN"/);
  assert.match(worker, /localized\?\.overview/);
  assert.match(worker, /return phase5eWorker\.scheduled\(controller, env, ctx\);/);
});
