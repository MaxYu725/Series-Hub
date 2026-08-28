import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pushCss = fs.readFileSync(new URL("../public/phase5d.css", import.meta.url), "utf8");

test("Phase 5E-D4 keeps the Push settings action at a 44px minimum touch target", () => {
  assert.match(
    pushCss,
    /\.push-settings-button\s*\{[\s\S]*?min-height:\s*44px;/
  );
});
