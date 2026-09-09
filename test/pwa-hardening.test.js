import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const indexHtml = read("public/index.html");
const showHtml = read("public/show.html");
const pwa = read("public/pwa.js");
const pwaCss = read("public/pwa.css");
const sw = read("public/push-sw.js");
const pushClient = read("public/push-client.js");
const manifest = JSON.parse(read("public/manifest.webmanifest"));

test("PWA manifest satisfies the Series Hub standalone install contract", () => {
  assert.equal(manifest.id, "/");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.prefer_related_applications, false);
  assert.equal(manifest.theme_color, "#0b0d12");
  assert.equal(manifest.background_color, "#0b0d12");
  assert.ok(manifest.name);
  assert.ok(manifest.short_name);

  const icon192 = manifest.icons.find((icon) => icon.sizes === "192x192");
  const icon512 = manifest.icons.find((icon) => icon.sizes === "512x512");
  assert.ok(icon192?.src);
  assert.ok(icon512?.src);
  assert.match(icon512.purpose, /maskable/);
});

test("main and detail documents share manifest standalone and safe-area metadata", () => {
  for (const html of [indexHtml, showHtml]) {
    assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(html, /viewport-fit=cover/);
    assert.match(html, /apple-mobile-web-app-capable" content="yes"/);
    assert.match(html, /rel="stylesheet" href="\/pwa\.css"/);
    assert.match(html, /type="module" src="\/pwa\.js"/);
  }
});

test("PWA and Push reuse one root-scoped service worker", () => {
  assert.match(pwa, /SERVICE_WORKER_URL = "\/push-sw\.js"/);
  assert.match(pwa, /serviceWorker\.register\(SERVICE_WORKER_URL, \{ scope: "\/" \}\)/);
  assert.match(pushClient, /serviceWorker\.register\("\/push-sw\.js", \{ scope: "\/" \}\)/);
  assert.match(sw, /addEventListener\("push"/);
  assert.match(sw, /showNotification/);
  assert.match(sw, /addEventListener\("notificationclick"/);
});

test("every declared PWA precache URL resolves to a real first-party asset", () => {
  const start = sw.indexOf("const PRECACHE_URLS");
  const end = sw.indexOf("];", start);
  const block = sw.slice(start, end);
  const urls = [...block.matchAll(/"(\/[^"]*)"/g)].map((match) => match[1]);

  assert.ok(urls.length > 0);
  for (const url of urls) {
    const relativePath = url === "/" ? "public/index.html" : `public${url}`;
    const target = new URL(`../${relativePath}`, import.meta.url);
    assert.equal(fs.existsSync(target), true, `Missing precache asset: ${url}`);
  }
});

test("service worker never intercepts or caches live API and health data", () => {
  const precacheStart = sw.indexOf("const PRECACHE_URLS");
  const precacheEnd = sw.indexOf("];", precacheStart);
  const precache = sw.slice(precacheStart, precacheEnd);
  assert.doesNotMatch(precache, /\/api\//);
  assert.doesNotMatch(precache, /\/health/);
  assert.match(sw, /url\.pathname === "\/health"/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);

  const bypassIndex = sw.indexOf("bypassNetworkCache(url)) return");
  const respondIndex = sw.indexOf("event.respondWith", bypassIndex);
  assert.ok(bypassIndex >= 0 && respondIndex > bypassIndex);
});

test("offline behavior is shell-only network-first with cached navigation fallback", () => {
  assert.match(sw, /caches\.open\(SHELL_CACHE\).*cache\.addAll\(PRECACHE_URLS\)/s);
  assert.match(sw, /const response = await fetch\(request\)/);
  assert.match(sw, /cache\.match\(fallbackRequest, \{ ignoreSearch: true \}\)/);
  assert.match(sw, /request\.mode === "navigate"/);
  assert.match(sw, /url\.pathname === "\/show\.html" \? "\/show\.html" : "\/"/);
  assert.match(sw, /key\.startsWith\(SHELL_PREFIX\) && key !== SHELL_CACHE/);
});

test("PWA client exposes explicit install and user-controlled update lifecycle", () => {
  assert.match(pwa, /beforeinstallprompt/);
  assert.match(pwa, /event\.preventDefault\(\)/);
  assert.match(pwa, /安裝 Series Hub/);
  assert.match(pwa, /appinstalled/);
  assert.match(pwa, /registration\?\.waiting/);
  assert.match(pwa, /updatefound/);
  assert.match(pwa, /SKIP_WAITING/);
  assert.match(pwa, /controllerchange/);

  const installStart = sw.indexOf('self.addEventListener("install"');
  const activateStart = sw.indexOf('self.addEventListener("activate"', installStart);
  const installBlock = sw.slice(installStart, activateStart);
  assert.doesNotMatch(installBlock, /skipWaiting/);
});

test("standalone UI accounts for mobile safe areas and minimum action target", () => {
  assert.match(pwaCss, /@media \(display-mode: standalone\)/);
  assert.match(pwaCss, /safe-area-inset-top/);
  assert.match(pwaCss, /safe-area-inset-bottom/);
  assert.match(pwaCss, /min-height: 44px/);
});
