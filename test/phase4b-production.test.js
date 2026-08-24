import test from "node:test";
import assert from "node:assert/strict";

import { lifecycleLabel, officialLifecycleProjection } from "../public/phase4-ui.js";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

async function fetchText(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, { headers: { "cache-control": "no-cache" } });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.text();
}

async function fetchJson(path) {
  return JSON.parse(await fetchText(path));
}

test("Phase 4B production assets and official lifecycle projection are live", async () => {
  const [html, appJs, phase4Js, phase4Css, lifecycle, siloCatalog, famCatalog] = await Promise.all([
    fetchText("/"),
    fetchText("/app.js"),
    fetchText("/phase4-ui.js"),
    fetchText("/phase4.css"),
    fetchJson("/api/lifecycle"),
    fetchJson("/api/shows?q=Silo&limit=10&region=HK"),
    fetchJson("/api/shows?q=For%20All%20Mankind&limit=10&region=HK")
  ]);

  assert.match(html, /Phase 4/);
  assert.match(html, /phase4\.css/);
  assert.match(html, /phase4-ui\.js/);
  assert.match(appJs, /card\.dataset\.showId\s*=\s*String\(show\.id\)/);
  assert.match(phase4Js, /confidence\s*===\s*"official"/);
  assert.match(phase4Css, /\.lifecycle-badge/);

  assert.equal(lifecycle.meta?.projectionPolicy, "phase-4b");
  assert.ok(Number(lifecycle.meta?.eventCount) >= 6);

  const silo = lifecycle.data?.["4"];
  const fam = lifecycle.data?.["58"];
  assert.ok(silo, "Silo lifecycle projection should exist");
  assert.ok(fam, "For All Mankind lifecycle projection should exist");

  const siloOfficial = officialLifecycleProjection(silo.events);
  const famOfficial = officialLifecycleProjection(fam.events);

  assert.equal(lifecycleLabel(siloOfficial.decision), "第4季為最終季");
  assert.equal(lifecycleLabel(famOfficial.decision), "第6季為最終季");
  assert.equal(lifecycleLabel(famOfficial.production), "第6季製作準備中");

  for (const event of [...silo.events, ...fam.events]) {
    assert.equal(event.confidence, "official");
    assert.equal(event.trust_level, "official");
    assert.equal(event.source_key, "apple_tv_press");
    assert.match(event.source_url, /^https:\/\/www\.apple\.com\/tv-pr\//);
  }

  const siloShow = siloCatalog.data?.find((show) => Number(show.id) === 4);
  const famShow = famCatalog.data?.find((show) => Number(show.id) === 58);
  assert.equal(siloShow?.status, "airing");
  assert.equal(famShow?.status, "planned");
});