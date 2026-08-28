import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, script, navigation, css, worker, details, wrangler] = await Promise.all([
  readFile(new URL("../public/show.html", import.meta.url), "utf8"),
  readFile(new URL("../public/show-details.js", import.meta.url), "utf8"),
  readFile(new URL("../public/phase6-ui.js", import.meta.url), "utf8"),
  readFile(new URL("../public/phase6.css", import.meta.url), "utf8"),
  readFile(new URL("../src/phase6-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../src/phase6-details.js", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
]);

test("Phase 6A detail page contains the required product surfaces", () => {
  assert.match(html, /id="detail-hero"/);
  assert.match(html, /id="detail-trailer-section"/);
  assert.match(html, /id="detail-images-section"/);
  assert.match(html, /id="detail-seasons"/);
  assert.match(html, /id="detail-lifecycle-section"/);
  assert.match(html, /src="\/show-details\.js"/);
});

test("Phase 6A detail UI keeps TMDB credentials server-side and lazy-loads privacy-enhanced trailer playback", () => {
  assert.doesNotMatch(script, /TMDB_API_TOKEN/);
  assert.match(details, /youtube-nocookie/);
  assert.match(details, /TMDB_API_TOKEN/);
  assert.match(script, /detail-trailer-play/);
  assert.match(script, /createElement\("iframe"\)/);
  assert.match(script, /frame\.src = video\.embed_url/);
});

test("Phase 6A catalog navigation uses stable show ids without mutating card contents", () => {
  assert.match(navigation, /\.show-card\[data-show-id\]/);
  assert.match(navigation, /\.schedule-show-group\[data-show-id\]/);
  assert.match(navigation, /MutationObserver/);
  assert.match(navigation, /childList: true, subtree: true/);
  assert.doesNotMatch(navigation, /innerHTML\s*=/);
});

test("Phase 6A mobile detail layout and worker route are present", () => {
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /detail-image-gallery/);
  assert.match(worker, /\/details\$/);
  assert.match(wrangler, /phase6-worker\.js/);
});