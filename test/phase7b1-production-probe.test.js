import test from "node:test";
import assert from "node:assert/strict";

const PRODUCTION_URL = "https://series-hub.max-yu-jp.workers.dev";
const CASES = [
  { showId: 1711, evidenceKey: "8c860fa6c3896fc8571a067fe6d0938229acfee302745d8fa88c9a03a19bcbee", name: "Tulsa King S4 premiere" },
  { showId: 40, evidenceKey: "105b97190dc6ac61bfa46207b6dfa5ecb86cd8e8338acb15d2ce864228624114", name: "Chicago Fire S15 renewal" },
  { showId: 1067, evidenceKey: "683cc10d987e400cba5f762e43e9523b03bd4ab5fc6be29e17a0bcdb6ae1cb83", name: "Shogun S2 order" },
  { showId: 1980, evidenceKey: "b5e523f63617812e943db547cd12cd2bfe626ba938b95a8008c1fafa4c71fdfe", name: "Dead City S2 premiere" }
];

test("Phase 7B.1 production evidence rows are visible through the public lifecycle API", async () => {
  for (const item of CASES) {
    const response = await fetch(`${PRODUCTION_URL}/api/shows/${item.showId}/lifecycle`);
    assert.equal(response.ok, true, `${item.name}: production lifecycle request failed`);
    const payload = await response.json();
    const match = (payload.data || []).find((row) => row.evidence_key === item.evidenceKey);
    console.log(`PHASE7B1_PRODUCTION ${item.name}: ${JSON.stringify(match || null)}`);
    assert.ok(match, `${item.name}: expected evidence row is absent from production`);
    assert.equal(match.confidence, "official", `${item.name}: evidence is not official`);
  }
});
