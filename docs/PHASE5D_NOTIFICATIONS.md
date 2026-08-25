# Phase 5D — Notification architecture design

Status: **DESIGN / FEASIBILITY GATE**

Phase 5D deliberately separates background notifications from Phase 5A–5C local personalization. My Shows, tracked-only schedule filtering and viewing states remain browser-local and usable without notifications.

The purpose of this phase is to choose a notification architecture before adding a Service Worker, Push API subscription, server-side subscription data or notification cron.

## Decision summary

Recommended model: **accountless, device-scoped targeted Web Push with explicit opt-in**.

- no user account is required;
- local My Shows remains authoritative in `series-hub-tracked-shows-v1`;
- local viewing states remain authoritative in `series-hub-viewing-states-v1`;
- when the user explicitly enables notifications, the server may store only the minimum device subscription data and the subset of stable Series Hub show IDs selected for notifications;
- viewing states, titles, search history and other local personalization are not uploaded;
- notification permission is never requested automatically on page load;
- disabling notifications deletes the device subscription and its show mappings from D1;
- first production trigger should be a narrowly defined episode reminder, not a broad collection of renewal/news alerts.

This is a new privacy boundary compared with Phase 5A–5C and must be treated as such.

## Why pure localStorage cannot provide reliable background notifications

The current Phase 5A–5C design is intentionally local-only. That works while the page is open, but a closed browser tab cannot rely on page timers or `localStorage` to create reliable background notifications.

A Service Worker can receive Push API events while the page is closed, but it cannot directly read page `localStorage`. A generic push sent to every device and then silently discarded by non-matching clients is also a poor production model: it wastes fan-out work and can conflict with browser expectations that push delivery results in a user-visible notification.

Therefore reliable targeted background delivery requires the backend to know which subscribed device should receive which show notification. The proposed compromise is to store only notification-specific show IDs for an anonymous device subscription rather than moving the full My Shows profile to the server.

## Alternatives considered

### A. Foreground-only browser notifications

Keep all personalization local and use the Notifications API only while the site is open.

Advantages:

- no new server-side personal data;
- no Push API subscription storage;
- simplest implementation.

Limitations:

- not a true background reminder;
- unreliable when the tab/browser is closed;
- does not satisfy the intended notification feature.

**Decision:** retain as fallback behavior, not the primary Phase 5D target.

### B. Generic Web Push to every subscriber, filter locally

Send a generic push after each data sync and let the Service Worker inspect local mirrored state.

Advantages:

- backend does not need show selections.

Limitations:

- Service Worker cannot use `localStorage`, so state must be duplicated into IndexedDB;
- every subscriber receives every sync wake-up;
- non-matching pushes may become silent pushes;
- inefficient and difficult to scale cleanly;
- user-visible-only push behavior becomes harder to guarantee.

**Decision:** reject for production.

### C. Accountless targeted Web Push

Store a browser/device push subscription plus only the show IDs enabled for notifications.

Advantages:

- targeted delivery;
- no account or identity system;
- local My Shows and viewing states stay local-first;
- avoids waking unrelated devices;
- clean deduplication and unsubscribe semantics.

Costs:

- creates a small server-side pseudonymous personalization dataset;
- requires VAPID/Web Push sender support, D1 tables, a Service Worker and a delivery runner;
- requires explicit privacy/retention rules.

**Decision:** recommended architecture.

## Initial notification scope

The first production notification should be intentionally narrow:

> **Tracked episode reminder:** notify a subscribed device once when a selected show has a numbered episode with a reliable `air_timestamp` entering the next 24-hour window.

Rules:

1. Only TVmaze episodes with a real timestamp are eligible.
2. Use stable Series Hub `show_id` and episode identity; never title fuzzy matching.
3. Send at most one `episode_24h` notification per subscription + episode.
4. If the timestamp changes before delivery, use the updated timestamp.
5. If only source `air_date` / `air_time` exists, do not fabricate a precise reminder time.
6. Season premieres (`SxxE01`) naturally use the same trigger and may receive a premiere-specific label in the payload/UI.
7. Renewal/cancellation, filming and general news alerts remain out of the first implementation slice.

