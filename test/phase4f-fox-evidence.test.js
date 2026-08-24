import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { lifecycleEvidenceKey, sourceUrlMatchesBase } from "../src/lifecycle.js";

const evidence = {
  showId: 431,
  seasonNumber: 3,
  eventType: "renewed",
  sourceKey: "fox_flash",
  sourceUrl: "https://www.foxflash.com/shows/murder-in-a-small-town/releases/print/fox-television-network-renews-murder-in-a-small-town-for-season-three",
  sourcePublishedAt: "2026-05-07"
};

const migrationUrl = new URL("../migrations/0013_phase4f_fox_murder_small_town_evidence.sql", import.meta.url);

test("Murder in a Small Town season 3 FOX evidence fingerprint matches runtime contract", async () => {
  const expected = "6f187c02de32779b755a304d305c671575390d77aea0df6c30157a830cd36be0";
  assert.equal(await lifecycleEvidenceKey(evidence), expected);

  const migration = fs.readFileSync(migrationUrl, "utf8");
  assert.match(migration, new RegExp(expected));
});

test("FOX evidence URL stays inside the registered FOXFLASH HTTPS base", () => {
  assert.equal(sourceUrlMatchesBase(evidence.sourceUrl, "https://www.foxflash.com/"), true);
  assert.equal(
    sourceUrlMatchesBase(
      "https://www.foxflash.com.example.com/shows/murder-in-a-small-town/releases/example",
      "https://www.foxflash.com/"
    ),
    false
  );
});

test("FOX seed is production-identity guarded and official", () => {
  const migration = fs.readFileSync(migrationUrl, "utf8");
  assert.match(migration, /s\.id = 431 AND s\.tmdb_id = 241549/);
  assert.match(migration, /src\.source_key = 'fox_flash'/);
  assert.match(migration, /src\.trust_level = 'official'/);
  assert.match(migration, /src\.enabled = 1/);
  assert.match(migration, /\n  3,\n  'renewed',/);
  assert.match(migration, /'2026-05-07'/);
  assert.match(migration, /'official'/);
});
