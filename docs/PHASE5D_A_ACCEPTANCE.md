# Phase 5D-A — Web Push feasibility acceptance

Status: **COMPLETE**

Phase 5D-A was an isolated, preview-only feasibility spike. Its purpose was to prove that Series Hub can deliver true background Web Push notifications on the existing GitHub → Cloudflare browser-only development stack without changing the production personalization model.

## Accepted result

The spike proved all of the following:

- Cloudflare Worker build and deployment with `web-push@3.6.7` and `nodejs_compat` succeeded;
- an ephemeral VAPID keypair could be generated inside GitHub Actions;
- the VAPID private key was attached only as a preview Worker secret and was not committed to the repository;
- the isolated preview Worker exposed no D1 binding and stored no Push subscription;
- the browser registered a Service Worker and created a `PushManager` subscription;
- notification permission was requested only after an explicit **Run Push Test** user action;
- the Worker encrypted and submitted the Push payload successfully;
- a real browser/device visibly received the native `Series Hub · Phase 5D-A` notification;
- the normal Series Hub isolated validation pipeline remained green, including unit tests, fresh preview D1 migrations, Worker build, preview runtime and production regression;
- closing the spike PR removed both the dedicated Web Push spike Worker and the normal PR preview Worker/D1.

PR #55 was deliberately closed **without merge**. None of the spike Service Worker, test sender, temporary VAPID workflow or `web-push` dependency entered production.

## What Phase 5D-A does not authorize

Successful feasibility does **not** itself authorize production persistence of Push subscriptions.

Production Series Hub remains unchanged after this checkpoint:

- My Shows tracking remains in `series-hub-tracked-shows-v1`;
- viewing states remain in `series-hub-viewing-states-v1`;
- no account/profile system exists;
- no Push subscription is stored in production D1;
- no Service Worker or Push sender is currently deployed by the production application;
- no notification cron/fan-out exists.

## Next boundary — Phase 5D-B

Phase 5D-B would introduce a new server-side personalization/privacy boundary: accountless device Push-subscription persistence.

The recommended design remains:

- no account requirement;
- explicit opt-in only;
- store only the minimum Push endpoint/encryption material plus notification-specific stable Series Hub `show_id` values;
- never upload local viewing states, search history or unrelated personalization;
- manage each anonymous device through a high-entropy capability token whose hash is stored server-side;
- fully delete the device subscription and mappings when notifications are disabled;
- keep production disabled behind a feature gate until register/update/delete behavior is independently accepted.

Phase 5D-B should not be started implicitly because it changes the privacy contract even though it does not create user accounts.

## Safe continuation point

The technical feasibility question is now closed: **Web Push works on the current stack.**

The next decision is product/privacy rather than technical feasibility: whether Series Hub should proceed with the minimal accountless D1 subscription model described in `docs/PHASE5D_NOTIFICATIONS.md`.
