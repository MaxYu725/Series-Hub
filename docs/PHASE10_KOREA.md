# Phase 10 — Korea Expansion

## Phase 10A — Korean Catalog Foundation

Status: accepted in production, including Phase 10A.1 catalog-quality hardening.

### Scope

Phase 10 starts non-US expansion with South Korean scripted television only. The Korean catalog is defined by TMDB `origin_country` containing `KR`, not by Korean language alone. This preserves Korean co-productions while rejecting unrelated shows that merely contain Korean-language material.

Included TMDB types:
- Scripted
- Miniseries

Excluded genres remain aligned with the accepted US catalog policy:
- Animation
- Documentary
- Kids
- News
- Reality
- Talk

Phase 10A.1 adds a second, conservative admission condition: a candidate must carry at least one TMDB fiction genre. This prevents sparse Korean variety/lifestyle records that TMDB labels `Scripted` from entering the catalog merely because their type is misclassified.

Accepted fiction genres are:
- Drama
- Comedy
- Western
- Crime
- Mystery
- Family
- Action & Adventure
- Sci-Fi & Fantasy
- Soap
- War & Politics

This is not a title blacklist. A sparse record with no fiction genre is simply deferred until TMDB metadata becomes sufficiently specific.

### Source authority

TMDB remains the catalog metadata authority. Korean records use the same normalized `shows`, `seasons`, `networks`, `genres`, and `title_aliases` tables as US records. No Korea-specific content tables are introduced.

The Korean catalog has a separate operational source identity:
- source key: `tmdb_kr`
- display name: `TMDB · Korea`
- sync run type: `catalog_kr`

This prevents Korean ingestion from replacing the accepted US `tmdb` sync freshness and health record.

### Bounded request budget

The accepted US TMDB sync remains unchanged at 48 external requests per run.

The Korean sync has its own maximum of 24 external requests:
- 1 broad Korean discovery request
- 1 upcoming / schedule discovery request
- 4 rotating Korean network discovery requests
- 18 detail requests

The two budgets are independent. Phase 10A does not steal US discovery slots or increase the US 48-request ceiling.

### Initial Korean network seeds

The first verified TMDB network seeds are:
- KBS2 — 342
- MBC — 97
- SBS — 156
- tvN — 866
- JTBC — 885
- ENA — 5841
- TVING — 3897
- Netflix — 213
- Disney+ — 2739

Only four network seeds are queried in one Korean run. The deterministic six-hour rotation reaches all nine seeds without changing the US seed rotation.

Network seeds improve coverage but are not an admission whitelist. A Korean scripted/miniseries candidate discovered through the KR broad or upcoming feed may still enter the catalog even when its original network is not in the seed list.

### First production benchmark — 2026-09-14

The first real production KR sync completed successfully with:
- 103 unique candidates seen
- 18 detail records selected
- 7 records initially persisted
- 6 discovery requests
- 24 total external requests
- 0 warnings
- independent `tmdb_kr=success` and `tmdb=success` health

The run proved the Phase 10A ingestion architecture and budget isolation, but also exposed a data-quality edge case: four of the seven initially persisted rows were sparse Korean variety/lifestyle programs that TMDB currently labels `Scripted` while providing no genres. The three clearly fictional rows all carried fiction genres.

A read-only follow-up diagnostic compared the production rows with Queen of Tears, Crash Landing on You, Moving, The Glory, Lovely Runner and Hospital Playlist. The useful invariant was not episode count, runtime, network or a particular title keyword; it was the presence of at least one fiction genre. This preserves long daily dramas and genre series while rejecting the observed sparse false positives.

Migration `0020_phase10a1_korea_catalog_quality.sql` performs the one-time cleanup of already-ingested rows that fail the same metadata rule. The cleanup is based only on country and genre relationships and contains no show-title or TMDB-ID blacklist.

