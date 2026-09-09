import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PERSONAL_STATE_WEIGHTS,
  buildPersonalProfile,
  rankPersonalCandidates
} from "../public/personal-discovery.js";
import {
  LOCAL_CATALOG_SIGNAL_LIMIT,
  LOCAL_CATALOG_SIGNALS_KEY,
  loadCatalogSignals,
  rememberCatalogSignals
} from "../public/local-catalog-signals.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

const SIGNAL_SHOWS = [
  { id: 1, genres: "Drama · Crime", networks: "HBO" },
  { id: 2, genres: "Comedy", networks: "NBC" }
];

const CANDIDATES = [
  { id: 1, english_title: "Tracked", genres: "Drama", networks: "HBO", popularity: 99, vote_average: 9, vote_count: 1000, status: "airing" },
  { id: 10, english_title: "Drama Match", genres: "Drama", networks: "FX", popularity: 12, vote_average: 7.5, vote_count: 300, status: "airing" },
  { id: 11, english_title: "Comedy Match", genres: "Comedy", networks: "NBC", popularity: 90, vote_average: 8.8, vote_count: 1500, status: "airing" },
  { id: 12, english_title: "Generic Hit", genres: "Sci-Fi", networks: "Apple TV", popularity: 120, vote_average: 9.1, vote_count: 2200, status: "airing" }
];

test("Phase 8D weights active viewing states more strongly than paused history", () => {
  assert.ok(PERSONAL_STATE_WEIGHTS.watching > PERSONAL_STATE_WEIGHTS.completed);
  assert.ok(PERSONAL_STATE_WEIGHTS.waiting > PERSONAL_STATE_WEIGHTS.paused);

  const profile = buildPersonalProfile(SIGNAL_SHOWS, [1, 2], { 1: "watching", 2: "paused" });
  assert.equal(profile.personalized, true);
  assert.equal(profile.matchedTrackedShows, 2);

  const genreScores = new Map(profile.topGenres.map((item) => [item.value, item.score]));
  assert.equal(genreScores.get("Drama"), genreScores.get("Crime"));
  assert.ok(genreScores.get("Drama") > genreScores.get("Comedy"));
  assert.equal(profile.topNetworks[0].value, "HBO");
});

test("Phase 8D excludes already tracked shows and puts strong local taste matches first", () => {
  const result = rankPersonalCandidates(
    CANDIDATES,
    SIGNAL_SHOWS,
    [1, 2],
    { 1: "watching", 2: "paused" },
    10
  );

  assert.equal(result.profile.personalized, true);
  assert.doesNotMatch(result.items.map((item) => String(item.id)).join(","), /(^|,)1(,|$)/);
  assert.equal(result.items[0].id, 10);
  assert.match(result.items[0].personal_reason, /Drama/);
});

test("Phase 8D is explicit when local preference signals are insufficient", () => {
  const result = rankPersonalCandidates(CANDIDATES, [], [999], { 999: "watching" }, 3);
  assert.equal(result.profile.personalized, false);
  assert.equal(result.profile.trackedCount, 1);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.personal_reason === "熱門與評分較高"));
});

test("local catalog signals remain minimal, bounded and browser-local", () => {
  const storage = memoryStorage();
  const shows = Array.from({ length: LOCAL_CATALOG_SIGNAL_LIMIT + 25 }, (_, index) => ({
    id: index + 1,
    english_title: `Private title ${index + 1}`,
    genres: index % 2 ? "Drama" : "Comedy",
    networks: "Example Network",
    poster_url: `https://example.test/${index + 1}.jpg`
  }));

  const saved = rememberCatalogSignals(shows, storage);
  assert.equal(Object.keys(saved).length, LOCAL_CATALOG_SIGNAL_LIMIT);
  assert.equal(Object.hasOwn(saved, "1"), false);
  const last = saved[String(LOCAL_CATALOG_SIGNAL_LIMIT + 25)];
  assert.deepEqual(Object.keys(last).sort(), ["genres", "id", "networks"]);
  assert.equal(storage.getItem(LOCAL_CATALOG_SIGNALS_KEY).includes("Private title"), false);
  assert.deepEqual(loadCatalogSignals(storage), saved);
});

test("Phase 8D UI requests only a generic candidate pool and never serializes local tracking state", () => {
  const html = readFileSync(join(root, "public", "index.html"), "utf8");
  const ui = readFileSync(join(root, "public", "phase8-ui.js"), "utf8");
  const myShows = readFileSync(join(root, "public", "phase5-ui.js"), "utf8");
  const css = readFileSync(join(root, "public", "phase8.css"), "utf8");

  assert.match(html, /Phase 8D/);
  assert.match(html, /id="phase8-personal-toggle">為你</);
  assert.match(ui, /new URLSearchParams\(\{ region, mode: "browse", limit: "100", sort: "popular" \}\)/);
  assert.match(ui, /loadTrackedShowIds\(\)/);
  assert.match(ui, /loadViewingStates\(\)/);
  assert.match(ui, /伺服器只收到通用 catalog request/);
  assert.doesNotMatch(ui, /params\.set\(["'](?:tracked|tracking|viewing|viewing_state|show_ids)/i);
  assert.match(myShows, /rememberCatalogSignals\(shows\)/);
  assert.match(css, /\.show-grid\.is-personal/);
  assert.match(css, /\.personal-reason/);
});
