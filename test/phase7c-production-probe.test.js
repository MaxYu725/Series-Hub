import test from "node:test";
import assert from "node:assert/strict";

const BASE = "https://series-hub.max-yu-jp.workers.dev";

async function fetchJson(path) {
  const response = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, `${path} returned ${response.status}`);
  return response.json();
}

function providerNames(region) {
  const groups = region?.groups || {};
  return [...new Set(Object.values(groups).flat().map((provider) => provider?.name).filter(Boolean))];
}

test("Phase 7C production exposes live Reacher details and TMDB/JustWatch availability", async () => {
  const search = await fetchJson("/api/search?q=Reacher&region=HK&limit=20");
  const show = (search.data || []).find((item) =>
    String(item?.english_title || item?.original_title || "").trim().toLowerCase() === "reacher"
  );
  assert.ok(show, "Reacher is missing from the production catalog");

  const details = await fetchJson(`/api/shows/${show.id}/details?region=HK`);
  assert.equal(Number(details?.data?.show?.id), Number(show.id));

  const availability = await fetchJson(`/api/shows/${show.id}/watch-providers`);
  assert.equal(availability?.meta?.phase, "7c-watch-availability");
  assert.equal(availability?.meta?.configured, true);
  assert.equal(availability?.meta?.error, null);
  assert.deepEqual(availability?.meta?.checkedRegions, ["HK", "US"]);
  assert.equal(availability?.data?.attribution?.source, "JustWatch");
  assert.equal(availability?.data?.attribution?.via, "TMDB");

  const hk = availability?.data?.regions?.HK;
  const us = availability?.data?.regions?.US;
  assert.ok(hk && us, "HK/US availability regions are missing");
  const hkNames = providerNames(hk);
  const usNames = providerNames(us);
  assert.equal(us.available, true, "Reacher should have at least one US watch provider in TMDB/JustWatch");
  assert.ok(usNames.length > 0);

  for (const region of [hk, us]) {
    if (!region.link) continue;
    const link = new URL(region.link);
    assert.equal(link.protocol, "https:");
    assert.ok(link.hostname === "themoviedb.org" || link.hostname.endsWith(".themoviedb.org"));
  }

  console.log("PHASE7C_PRODUCTION_PROBE", JSON.stringify({
    showId: Number(show.id),
    tmdbId: availability.meta.tmdbId,
    detailPhase: details?.meta?.phase || null,
    watchPhase: availability.meta.phase,
    HK: { available: Boolean(hk.available), providers: hkNames },
    US: { available: Boolean(us.available), providers: usNames }
  }));
});
