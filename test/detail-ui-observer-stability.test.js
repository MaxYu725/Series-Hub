import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const detailPolishUi = await readFile(new URL("../public/phase6a1-ui.js", import.meta.url), "utf8");

test("detail trailer polish only writes hidden when visibility changes", () => {
  assert.match(detailPolishUi, /const hideSubheading = list\.children\.length === 0;/);
  assert.match(detailPolishUi, /if \(subheading\.hidden !== hideSubheading\) subheading\.hidden = hideSubheading;/);
});

test("detail polish observer does not watch descendant hidden mutations", () => {
  assert.match(detailPolishUi, /subtreeObserver\.observe\(content, \{ childList: true, subtree: true \}\);/);
  assert.match(detailPolishUi, /visibilityObserver\.observe\(content, \{ attributes: true, attributeFilter: \["hidden"\] \}\);/);
  assert.doesNotMatch(detailPolishUi, /subtree: true, attributes: true, attributeFilter: \["hidden"\]/);
});
