import test from "node:test";
import assert from "node:assert/strict";

const BASE = "https://series-hub.max-yu-jp.workers.dev";
const TARGETS = ["MobLand", "The Five Star Weekend", "The Bear", "Dark Winds"];

async function fetchJson(path) {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.json();
}

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/[’'\-]/g, "").replace(/\s+/g, " ");
}

for (const title of TARGETS) {
  test(`Phase 7D production catalog probe: ${title}`, async () => {
    const search = await fetchJson(`/api/search?q=${encodeURIComponent(title)}&region=HK&limit=20`);
    const wanted = normalized(title);
    const exact = (search.data || []).find((item) => {
      const titles = [item?.english_title, item?.original_title, item?.display_title];
      return titles.some((value) => normalized(value) === wanted);
    });

    let detail = null;
    if (exact?.id) {
      detail = await fetchJson(`/api/shows/${exact.id}/details?region=HK`);
    }

    const show = detail?.data?.show || exact || null;
    console.log("PHASE7D_CATALOG_PROBE", JSON.stringify({
      query: title,
      found: Boolean(exact),
      showId: exact?.id ?? null,
      tmdbId: show?.tmdb_id ?? show?.tmdbId ?? null,
      englishTitle: show?.english_title ?? exact?.english_title ?? null,
      status: show?.status ?? exact?.status ?? null,
      tmdbStatus: show?.tmdb_status ?? null,
      networks: Array.isArray(detail?.data?.networks)
        ? detail.data.networks.map((network) => network?.name).filter(Boolean)
        : []
    }));

    assert.ok(Array.isArray(search.data));
  });
}
