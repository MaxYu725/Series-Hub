import test from "node:test";
import assert from "node:assert/strict";

import { lifecycleEvidenceKey } from "../src/lifecycle.js";

const SILO_URL = "https://www.apple.com/tv-pr/news/2024/12/apple-tv-renews-hit-world-building-drama-silo-for-seasons-three-and-four/";
const FAM_URL = "https://www.apple.com/tv-pr/news/2026/03/apple-tv-renews-award-winning-and-globally-acclaimed-space-drama-for-all-mankind-for-sixth-and-final-season/";

const CASES = [
  [4, 3, "renewed", SILO_URL, "2024-12-16", "ac00ae9c7010ee5953824e6a7fc9116c359bf31250fd2989eb764621d7421112"],
  [4, 4, "renewed", SILO_URL, "2024-12-16", "5ab203c34a572aa0c0b87f61ccf147113994f24c3ab505bb2b536e1d964fc982"],
  [4, 4, "final_season", SILO_URL, "2024-12-16", "f16d5eeecd10bae46c4c4ca28ff9bd9f396a2653929177d8d217ac3f570e9b64"],
  [58, 6, "renewed", FAM_URL, "2026-03-24", "ebe4b71b747844ff4618e59ac1f95e14a7d7ef9a3c1db89bf58b3aed7df2b807"],
  [58, 6, "final_season", FAM_URL, "2026-03-24", "ea0d5811871bcfb710a617829a5e3ddf1f49c1953f441da722ad4f777b9f6e54"],
  [58, 6, "pre_production", FAM_URL, "2026-03-24", "6d8cdcb8833b61fc99a0f3c6384a5c4b02d2d4254fe67c1b88b64e3e36f4dcbd"]
];

test("initial Phase 4A evidence fingerprints match the runtime editorial key contract", async () => {
  for (const [showId, seasonNumber, eventType, sourceUrl, sourcePublishedAt, expected] of CASES) {
    const actual = await lifecycleEvidenceKey({
      showId,
      seasonNumber,
      eventType,
      sourceKey: "apple_tv_press",
      sourceUrl,
      sourcePublishedAt
    });
    assert.equal(actual, expected);
  }
});
