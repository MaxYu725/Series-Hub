import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/tmdb.js", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../migrations/0002_phase1_tmdb.sql", import.meta.url), "utf8");

test("TMDB genre persistence uses the declared show_genres genre_id foreign key", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS show_genres[\s\S]*genre_id INTEGER NOT NULL/);
  assert.match(source, /show_genres \(show_id, genre_id\) VALUES \(\?1, \?2\)/);
  assert.doesNotMatch(source, /show_genres \(show_id, network_id\)/);
});

test("default persistence cap follows the already-paid detail candidate limit", () => {
  assert.match(source, /const requestedMaxShows = Number\(options\.maxShows\);/);
  assert.match(source, /: detailLimit;/);
  assert.doesNotMatch(source, /Number\(options\.maxShows\) \|\| 30/);
});

test("explicit maxShows override remains bounded by detailLimit", () => {
  assert.match(source, /Math\.min\(Math\.max\(Math\.trunc\(requestedMaxShows\), 1\), detailLimit\)/);
});
