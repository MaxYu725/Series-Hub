import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { lifecycleEvidenceKey, sourceUrlMatchesBase } from "../src/lifecycle.js";

const CURRENT_BASE = "https://www.amcglobalmedia.com/20";
const CURRENT_URL = "https://www.amcglobalmedia.com/2026/05/15/maggie-and-negan-unite-to-save-manhattan-in-new-action-packed-teaser-for-season-three-of-the-walking-dead-dead-city/";
const LEGACY_BASE = "https://www.amcnetworks.com/press-releases/";
const MIGRATION = fs.readFileSync(new URL("../migrations/0018_phase7b2_amc_global_media.sql", import.meta.url), "utf8");
const WORKFLOW = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");

test("Phase 7B.2 accepts dated AMC Global Media press permalinks without whitelisting the site root", () => {
  assert.equal(sourceUrlMatchesBase(CURRENT_URL, CURRENT_BASE), true);
  assert.equal(sourceUrlMatchesBase("https://www.amcglobalmedia.com/press/", CURRENT_BASE), false);
  assert.equal(sourceUrlMatchesBase("https://www.amcglobalmedia.com/careers/", CURRENT_BASE), false);
  assert.equal(sourceUrlMatchesBase("https://amcglobalmedia.com/2026/05/15/example/", CURRENT_BASE), false);
});

test("Phase 7B.2 keeps the archival AMC Networks source separate from the current AMC Global Media source", () => {
  assert.match(MIGRATION, /'amc_global_media_press'/);
  assert.match(MIGRATION, /'https:\/\/www\.amcglobalmedia\.com\/20'/);
  assert.doesNotMatch(MIGRATION, /UPDATE\s+sources[\s\S]*amc_networks_press/i);
  assert.doesNotMatch(MIGRATION, /DELETE\s+FROM\s+sources[\s\S]*amc_networks_press/i);
  assert.equal(sourceUrlMatchesBase("https://www.amcnetworks.com/press-releases/example/", LEGACY_BASE), true);
});

test("Phase 7B.2 Dead City season 3 fingerprint matches the runtime editorial key contract", async () => {
  const key = await lifecycleEvidenceKey({
    showId: 1980,
    seasonNumber: 3,
    eventType: "premiere_dated",
    sourceKey: "amc_global_media_press",
    sourceUrl: CURRENT_URL,
    sourcePublishedAt: "2026-05-15"
  });

  assert.equal(key, "b0fea84fd2ac38eb59cd7bfe66be2a2bda3ff880b5db9a9085de470a5c2656f2");
  assert.match(MIGRATION, new RegExp(`'${key}'`));
  assert.match(MIGRATION, /WHERE s\.id = 1980\s+AND s\.tmdb_id = 194583;/);
  assert.match(MIGRATION, /3,\s+'premiere_dated'/);
  assert.match(MIGRATION, /'official'/);
});

test("browser editorial workflow exposes both current and archival AMC source identities", () => {
  assert.match(WORKFLOW, /- amc_networks_press/);
  assert.match(WORKFLOW, /- amc_global_media_press/);
});
