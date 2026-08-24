import assert from "node:assert/strict";

const API = "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_API_TOKEN;
assert.ok(TOKEN, "TMDB_API_TOKEN is required");

async function tmdb(path, params = {}) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const response = await fetch(url, {
    headers: { accept: "application/json", authorization: `Bearer ${TOKEN}` }
  });
  assert.equal(response.status, 200, `${url.pathname} should return 200`);
  return response.json();
}

const base = {
  include_adult: false,
  language: "en-US",
  page: 1,
  with_origin_country: "US",
  with_type: "2|4",
  without_genres: "16|99|10762|10763|10764|10767",
  with_networks: 19
};

const search = await tmdb("/search/tv", { query: "Murder in a Small Town", language: "en-US" });
const exact = (search.results || []).find((item) => String(item.name || "").toLowerCase() === "murder in a small town") || search.results?.[0];
assert.ok(exact?.id, "Murder in a Small Town must resolve in TMDB search");

const details = await tmdb(`/tv/${exact.id}`, { language: "en-US" });

async function feed(label, sortBy, extra = {}) {
  const data = await tmdb("/discover/tv", { ...base, sort_by: sortBy, ...extra });
  const rows = data.results || [];
  return {
    label,
    sortBy,
    extra,
    targetRank: rows.findIndex((item) => item.id === exact.id) + 1 || null,
    first10: rows.slice(0, 10).map((item, index) => ({ rank: index + 1, id: item.id, name: item.name, first_air_date: item.first_air_date, popularity: item.popularity }))
  };
}

const feeds = [
  await feed("current", "popularity.desc"),
  await feed("recent-from-2022", "popularity.desc", { "first_air_date.gte": "2022-01-01" }),
  await feed("recent-from-2023", "popularity.desc", { "first_air_date.gte": "2023-01-01" }),
  await feed("recent-from-2024", "popularity.desc", { "first_air_date.gte": "2024-01-01" }),
  await feed("newest-first", "first_air_date.desc")
];

console.log(JSON.stringify({
  target: {
    id: exact.id,
    name: details.name,
    status: details.status,
    type: details.type,
    origin_country: details.origin_country,
    first_air_date: details.first_air_date,
    last_air_date: details.last_air_date,
    in_production: details.in_production,
    number_of_seasons: details.number_of_seasons,
    networks: (details.networks || []).map((network) => [network.id, network.name])
  },
  feeds
}, null, 2));
