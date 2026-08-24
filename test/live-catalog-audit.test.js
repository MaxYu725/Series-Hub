import test from "node:test";
import assert from "node:assert/strict";

const productionUrl = process.env.PRODUCTION_URL;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path) {
  const response = await fetch(`${productionUrl}${path}`, { cache: "no-store" });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

if (process.env.CI === "true" && productionUrl) {
  test("production has a live TMDB catalog and prints the Phase 1B audit sample", async () => {
    let snapshot = null;
    let last = null;

    for (let attempt = 1; attempt <= 20; attempt += 1) {
      const [health, shows, sync] = await Promise.all([
        fetchJson("/health"),
        fetchJson("/api/shows?limit=100"),
        fetchJson("/api/sync-status")
      ]);

      last = { health, shows, sync };
      const ready =
        health.status === 200 &&
        health.body?.phase === "1-tmdb-core" &&
        health.body?.tmdbConfigured === true &&
        shows.status === 200 &&
        Array.isArray(shows.body?.data) &&
        shows.body.data.length > 0 &&
        sync.status === 200 &&
        sync.body?.data &&
        ["success", "success_with_warnings"].includes(sync.body.data.status);

      if (ready) {
        snapshot = { health: health.body, shows: shows.body, sync: sync.body };
        break;
      }

      if (attempt < 20) await sleep(3000);
    }

    assert.ok(snapshot, `Production TMDB catalog did not become ready: ${JSON.stringify(last)}`);

    const rows = snapshot.shows.data;
    const statusCounts = rows.reduce((counts, row) => {
      const key = row.status || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    const networkCounts = {};
    let chineseAny = 0;
    let posterCount = 0;

    for (const row of rows) {
      if (row.title_zh_hk || row.title_zh_tw || row.title_zh_cn) chineseAny += 1;
      if (row.poster_url) posterCount += 1;
      for (const network of String(row.networks || "").split(" · ").filter(Boolean)) {
        networkCounts[network] = (networkCounts[network] || 0) + 1;
      }
    }

    const sample = rows.slice(0, 40).map((row) => ({
      id: row.id,
      tmdb_id: row.tmdb_id,
      title: row.english_title || row.original_title,
      zh_hk: row.title_zh_hk || null,
      zh_tw: row.title_zh_tw || null,
      zh_cn: row.title_zh_cn || null,
      status: row.status,
      tmdb_status: row.tmdb_status,
      season: row.latest_season_number || null,
      next_air_date: row.next_air_date || null,
      networks: row.networks || null,
      genres: row.genres || null,
      vote_average: row.vote_average || null
    }));

    const audit = {
      catalog_count: rows.length,
      sync: snapshot.sync.data,
      status_counts: statusCounts,
      chinese_title_coverage: `${chineseAny}/${rows.length}`,
      poster_coverage: `${posterCount}/${rows.length}`,
      network_counts: Object.fromEntries(
        Object.entries(networkCounts).sort((a, b) => b[1] - a[1]).slice(0, 20)
      ),
      sample
    };

    console.log(`SERIES_HUB_LIVE_AUDIT\n${JSON.stringify(audit, null, 2)}`);
    assert.ok(rows.length >= 1);
  });
}
