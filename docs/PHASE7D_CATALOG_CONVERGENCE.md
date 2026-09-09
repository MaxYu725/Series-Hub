# Phase 7D — Catalog Convergence

Phase 7D repairs the remaining Phase 7A/7A.1 catalog blind spot without increasing the TMDB request budget or inserting synthetic show identities.

## Production diagnostic baseline

A read-only production probe on 2026-09-09 confirmed that `MobLand`, `The Five Star Weekend`, `The Bear` and `Dark Winds` were still absent from Series Hub. A separate TMDB probe then showed that bounded discovery could see them once stale historical inventory was reduced:

- `MobLand`: Paramount+ popularity rank 5 on page 1.
- `The Five Star Weekend`: Peacock popularity rank 23, page 2 position 3; recency rank 4 on page 1.
- `The Bear`: Hulu popularity rank 5 on page 1.
- `Dark Winds`: AMC popularity rank 3 on page 1.

The remaining delay came from correlation between the three-page network rotation and one global five-item candidate offset shared by all feeds. Some page/slice combinations could take roughly 10–15 days to meet.

## Phase 7D changes

1. Recent first-air windows are applied only where they improve current-catalog convergence without excluding credible long-running broadcast series: Paramount+ 8 years, Peacock 8, Disney+ 8, Hulu 10, AMC 8 and AMC+ 8. FOX keeps its existing 3-year repair.
2. Apple TV, HBO, Prime Video, FX, Netflix, CBS and NBC remain unbounded by first-air date.
3. Network candidate slices now rotate independently per network and per TMDB page from the Phase 7D rollout boundary. Each repeated 20-item page receives offsets 0, 5, 10 and 15 on successive visits rather than inheriting one globally correlated offset.
4. Schedule and broad discovery keep the existing global candidate rotation.
5. The request ceiling is unchanged: 6 network discovery + 1 schedule + 1 broad + at most 40 detail requests = 48 external requests.

No D1 migration is required. Existing identity, US-scripted, target-network and active-lifecycle gates remain authoritative.

## Production acceptance — 2026-09-09

Phase 7D was merged through PR #103 and deployed from feature checkpoint:

```text
68414185d79222e597197923d1f2c63b901c56ef
```

Acceptance evidence:

- 201 / 201 repository tests passed before the production deployment;
- production D1 migration verification passed with no Phase 7D schema change required;
- production Worker deployment passed;
- immediate production TMDB catalog sync passed;
- bounded TVmaze mapping/episode bootstrap passed;
- production runtime verification passed.

A separate read-only post-deploy probe then verified real catalog behavior:

- `MobLand` was present as Series Hub show `2727`, TMDB `247718`, status `upcoming`;
- `The Five Star Weekend` was present as Series Hub show `2722`, TMDB `283151`, status `planned`;
- `The Bear` and `Dark Winds` were not yet present at that first post-deploy slot.

The first two shows had both been absent immediately before Phase 7D, so their production convergence demonstrates that the network/page-specific slice rotation works on the live catalog rather than only in unit tests.

`The Bear` and `Dark Winds` are not treated as a Phase 7D failure at this checkpoint. Their Hulu and AMC feeds remain subject to the deliberate bounded network/page/slice schedule, and later sync slots are expected to revisit the relevant candidates automatically. Do not add manual show identities merely to accelerate those two examples.

The post-deploy diagnostic PR was closed without merge, and its isolated preview Worker and D1 were deleted successfully.

**Phase 7D is production-accepted and closed.** Continued catalog convergence is an operational observation task, not a blocker for closing the phase.