The first post-migration production acceptance run confirmed that only three fiction-qualified rows remained, but also exposed avoidable write/delete churn in the initial quality wrapper: sparse detail records were persisted before being pruned. Phase 10A.1 therefore moves the fiction-genre admission check into the KR detail loop before `persistSeries()`. The base KR sync retains its accepted discovery/budget behavior and exposes an optional admission predicate; the Phase 10 quality wrapper supplies the stricter fiction policy. Runtime syncs no longer use delete-after-write cleanup.

PR #118 closed the remaining stale-row gap. Both base KR-policy rejections and fiction-quality rejections now reach failure-tracked cleanup before a run is marked successful, while KR/US shared rows that remain valid through the US catalog are preserved. Production acceptance confirmed 10 Korean-origin rows, zero KR-only out-of-policy rows, `tmdb_kr=success`, `tmdb=success`, and the unchanged 24-request Korean ceiling.

### Product behavior

The existing title model is reused:
- `original_title` may contain the Korean title
- `english_title` uses TMDB English metadata
- HK / TW / CN Chinese names continue through the existing title alias pipeline

The homepage and PWA branding are region-neutral (`SERIES TRACKER`, `劇集追蹤`) because the catalog is no longer US-only.

Phase 10A deliberately does not add a market selector yet. Region filtering belongs to Phase 10C after Korean ingestion and schedule coverage are production-validated.

### Scheduling

The accepted US TMDB catalog sync remains unchanged on `17 */6 * * *`, and the accepted TVmaze convergence remains unchanged on `47 * * * *`.

The Korean catalog has its own six-hour trigger at `37 */6 * * *`. This separation is deliberate: the US 48-request budget and Korean 24-request budget run in different Worker invocations instead of being combined into one scheduled execution.

Internal manual endpoint:
- `POST /api/internal/tmdb-sync-kr`

Operational status:
- `GET /api/sync-status?source=tmdb_kr`

Both retain the existing internal sync-key authorization model.

### Acceptance gates

Phase 10A / 10A.1 is accepted only when:
1. all existing US / Phase 1–9 tests remain green;
2. Korean eligibility rejects non-KR, reality, animation and sparse no-fiction-genre cases;
3. US request budget remains exactly 48;
4. Korean request budget remains at or below 24 and runs on an isolated cron invocation;
5. the Phase 10 wrapper delegates all non-Korean fetch and scheduled behavior to Phase 8;
6. production D1 records `tmdb_kr` separately from `tmdb`;
7. a production Korean sync inserts real active Korean scripted series without synthetic IDs or manual show seeds;
8. migration 0020 removes the observed historical false positives without title/TMDB-ID blacklists;
9. normal KR sync applies fiction admission before D1 persistence and does not rely on runtime delete-after-write pruning;
10. a production re-run confirms accepted/rejected metrics, zero out-of-policy KR rows and healthy US catalog sync.

## Phase 10B — Korean Schedule Coverage

Status: accepted in production after Phase 10B.1 schedule-gap prioritization.

### Production baseline — 2026-09-14

A read-only production comparison measured every Korean-origin catalog row against the current D1 episode schedule, TVmaze and TMDB:
- 10 Korean-origin rows
- 6 with future episodes already in D1
- 8 mapped to TVmaze
- 6 with future schedule exposed by TVmaze
- 8 with TMDB `next_episode_to_air`
- 0 cases where TVmaze had future schedule but D1 lacked it
- 2 D1 gaps where TVmaze had no future schedule but TMDB had a next episode
- 2 rows where neither provider currently published a future episode
- 0 provider-unavailable rows in the final diagnostic run

The two actionable gaps were:
- Good Partner (`tmdb 243761`) — TMDB next episode `2026-12-04`, while TVmaze had no future episode
- Doctor X (`tmdb 293610`) — TMDB next episode `2026-10-09`, with no exact TVmaze mapping

O’PENing and All of Us Are Dead had no future schedule from either provider and are deliberately left without fabricated episode dates.

### Schedule authority policy

