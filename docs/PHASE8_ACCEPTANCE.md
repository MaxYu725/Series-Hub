# Phase 8 — Acceptance & Closeout

Phase 8 closes only when the production product supports discovery, browse, search and local-first personal discovery without weakening the data-authority, privacy or sync-budget boundaries established in earlier phases.

## Product acceptance matrix

| Area | Accepted behavior |
| --- | --- |
| Discovery Home | Four bounded D1-only rails: popular, recent new series, coming soon and top rated. |
| Faceted Browse | Exact network, genre, lifecycle status and first-air-year facets with server-allowlisted sorting. |
| Global Search | Existing catalog/alias/episode search universe with deterministic relevance ranking. |
| For You | Generic catalog candidate pool plus browser-local explainable ranking; tracked shows excluded. |
| My Shows | Existing local tracking remains independent from discovery and continues to work without an account. |

## Transition acceptance

Phase 8E treats navigation continuity as part of the product contract:

- entering search from Explore must not lose which Explore mode was active;
- clearing search restores the exact originating mode: **精選**, **為你** or **全部劇集**;
- selecting Today/Week/status/My Shows still leaves Explore cleanly;
- selecting Explore while search is active explicitly hands control back to Explore;
- changing HK/TW/CN title region while searching or exploring remains bounded to the current UI state rather than walking unrelated tabs.

## Loading and failure acceptance

Every network-backed Phase 8 surface keeps a 12-second bounded request:

- featured discovery;
- faceted browse;
- generic personal-discovery candidate pool;
- global search.

Each surface owns an explicit failure message and does not silently replace a failed result with unrelated content. Personal discovery explicitly states when it is falling back to generic popularity/rating because there is not enough browser-local taste data.

## Mobile and accessibility acceptance

- featured discovery remains a horizontal, scrollable rail rather than a long vertical wall;
- browse and personal discovery use a compact two-column grid at phone widths;
- Explore mode controls retain at least 44px touch height on phone widths;
- Explore mode buttons expose `aria-pressed` and `aria-controls="show-grid"`;
- `aria-pressed` is cleared when Explore is no longer active.

## Privacy acceptance

For You remains local-first:

- the server receives only the same generic browse candidate request available to any user;
- tracked show IDs are not serialized into the recommendation request;
- viewing states are not serialized into the recommendation request;
- derived taste scores are not serialized into the recommendation request;
- the optional local catalog-signal cache is capped at 300 shows;
- that cache stores only Series Hub show ID, genre string and original network/service string;
- titles, posters, search terms, timestamps and watch dates are deliberately excluded.

## Data and request-budget acceptance

Phase 8 introduces no new catalog authority.

- TMDB remains canonical catalog metadata.
- TVmaze remains episode/schedule supplementation.
- Official lifecycle evidence remains separately attributed.
- Original network/service remains separate from regional watch availability.
- No synthetic identities are inserted for discovery or recommendations.
- Phase 8 user interactions add no direct TMDB/TVmaze calls.
- The existing 48-request TMDB catalog-sync ceiling remains unchanged.

## Production closeout gate

After the Phase 8E branch passes isolated PR validation, the Phase is considered production-closed only when the merged main workflow also succeeds through:

1. full unit-test suite;
2. production credential and D1 migration checks;
3. Worker deployment;
4. immediate TMDB catalog sync;
5. TVmaze bootstrap/convergence;
6. final production runtime smoke;
7. VAPID readiness without creating or removing subscriptions;
8. isolated preview Worker/D1 cleanup.

No Phase 9 or geographic expansion is implied by Phase 8 closeout.
