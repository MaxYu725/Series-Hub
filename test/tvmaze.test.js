import test from "node:test";
import assert from "node:assert/strict";

import {
  lookupParamsForShow,
  normalizeTvmazeEpisode,
  selectRelevantEpisodes
} from "../src/tvmaze.js";

const NOW = new Date("2026-08-24T12:00:00Z");

test("TVmaze episode normalization keeps schedule facts and strips summary HTML", () => {
  const normalized = normalizeTvmazeEpisode({
    id: 12345,
    season: 4,
    number: 2,
    name: "Second Wave",
    summary: "<p>A <b>new</b> case &amp; clue.</p>",
    airdate: "2026-08-26",
    airtime: "21:00",
    airstamp: "2026-08-27T01:00:00+00:00",
    runtime: 52,
    image: { original: "https://static.tvmaze.com/example.jpg" },
    url: "https://www.tvmaze.com/episodes/12345/example"
  });

  assert.deepEqual(normalized, {
    tvmazeId: 12345,
    seasonNumber: 4,
    episodeNumber: 2,
    name: "Second Wave",
    overview: "A new case & clue.",
    airDate: "2026-08-26",
    airTime: "21:00",
    airTimestamp: "2026-08-27T01:00:00+00:00",
    runtimeMinutes: 52,
    imageUrl: "https://static.tvmaze.com/example.jpg",
    sourceUrl: "https://www.tvmaze.com/episodes/12345/example"
  });
});

test("episode retention keeps recent/future episodes plus the latest historical episode", () => {
  const episodes = [
    { id: 1, season: 1, number: 1, airdate: "2020-01-01" },
    { id: 2, season: 3, number: 8, airdate: "2026-04-01" },
    { id: 3, season: 3, number: 9, airdate: "2026-05-01" },
    { id: 4, season: 4, number: 1, airdate: "2026-08-20" },
    { id: 5, season: 4, number: 2, airdate: "2026-08-27" },
    { id: 6, season: 4, number: 3, airdate: "2026-09-03" }
  ];

  assert.deepEqual(
    selectRelevantEpisodes(episodes, NOW).map((episode) => episode.id),
    [4, 5, 6]
  );
});

test("latest historical episode is retained when a show has been off air for more than 90 days", () => {
  const episodes = [
    { id: 1, season: 1, number: 1, airdate: "2020-01-01" },
    { id: 2, season: 5, number: 10, airdate: "2025-11-10" },
    { id: 3, season: 6, number: 1, airdate: "2027-01-01" }
  ];

  assert.deepEqual(
    selectRelevantEpisodes(episodes, NOW).map((episode) => episode.id),
    [2, 3]
  );
});

test("exact TVmaze lookup prefers IMDb and falls back to TheTVDB", () => {
  assert.deepEqual(
    lookupParamsForShow({ imdb_id: "tt1234567", thetvdb_id: 999 }),
    { imdb: "tt1234567" }
  );
  assert.deepEqual(lookupParamsForShow({ imdb_id: null, thetvdb_id: 999 }), { thetvdb: 999 });
  assert.equal(lookupParamsForShow({}), null);
});

test("invalid specials or undated episodes are not normalized into the numbered schedule", () => {
  assert.equal(normalizeTvmazeEpisode({ id: 1, season: 0, number: 1, airdate: "2026-08-24" }), null);
  assert.equal(normalizeTvmazeEpisode({ id: 2, season: 1, number: null, airdate: "2026-08-24" }), null);
  assert.equal(normalizeTvmazeEpisode({ id: 3, season: 1, number: 1, airdate: null }), null);
});