This keeps Phase 5D grounded in the already accepted TVmaze schedule contract.

## Permission UX

Notification permission must be user initiated.

Recommended My Shows flow:

1. User opens **我的劇集**.
2. User chooses **開啟通知**.
3. Series Hub explains what will leave the browser: a device push subscription and selected show IDs only.
4. Only then call `Notification.requestPermission()` from the user gesture.
5. If granted, create a `PushManager` subscription and register it with Series Hub.
6. If denied, keep My Shows fully functional and do not repeatedly prompt.
7. **關閉通知** must unsubscribe in the browser and delete the server-side subscription record.

No permission prompt should appear automatically during normal catalog browsing.

## Proposed server-side data model

No account/user/profile table is required.

### `push_subscriptions`

Suggested fields:

- `id` — internal integer primary key;
- `endpoint_hash` — unique hash used for deduplication/lookups;
- `endpoint` — Push API endpoint;
- `p256dh` — browser public encryption key;
- `auth` — browser auth secret;
- `manage_token_hash` — hash of a random capability token used to update/delete this device subscription;
- `timezone` — IANA browser timezone for display/reminder semantics when needed;
- `title_region` — `HK|TW|CN` for notification title preference;
- `created_at`;
- `updated_at`;
- `last_seen_at`;
- `disabled_at` nullable.

Do **not** store IP address, user-agent history, search history, viewing state or title metadata as part of this feature.

### `push_subscription_shows`

Suggested fields:

- `subscription_id`;
- `show_id`;
- `created_at`;
- unique `(subscription_id, show_id)`.

This table represents only the shows that this device opted to receive notifications for. It is not a server-authoritative copy of My Shows.

### `notification_deliveries`

Suggested fields:

- `subscription_id`;
- `kind` — initially `episode_24h`;
- `entity_key` — stable episode fingerprint/ID;
- `scheduled_for`;
- `sent_at`;
- `status`;
- `error_code` nullable;
- unique `(subscription_id, kind, entity_key)`.

The unique constraint is the primary duplicate-delivery guard.

## Subscription-management capability

Because there is no account, subscription mutation needs a device-scoped capability rather than an identity login.

Recommended contract:

- registration returns a high-entropy random management token;
- only a hash of the management token is stored in D1;
- the raw token remains in browser storage alongside notification settings;
- update/delete calls send the token in an authorization header, not in URLs;
- losing site storage simply means the old subscription becomes stale and is eventually purged or can be replaced by a new one.

The Push endpoint itself should not be treated as sufficient authorization for mutation.

## Proposed API surface

Public/device endpoints:

- `GET /api/push/public-key` — returns the VAPID public key only;
- `POST /api/push/subscriptions` — register a device subscription and initial notification show IDs;
- `PUT /api/push/subscription` — update notification show IDs / timezone / title region using the management token;
- `DELETE /api/push/subscription` — revoke/delete the current device subscription using the management token.

Protected/internal endpoint or scheduled handler:

- notification-delivery runner, protected by the existing internal authorization pattern when invoked over HTTP;
- normal cron execution should call the same internal delivery logic without exposing a public mutation path.

All device write routes must enforce strict size limits, HTTPS Push endpoints, bounded show-ID counts and same-origin browser use where applicable.

## Service Worker responsibilities

The Service Worker should stay small and notification-specific.

Responsibilities:

- receive targeted `push` events;
- validate/parse a compact notification payload;
- call `registration.showNotification()`;
- route notification clicks to Series Hub / My Shows;
- handle subscription-change events by asking the page/server to refresh registration when possible;
- contain no canonical catalog, lifecycle or tracking logic.

The Service Worker should not become a second application backend or duplicate the main catalog state machine.

## Delivery runner

Recommended first runner cadence: **hourly**.

Each run should:

