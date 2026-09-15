# Phase 10E — Korean Catalog Coverage Expansion

Status: accepted in production on 2026-09-15.

## Why Phase 10E exists

Phase 10A–10D proved the Korean ingestion, schedule fallback, shared market selector and lifecycle evidence paths, but the live Korean catalog was still visibly sparse.

The 2026-09-15 read-only baseline measured:
- 13 Korean production rows total;
- 4 `airing`, 7 `upcoming`, 2 `planned`;
- 24 diagnostic discovery requests across broad, future-schedule and Korean network pages;
- 393 unique TMDB candidates in those sampled pages;
- 380 candidates not already present in the production Korean catalog;
- only the 120 most popular missing candidates were detail-audited;
- 13 of those 120 already passed the existing Phase 10A.1 fiction-quality gate and normalized to an active catalog status: 5 airing, 1 upcoming and 7 planned.

This proved the primary coverage problem was selection efficiency, not lack of source data and not the quality gate.

## Policy

Phase 10E increases coverage without increasing the accepted Korean external-request ceiling.

The ceiling remains:
- 6 discovery requests;
- at most 18 detail requests;
- at most 24 external requests total.

No US request budget changes. The US ceiling remains 48.

## Discovery changes

1. Broad and network discovery request only TMDB active-ish statuses: Returning Series, Planned, In Production and Pilot (TMDB status filter `0|1|2|5`).
2. The existing Phase 10A.1 fiction genre allow-set is also applied at discover time, while the detail-stage quality gate remains authoritative.
3. Future schedule discovery deliberately does not use the status filter. A TMDB row can still have a stale terminal status while exposing a real future episode date, so schedule evidence remains allowed to rescue that case.
4. Broad and schedule feeds rotate pages 1–3 every six-hour slot instead of always reading page 1.
5. The schedule look-ahead window expands from 90 to 180 days.

These changes alter candidate quality and page coverage, not request count.

## Detail-slot allocation

Phase 10B.1 schedule-gap maintenance remains first priority but is bounded to at most 4 of the 18 detail slots per run. Gap rows are ordered by least-recently-synced first so the bounded set rotates instead of permanently monopolizing the same slots.

Discovery builds an in-memory pool of up to 60 deduplicated candidates from the same six discovery responses. No extra API request is used for this larger pool.

The 18 detail slots are filled in this order:
1. up to 4 existing Korean schedule-gap rows;
2. newly discovered TMDB IDs that are not already active Korean catalog rows;
3. existing active Korean discovery rows for normal metadata refresh.

This lets repeated six-hour runs converge the catalog while preserving refresh behavior once the new-candidate backlog falls.

## Baseline benchmark titles

The read-only audit found multiple legitimate active Korean fiction rows missing from production under the already-accepted quality policy, including:
- A Love Other Than Yours (TMDB 314939, KBS2, airing);
- Made in Korea (TMDB 246473, Disney+, airing);
- The Ordinary Jackpot (TMDB 294636, TVING, airing);
- Flex X Cop (TMDB 220074, SBS, airing);
- Moving (TMDB 126485, Disney+, planned);
- Study Group (TMDB 233347, TVING, planned);
- The Judge from Hell (TMDB 235577, SBS, planned);
- The Trauma Code: Heroes on Call (TMDB 217553, Netflix, planned).

These are acceptance benchmarks only. They are not hard-coded seeds, allowlists or title exceptions.

## Production acceptance — 2026-09-15

PR #128 deployed Phase 10E to production at main commit `99d2bfdaf642dfa97b0a20735fffbff6277da49b`. The merged-main Cloudflare validation/deploy pipeline passed before the acceptance run began.

The one-time production acceptance run was GitHub Actions run `34920057146`, job `104225945900`. It executed three independently bounded KR syncs followed by three TVmaze convergence passes.

Accepted result:
- active Korean catalog: **13 → 42**;
- future Korean TVmaze-owned episodes: **123 → 241**;
- accepted row writes across the three KR syncs: 54;
- maximum external request budget in any KR sync: **24 / 24**;
- maximum detail selections in any KR sync: **18 / 18**;
- maximum schedule-gap candidates in any KR sync: **4 / 4**;
- each KR sync used 6 discovery requests, a 180-day schedule horizon and the `bounded_gap_then_new_candidate_priority` policy;
- all three KR syncs reported 0 warnings and 0 quality rejections;
- out-of-policy active Korean rows after convergence: **0**;
- future non-Korean TMDB fallback leakage: **0**;
- `tmdb_kr` sync health: successful;
- production operational health: successful.

Four benchmark titles entered naturally through discovery with no manual IDs or title exceptions:
- Flex X Cop — TMDB 220074 — `airing`;
- Made in Korea — TMDB 246473 — `airing`;
- The Ordinary Jackpot — TMDB 294636 — `airing`;
- A Love Other Than Yours — TMDB 314939 — `airing`.

The three TVmaze convergence passes processed 19 show passes. The future TVmaze-owned episode count increased rather than regressed, confirming that broader Korean catalog admission did not displace TVmaze schedule ownership.

The acceptance run deliberately occurred within one six-hour rotation slot, so broad/schedule pages stayed fixed during those three immediate convergence calls. Deterministic page 1–3 rotation is covered by unit tests and occurs across normal six-hour sync slots; the production acceptance proves the bounded selection policy even before later slots contribute additional pages.

The one-time acceptance workflow was removed from the diagnostic branch after the successful run so the production mutation cannot be accidentally replayed from that workflow.

## Boundaries

Phase 10E does not:
- relax the Korean fiction-quality gate;
- add title or TMDB-ID blacklists;
- add a provider;
- add schema or migrations;
- change TVmaze ownership or the Phase 10B TMDB schedule fallback contract;
- increase the Korean 24-request ceiling;
- change the US 48-request ceiling;
- change the market-selector UI.

## Acceptance gates

All Phase 10E acceptance gates passed on 2026-09-15:
1. all existing tests remained green;
2. KR external request budget remained <=24 and detail requests remained <=18;
3. schedule-gap candidates consumed at most 4 detail slots;
4. new discovery candidates led existing non-gap refresh candidates;
5. broad and schedule page rotation across pages 1–3 remained deterministic in regression coverage;
6. broad/network status filtering did not apply to future-date schedule discovery;
7. production KR catalog count materially increased from 13 to 42 after bounded sync convergence;
8. multiple benchmark titles entered naturally through discovery without manual seeds;
9. out-of-policy KR rows remained zero under the Phase 10A.1 quality rule;
10. TVmaze ownership, TMDB fallback boundaries, `tmdb_kr` health and production runtime remained healthy.
