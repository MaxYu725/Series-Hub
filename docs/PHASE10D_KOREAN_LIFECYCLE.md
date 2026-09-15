# Phase 10D — Korean Renewal / Production Evidence

Status: implementation candidate.

## Goal

Extend the already accepted Phase 4 lifecycle evidence model to the Korean catalog without creating a Korea-only lifecycle table, status system or scraper.

Phase 10D reuses the existing event-sourced lifecycle contract, official-source whitelist, protected editorial API and UI projection.

## Initial official sources

Phase 10D registers two public official publishers:

| Source key | Display name | Allowed base |
| --- | --- | --- |
| `sbs_news` | SBS News | `https://news.sbs.co.kr/news/` |
| `netflix_about_news` | Netflix About News | `https://about.netflix.com/en/news/` |

Both are registered with `trust_level=official` and remain editorial sources only. Registration does not authorize automatic extraction.

## Production acceptance targets

The first acceptance pair deliberately covers two different lifecycle dimensions and two different publishers already represented in the Korean production catalog.

### Good Partner — season 2 decision

- TMDB identity: `243761`
- normalized event: `renewed`
- season: `2`
- source: `sbs_news`
- official URL: `https://news.sbs.co.kr/news/endPage.do?news_id=N1008049198`
- publication date: `2025-04-04`

SBS explicitly confirmed that season 2 would be produced while stating that casting, filming and broadcast timing were still under discussion. Phase 10D therefore stores a renewal decision only and does not infer filming from that announcement.

### All of Us Are Dead — season 2 production

- TMDB identity: `99966`
- normalized event: `filming`
- season: `2`
- source: `netflix_about_news`
- official URL: `https://about.netflix.com/en/news/all-of-us-are-dead-season-2-now-in-production`
- publication date: `2025-07-22`

Netflix explicitly states that production had begun on season 2, so `filming` is an evidence-safe normalization.

## Boundaries

Phase 10D does not:

- overwrite `shows.status`, `shows.tmdb_status` or season catalog state;
- create a Korean-specific lifecycle schema;
- add a collector or scraper;
- add external requests to the catalog or schedule syncs;
- change US/KR TMDB request ceilings;
- change TVmaze schedule authority or Phase 10B fallback behavior;
- use entertainment press or social posts as `official` evidence when a registered publisher is unavailable.

Evidence remains additive and attributed. A later official announcement can add a newer production or schedule event without destructively rewriting the earlier decision record.

## Editorial ingestion

Evidence is applied through the existing protected lifecycle editorial path after the source registry migration reaches production.

The show is resolved against the production catalog by stable TMDB identity before submission. This avoids hard-coding a Series Hub show ID into the migration and preserves the existing identity guard.

## Acceptance gates

Phase 10D is accepted only when:

1. all existing tests remain green;
2. both new source keys are present, enabled and trusted as official after migration;
3. source URL validation accepts only the registered HTTPS host/path scope;
4. Good Partner season 2 projects an official `renewed` decision from SBS News;
5. All of Us Are Dead season 2 projects an official `filming` production event from Netflix About News;
6. the events resolve to the production shows with TMDB IDs `243761` and `99966` respectively;
7. existing lifecycle UI/API projection shows the Korean evidence without Korea-specific rendering logic;
8. no sync request ceiling, provider ownership or catalog admission rule changes;
9. production runtime and source health remain green after acceptance.

## Deferred after Phase 10D

- additional Korean official publishers only after their canonical public URL scope is verified;
- automated collectors only if a source passes the existing Phase 4 collector gate;
- Japan / Taiwan / Europe catalog expansion as the next geographic expansion milestone.
