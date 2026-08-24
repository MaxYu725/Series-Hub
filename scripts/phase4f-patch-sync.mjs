import fs from "node:fs";

const path = "src/tmdb.js";
let source = fs.readFileSync(path, "utf8");

const replacements = [
  [
    '"INSERT OR REPLACE INTO show_genres (show_id, network_id) VALUES (?1, ?2)"',
    '"INSERT OR REPLACE INTO show_genres (show_id, genre_id) VALUES (?1, ?2)"'
  ],
  [
    "const maxShows = Math.min(Math.max(Number(options.maxShows) || 30, 1), 30);",
    "const requestedMaxShows = Number(options.maxShows);\n  const maxShows = Number.isFinite(requestedMaxShows) && requestedMaxShows > 0\n    ? Math.min(Math.max(Math.trunc(requestedMaxShows), 1), detailLimit)\n    : detailLimit;"
  ]
];

for (const [from, to] of replacements) {
  const matches = source.split(from).length - 1;
  if (matches !== 1) throw new Error(`Expected exactly one match for replacement, found ${matches}: ${from}`);
  source = source.replace(from, to);
}

fs.writeFileSync(path, source);
