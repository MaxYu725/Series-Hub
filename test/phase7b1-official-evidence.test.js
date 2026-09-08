import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { lifecycleEvidenceKey, sourceUrlMatchesBase } from "../src/lifecycle.js";

const migrationUrl = new URL("../migrations/0016_phase7b1_official_evidence.sql", import.meta.url);

const evidence = [
  {
    name: "Tulsa King season 4 premiere date",
    showId: 1711,
    tmdbId: 153312,
    seasonNumber: 4,
    eventType: "premiere_dated",
    sourceKey: "paramount_press_express",
    sourceBase: "https://www.paramountpressexpress.com/",
    sourceUrl: "https://www.paramountpressexpress.com/paramount-television-studios/shows/tulsa-king/releases/?view=113200-tulsa-king-season-four-premieres-october-16-on-paramount",
    sourcePublishedAt: "2026-09-01",
    expected: "8c860fa6c3896fc8571a067fe6d0938229acfee302745d8fa88c9a03a19bcbee"
  },
  {
    name: "Chicago Fire season 15 renewal",
    showId: 40,
    tmdbId: 44006,
    seasonNumber: 15,
    eventType: "renewed",
    sourceKey: "nbcuniversal_newsroom",
    sourceBase: "https://www.nbcuniversal.com/article/",
    sourceUrl: "https://www.nbcuniversal.com/article/nbc-renews-one-chicago-franchise-continuing-long-running-production-illinois",
    sourcePublishedAt: "2026-04-10",
    expected: "105b97190dc6ac61bfa46207b6dfa5ecb86cd8e8338acb15d2ce864228624114"
  },
  {
    name: "Shogun season 2 conservative future-season order",
    showId: 1067,
    tmdbId: 126308,
    seasonNumber: 2,
    eventType: "ordered",
    sourceKey: "disney_newsroom",
    sourceBase: "https://thewaltdisneycompany.com/news/",
    sourceUrl: "https://thewaltdisneycompany.com/news/shogun-more-seasons-fx-hulu-james-clavell/",
    sourcePublishedAt: "2024-05-16",
    expected: "683cc10d987e400cba5f762e43e9523b03bd4ab5fc6be29e17a0bcdb6ae1cb83"
  },
  {
    name: "The Walking Dead Dead City season 2 premiere date",
    showId: 1980,
    tmdbId: 194583,
    seasonNumber: 2,
    eventType: "premiere_dated",
    sourceKey: "amc_networks_press",
    sourceBase: "https://www.amcnetworks.com/press-releases/",
    sourceUrl: "https://www.amcnetworks.com/press-releases/amc-networks-announces-may-4-return-for-the-walking-dead-dead-city-and-debuts-opening-minutes-from-the-highly-anticipated-season-two-premiere-episode/",
    sourcePublishedAt: "2025-02-25",
    expected: "b5e523f63617812e943db547cd12cd2bfe626ba938b95a8008c1fafa4c71fdfe"
  }
];

test("Phase 7B.1 evidence fingerprints match the runtime editorial contract", async () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  for (const item of evidence) {
    assert.equal(await lifecycleEvidenceKey(item), item.expected, item.name);
    assert.match(migration, new RegExp(item.expected), item.name);
  }
});

test("Phase 7B.1 evidence stays inside each registered official source", () => {
  for (const item of evidence) {
    assert.equal(sourceUrlMatchesBase(item.sourceUrl, item.sourceBase), true, item.name);
  }
});

test("Phase 7B.1 seeds remain fixed-production-identity guarded and official", () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  for (const item of evidence) {
    assert.match(migration, new RegExp(`s\\.id = ${item.showId}\\s+AND s\\.tmdb_id = ${item.tmdbId}`), item.name);
    assert.match(migration, new RegExp(`'${item.sourceKey}'`), item.name);
  }
  assert.match(migration, /src\.trust_level = 'official'/);
  assert.match(migration, /src\.enabled = 1/);
  assert.match(migration, /'official'/);
});

test("Phase 7B.1 does not misstate Shogun development as filming", () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  assert.match(migration, /production timing was not yet locked/i);
  assert.doesNotMatch(migration, /126308[\s\S]{0,900}'filming'/);
});