Phase 10B keeps TVmaze as the primary episode schedule authority. It does not add a third provider.

TMDB `next_episode_to_air` is used only as a bounded fallback when:
1. the accepted KR catalog detail already contains a valid future next episode;
2. D1 has no future TVmaze-owned episode for that show; and
3. the referenced season already exists in the normalized catalog.

The fallback reuses the TMDB detail response already fetched by the 24-request KR catalog sync. It performs no additional TMDB request and therefore does not change the KR or US request ceilings.

Fallback episode rows use the existing `episodes` table and existing provenance fields. No schema or migration is required. A fallback is identifiable by a TMDB episode ID, no TVmaze episode ID, and a TMDB episode source URL.

When TMDB changes or withdraws its next episode, stale future fallback rows are updated or removed. When TVmaze later publishes a future schedule, TVmaze automatically takes over and future TMDB fallback rows for that show are removed before TVmaze episodes are written.

A TMDB fallback never overwrites an existing TVmaze-owned episode row.

### Phase 10B.1 — schedule-gap prioritization

The first post-deploy Phase 10B acceptance run proved the fallback writer itself worked: Doctor X was inserted correctly, but Good Partner remained missing. The cause was candidate selection rather than persistence. The Korean sync fetches at most 18 detail records per run, and an already-cataloged show with a schedule gap was not guaranteed to appear in the rotating discovery sample.

Phase 10B.1 closes that gap without increasing the request budget. Before the normal round-robin detail selection is finalized, D1 contributes active Korean catalog rows that have no future TVmaze-owned episode. These priority candidates occupy the existing 18 detail slots, are deduplicated against normal discovery candidates, and the remaining slots are filled by the existing discovery rotation.

This keeps the operational ceilings unchanged:
- 6 discovery requests
- at most 18 detail requests
- at most 24 total external requests

The priority query deliberately includes existing TMDB-fallback shows as long as TVmaze still has no future schedule. This lets later KR syncs refresh, change or withdraw the TMDB fallback while preserving TVmaze as the primary authority.

### Final production acceptance — 2026-09-14

The final production acceptance after PR #122 confirmed:
- 4 current Korean schedule-gap candidates were prioritized
- 18 detail candidates were selected
- external request budget remained exactly 24 / 24
- 2 TMDB schedule fallbacks were applied
- Good Partner S2E1 was present with air date `2026-12-04` and TMDB episode provenance
- Doctor X S1E1 was present with air date `2026-10-09` and TMDB episode provenance
- future Korean TVmaze-owned episode count remained stable at 124 → 124
- future TMDB fallback rows outside the Korean catalog remained 0
- latest `tmdb_kr` sync status was `success`
- no warnings were reported by the accepted KR sync

The previously observed Good Partner gap is therefore closed in production. Phase 10B and Phase 10B.1 are accepted.

### Phase 10B acceptance gates

Phase 10B / 10B.1 is accepted only when:
1. all existing tests remain green;
2. a valid TMDB future next episode can populate one fallback episode without an extra network request;
3. past, missing or malformed TMDB next-episode data never creates a fallback;
4. TVmaze future schedule prevents TMDB fallback insertion;
5. TVmaze can replace/remove a previous fallback when it gains future schedule coverage;
6. a TMDB schedule change updates a TMDB-owned fallback without overwriting TVmaze ownership;
7. existing Korean schedule gaps are prioritized inside the original 18-detail budget rather than by adding requests;
8. the KR request ceiling remains 24 and the US ceiling remains 48;
9. production validation confirms the expected schedule gaps close without fabricated dates, non-KR fallback leakage or TVmaze ownership regression.

All Phase 10B / 10B.1 acceptance gates passed on 2026-09-14.

### Deferred / next milestone

Not part of 10A/10B:
- Korean official renewal / production evidence registry
- Japan / Taiwan / Europe expansion

Phase 10C — the US / Korea catalog UI selector — is now unblocked and is the next planned milestone.
