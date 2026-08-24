import test from "node:test";
import assert from "node:assert/strict";

import { applyTitleOverride, normalizeTitleOverride } from "../src/title-admin.js";

test("title override input is normalized and constrained", () => {
  const result = normalizeTitleOverride({
    showId: "12",
    region: "hk",
    action: "set-preferred",
    title: "  香港譯名  ",
    confidence: "official"
  });

  assert.deepEqual(result.value, {
    showId: 12,
    region: "HK",
    action: "set-preferred",
    title: "香港譯名",
    confidence: "official"
  });

  assert.equal(normalizeTitleOverride({ showId: 0 }).status, 400);
  assert.equal(normalizeTitleOverride({ showId: 1, region: "US", action: "add-alias", title: "x" }).status, 400);
  assert.equal(normalizeTitleOverride({ showId: 1, region: "HK", action: "bad", title: "x" }).status, 400);
});

test("set-preferred uses one D1 batch for the three related mutations", async () => {
  let capturedBatch = null;
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            sql,
            params,
            async first() {
              if (sql.includes("FROM shows")) {
                return { id: 7, english_title: "Example", original_title: "Example" };
              }
              if (sql.includes("preferred_show_titles")) {
                return {
                  show_id: 7,
                  title_zh_hk: "人工香港名",
                  title_zh_hk_source: "manual",
                  title_zh_hk_confidence: "high"
                };
              }
              return null;
            }
          };
        }
      };
    },
    async batch(statements) {
      capturedBatch = statements;
      return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    }
  };

  const request = new Request("https://example.test/api/internal/title-override", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      showId: 7,
      region: "HK",
      action: "set-preferred",
      title: "人工香港名",
      confidence: "high"
    })
  });

  const result = await applyTitleOverride(request, { DB: db });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.preferred.title, "人工香港名");
  assert.equal(result.body.preferred.source, "manual");
  assert.equal(capturedBatch.length, 3);
  assert.match(capturedBatch[0].sql, /UPDATE title_aliases/);
  assert.match(capturedBatch[1].sql, /DELETE FROM title_aliases/);
  assert.match(capturedBatch[2].sql, /INSERT INTO title_aliases/);
});
