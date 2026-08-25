# Phase 5D-C — Targeted episode reminders

Status: **IMPLEMENTATION IN PROGRESS**

Phase 5D-C turns the already accepted accountless Push subscription storage into one narrowly scoped background notification feature.

## First production trigger

`episode_24h` only.

A delivery candidate must satisfy all of the following:

- the episode is numbered;
- the episode comes from the normalized TVmaze pipeline;
- `air_timestamp` is present and valid;
- the episode begins more than 23 hours and no more than 24 hours after the runner's current time;
- the subscription is active and contains the episode's stable Series Hub `show_id`;
- no successful `episode_24h` delivery already exists for that subscription + episode.

The 23–24 hour window is intentionally paired with an hourly runner. It prevents repeated candidate scanning across an entire 24-hour range while allowing each upcoming timestamp to enter one normal hourly window.

## Delivery identity and deduplication

- kind: `episode_24h`;
- entity key: `episode:<Series Hub episode id>`;
- unique D1 key: `(subscription_id, kind, entity_key)`;
- successful deliveries are never retried;
- transient failures may be retried on a later runner only while the episode remains eligible;
- permanent Push service responses (`404`/`410`) delete the stale subscription and all dependent mappings/delivery rows.

## Failure isolation

The notification cron is independent of TMDB and TVmaze sync crons. A Push runner failure is logged and swallowed by its own scheduled task; it cannot prevent catalog or schedule synchronization.

## Data/privacy boundary

No additional user/profile data is introduced. The runner uses only data already accepted in Phase 5D-B plus canonical episode/show metadata required to compose a notification.

No notification body is persisted in D1.

## Production gate

Implementation is deployed with an explicit `EPISODE_REMINDERS_ENABLED` feature flag. Preview/isolation validation can exercise runner selection and dry-run behavior without contacting real Push endpoints. Production fan-out remains disabled until the implementation PR passes and the gate is deliberately enabled.
