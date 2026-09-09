import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { improveSearchPayload, rankSearchResults, searchRelevance } from "../src/phase8-search.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function show(id, englishTitle, extra = {}) {
  return {
    id,
    english_title: englishTitle,
    original_title: englishTitle,
    popularity: 10,
    vote_count: 100,
    ...extra
  };
}

test("Phase 8C ranks exact primary titles ahead of popularity-driven partial matches", () => {
  const ranked = rankSearchResults([
    show(1, "The Bear Trap", { popularity: 999 }),
    show(2, "The Bear", { popularity: 5 }),
    show(3, "Bear Country", { popularity: 400 })
  ], "The Bear");

  assert.deepEqual(ranked.map((item) => item.id), [2, 1, 3]);
  assert.equal(ranked[0].search_match_type, "title_exact");
  assert.equal(ranked[0].search_match_label, "劇名完全符合");
});

test("requested regional Chinese title is primary while other aliases remain searchable", () => {
  const regional = show(1, "Reacher", {
    display_title_zh: "神隱任務",
    title_zh_hk: "俠探傑克",
    title_zh_tw: "神隱任務",
    chinese_aliases: "俠探傑克 | 神隱任務"
  });

  assert.equal(searchRelevance(regional, "神隱任務").kind, "title_exact");
  assert.equal(searchRelevance(regional, "俠探傑克").kind, "alias_exact");
});

test("search relevance uses exact, prefix, contains, then episode tiers", () => {
  const ranked = rankSearchResults([
    show(1, "Unrelated", { search_match_episode: "Pilot" }),
    show(2, "Pilot House"),
    show(3, "The Pilot Story"),
    show(4, "Pilot")
  ], "pilot");

  assert.deepEqual(ranked.map((item) => item.id), [4, 2, 3, 1]);
  assert.deepEqual(ranked.map((item) => item.search_match_type), [
    "title_exact",
    "title_prefix",
    "title_contains",
    "episode_exact"
  ]);
});

test("normalization is case-insensitive and NFKC-stable", () => {
  assert.equal(searchRelevance(show(1, "Reacher"), "  REACHER  ").kind, "title_exact");
  assert.equal(searchRelevance(show(2, "ＡＢＣ"), "abc").kind, "title_exact");
});

test("same relevance tier falls back to popularity without changing the search universe", () => {
  const ranked = rankSearchResults([
    show(1, "Bear One", { popularity: 10 }),
    show(2, "Bear Two", { popularity: 80 }),
    show(3, "Bear Three", { popularity: 40 })
  ], "Bear");
  assert.deepEqual(ranked.map((item) => item.id), [2, 3, 1]);
});

test("Phase 8C payload preserves existing search metadata and adds explainable ranking metadata", () => {
  const payload = improveSearchPayload({
    data: [show(1, "The Bear")],
    meta: { global: true, titleMatchCount: 1, episodeMatchCount: 0 }
  }, "The Bear");

  assert.equal(payload.meta.global, true);
  assert.equal(payload.meta.titleMatchCount, 1);
  assert.equal(payload.meta.phase, "8c-search-quality");
  assert.equal(payload.meta.externalRequestsAdded, 0);
  assert.match(payload.meta.relevanceRanking, /exact-primary/);
});

test("Phase 8 wrapper intercepts search only to rerank the existing Phase 6 result", () => {
  const worker = readFileSync(join(root, "src", "phase8-worker.js"), "utf8");
  assert.match(worker, /url\.pathname === "\/api\/search"/);
  assert.match(worker, /phase7Worker\.fetch\(request, env, ctx\)/);
  assert.match(worker, /improveSearchPayload\(payload, query\)/);
  assert.doesNotMatch(worker, /FROM shows/);
  assert.doesNotMatch(worker, /TMDB_API_TOKEN/);
});
