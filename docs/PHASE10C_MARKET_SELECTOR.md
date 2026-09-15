# Phase 10C — US / Korea Catalog Selector

Status: production accepted on 2026-09-14.

## Goal

Expose the already accepted US and Korean catalogs through one shared market selector without creating a second catalog stack.

Supported values:
- `all` — default, preserves the existing combined catalog
- `US` — United States origin catalog
- `KR` — South Korea origin catalog

The selected market is stored only in the browser under `series-hub-catalog-market`.

## Scope

The same market value is applied to:
- Today and This Week schedule views
- Airing, Upcoming and Planned catalog views
- Phase 8 featured discovery
- Phase 8 faceted browse and its facet counts
- Phase 8 personal recommendation candidate pool
- global title / alias / episode search

`My Shows` remains a personal tracked collection and is deliberately not filtered by market. The market selector is disabled while that view is active.

## Backend contract

The existing endpoints accept an optional `market` query parameter:
- `/api/shows`
- `/api/schedule`
- `/api/discover`
- `/api/search`

Unknown or missing market values normalize to `all` for backwards compatibility.

US/KR filtering uses the normalized `shows.origin_country` value already present in D1. No new table, migration or external provider is introduced.

## Boundaries

Phase 10C does not change:
- US TMDB 48-request ceiling
- Korea TMDB 24-request ceiling
- TVmaze schedule authority
- Phase 10B TMDB next-episode fallback policy
- catalog admission rules
- tracking persistence
- title-region preference

## Acceptance gates

Phase 10C is accepted only when:
1. existing tests remain green;
2. `all`, `US` and `KR` normalize consistently across catalog APIs;
3. catalog, schedule, discovery, browse and search results do not leak rows from the other selected market;
4. browse facet counts are scoped to the selected market;
5. the browser selection persists and the same control drives regular views, discovery and global search;
6. My Shows remains unfiltered by market;
7. invalid market values safely fall back to `all`;
8. production validation confirms both US and KR selections return real catalog data without affecting sync health or request ceilings.

All Phase 10C acceptance gates passed on 2026-09-14. PR #124 was squash-merged as `c8fbf48f340f9529f573b59172a638a9bce1fc71`, and the merged-main Cloudflare deployment completed successfully.

## Next milestone

Phase 10D — Korean Renewal / Production Evidence — extends the existing Phase 4 official lifecycle evidence model to the Korean catalog before the project expands to another geographic market.
