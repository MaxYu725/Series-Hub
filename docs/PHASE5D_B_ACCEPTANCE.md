# Phase 5D-B — Production acceptance

Status: **COMPLETE / PRODUCTION-ACCEPTED**

Accepted on 2026-08-25 after explicit real-device browser verification.

## Scope accepted

Phase 5D-B introduced accountless, device-scoped Push subscription persistence while keeping the existing Phase 5 local-personalization model intact.

Accepted behavior:

- notification permission is requested only from the explicit **開啟通知** action inside **我的劇集**;
- a browser Push subscription can be registered against Series Hub without an account;
- D1 stores only the Push endpoint/key material, device-scoped management-token hash, timezone/title-region preference, and selected stable Series Hub `show_id` mappings needed for notification routing;
- `series-hub-tracked-shows-v1` remains the authoritative local My Shows list;
- `series-hub-viewing-states-v1` remains browser-local and is never uploaded;
- search history, viewing state, account/profile identity and catalog metadata are not stored as notification personalization;
- the raw management token remains browser-side; only its SHA-256 hash is stored in D1;
- disabling notifications deletes the subscription, its show mappings and its delivery-history rows from D1 before clearing local management state;
- production VAPID public material is stable and stored in D1;
- production VAPID private material is a Cloudflare secret and is not committed to GitHub;
- Push registration failure or notification disablement does not affect catalog, schedule, My Shows or viewing-state functionality.

## Real-device acceptance

The production page was verified on a real mobile browser after the Phase 5 tracking UI freeze hotfix.

Observed acceptance:

1. **我的劇集** rendered normally with two tracked shows.
2. **開啟通知** completed successfully.
3. The UI changed to the enabled state and reported that the server retained only the Push device data and the two selected show IDs.
4. **關閉通知** completed successfully.
5. The page remained responsive throughout the enable/disable cycle.
6. Existing My Shows cards, lifecycle badges and local tracking remained intact.

This closes the Phase 5D-B privacy-boundary acceptance gate.

## Production boundary after Phase 5D-B

Production now has notification subscription persistence, but **does not yet have an episode-reminder delivery runner**.

The following remain absent until Phase 5D-C:

- hourly episode reminder fan-out;
- automatic `episode_24h` delivery;
- delivery retry/cleanup processing;
- live notification dispatch from scheduled episode matching.

## Next safe continuation point

Proceed to **Phase 5D-C — targeted episode reminders** with the already approved narrow contract:

- only numbered TVmaze episodes with a real `air_timestamp`;
- only selected stable Series Hub show IDs;
- at most one `episode_24h` notification per subscription + episode;
- hourly runner, isolated from TMDB/TVmaze sync;
- permanent Push endpoint failures purge stale subscriptions;
- transient failures are bounded and retryable;
- runner failure must never block catalog or schedule synchronization;
- production acceptance requires a real-device delivery proof after the isolated implementation passes.
