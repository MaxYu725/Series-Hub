import test from "node:test";
import assert from "node:assert/strict";

import {
  isOfficialLifecycleEvent,
  lifecycleLabel,
  officialLifecycleProjection
} from "../public/phase4-ui.js";

test("Phase 4B UI only treats official confidence from official sources as official", () => {
  assert.equal(isOfficialLifecycleEvent({ confidence: "official", trust_level: "official", is_retracted: 0 }), true);
  assert.equal(isOfficialLifecycleEvent({ confidence: "high", trust_level: "official", is_retracted: 0 }), false);
  assert.equal(isOfficialLifecycleEvent({ confidence: "official", trust_level: "high", is_retracted: 0 }), false);
  assert.equal(isOfficialLifecycleEvent({ confidence: "official", trust_level: "official", is_retracted: 1 }), false);
});

test("official projection keeps decision and production facts independent", () => {
  const projection = officialLifecycleProjection([
    {
      id: 1,
      event_type: "renewed",
      season_number: 6,
      source_published_at: "2026-03-24",
      confidence: "official",
      trust_level: "official",
      is_retracted: 0
    },
    {
      id: 2,
      event_type: "final_season",
      season_number: 6,
      source_published_at: "2026-03-24",
      confidence: "official",
      trust_level: "official",
      is_retracted: 0
    },
    {
      id: 3,
      event_type: "pre_production",
      season_number: 6,
      source_published_at: "2026-03-24",
      confidence: "official",
      trust_level: "official",
      is_retracted: 0
    }
  ]);

  assert.equal(projection.decision.event_type, "final_season");
  assert.equal(projection.production.event_type, "pre_production");
  assert.equal(projection.eventCount, 3);
});

test("non-official newer evidence cannot replace an official UI badge", () => {
  const projection = officialLifecycleProjection([
    {
      id: 1,
      event_type: "renewed",
      season_number: 4,
      source_published_at: "2024-12-16",
      confidence: "official",
      trust_level: "official",
      is_retracted: 0
    },
    {
      id: 2,
      event_type: "cancelled",
      season_number: 4,
      source_published_at: "2026-08-01",
      confidence: "high",
      trust_level: "official",
      is_retracted: 0
    }
  ]);

  assert.equal(projection.decision.event_type, "renewed");
});

test("lifecycle labels remain season-specific", () => {
  assert.equal(lifecycleLabel({ event_type: "final_season", season_number: 4 }), "第4季為最終季");
  assert.equal(lifecycleLabel({ event_type: "pre_production", season_number: 6 }), "第6季製作準備中");
  assert.equal(lifecycleLabel({ event_type: "filming", season_number: 2 }), "第2季拍攝中");
});