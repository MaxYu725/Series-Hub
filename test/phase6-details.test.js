import test from "node:test";
import assert from "node:assert/strict";
import {
  buildShowDetail,
  normalizeTmdbImages,
  normalizeTmdbVideos
} from "../src/phase6-details.js";

test("Phase 6A prefers official YouTube trailers and rejects unsupported video sites", () => {
  const videos = normalizeTmdbVideos([
    { site: "YouTube", key: "teaser_123", name: "Teaser", type: "Teaser", official: true, iso_639_1: "en" },
    { site: "Vimeo", key: "vimeo_123", name: "Vimeo trailer", type: "Trailer", official: true },
    { site: "YouTube", key: "trailer_456", name: "Official Trailer", type: "Trailer", official: true, iso_639_1: "en" },
    { site: "YouTube", key: "fan_789", name: "Fan Trailer", type: "Trailer", official: false, iso_639_1: "en" }
  ]);

  assert.equal(videos.length, 3);
  assert.equal(videos[0].key, "trailer_456");
  assert.equal(videos[0].official, true);
  assert.match(videos[0].embed_url, /^https:\/\/www\.youtube-nocookie\.com\/embed\//);
  assert.ok(videos.every((video) => !video.watch_url.includes("vimeo")));
});

test("Phase 6A deduplicates TMDB images and keeps high-ranked media first", () => {
  const images = normalizeTmdbImages({
    backdrops: [
      { file_path: "/low.jpg", vote_average: 4, vote_count: 2, width: 1280, height: 720 },
      { file_path: "/high.jpg", vote_average: 8, vote_count: 10, width: 1920, height: 1080 },
      { file_path: "/high.jpg", vote_average: 9, vote_count: 20, width: 1920, height: 1080 }
    ],
    posters: [{ file_path: "/poster.jpg", vote_average: 7, vote_count: 5, width: 1000, height: 1500 }]
  });

  assert.equal(images.backdrops.length, 2);
  assert.match(images.backdrops[0].preview_url, /\/w780\/high\.jpg$/);
  assert.match(images.backdrops[0].full_url, /\/original\/high\.jpg$/);
  assert.equal(images.posters.length, 1);
});

test("Phase 6A keeps stored detail usable when live TMDB media is unavailable", async () => {
  const show = {
    id: 7,
    tmdb_id: 123,
    english_title: "Example Show",
    original_title: "Example Show",
    status: "airing",
    title_zh_hk: "香港例子",
    title_zh_hk_source: "tmdb",
    title_zh_hk_confidence: "normal",
    title_zh_tw: "台灣例子",
    title_zh_tw_source: "tmdb",
    title_zh_tw_confidence: "normal",
    title_zh_cn: null,
    title_zh_cn_source: null,
    title_zh_cn_confidence: null
  };
  const seasons = [{ id: 1, season_number: 1, lifecycle_status: "airing" }];
  const db = {
    prepare(sql) {
      return {
        bind() {
          if (sql.includes("FROM shows s")) return { first: async () => show };
          if (sql.includes("FROM seasons")) return { all: async () => ({ results: seasons }) };
          throw new Error("Unexpected query");
        }
      };
    }
  };

  const result = await buildShowDetail({ DB: db }, 7, "TW");
  assert.equal(result.status, 200);
  assert.equal(result.body.data.show.display_title_zh, "台灣例子");
  assert.equal(result.body.data.media.available, false);
  assert.deepEqual(result.body.data.seasons, seasons);
});
