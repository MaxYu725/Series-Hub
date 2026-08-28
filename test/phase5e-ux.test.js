import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const myShows = fs.readFileSync(new URL("../public/phase5-ui.js", import.meta.url), "utf8");
const ux = fs.readFileSync(new URL("../public/phase5e-ui.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/phase5e.css", import.meta.url), "utf8");
const plan = fs.readFileSync(new URL("../docs/PHASE5E_D_PLAN.md", import.meta.url), "utf8");

test("Phase 5E-D visible product baseline is current", () => {
  assert.match(html, /Phase 5E-D/);
  assert.doesNotMatch(html, /Phase 5D-B/);
  assert.match(html, /phase5e\.css/);
  assert.match(html, /phase5e-ui\.js/);
  assert.match(html, /約 24 小時前提醒/);
});

test("base views expose bounded loading, explicit error and retry behavior", () => {
  assert.match(app, /new AbortController\(\)/);
  assert.match(app, /12000/);
  assert.match(app, /loading-skeleton-card/);
  assert.match(app, /loading-skeleton-row/);
  assert.match(app, /state\.error/);
  assert.match(app, /dataset\.state = "error"/);
  assert.match(app, /series-hub:retry/);
  assert.match(html, /id="retry-view-button"/);
  assert.match(html, /aria-busy="true"/);
});

test("My Shows failure path uses the same in-place retry control", () => {
  assert.match(myShows, /series-hub:retry/);
  assert.match(myShows, /retryViewButton/);
  assert.match(myShows, /可立即重新載入/);
});

test("notification My Shows deep-link waits for the base request before activation", () => {
  assert.match(ux, /SUPPORTED_VIEWS/);
  assert.match(ux, /"my-shows"/);
  assert.match(ux, /afterBaseLoad/);
  assert.match(ux, /#show-count/);
  assert.match(ux, /#my-shows-filter/);
  assert.match(ux, /popstate/);
});

test("mobile controls have visible keyboard focus and minimum touch height", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /prefers-reduced-motion/);
});

test("Phase 6 remains blocked on explicit real-device UI UX acceptance", () => {
  assert.match(plan, /Non-US expansion remains blocked/);
  assert.match(plan, /360–430 px/);
  assert.match(plan, /notification deep-link/);
  assert.match(plan, /Phase 5E-D4 is explicitly accepted/);
});
