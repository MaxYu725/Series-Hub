# PWA hardening

Status: implementation validation in progress.

## Scope

This phase improves Series Hub as an installable standalone web app without adding catalog, lifecycle, availability or account features.

It covers:

- Web App Manifest and install metadata;
- shared root-scoped service worker registration;
- conservative offline app-shell fallback;
- explicit install prompt surface when supported by the browser;
- user-controlled service-worker update activation;
- mobile standalone and safe-area layout polish;
- preservation of the existing Phase 5D Web Push behavior.

## Shared service worker

Series Hub already used `/push-sw.js` for Web Push subscriptions. PWA hardening deliberately reuses that same root-scoped worker instead of introducing a second competing service worker.

The worker continues to own:

- `push` notification delivery;
- `notificationclick` focus/navigation behavior;
- the same `/` scope used by existing Push subscriptions.

PWA additions are limited to app-shell install, activation, version cleanup and GET navigation/static handling.

## Cache safety boundary

The service worker is intentionally **not** an offline data store.

The following always bypass service-worker caching:

- `/api/*`
- `/health`
- non-GET requests
- cross-origin requests

Catalog, schedule, sync state, Push management and other live API data therefore remain network-authoritative. An offline or failed API request is allowed to fail normally so the existing bounded loading/error/retry UI can communicate that the data is unavailable rather than showing stale data as current.

First-party HTML, CSS, JavaScript, manifest and app icons are pre-cached as the shell. Same-origin shell requests remain network-first while online and use the cached copy only when the network request fails.

## Install contract

`manifest.webmanifest` defines:

- app id, start URL and scope at `/`;
- `display: standalone`;
- matching dark `theme_color` and `background_color`;
- 192×192 and 512×512 icon declarations;
- a maskable 512×512 icon purpose;
- no related native-app preference.

Both the catalog and show-detail documents expose the same manifest, theme, mobile standalone metadata, icon links and `viewport-fit=cover` behavior.

## Update behavior

PWA updates are not force-activated during service-worker install.

When a replacement worker reaches `waiting`, Series Hub displays an explicit `有新版本 · 重新載入` action. Only that user action sends `SKIP_WAITING`; `controllerchange` then reloads once under the new worker.

This avoids an uncontrolled mid-session reload while still making updates visible to installed users, including the case where a worker was already waiting before the page loaded.

## Offline behavior

Offline support is deliberately bounded:

- the application shell can open after it has been installed/cached;
- main and show-detail navigation can fall back to their cached HTML shell;
- previously cached first-party static assets can load;
- live catalog, schedule, availability and detail API data are not replayed from cache;
- existing UI error states remain authoritative when live data cannot be fetched.

This is a resilience layer, not a promise that dynamic Series Hub content is fully usable offline.

## Acceptance gates

Before merge:

1. all existing tests must stay green;
2. PWA regression tests must validate install metadata, shared-worker behavior, API cache exclusion, offline shell fallback, update lifecycle and safe-area behavior;
3. isolated Cloudflare preview must deploy successfully;
4. preview must continue to pass production regression smoke checks;
5. production merge is allowed only after the PR workflow is fully green.
