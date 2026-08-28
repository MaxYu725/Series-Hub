# Phase 5E-D3 acceptance

Phase 5E-D3 is production-accepted. It adds public, aggregate-only operational visibility for TMDB catalog sync, TVmaze episode sync, and Push readiness while preserving source separation, and it rotates the deterministic internal authorization derivation away from the historical v1 context.

## Shipped changes

- PR #76 introduced `/api/ops-status`, separate TMDB / TVmaze / Push health indicators, v2 internal authorization derivation, workflow masking, and aggregate-only Push observability. It merged as `af2a10fb73f0f85ac5d92a4bf43b5b7378fb6b61`.
- The first production acceptance audit correctly exposed one observability defect: a normal in-progress sync was being classified from the newest `running` row as an error.
- PR #77 separated the newest sync activity from the newest completed sync result. Freshness is now assessed from the latest completed run while `inProgress` reports current work. It merged as `2fe880272b1519167b569f4e5602666a72933299`.

## Production evidence

Production deploy run `33135512386` completed successfully after PR #77, including unit tests, D1 migration validation, Worker deployment, internal v2 authorization derivation, immediate TMDB sync, TVmaze bootstrap, and final runtime verification.

Stable VAPID bootstrap run `33135512380` also completed successfully without rotating or deleting the existing production subscription state.

Production acceptance audit run `33135592712` completed successfully while a TVmaze sync was actively running. The observed aggregate state was:

- TMDB: `ok`, latest completed run approximately 0 minutes old, not currently running;
- TVmaze: `ok`, latest completed run approximately 5 minutes old, with a new sync currently in progress;
- Push: `ok`;
- overall: `ok`.

This is deliberate proof that active source synchronization no longer creates a false red operational state.

The same audit also confirmed:

- `/api/ops-status` is reachable and structurally valid;
- the operational payload is aggregate-only and exposes no Push endpoint, p256dh, auth, management token, or equivalent subscription credential material;
- the production homepage includes the separate source-status UI;
- the historical v1-derived internal authorization value is rejected by production;
- the current v2-derived authorization value is accepted for a protected **non-sending** reminder dry-run;
- that dry-run reported no attempted or sent notifications.

## Gate

**Phase 5E-D3 is accepted. Phase 6 / non-US expansion remains blocked until Phase 5E-D4 real-device UI/UX acceptance is explicitly completed.**
