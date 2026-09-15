import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sourceUrlMatchesBase } from "../src/lifecycle.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const migration = readFileSync(join(root, "migrations", "0021_phase10d_korean_lifecycle_sources.sql"), "utf8");
const docs = readFileSync(join(root, "docs", "PHASE10D_KOREAN_LIFECYCLE.md"), "utf8");
const editorialWorkflow = readFileSync(join(root, ".github", "workflows", "lifecycle-evidence.yml"), "utf8");

test("Phase 10D registers bounded official SBS and Netflix Korean lifecycle sources", () => {
  assert.match(migration, /'sbs_news'[\s\S]*?'https:\/\/news\.sbs\.co\.kr\/news\/'[\s\S]*?'official'[\s\S]*?1/);
  assert.match(migration, /'netflix_about_news'[\s\S]*?'https:\/\/about\.netflix\.com\/en\/news\/'[\s\S]*?'official'[\s\S]*?1/);
  assert.match(migration, /Registration does not enable automatic scraping/);
});

test("Phase 10D editorial workflow exposes both registered Korean sources", () => {
  assert.match(editorialWorkflow, /source_key:[\s\S]*options:[\s\S]*- sbs_news[\s\S]*- netflix_about_news/);
  assert.match(editorialWorkflow, /INPUT_SOURCE_KEY: \$\{\{ inputs\.source_key \}\}/);
  assert.match(editorialWorkflow, /\/api\/internal\/lifecycle-evidence/);
});

test("Phase 10D source scopes accept intended articles and reject sibling paths or hosts", () => {
  assert.equal(
    sourceUrlMatchesBase(
      "https://news.sbs.co.kr/news/endPage.do?news_id=N1008049198",
      "https://news.sbs.co.kr/news/"
    ),
    true
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://ent.sbs.co.kr/news/article.do?article_id=E10010312605",
      "https://news.sbs.co.kr/news/"
    ),
    false
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://about.netflix.com/en/news/all-of-us-are-dead-season-2-now-in-production",
      "https://about.netflix.com/en/news/"
    ),
    true
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://about.netflix.com/ko/news/all-of-us-are-dead-season-2-now-in-production",
      "https://about.netflix.com/en/news/"
    ),
    false
  );
});

test("Phase 10D acceptance targets use stable Korean catalog identities and conservative event types", () => {
  assert.match(docs, /Good Partner[\s\S]*TMDB identity: `243761`[\s\S]*normalized event: `renewed`[\s\S]*season: `2`/);
  assert.match(docs, /All of Us Are Dead[\s\S]*TMDB identity: `99966`[\s\S]*normalized event: `filming`[\s\S]*season: `2`/);
  assert.match(docs, /does not infer filming from that announcement/);
  assert.match(docs, /production had begun on season 2/);
});

test("Phase 10D keeps the existing lifecycle and sync boundaries", () => {
  assert.match(docs, /does not:[\s\S]*overwrite `shows\.status`/);
  assert.match(docs, /create a Korean-specific lifecycle schema/);
  assert.match(docs, /add a collector or scraper/);
  assert.match(docs, /add external requests to the catalog or schedule syncs/);
  assert.match(docs, /change US\/KR TMDB request ceilings/);
  assert.match(docs, /existing protected lifecycle editorial path/);
});
