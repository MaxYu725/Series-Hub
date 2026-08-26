# Phase 5D — Background notification architecture

Status: **COMPLETE THROUGH PHASE 5D-C — PRODUCTION ACCEPTED**

Phase 5D introduced true background notifications without replacing Series Hub's local-first personalization model with accounts.

## Final architecture decision

Production uses **accountless, device-scoped targeted Web Push with explicit opt-in**.

- no user account is required;
- My Shows remains authoritative in browser storage key `series-hub-tracked-shows-v1`;
- viewing states remain authoritative in browser storage key `series-hub-viewing-states-v1`;
- only after the user explicitly enables notifications does the server store the minimum Push subscription data plus stable Series Hub show IDs selected for notification routing;
- viewing states, search history and normal catalog metadata are not uploaded as personalization data;
- notification permission is requested only from an explicit user action in My Shows;
- disabling notifications unsubscribes the browser and deletes the server subscription, mappings and dependent delivery history;
- the accepted first trigger is `episode_24h` only.

## Why server-side subscription data is required

A closed browser tab cannot rely on page timers or `localStorage` for reliable background reminders. A Service Worker can receive Push events while the page is closed, but it cannot directly use page `localStorage` as a routing database.

Series Hub therefore stores only the minimum notification-specific device routing data rather than moving the complete My Shows or viewing-state model to the server.

## Production notification scope

The accepted production rule is:

> Notify an opted-in device once when a tracked show has a numbered TVmaze episode with a real `air_timestamp` entering the approximately 23–24 hour reminder window.

Rules:

1. Only episodes with a real TVmaze timestamp are eligible.
2. Routing uses stable Series Hub `show_id`; no title fuzzy matching is used.
3. At most one successful `episode_24h` delivery is recorded per subscription + episode identity.
4. Changed timestamps are evaluated from the latest stored episode data before delivery.
5. A date/time without a reliable timestamp does not receive a fabricated precise reminder.
6. Season premieres use the same mechanism.
7. Renewal/cancellation, filming and general-news Push alerts remain outside the accepted Phase 5D-C scope.

## Permission and browser UX

The production flow is:

1. User opens **我的劇集 / My Shows**.
2. User presses **開啟通知**.
3. Series Hub explains that the device Push subscription and selected show IDs will be stored server-side.
4. Only that explicit gesture may invoke `Notification.requestPermission()`.
5. The browser registers `/push-sw.js` and creates a `PushManager` subscription.
6. The server registers the subscription and returns a high-entropy management capability.
7. The raw management capability stays in browser storage; only its SHA-256 hash is stored in D1.
8. **關閉通知** deletes the server subscription and then unsubscribes the browser.

Permission denial does not break My Shows and is not followed by repeated automatic prompts.

## Production D1 model

Migration: `0014_phase5d_push_subscriptions.sql`

### `push_config`

Stores non-secret notification configuration such as the VAPID public key.

### `push_subscriptions`

Stores only notification-device routing material:

- Push endpoint and endpoint hash;
- `p256dh` and `auth` encryption material;
- SHA-256 management-token hash;
- timezone;
- title region (`HK|TW|CN`);
- timestamps and optional disabled state.

It does not store an account, viewing state, search history or user-agent/IP history for this feature.

### `push_subscription_shows`

Maps a subscription to stable Series Hub `show_id` values selected for notifications. It is not the authoritative My Shows database.

### `notification_deliveries`

Stores compact delivery/deduplication facts:

- subscription ID;
- kind (`episode_24h`);
- stable episode entity key;
- scheduled timestamp;
- sent timestamp;
- delivery status/error code.

Unique `(subscription_id, kind, entity_key)` is the successful-delivery deduplication boundary.

## API surface

Device/public routes:

- `GET /api/push/public-key`
- `POST /api/push/subscriptions`
- `PUT /api/push/subscription`
- `DELETE /api/push/subscription`

Protected internal route:

- `POST /api/internal/episode-reminders`
  - default: dry-run/non-sending;
  - `?send=1`: delivery only when the production reminder gate is enabled.

