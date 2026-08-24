import test from "node:test";
import assert from "node:assert/strict";

import {
  lifecycleDimension,
  lifecycleEvidenceKey,
  normalizeLifecycleEvidence,
  sourceUrlMatchesBase,
  summarizeLifecycleEvents
} from "../src/lifecycle.js";

test("lifecycle dimensions keep decision, production and schedule facts independent", () => {
  assert.equal(lifecycleDimension("renewed"), "decision");
  assert.equal(lifecycleDimension("filming"), "production");
  assert.equal(lifecycleDimension("premiere_dated"), "schedule");
});

test("summary keeps a final-season decision and production state at the same time", () => {
  const summary = summarizeLifecycleEvents([
    {
      id: 20,
      event_type: "renewed",
      season_number: 6,
      source_published_at: "2026-03-24",
      is_retracted: 0
    },
    {
      id: 10,
      event_type: "final_season",
      season_number: 6,
      source_published_at: "2026-03-24",
      is_retracted: 0
    },
    {
      id: 30,
      event_type: "pre_production",
      season_number: 6,
      source_published_at: "2026-03-24",
      is_retracted: 0
    }
  ]);

  assert.equal(summary.decision.event_type, "final_season");
  assert.equal(summary.production.event_type, "pre_production");
  assert.equal(summary.bySeason["6"].decision.event_type, "final_season");
  assert.equal(summary.bySeason["6"].production.event_type, "pre_production");
});

test("same-time production evidence uses semantic precedence rather than insert order", () => {
  const summary = summarizeLifecycleEvents([
    { id: 50, event_type: "filming", season_number: 2, source_published_at: "2026-06-01", is_retracted: 0 },
    { id: 40, event_type: "production_paused", season_number: 2, source_published_at: "2026-06-01", is_retracted: 0 }
  ]);
  assert.equal(summary.production.event_type, "production_paused");
});

test("retracted evidence is excluded from the current summary but can remain in storage", () => {
  const summary = summarizeLifecycleEvents([
    { id: 1, event_type: "renewed", season_number: 4, source_published_at: "2024-12-16", is_retracted: 0 },
    { id: 2, event_type: "cancelled", season_number: 4, source_published_at: "2025-01-01", is_retracted: 1 }
  ]);
  assert.equal(summary.decision.event_type, "renewed");
  assert.equal(summary.eventCount, 1);
});

test("future season evidence is valid even before a season row exists", () => {
  const result = normalizeLifecycleEvidence({
    showId: 42,
    seasonNumber: 6,
    eventType: "renewed",
    sourceKey: "apple_tv_press",
    sourceUrl: "https://www.apple.com/tv-pr/news/2026/03/example/",
    sourceTitle: "Official renewal",
    sourcePublishedAt: "2026-03-24",
    confidence: "official"
  });
  assert.equal(result.status, 200);
  assert.equal(result.value.seasonNumber, 6);
});

test("lifecycle evidence rejects unsupported states and insecure source URLs", () => {
  const badType = normalizeLifecycleEvidence({
    showId: 1,
    eventType: "rumoured",
    sourceKey: "apple_tv_press",
    sourceUrl: "https://www.apple.com/tv-pr/news/example/",
    sourceTitle: "Example",
    sourcePublishedAt: "2026-01-01"
  });
  assert.equal(badType.status, 400);

  const insecure = normalizeLifecycleEvidence({
    showId: 1,
    eventType: "renewed",
    sourceKey: "apple_tv_press",
    sourceUrl: "http://www.apple.com/tv-pr/news/example/",
    sourceTitle: "Example",
    sourcePublishedAt: "2026-01-01"
  });
  assert.equal(insecure.status, 400);
});

test("official source URL matching requires the registered host and path prefix", () => {
  assert.equal(
    sourceUrlMatchesBase(
      "https://www.apple.com/tv-pr/news/2026/03/example/",
      "https://www.apple.com/tv-pr/"
    ),
    true
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://www.apple.com/newsroom/2026/03/example/",
      "https://www.apple.com/tv-pr/"
    ),
    false
  );
  assert.equal(
    sourceUrlMatchesBase(
      "https://example.com/tv-pr/news/example/",
      "https://www.apple.com/tv-pr/"
    ),
    false
  );
});

test("evidence keys are deterministic and distinguish event types", async () => {
  const base = {
    showId: 7,
    seasonNumber: 4,
    eventType: "renewed",
    sourceKey: "apple_tv_press",
    sourceUrl: "https://www.apple.com/tv-pr/news/2024/12/silo/",
    sourcePublishedAt: "2024-12-16"
  };
  assert.equal(await lifecycleEvidenceKey(base), await lifecycleEvidenceKey({ ...base }));
  assert.notEqual(await lifecycleEvidenceKey(base), await lifecycleEvidenceKey({ ...base, eventType: "final_season" }));
});
