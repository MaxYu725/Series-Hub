import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { lifecycleEvidenceKey, sourceUrlMatchesBase } from "../src/lifecycle.js";

const evidence = {
  showId: 1,
  seasonNumber: 5,
  eventType: "renewed",
  sourceKey: "amazon_entertainment",
  sourceUrl: "https://www.aboutamazon.com/news/entertainment/prime-video-reacher-how-to-watch",
  sourcePublishedAt: "2026-05-11"
};

test("Reacher season 5 Amazon evidence fingerprint matches the runtime editorial contract", async () => {
  const expected = "13558ece6ebddff8d901a61e00be38e34ad5e4600c493e12ad639946b4549090";
  assert.equal(await lifecycleEvidenceKey(evidence), expected);

  const migration = fs.readFileSync(new URL("../migrations/0010_phase4d_amazon_reacher_evidence.sql", import.meta.url), "utf8");
  assert.match(migration, new RegExp(expected));
});

test("Reacher evidence URL is inside the registered Amazon Entertainment path", () => {
  assert.equal(
    sourceUrlMatchesBase(
      evidence.sourceUrl,
      "https://www.aboutamazon.com/news/entertainment/"
    ),
    true
  );
});

test("Reacher seed remains production-identity guarded and official", () => {
  const migration = fs.readFileSync(new URL("../migrations/0010_phase4d_amazon_reacher_evidence.sql", import.meta.url), "utf8");
  assert.match(migration, /s\.id = 1 AND s\.tmdb_id = 108978/);
  assert.match(migration, /source_key = 'amazon_entertainment'/);
  assert.match(migration, /'official'/);
  assert.match(migration, /season_number, event_type/);
});