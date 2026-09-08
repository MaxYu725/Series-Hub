# Phase 7 — US Coverage Hardening

Phase 7 strengthens the mature US-series baseline without replacing the accepted TMDB + TVmaze + official-evidence architecture.

## Goal

Reduce blind spots across major US broadcasters and streaming services while preserving source attribution, request budgets and the existing production data model.

## Phase 7A — Dedicated catalog discovery coverage

**Status:** production-accepted on 2026-09-08.

Dedicated TMDB discovery now covers 14 major network/service seeds:

- Apple TV
- HBO
- Prime Video
- FOX
- FX
- Netflix
- Paramount+
- CBS
- NBC
- Peacock
- Disney+
- Hulu
- AMC
- AMC+

To preserve the existing Worker request ceiling, each six-hour TMDB sync still performs only six dedicated network discovery requests. The 14 seeds rotate deterministically, so all dedicated sources are visited within three six-hour sync slots while the 40-detail-request budget and 48-request total maximum remain unchanged.

Production acceptance after merge included an immediate TMDB sync that accepted 17 shows from 133 candidates, followed by three TVmaze convergence passes that normalized 117 episode rows.

## Phase 7B — Official lifecycle source coverage

**Status:** implementation in progress.

Phase 7B extends the verified official-source registry with:

- Paramount Press Express — `https://www.paramountpressexpress.com/`
- NBCUniversal Newsroom articles — `https://www.nbcuniversal.com/article/`
- The Walt Disney Company Newsroom — `https://thewaltdisneycompany.com/news/`
- AMC Networks Press Releases — `https://www.amcnetworks.com/press-releases/`

These complement the existing Apple TV Press, Warner Bros. Discovery Pressroom, Amazon Entertainment, Netflix Media Center, Netflix Tudum and FOXFLASH sources.

Registration does **not** turn these websites into broad scrapers. Official evidence continues to require:

1. an existing Series Hub show identity;
2. a supported normalized lifecycle event;
3. an exact public official URL matching the registered HTTPS host/path prefix;
4. publication date and official page title;
5. non-destructive storage in the lifecycle evidence layer.

TMDB-derived catalog lifecycle remains independent from attributed official evidence.

## Deferred from Phase 7A/7B

- automated press-site collectors;
- regional watch-provider availability;
- non-US catalog expansion;
- additional notification classes.

Collector automation should be evaluated separately only for publishers whose public formats prove stable enough for deterministic extraction and identity-safe matching.
