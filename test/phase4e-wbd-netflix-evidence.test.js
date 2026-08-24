import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { lifecycleEvidenceKey, sourceUrlMatchesBase } from "../src/lifecycle.js";

const migrationUrl = new URL("../migrations/0012_phase4e_wbd_netflix_evidence.sql", import.meta.url);

const evidence = [
  {
    name: "House of the Dragon season 4 renewal",
    showId: 7,
    tmdbId: 94997,
    seasonNumber: 4,
    eventType: "renewed",
    sourceKey: "wbd_pressroom",
    sourceBase: "https://press.wbd.com/",
    sourceUrl: "https://press.wbd.com/na/media-release/hbo-0/hbo-announces-season-renewals-two-game-thrones-franchise-series-setting-new-seasons",
    sourcePublishedAt: "2025-11-20",
    expected: "763cc511b8472f6320ab0f998d66165fd61f09491552c45a4185a87ef1712b9c"
  },
  {
    name: "Wednesday season 3 renewal",
    showId: 66,
    tmdbId: 119051,
    seasonNumber: 3,
    eventType: "renewed",
    sourceKey: "netflix_tudum",
    sourceBase: "https://www.netflix.com/tudum/",
    sourceUrl: "https://www.netflix.com/tudum/articles/wednesday-season-3-release-date",
    sourcePublishedAt: "2026-04-20",
    expected: "e52b580d5d65c36ea19d4e386ce3d6ddc64f605aa05f3e60fae654f74cd95c65"
  },
  {
    name: "Wednesday season 3 filming",
    showId: 66,
    tmdbId: 119051,
    seasonNumber: 3,
    eventType: "filming",
    sourceKey: "netflix_tudum",
    sourceBase: "https://www.netflix.com/tudum/",
    sourceUrl: "https://www.netflix.com/tudum/articles/wednesday-season-3-start-of-production",
    sourcePublishedAt: "2026-02-23",
    expected: "a9ac1f8d2635343890726de3cf3bd35291a51523e8c9f43dd58768d3a91d1f49"
  }
];

test("Phase 4E evidence fingerprints match the runtime editorial contract", async () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  for (const item of evidence) {
    assert.equal(await lifecycleEvidenceKey(item), item.expected, item.name);
    assert.match(migration, new RegExp(item.expected), item.name);
  }
});

test("Phase 4E evidence URLs stay inside their registered official sources", () => {
  for (const item of evidence) {
    assert.equal(sourceUrlMatchesBase(item.sourceUrl, item.sourceBase), true, item.name);
  }
});

test("Phase 4E seeds remain production-identity guarded and official", () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  assert.match(migration, /s\.id = 7 AND s\.tmdb_id = 94997/);
  assert.match(migration, /s\.id = 66 AND s\.tmdb_id = 119051/);
  assert.match(migration, /src\.trust_level = 'official' AND src\.enabled = 1/);
  assert.match(migration, /'wbd_pressroom'/);
  assert.match(migration, /'netflix_tudum'/);
  assert.match(migration, /'official'/);
});
