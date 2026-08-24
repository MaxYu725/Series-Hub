import test from "node:test";
import assert from "node:assert/strict";

const productionUrl = process.env.PRODUCTION_URL;
const activeStatuses = new Set(["airing", "upcoming", "planned"]);
const targetNetworks = new Set([
  "abc", "amc", "amc+", "amazon", "amazon prime video", "apple tv", "apple tv+",
  "cbs", "disney+", "fox", "fx", "fxx", "freeform", "hbo", "hbo max", "hulu",
  "max", "mgm+", "nbc", "netflix", "paramount+", "peacock", "prime video", "showtime",
  "starz", "syfy", "the cw", "usa network"
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path) {
  const response = await fetch(`${productionUrl}${path}`, { cache: "no-store" });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 500) }; }
  return { status: response.status, body };
}

if (process.env.CI === "true" && productionUrl) {
  test("Phase 1B live catalog reflects the refined active-target policy", async () => {
    let snapshot = null;
    let last = null;

    for (let attempt = 1; attempt <= 45; attempt += 1) {
      const [health, shows, sync] = await Promise.all([
        fetchJson("/health"),
        fetchJson("/api/shows?limit=100"),
        fetchJson("/api/sync-status")
      ]);
      last = { health, shows, sync };

      const ready =
        health.status === 200 &&
        health.body?.tmdbConfigured === true &&
        shows.status === 200 &&
        Array.isArray(shows.body?.data) &&
        shows.body.data.length > 0 &&
        sync.status === 200 &&
        sync.body?.data &&
        ["success", "success_with_warnings"].includes(sync.body.data.status) &&
        Number(sync.body.data.records_seen || 0) > 40;

      if (ready) {
        snapshot = { health: health.body, shows: shows.body, sync: sync.body };
        break;
      }
      if (attempt < 45) await sleep(3000);
    }

    assert.ok(snapshot, `Phase 1B production sync did not become ready: ${JSON.stringify(last)}`);

    const rows = snapshot.shows.data;
    const badStatuses = rows.filter((row) => !activeStatuses.has(row.status));
    const badNetworks = rows.filter((row) => {
      const networks = String(row.networks || "").split(" · ").filter(Boolean);
      return !networks.some((name) => targetNetworks.has(name.trim().toLowerCase()));
    });

    assert.deepEqual(badStatuses.map((row) => [row.english_title, row.status]), []);
    assert.deepEqual(badNetworks.map((row) => [row.english_title, row.networks]), []);

    const statusCounts = {};
    const networkCounts = {};
    let chineseAny = 0;
    let posterCount = 0;

    for (const row of rows) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      if (row.title_zh_hk || row.title_zh_tw || row.title_zh_cn) chineseAny += 1;
      if (row.poster_url) posterCount += 1;
      for (const network of String(row.networks || "").split(" · ").filter(Boolean)) {
        networkCounts[network] = (networkCounts[network] || 0) + 1;
      }
    }

    const selected = [
      "Reacher", "Ted Lasso", "The Rookie", "Grey's Anatomy", "Silo", "House of the Dragon"
    ];
    const focus = rows
      .filter((row) => selected.includes(row.english_title || row.original_title))
      .map((row) => ({
        title: row.english_title || row.original_title,
        status: row.status,
        next_air_date: row.next_air_date,
        season: row.latest_season_number,
        network: row.networks,
        zh_hk: row.title_zh_hk
      }));

    console.log(`SERIES_HUB_PHASE1B_QUALITY_AUDIT\n${JSON.stringify({
      catalog_count: rows.length,
      sync: snapshot.sync.data,
      status_counts: statusCounts,
      chinese_title_coverage: `${chineseAny}/${rows.length}`,
      poster_coverage: `${posterCount}/${rows.length}`,
      network_counts: Object.fromEntries(
        Object.entries(networkCounts).sort((a, b) => b[1] - a[1]).slice(0, 25)
      ),
      focus,
      sample: rows.slice(0, 40).map((row) => ({
        title: row.english_title || row.original_title,
        status: row.status,
        next_air_date: row.next_air_date,
        season: row.latest_season_number,
        networks: row.networks,
        zh_hk: row.title_zh_hk || null
      }))
    }, null, 2)}`);
  });
}
