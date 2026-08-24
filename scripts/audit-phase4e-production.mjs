import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";

async function json(path) {
  const response = await fetch(`${PRODUCTION_URL}${path}`, {
    headers: { "cache-control": "no-cache" }
  });
  assert.equal(response.status, 200, `${path} should return 200`);
  return response.json();
}

function findEvent(events, seasonNumber, eventType, sourceKey) {
  return events.find((event) =>
    Number(event.season_number) === seasonNumber &&
    event.event_type === eventType &&
    event.source_key === sourceKey
  );
}

const houseCatalog = await json("/api/shows?q=House%20of%20the%20Dragon&limit=20&region=HK");
const house = houseCatalog.data.find((show) => show.id === 7 && show.tmdb_id === 94997);
assert.ok(house, "House of the Dragon production identity must remain stable");
assert.equal(house.status, "airing");
assert.equal(Number(house.latest_season_number), 3);

const houseLifecycle = await json("/api/shows/7/lifecycle");
assert.equal(houseLifecycle.meta?.authoritativeFactsOnly, true);
const houseRenewal = findEvent(houseLifecycle.data, 4, "renewed", "wbd_pressroom");
assert.ok(houseRenewal, "House of the Dragon season 4 renewal must be live");
assert.equal(houseRenewal.confidence, "official");
assert.equal(houseRenewal.trust_level, "official");
assert.equal(houseRenewal.evidence_key, "763cc511b8472f6320ab0f998d66165fd61f09491552c45a4185a87ef1712b9c");

const wednesdayCatalog = await json("/api/shows?q=Wednesday&limit=20&region=HK");
const wednesday = wednesdayCatalog.data.find((show) => show.id === 66 && show.tmdb_id === 119051);
assert.ok(wednesday, "Wednesday production identity must remain stable");
assert.equal(wednesday.status, "planned");
assert.equal(Number(wednesday.latest_season_number), 3);

const wednesdayLifecycle = await json("/api/shows/66/lifecycle");
assert.equal(wednesdayLifecycle.meta?.authoritativeFactsOnly, true);
const wednesdayRenewal = findEvent(wednesdayLifecycle.data, 3, "renewed", "netflix_tudum");
const wednesdayFilming = findEvent(wednesdayLifecycle.data, 3, "filming", "netflix_tudum");
assert.ok(wednesdayRenewal, "Wednesday season 3 renewal must be live");
assert.ok(wednesdayFilming, "Wednesday season 3 filming evidence must be live");
for (const event of [wednesdayRenewal, wednesdayFilming]) {
  assert.equal(event.confidence, "official");
  assert.equal(event.trust_level, "official");
}
assert.equal(wednesdayRenewal.evidence_key, "e52b580d5d65c36ea19d4e386ce3d6ddc64f605aa05f3e60fae654f74cd95c65");
assert.equal(wednesdayFilming.evidence_key, "a9ac1f8d2635343890726de3cf3bd35291a51523e8c9f43dd58768d3a91d1f49");

assert.equal(wednesdayLifecycle.summary?.bySeason?.["3"]?.decision?.event_type, "renewed");
assert.equal(wednesdayLifecycle.summary?.bySeason?.["3"]?.production?.event_type, "filming");

const bulk = await json("/api/lifecycle");
assert.equal(bulk.meta?.authoritativeFactsOnly, true);
assert.equal(bulk.data?.["7"]?.summary?.bySeason?.["4"]?.decision?.event_type, "renewed");
assert.equal(bulk.data?.["66"]?.summary?.bySeason?.["3"]?.decision?.event_type, "renewed");
assert.equal(bulk.data?.["66"]?.summary?.bySeason?.["3"]?.production?.event_type, "filming");

console.log(JSON.stringify({
  houseOfTheDragon: {
    catalogStatus: house.status,
    latestCatalogSeason: house.latest_season_number,
    officialDecision: [houseRenewal.season_number, houseRenewal.event_type, houseRenewal.source_key]
  },
  wednesday: {
    catalogStatus: wednesday.status,
    latestCatalogSeason: wednesday.latest_season_number,
    officialDecision: [wednesdayRenewal.season_number, wednesdayRenewal.event_type, wednesdayRenewal.source_key],
    officialProduction: [wednesdayFilming.season_number, wednesdayFilming.event_type, wednesdayFilming.source_key]
  }
}, null, 2));
