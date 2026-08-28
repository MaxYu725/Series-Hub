# Phase 5E-D3 acceptance

Phase 5E-D3 adds public, aggregate-only operational visibility for TMDB catalog sync, TVmaze episode sync, and Push readiness while preserving source separation.

Acceptance requires:

- production `/api/ops-status` is reachable and structurally valid;
- fresh TMDB and TVmaze syncs are not classified as error/unknown;
- Push readiness is not classified as configuration error after the stable VAPID bootstrap;
- the operational payload contains aggregate counts/status only and no Push endpoint or cryptographic subscription material;
- production homepage includes the source-separated status UI;
- internal authorization uses derivation context v2 in backend and active workflows;
- workflow-derived authorization values are masked before output/use;
- the historical v1-derived authorization value is rejected by production, while v2 can perform a non-sending reminder dry-run;
- Phase 6 remains blocked until Phase 5E-D4 real-device UI/UX acceptance.

The acceptance audit is read-only except for protected reminder dry-run requests, which do not create or send notification deliveries.
