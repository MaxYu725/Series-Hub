import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const productionUrl = process.env.PRODUCTION_URL;
const productionDb = process.env.PRODUCTION_DB_NAME || "series-hub-db";
const wranglerVersion = process.env.WRANGLER_VERSION || "4.125.0";
const isTransitionPr = process.env.GITHUB_HEAD_REF === "phase-1a-postdeploy-gate";

async function fetchJsonWithRetry(url, attempts = 10) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return { response, data: await response.json() };
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw lastError;
}

if (process.env.CI === "true" && productionUrl && isTransitionPr) {
  test("one-time transition deploys and verifies the merged Phase 1 core", async () => {
    assert.ok(process.env.CLOUDFLARE_API_TOKEN, "Cloudflare token is required for the transition");
    assert.ok(process.env.CLOUDFLARE_ACCOUNT_ID, "Cloudflare account ID is required for the transition");

    execFileSync(
      "npx",
      ["--yes", `wrangler@${wranglerVersion}`, "d1", "migrations", "apply", productionDb, "--remote"],
      { stdio: "inherit", env: process.env }
    );

    execFileSync(
      "npx",
      ["--yes", `wrangler@${wranglerVersion}`, "deploy"],
      { stdio: "inherit", env: process.env }
    );

    const [healthResult, showsResult, syncResult] = await Promise.all([
      fetchJsonWithRetry(`${productionUrl}/health`),
      fetchJsonWithRetry(`${productionUrl}/api/shows?limit=5`),
      fetchJsonWithRetry(`${productionUrl}/api/sync-status`)
    ]);

    const health = healthResult.data;
    const shows = showsResult.data;
    const sync = syncResult.data;

    assert.equal(health.ok, true);
    assert.equal(health.phase, "1-tmdb-core");
    assert.equal(health.databaseConfigured, true);
    assert.equal(health.databaseReachable, true);
    assert.equal(health.tmdbConfigured, false);
    assert.equal(shows.meta?.phase, "1-tmdb-core");
    assert.ok(Array.isArray(shows.data));
    assert.ok(Object.prototype.hasOwnProperty.call(sync, "data"));
  });
}