1. query upcoming TVmaze-backed episodes with reliable timestamps in a narrow reminder window;
2. join only subscribed show IDs;
3. exclude successful delivery fingerprints already recorded;
4. send targeted Web Push messages;
5. record success/failure atomically enough to prevent normal duplicate sends;
6. delete subscriptions that return permanent gone/not-found responses;
7. retry only bounded transient failures.

Do not trigger a full generic push fan-out from every TMDB/TVmaze sync.

The delivery worker must respect Cloudflare outbound-subrequest limits. If subscription volume approaches a level where one scheduled invocation cannot safely fan out, Phase 5D should stop and add an explicit queue/batch design rather than silently increasing scope.

## VAPID and secrets

Required configuration should be separated into:

- **VAPID public key** — safe to expose to frontend clients;
- **VAPID private key** — Cloudflare secret only, never committed or served;
- optional contact/subject metadata required by the chosen Web Push sender implementation.

Before adding production tables or UI, run an isolated feasibility spike proving that the chosen Worker-compatible Web Push implementation can:

1. generate/sign a valid VAPID request;
2. send a test notification to a real browser Push subscription;
3. build under the existing Wrangler environment without destabilizing the Worker;
4. correctly classify permanent vs transient Push service failures.

## Retention and privacy rules

Minimum recommended rules:

- explicit opt-in only;
- disabling notifications deletes subscription + show mappings + delivery history for that subscription;
- HTTP 404/410 from a Push service deletes the stale subscription;
- inactive subscriptions older than 90 days should be purged unless refreshed;
- do not retain notification delivery bodies after delivery; keep only compact dedup/status facts;
- no account creation as a side effect of enabling notifications;
- local viewing states never leave the browser in Phase 5D;
- notification show IDs are used only for notification routing.

## Failure behavior

Notifications are optional. Failure must never break the catalog, schedule or My Shows.

- Push registration failure: show a local status; keep tracking functional.
- Permission denied: no retry loop or nagging prompt.
- Backend subscription failure: browser subscription may be rolled back or marked unregistered locally.
- Delivery failure: retry only transient failures; permanent endpoint failures purge the subscription.
- Notification runner failure: normal TMDB/TVmaze sync remains independent.

This preserves the existing source and personalization isolation principles.

## Implementation slices after this design gate

### Phase 5D-A — Web Push feasibility spike

- Service Worker registration in an isolated branch;
- VAPID test configuration using preview-only secrets;
- one manually initiated test subscription/send path;
- no production notification table migration yet;
- prove Cloudflare Worker compatibility first.

### Phase 5D-B — accountless subscription persistence

- new immutable D1 migration for the three notification tables;
- public-key + register/update/delete routes;
- explicit My Shows opt-in UI;
- production remains disabled behind a feature gate until acceptance.

### Phase 5D-C — targeted episode reminders

- hourly delivery runner;
- `episode_24h` only;
- deduplication + stale subscription cleanup;
- isolated preview tests, then dedicated production acceptance.

### Phase 5D-D — optional expansion

Only after 5D-C is stable:

- official renewal/final-season alerts;
- per-show notification toggles beyond the default tracked list;
- queue/batching architecture if subscriber scale requires it.

## Acceptance gates

No Phase 5D implementation should reach production until all of the following are true:

1. Existing Phase 5A–5C local tracking/state behavior remains unchanged when notifications are disabled.
2. Permission is requested only from an explicit user gesture.
3. The browser can fully revoke the server subscription.
4. No account is created.
5. Only notification-specific show IDs are stored server-side; viewing states remain local.
6. VAPID private material is a Cloudflare secret.
7. Push delivery is deduplicated.
8. Stale subscriptions are purged.
9. Notification runner failure cannot block TMDB/TVmaze sync.
10. Production-network tests stay outside default `npm test`.
11. A dedicated production audit verifies live Service Worker/assets, `/health`, subscription deletion and at least one real device delivery before the phase is accepted.

## Current recommendation

Proceed next with **Phase 5D-A only**: an isolated Web Push feasibility spike. Do not create production notification tables, cron fan-out or account infrastructure until the spike proves Worker/browser compatibility and the user explicitly accepts the new device-subscription privacy boundary.
