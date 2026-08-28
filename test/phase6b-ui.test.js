import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const html = readFileSync(join(root, "public", "show.html"), "utf8");
const js = readFileSync(join(root, "public", "phase6b-ui.js"), "utf8");
const css = readFileSync(join(root, "public", "phase6b.css"), "utf8");

test("Phase 6B show detail keeps the media-browser layer after 6A.1", () => {
  assert.match(html, /phase6a1\.css/);
  assert.match(html, /phase6b\.css/);
  assert.ok(html.indexOf("phase6a1-ui.js") < html.indexOf("phase6b-ui.js"));
});

test("Phase 6B groups gallery media into all, backdrop and poster filters", () => {
  assert.match(js, /backdrop: "劇照"/);
  assert.match(js, /poster: "海報"/);
  assert.match(js, /data-media-filter/);
  assert.match(js, /查看全部 \$\{filtered\.length\} 張/);
});

test("Phase 6B lightbox supports keyboard and mobile swipe navigation", () => {
  assert.match(js, /showModal/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /pointerdown/);
  assert.match(js, /pointerup/);
  assert.match(js, /Math\.abs\(dx\) < 55/);
});

test("Phase 6B loads original-resolution media only after the viewer opens", () => {
  assert.match(js, /highResolution = new Image\(\)/);
  assert.match(js, /highResolution\.src = item\.full/);
  assert.match(js, /高清載入中/);
  assert.match(js, /resolution\.textContent = "高清"/);
  assert.match(js, /original\.href = item\.full/);
  assert.doesNotMatch(html, /image\.tmdb\.org\/t\/p\/original/);
});

test("Phase 6B lightbox is full-screen and accounts for mobile safe areas", () => {
  assert.match(css, /width: 100dvw/);
  assert.match(css, /height: 100dvh/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /touch-action: pan-y pinch-zoom/);
  assert.match(css, /phase6b-lightbox-thumbs/);
});
