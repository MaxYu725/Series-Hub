import test from "node:test";
import assert from "node:assert/strict";

const PROD = "https://series-hub.max-yu-jp.workers.dev";

async function fetchJson(path) {
  const response = await fetch(`${PROD}${path}`);
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json();
}

async function waitForSeed(showId, expectedCount) {
  let last;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    last = await fetchJson(`/api/shows/${showId}/lifecycle`);
    if (last.data?.length >= expectedCount) return last;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return last;
}

function event(payload, seasonNumber, eventType) {
  return payload.data.find((row) => Number(row.season_number) === seasonNumber && row.event_type === eventType);
}

test("Phase 4A initial official evidence is live without overwriting TMDB catalog lifecycle", async () => {
  const silo = await waitForSeed(4, 3);
  const fam = await waitForSeed(58, 3);

  assert.equal(silo.show.tmdb_id, 125988);
  assert.equal(silo.show.status, "airing");
  assert.equal(fam.show.tmdb_id, 87917);
  assert.equal(fam.show.status, "planned");

  assert.equal(silo.data.length, 3);
  assert.equal(fam.data.length, 3);

  const siloS3Renewed = event(silo, 3, "renewed");
  const siloS4Renewed = event(silo, 4, "renewed");
  const siloS4Final = event(silo, 4, "final_season");
  const famS6Renewed = event(fam, 6, "renewed");
  const famS6Final = event(fam, 6, "final_season");
  const famS6Pre = event(fam, 6, "pre_production");

  for (const row of [siloS3Renewed, siloS4Renewed, siloS4Final, famS6Renewed, famS6Final, famS6Pre]) {
    assert.ok(row, "expected official evidence row is missing");
    assert.equal(row.source_key, "apple_tv_press");
    assert.equal(row.trust_level, "official");
    assert.equal(row.confidence, "official");
    assert.equal(new URL(row.source_url).hostname, "www.apple.com");
  }

  assert.equal(silo.summary.bySeason["3"].decision.event_type, "renewed");
  assert.equal(silo.summary.bySeason["4"].decision.event_type, "final_season");
  assert.equal(fam.summary.bySeason["6"].decision.event_type, "final_season");
  assert.equal(fam.summary.bySeason["6"].production.event_type, "pre_production");

  assert.equal(siloS3Renewed.evidence_key, "ac00ae9c7010ee5953824e6a7fc9116c359bf31250fd2989eb764621d7421112");
  assert.equal(siloS4Final.evidence_key, "f16d5eeecd10bae46c4c4ca28ff9bd9f396a2653929177d8d217ac3f570e9b64");
  assert.equal(famS6Final.evidence_key, "ea0d5811871bcfb710a617829a5e3ddf1f49c1953f441da722ad4f777b9f6e54");
  assert.equal(famS6Pre.evidence_key, "6d8cdcb8833b61fc99a0f3c6384a5c4b02d2d4254fe67c1b88b64e3e36f4dcbd");

  console.log(JSON.stringify({
    silo: { status: silo.show.status, events: silo.data.map((row) => [row.season_number, row.event_type]) },
    forAllMankind: { status: fam.show.status, events: fam.data.map((row) => [row.season_number, row.event_type]) }
  }));
});
