const SHELL_CACHE = "series-hub-shell-v1";
const SHELL_PREFIX = "series-hub-shell-";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/show.html",
  "/styles.css",
  "/phase3.css",
  "/phase4.css",
  "/phase5.css",
  "/phase5c.css",
  "/phase5d.css",
  "/phase5e.css",
  "/phase6.css",
  "/phase6a1.css",
  "/phase6b.css",
  "/phase6c.css",
  "/phase6c-state.css",
  "/phase6c1.css",
  "/phase7c.css",
  "/phase8.css",
  "/pwa.css",
  "/app.js",
  "/global-search.js",
  "/local-catalog-signals.js",
  "/personal-discovery.js",
  "/phase4-ui.js",
  "/phase5-ui.js",
  "/phase5b-ui.js",
  "/phase5c-ui.js",
  "/phase5d-ui.js",
  "/phase5e-ui.js",
  "/phase5e-ops-ui.js",
  "/phase6-ui.js",
  "/phase6a1-ui.js",
  "/phase6b-ui.js",
  "/phase6c-ui.js",
  "/phase6c-state.js",
  "/phase7c-ui.js",
  "/phase8-ui.js",
  "/phase8e-ui.js",
  "/push-client.js",
  "/schedule-utils.js",
  "/show-details.js",
  "/tracking.js",
  "/viewing-state.js",
  "/pwa.js",
  "/manifest.webmanifest",
  "/icons/series-hub-192.svg",
  "/icons/series-hub-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(SHELL_PREFIX) && key !== SHELL_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function bypassNetworkCache(url) {
  return url.pathname === "/health" || url.pathname.startsWith("/api/");
}

async function networkFirst(request, fallbackRequest = request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackRequest, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || bypassNetworkCache(url)) return;

  if (request.mode === "navigate") {
    const fallback = url.pathname === "/show.html" ? "/show.html" : "/";
    event.respondWith(networkFirst(request, fallback));
    return;
  }

  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(networkFirst(request));
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || "Series Hub 有新的劇集通知。" };
  }

  const title = payload.title || "Series Hub";
  const options = {
    body: payload.body || "你追蹤的劇集有新消息。",
    tag: payload.tag || "series-hub-notification",
    data: payload.data || { url: "/" },
    renotify: false
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        if ("navigate" in client) await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
