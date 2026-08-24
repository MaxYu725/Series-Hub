import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { sourceUrlMatchesBase } from "../src/lifecycle.js";

const SOURCES = [
  {
    key: "wbd_pressroom",
    base: "https://press.wbd.com/",
    valid: "https://press.wbd.com/na/media-release/hbo-renews-example"
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
    key: "netflix_tudum",
    base: "https://www.netflix.com/tudum/",
    valid: "https://www.netflix.com/tudum/articles/wednesday-season-3-start-of-production"
  },
  {
    key: "fox_flash",
    base: "https://www.foxflash.com/",
    valid: "https://www.foxflash.com/releases/view/example-renewal"
  }
];

test("Phase 4 official source URLs match their registered HTTPS bases", () => {
  for (const source of SOURCES) {
    assert.equal(sourceUrlMatchesBase(source.valid, source.base), true, source.key);
  }
});

test("official source validation rejects lookalike hosts and out-of-scope paths", () => {
  assert.equal(
    sourceUrlMatchesBase(
      "https://press.wbd.com.example.com/na/media-release/example",
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
  assert.equal(
    sourceUrlMatchesBase(
      "https://www.netflix.com/title/81231974",
      "https://www.netflix.com/tudum/"
    ),
    false
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://tudum.netflix.com/articles/example",
      "https://www.netflix.com/tudum/"
    ),
    false
  );
});

test("source migrations and browser editorial workflow expose the same official source keys", () => {
  const phase4c = fs.readFileSync(new URL("../migrations/0009_phase4c_official_sources.sql", import.meta.url), "utf8");
  const phase4e = fs.readFileSync(new URL("../migrations/0011_phase4e_netflix_tudum_source.sql", import.meta.url), "utf8");
  const migrations = `${phase4c}\n${phase4e}`;
  const workflow = fs.readFileSync(new URL("../.github/workflows/lifecycle-evidence.yml", import.meta.url), "utf8");

  for (const source of SOURCES) {
    assert.match(migrations, new RegExp(`'${source.key}'`));
    assert.match(workflow, new RegExp(`- ${source.key}`));
  }
});
