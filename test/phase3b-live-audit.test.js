import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const REGIONS = ["HK", "TW", "CN"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, init = {}) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${PRODUCTION_URL}${path}${separator}audit=${Date.now()}`, {
    ...init,
    headers: {
      accept: "application/json",
      "cache-control": "no-cache",
      ...(init.headers || {})
    }
  });
  return { response, body: await response.json().catch(() => null) };
}

async function fetchText(path) {
  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${PRODUCTION_URL}${path}${separator}audit=${Date.now()}`, {
    headers: { "cache-control": "no-cache" }
  });
  return { response, text: await response.text() };
}

async function waitForPhase3a() {
  let last = null;
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const [health, audit, home] = await Promise.all([
        fetchJson("/health"),
        fetchJson("/api/title-audit"),
        fetchText("/")
      ]);
      last = { health, audit, home };
      if (
        health.response.ok &&
        health.body?.titleAliasPolicy === "phase-3a" &&
        audit.response.ok &&
        audit.body?.meta?.policy === "phase-3a" &&
        home.response.ok &&
        home.text.includes("Phase 3A") &&
        home.text.includes("title-region-select")
      ) {
        return { ...last, attempt };
      }
    } catch (error) {
      console.log(`Phase 3A production not ready (${attempt}/40): ${error.message}`);
    }
    await sleep(3000);
  }
  console.log("Last production snapshot:", last);
  assert.fail("Production did not expose Phase 3A within the audit window");
}

function expectedDisplay(row, region) {
  const order = region === "HK" ? ["HK", "TW", "CN"] : region === "TW" ? ["TW", "HK", "CN"] : ["CN", "TW", "HK"];
  for (const candidate of order) {
    const title = row[`title_zh_${candidate.toLowerCase()}`];
    if (title) return { title, region: candidate };
  }
  return { title: null, region: null };
}

test("Phase 3A production regional-title contract and live catalog audit", { timeout: 180000 }, async () => {
  if (!process.env.CI) return;

  const ready = await waitForPhase3a();
  const [styles, app, ...regionalCatalogResults] = await Promise.all([
    fetchText("/phase3.css"),
    fetchText("/app.js"),
    ...REGIONS.map((region) => fetchJson(`/api/shows?limit=100&region=${region}`))
  ]);

  assert.equal(styles.response.ok, true);
  assert.match(styles.text, /region-box/);
  assert.equal(app.response.ok, true);
  assert.match(app.text, /series-hub-title-region/);
  assert.match(app.text, /display_title_zh/);
  assert.match(app.text, /chinese_aliases/);

  const audit = ready.audit.body;
  assert.ok(Number(audit.data?.totalActive) >= 20, `active catalog unexpectedly small: ${audit.data?.totalActive}`);
  assert.ok(audit.data?.coverage?.HK);
  assert.ok(audit.data?.coverage?.TW);
  assert.ok(audit.data?.coverage?.CN);

  const catalogs = Object.fromEntries(REGIONS.map((region, index) => {
    const result = regionalCatalogResults[index];
    assert.equal(result.response.ok, true, `${region} catalog failed`);
    assert.equal(result.body?.meta?.titleRegion, region);
    assert.ok(Array.isArray(result.body?.data));
    assert.ok(result.body.data.length >= 20, `${region} catalog unexpectedly small`);
    return [region, result.body.data];
  }));

  const baseById = new Map(catalogs.HK.map((row) => [Number(row.id), row]));
  for (const region of REGIONS) {
    for (const row of catalogs[region]) {
      const base = baseById.get(Number(row.id));
      assert.ok(base, `show ${row.id} missing from HK baseline`);
      const expected = expectedDisplay(base, region);
      assert.equal(row.display_title_zh || null, expected.title, `${row.english_title} ${region} display title mismatch`);
      assert.equal(row.display_title_zh_region || null, expected.region, `${row.english_title} ${region} display region mismatch`);
      assert.equal(Boolean(row.display_title_zh_fallback), Boolean(expected.region && expected.region !== region));
    }
  }

  const catalog = catalogs.HK;
  const aliases = await Promise.all(catalog.map(async (show) => {
    const result = await fetchJson(`/api/shows/${show.id}/aliases?region=HK`);
    assert.equal(result.response.ok, true, `aliases failed for ${show.english_title}`);
    return {
      id: show.id,
      english: show.english_title,
      status: show.status,
      networks: show.networks,
      HK: show.title_zh_hk || null,
      HK_source: show.title_zh_hk_source || null,
      TW: show.title_zh_tw || null,
      TW_source: show.title_zh_tw_source || null,
      CN: show.title_zh_cn || null,
      CN_source: show.title_zh_cn_source || null,
      aliases: (result.body?.data || [])
        .filter((alias) => alias.locale === "zh")
        .map((alias) => ({
          region: alias.region,
          title: alias.title,
          source: alias.source_key,
          preferred: alias.is_preferred,
          confidence: alias.confidence
        }))
    };
  }));

  const searchable = catalog.find((show) => show.title_zh_hk || show.title_zh_tw || show.title_zh_cn);
  assert.ok(searchable, "no Chinese title available for search validation");
  const searchTitle = searchable.title_zh_hk || searchable.title_zh_tw || searchable.title_zh_cn;
  const search = await fetchJson(`/api/shows?q=${encodeURIComponent(searchTitle)}&limit=20&region=HK`);
  assert.equal(search.response.ok, true);
  assert.ok(search.body.data.some((show) => Number(show.id) === Number(searchable.id)), `Chinese alias search did not return ${searchable.english_title}`);

  const unauthorized = await fetchJson("/api/internal/title-override", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ showId: searchable.id, region: "HK", action: "add-alias", title: "should-not-write", confidence: "normal" })
  });
  assert.equal(unauthorized.response.status, 401, "title override endpoint must reject missing internal key");

  console.log("SERIES_HUB_PHASE3B_TITLE_AUDIT");
  console.log(JSON.stringify({
    assets_ready_attempt: ready.attempt,
    health: ready.health.body,
    title_audit: audit,
    catalog_count: catalog.length,
    searchable_example: { id: searchable.id, english: searchable.english_title, query: searchTitle },
    titles: aliases
  }, null, 2));
});
