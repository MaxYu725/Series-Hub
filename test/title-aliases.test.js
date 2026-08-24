import test from "node:test";
import assert from "node:assert/strict";

import {
  aliasPriority,
  normalizeTitleRegion,
  resolveChineseTitle,
  titleRegionFallbacks,
  withResolvedChineseTitle
} from "../src/title-aliases.js";

test("title regions normalize to HK by default", () => {
  assert.equal(normalizeTitleRegion("tw"), "TW");
  assert.equal(normalizeTitleRegion("CN"), "CN");
  assert.equal(normalizeTitleRegion("invalid"), "HK");
});

test("regional fallback order preserves the requested market first", () => {
  assert.deepEqual(titleRegionFallbacks("HK"), ["HK", "TW", "CN"]);
  assert.deepEqual(titleRegionFallbacks("TW"), ["TW", "HK", "CN"]);
  assert.deepEqual(titleRegionFallbacks("CN"), ["CN", "TW", "HK"]);
});

test("manual preferred aliases outrank TMDB preferred aliases", () => {
  const manualPreferred = aliasPriority({ source_key: "manual", is_preferred: 1, confidence: "high" });
  const tmdbPreferred = aliasPriority({ source_key: "tmdb", is_preferred: 1, confidence: "normal" });
  const manualAlternate = aliasPriority({ source_key: "manual", is_preferred: 0, confidence: "high" });

  assert.ok(manualPreferred < tmdbPreferred);
  assert.ok(tmdbPreferred < manualAlternate);
});

test("a non-preferred manual alias does not silently replace a preferred source title", () => {
  assert.ok(
    aliasPriority({ source_key: "tmdb", is_preferred: 1, confidence: "normal" }) <
    aliasPriority({ source_key: "manual", is_preferred: 0, confidence: "official" })
  );
});

test("HK display title falls back to TW without losing provenance", () => {
  const resolved = resolveChineseTitle({
    title_zh_hk: null,
    title_zh_tw: "台灣譯名",
    title_zh_tw_source: "tmdb",
    title_zh_tw_confidence: "normal",
    title_zh_cn: "大陆译名"
  }, "HK");

  assert.deepEqual(resolved, {
    title: "台灣譯名",
    requestedRegion: "HK",
    region: "TW",
    source: "tmdb",
    confidence: "normal",
    fallback: true
  });
});

test("resolved title metadata is added without removing original regional fields", () => {
  const row = withResolvedChineseTitle({
    english_title: "Example",
    title_zh_hk: "香港譯名",
    title_zh_hk_source: "manual",
    title_zh_hk_confidence: "high",
    title_zh_tw: "台灣譯名"
  }, "HK");

  assert.equal(row.title_zh_hk, "香港譯名");
  assert.equal(row.display_title_zh, "香港譯名");
  assert.equal(row.display_title_zh_region, "HK");
  assert.equal(row.display_title_zh_source, "manual");
  assert.equal(row.display_title_zh_fallback, false);
});
