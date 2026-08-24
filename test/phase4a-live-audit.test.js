import test from "node:test";
import assert from "node:assert/strict";

const PROD = "https://series-hub.max-yu-jp.workers.dev";

async function getJson(path) {
  const response = await fetch(`${PROD}${path}`);
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json();
}

test("Phase 4A production wrapper and target shows are live", async () => {
  const health = await getJson("/health");
  assert.equal(health.phase, "3-regional-titles");
  assert.equal(health.titleAliasPolicy, "phase-3");
  assert.equal(health.databaseReachable, true);

  const siloSearch = await getJson(`/api/shows?q=${encodeURIComponent("Silo")}&limit=100`);
  const famSearch = await getJson(`/api/shows?q=${encodeURIComponent("For All Mankind")}&limit=100`);

  const silo = siloSearch.data.find((show) => Number(show.tmdb_id) === 125988);
  const fam = famSearch.data.find((show) => Number(show.tmdb_id) === 87917);
  assert.ok(silo, "Silo TMDB 125988 missing from production catalog");
  assert.ok(fam, "For All Mankind TMDB 87917 missing from production catalog");

  const siloLifecycle = await getJson(`/api/shows/${silo.id}/lifecycle`);
  const famLifecycle = await getJson(`/api/shows/${fam.id}/lifecycle`);

  for (const payload of [siloLifecycle, famLifecycle]) {
    assert.equal(payload.meta.evidencePolicy, "phase-4a");
    assert.equal(payload.meta.authoritativeFactsOnly, true);
    assert.ok(Array.isArray(payload.data));
    assert.ok(payload.summary);
  }

  console.log(JSON.stringify({
    silo: { id: silo.id, tmdb_id: silo.tmdb_id, status: silo.status, events: siloLifecycle.data.length },
    forAllMankind: { id: fam.id, tmdb_id: fam.tmdb_id, status: fam.status, events: famLifecycle.data.length }
  }));
});