Device mutation routes use same-origin checks and a device management capability rather than an account login.

## Service Worker responsibilities

`public/push-sw.js` remains notification-specific:

- receives targeted Push events;
- parses the compact payload;
- always converts accepted Push delivery into a visible native notification;
- handles notification clicks and opens/focuses Series Hub;
- does not duplicate catalog, lifecycle or tracking state machines.

## Delivery runner

Production cadence: **hourly at minute 7**.

The runner:

1. queries tracked numbered episodes entering the accepted reminder window;
2. joins only active subscription/show mappings;
3. skips already-successful delivery fingerprints;
4. sends encrypted targeted Web Push;
5. records success/failure status;
6. removes Push subscriptions returning permanent 404/410 responses;
7. retries only bounded transient failures while the episode remains eligible;
8. purges stale inactive subscriptions according to the retention policy;
9. limits one run to a bounded send batch so Push fan-out cannot silently grow without an explicit scale review.

Reminder failure is isolated from TMDB and TVmaze sync.

## VAPID and secrets

- VAPID public key: stored in D1 `push_config` and exposed to opted-in browser clients.
- VAPID private key: Cloudflare Worker secret only.
- private key is not stored in GitHub or served to the frontend.
- production bootstrap preserves an existing complete VAPID pair and refuses unsafe key rotation while subscriptions exist.

## Retention and privacy contract

- explicit opt-in only;
- no account creation;
- viewing states remain local;
- notification show IDs are used only for notification routing;
- disabling notifications deletes subscription + mappings + dependent delivery history;
- permanent 404/410 Push endpoints are removed;
- inactive subscriptions are eligible for stale cleanup;
- delivery payload bodies are not retained as history; only compact dedup/status facts remain.

## Phase acceptance history

### Phase 5D-A — Web Push feasibility: COMPLETE

A preview-only isolated spike proved:

- `web-push@3.6.7` works under the Cloudflare Worker `nodejs_compat` environment;
- CI-generated VAPID configuration works;
- Service Worker + PushManager registration works on a real browser;
- a native test notification was received;
- no D1 persistence was required for the spike.

The spike PR was closed without merge and its temporary Worker was deleted.

### Phase 5D-B — accountless subscription persistence: COMPLETE

Isolated and production acceptance proved:

- fresh D1 migration works;
- registration/update/delete works;
- same-origin mutation protection works;
- only the hashed management capability is stored server-side;
- tracked show mappings can be replaced safely;
- no account/viewing-state/search-history data is added;
- a real production browser could enable notifications and fully revoke/delete them again;
- stable VAPID production provisioning works.

### Phase 5D-C — targeted episode reminders: COMPLETE

Implementation and production acceptance proved:

- `EPISODE_REMINDERS_ENABLED` is enabled in production;
- the dedicated hourly cron is live;
- protected production dry-run works without sending or mutating delivery state;
- a real opted-in device subscription and tracked-show mappings were present;
- a real `episode_24h` reminder was sent by production and visibly received on the device;
- the matching D1 delivery record has status `sent`;
- final read-only acceptance found 1 successful `episode_24h` delivery, 0 pending transient failures and 0 terminal failures;
- the active accountless subscription and its two show mappings remained healthy after delivery.

This satisfies the original Phase 5D acceptance requirement for an actual native background notification backed by production delivery evidence.

## Phase 5D-D — optional expansion: DEFERRED

Possible later work:

- official renewal/final-season Push alerts;
- per-show notification-type controls;
- queue/batching architecture if subscription volume requires it.

These are deliberately **not** part of the current accepted notification baseline. The first production model should now be allowed to operate and accumulate reliability evidence before alert scope is widened.

## Current recommendation

Do **not** immediately expand notification types or introduce accounts. Keep the accepted `episode_24h` model running and use the next project phase to harden the US-series product: catalog/schedule coverage, title quality, lifecycle consistency, mobile UX and notification observability. Phase 6 geographic expansion should follow only after that maturity checkpoint.