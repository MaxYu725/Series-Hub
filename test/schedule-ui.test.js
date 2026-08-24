import test from "node:test";
import assert from "node:assert/strict";

import {
  addDateKeyDays,
  dateKeyInTimeZone,
  episodeCode,
  episodeLocalDateKey,
  scheduleWindow
} from "../public/schedule-utils.js";

test("a US evening airstamp rolls into the next Hong Kong calendar day", () => {
  const timestamp = "2026-08-24T21:00:00-04:00";
  assert.equal(dateKeyInTimeZone(timestamp, "Asia/Hong_Kong"), "2026-08-25");
});

test("episodes without an airstamp preserve the TVmaze source air date", () => {
  assert.equal(
    episodeLocalDateKey({ air_date: "2026-08-26", air_timestamp: null }, "Asia/Hong_Kong"),
    "2026-08-26"
  );
});

test("episode code is consistently padded", () => {
  assert.equal(episodeCode({ season_number: 4, episode_number: 5 }), "S04E05");
  assert.equal(episodeCode({ season_number: 0, episode_number: 1 }), null);
});

test("seven-day local schedule window includes timezone-shifted episodes only inside the local range", () => {
  const episodes = [
    {
      id: 1,
      english_title: "Late US Show",
      air_date: "2026-08-24",
      air_timestamp: "2026-08-24T21:00:00-04:00"
    },
    {
      id: 2,
      english_title: "Streaming Show",
      air_date: "2026-08-30",
      air_timestamp: null
    },
    {
      id: 3,
      english_title: "Outside Window",
      air_date: "2026-08-31",
      air_timestamp: null
    }
  ];

  const result = scheduleWindow(episodes, "2026-08-24", 7, "Asia/Hong_Kong");
  assert.deepEqual(result.map((episode) => episode.id), [1, 2]);
  assert.equal(episodeLocalDateKey(result[0], "Asia/Hong_Kong"), "2026-08-25");
});

test("date-key arithmetic is stable across month boundaries", () => {
  assert.equal(addDateKeyDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDateKeyDays("2026-09-01", -1), "2026-08-31");
});
