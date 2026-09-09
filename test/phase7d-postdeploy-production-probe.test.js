import test from "node:test";
import assert from "node:assert/strict";

const BASE = "https://series-hub.max-yu-jp.workers.dev";
const TARGETS = [
  { title: "MobLand", requiredNow: true },
  { title: "The Five Star Weekend", requiredNow: true },
  { title: "The Bear", requiredNow: false },
  { title: "Dark Winds", requiredNow: false }
];

function normalized(value) {
  return String(value || "").trim().toLowerCase().replace(/[’'\-]/g, "").replace(/\s+/g, " ");
}

async function search(title) {
  const response = await fetch(`${BASE}/api/search?q=${encodeURIComponent(title)}&region=HK&limit=20`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });
  assert.equal(response.status, 200, `${title} search returned ${response.status}`);
  const body = await response.json();
  const wanted = normalized(title);
  const exact = (body.data || []).find((item) =>
    [item?.english_title, item?.original_title, item?.display_title]
      .some((value) => normalized(value) === wanted)
  );
  return exact || null;
}

for (const target of TARGETS) {
  test(`Phase 7D post-deploy production probe: ${target.title}`, async () => {
    const exact = await search(target.title);
    console.log("PHASE7D_POSTDEPLOY_PROBE", JSON.stringify({
      title: target.title,
      requiredNow: target.requiredNow,
      found: Boolean(exact),
      showId: exact?.id ?? null,
      tmdbId: exact?.tmdb_id ?? exact?.tmdbId ?? null,
      status: exact?.status ?? null
    }));
    if (target.requiredNow) {
      assert.ok(exact, `${target.title} should have converged in the immediate Phase 7D production sync`);
    }
  });
}
