# Phase 7C — Regional Watch Availability

Phase 7C adds regional watch-availability information to Series Hub show detail pages without changing the meaning of a show's original network or service.

## Scope

- Markets: Hong Kong (HK) and United States (US).
- Source: TMDB TV watch-provider data, supplied by JustWatch.
- Monetization groups: subscription, free, ads, rent and buy.
- UI: independent HK/US availability selector on the show detail page.
- Attribution: JustWatch is explicitly credited on the detail page.

## Architecture

`src/phase7-worker.js` wraps the accepted Phase 6 Worker and owns only:

`GET /api/shows/:id/watch-providers`

All other fetch routes and all scheduled jobs delegate to `src/phase6-worker.js`. Phase 6 in turn preserves the existing Phase 5E scheduling behavior.

The endpoint:

1. resolves the stored Series Hub show ID to its TMDB ID;
2. calls TMDB's TV watch-provider endpoint with the existing server-side TMDB token;
3. normalizes only HK and US provider groups;
4. de-duplicates providers inside each group;
5. exposes TMDB provider logos and only validated HTTPS `themoviedb.org` landing links;
6. fails soft to empty availability when TMDB credentials or provider data are unavailable.

No D1 migration is required and no provider availability is hard-coded.

## Product boundaries

Original network/service and regional availability remain separate concepts. A show may originate on one network while being available through different services in HK or US.

The availability selector is also independent from the HK/TW/CN Chinese-title selector.

## Acceptance

PR #100 isolated validation passed the full test suite, D1 migration check, Worker build, isolated preview deployment, preview runtime smoke and production regression smoke before merge eligibility.
