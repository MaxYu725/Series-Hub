import test from "node:test";
import assert from "node:assert/strict";

import {
  extractTitleAliases,
  isIncludedUsScriptedSeries,
  normalizeLifecycle,
  normalizeTmdbSeries,
  tmdbImageUrl
} from "../src/tmdb.js";

const NOW = new Date("2026-08-24T12:00:00Z");

function baseSeries(overrides = {}) {
  return {
    id: 100,
    name: "Example Show",
    original_name: "Example Show",
    original_language: "en",
    origin_country: ["US"],
    overview: "Example overview",
    first_air_date: "2025-01-01",
    last_air_date: "2026-08-20",
    status: "Returning Series",
    type: "Scripted",
    in_production: true,
    popularity: 50,
    vote_average: 8.2,
    vote_count: 100,
    number_of_seasons: 2,
    number_of_episodes: 16,
    genres: [{ id: 18, name: "Drama" }],
    networks: [{ id: 1, name: "Example Network", origin_country: "US", logo_path: "/logo.png" }],
    seasons: [
      { id: 10, season_number: 1, name: "Season 1", air_date: "2025-01-01", episode_count: 8 },
      { id: 20, season_number: 2, name: "Season 2", air_date: "2026-08-01", episode_count: 8 }
    ],
    translations: { translations: [] },
    ...overrides
  };
}

test("image URLs use TMDB CDN sizes", () => {
  assert.equal(
    tmdbImageUrl("/poster.jpg", "w500"),
    "https://image.tmdb.org/t/p/w500/poster.jpg"
  );
  assert.equal(tmdbImageUrl(null), null);
});

test("US scripted and miniseries are included while reality and animation are excluded", () => {
  assert.equal(isIncludedUsScriptedSeries(baseSeries()), true);
  assert.equal(isIncludedUsScriptedSeries(baseSeries({ type: "Miniseries" })), true);
  assert.equal(isIncludedUsScriptedSeries(baseSeries({ type: "Reality" })), false);
  assert.equal(isIncludedUsScriptedSeries(baseSeries({ origin_country: ["GB"] })), false);
  assert.equal(
    isIncludedUsScriptedSeries(baseSeries({ genres: [{ id: 16, name: "Animation" }] })),
    false
  );
});

test("a scheduled next episode is classified as airing", () => {
  const lifecycle = normalizeLifecycle(
    baseSeries({ next_episode_to_air: { air_date: "2026-08-28" } }),
    NOW
  );

  assert.equal(lifecycle.status, "airing");
  assert.equal(lifecycle.nextAirDate, "2026-08-28");
});

test("a future new season without a next episode is classified as upcoming", () => {
  const lifecycle = normalizeLifecycle(
    baseSeries({
      last_air_date: "2025-05-01",
      last_episode_to_air: { air_date: "2025-05-01" },
      seasons: [
        { id: 10, season_number: 1, air_date: "2025-01-01" },
        { id: 20, season_number: 2, air_date: "2026-10-12" }
      ]
    }),
    NOW
  );

  assert.equal(lifecycle.status, "upcoming");
  assert.equal(lifecycle.nextAirDate, "2026-10-12");
});

test("a returning show between seasons is classified as planned", () => {
  const lifecycle = normalizeLifecycle(
    baseSeries({
      last_air_date: "2025-05-01",
      last_episode_to_air: { air_date: "2025-05-01" },
      seasons: [{ id: 10, season_number: 1, air_date: "2025-01-01" }]
    }),
    NOW
  );

  assert.equal(lifecycle.status, "planned");
});

test("an ended show is classified as completed", () => {
  const lifecycle = normalizeLifecycle(
    baseSeries({
      status: "Ended",
      in_production: false,
      last_air_date: "2025-05-01",
      last_episode_to_air: { air_date: "2025-05-01" }
    }),
    NOW
  );

  assert.equal(lifecycle.status, "completed");
});

test("recently aired non-terminal shows remain airing even when TMDB has no next episode", () => {
  const lifecycle = normalizeLifecycle(
    baseSeries({
      last_episode_to_air: { air_date: "2026-08-20" },
      next_episode_to_air: null
    }),
    NOW
  );

  assert.equal(lifecycle.status, "airing");
});

test("Chinese aliases preserve HK, TW and CN independently", () => {
  const aliases = extractTitleAliases(
    baseSeries({
      translations: {
        translations: [
          { iso_639_1: "zh", iso_3166_1: "HK", name: "Chinese", data: { name: "香港譯名" } },
          { iso_639_1: "zh", iso_3166_1: "TW", name: "Chinese", data: { name: "台灣譯名" } },
          { iso_639_1: "zh", iso_3166_1: "CN", name: "Chinese", data: { name: "大陆译名" } }
        ]
      }
    })
  );

  assert.deepEqual(
    aliases.filter((alias) => alias.locale === "zh").map(({ region, title }) => ({ region, title })),
    [
      { region: "HK", title: "香港譯名" },
      { region: "TW", title: "台灣譯名" },
      { region: "CN", title: "大陆译名" }
    ]
  );
});

test("normalization keeps source status while generating Series Hub lifecycle and season state", () => {
  const normalized = normalizeTmdbSeries(
    baseSeries({
      next_episode_to_air: { air_date: "2026-08-28" },
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg"
    }),
    NOW
  );

  assert.equal(normalized.status, "airing");
  assert.equal(normalized.tmdbStatus, "Returning Series");
  assert.equal(normalized.englishTitle, "Example Show");
  assert.equal(normalized.posterUrl, "https://image.tmdb.org/t/p/w500/poster.jpg");
  assert.equal(normalized.networks[0].isPrimary, 1);
  assert.equal(normalized.seasons.at(-1).lifecycleStatus, "airing");
});
