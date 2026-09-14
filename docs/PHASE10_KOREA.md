# Phase 10 — Korea Expansion

## Phase 10A — Korean Catalog Foundation

Status: production foundation validated; Phase 10A.1 catalog-quality hardening in progress.

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

Phase 10A.1 therefore applies the fiction-genre requirement as a post-ingestion quality layer and uses migration `0020_phase10a1_korea_catalog_quality.sql` for the one-time cleanup of already-ingested rows that fail the same metadata rule. The cleanup is based only on country and genre relationships and contains no show-title or TMDB-ID blacklist.

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
8. the quality cleanup removes the observed false positives without title/TMDB-ID blacklists;
9. a production re-run confirms accepted KR rows retain fiction genres and the US catalog remains healthy.

### Deferred

Not part of 10A:
- Korean-specific TV schedule fallback source
- Korean official renewal / production evidence registry
- US / Korea catalog UI selector
- Japan / Taiwan / Europe expansion

Those are evaluated only after the Korean catalog foundation is proven in production.
