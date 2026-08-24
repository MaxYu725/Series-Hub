import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { sourceUrlMatchesBase } from "../src/lifecycle.js";

const SOURCES = [
  {
    key: "wbd_pressroom",
    base: "https://press.wbd.com/",
    valid: "https://press.wbd.com/us/media-release/hbo-renews-example"
  },
  {
    key: "amazon_entertainment",
    base: "https://www.aboutamazon.com/news/entertainment/",
    valid: "https://www.aboutamazon.com/news/entertainment/prime-video-new-series-renewals"
  },
  {
    key: "netflix_media_center",
    base: "https://media.netflix.com/",
    valid: "https://media.netflix.com/en/only-on-netflix/80217863"
  },
  {
    key: "fox_flash",
    base: "https://www.foxflash.com/",
    valid: "https://www.foxflash.com/releases/view/example-renewal"
  }
];

test("Phase 4C official source URLs match their registered HTTPS bases", () => {
  for (const source of SOURCES) {
    assert.equal(sourceUrlMatchesBase(source.valid, source.base), true, source.key);
  }
});

test("official source validation rejects lookalike hosts and out-of-scope Amazon sections", () => {
  assert.equal(
    sourceUrlMatchesBase(
      "https://press.wbd.com.example.com/us/media-release/example",
      "https://press.wbd.com/"
    ),
    false
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://www.aboutamazon.com/news/company-news/example",
      "https://www.aboutamazon.com/news/entertainment/"
    ),
    false
  );
});

test("migration and browser editorial workflow expose the same Phase 4C source keys", () => {
  const migration = fs.readFileSync(new URL("../migrations/0009_phase4c_official_sources.sql", import.meta.url), "utf8");
  const workflow = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");

  for (const source of SOURCES) {
    assert.match(migration, new RegExp(`'${source.key}'`));
    assert.match(workflow, new RegExp(`- ${source.key}`));
  }
});