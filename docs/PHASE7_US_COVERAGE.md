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

Production acceptance after merge included an immediate TMDB sync that accepted 17 shows from 133 candidates, followed by bounded TVmaze convergence.

### Phase 7A.1 follow-up — catalog convergence

Phase 7B.1 identity validation exposed a separate catalog-convergence issue: four initially researched official-evidence examples — MobLand, The Five Star Weekend, The Bear and Dark Winds — were not yet present in the production catalog even though their publishers are in Phase 7A discovery scope.

This is deliberately **not** repaired by inserting synthetic show identities or weakening lifecycle identity checks. A later catalog-convergence pass should measure why eligible high-profile shows can remain outside the bounded candidate set and improve convergence without breaking the 48-request ceiling.

## Phase 7B — Official lifecycle source coverage

**Status:** production-accepted on 2026-09-08.

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

## Phase 7B.1 — Real-source evidence validation

**Status:** implementation validation.

Phase 7B.1 validates each Phase 7B publisher against a real show already present in production. The selected cases are intentionally identity-first and fixed to both the Series Hub show ID and TMDB ID:

| Publisher | Production show | Evidence | Normalized event |
| --- | --- | --- | --- |
| Paramount Press Express | Tulsa King (`show_id=1711`, `tmdb_id=153312`) | Season 4 dated for October 16, 2026 | `premiere_dated`, season 4 |
| NBCUniversal Newsroom | Chicago Fire (`show_id=40`, `tmdb_id=44006`) | Renewed for season 15 | `renewed`, season 15 |
| Disney Newsroom | Shōgun (`show_id=1067`, `tmdb_id=126308`) | Development of two additional seasons announced | conservative `ordered`, season 2 |
| AMC Networks Press | The Walking Dead: Dead City (`show_id=1980`, `tmdb_id=194583`) | Season 2 dated for May 4, 2025 | `premiere_dated`, season 2 |

The Shōgun item is deliberately **not** represented as filming evidence: Disney's announcement said production timing was not yet locked. The normalized `ordered` event records the future-season commitment without asserting a production state that the source did not establish.

The AMC validation uses the archival `amcnetworks.com/press-releases/` URL because that is the currently registered source identity. The URL now redirects to AMC Global Media after AMC's 2026 corporate-domain transition, but the original official URL remains a valid archival source and preserves the Phase 7B whitelist contract.

### Phase 7B.2 follow-up — AMC Global Media

Current AMC corporate press releases are now published on `amcglobalmedia.com`. Phase 7B.2 should register that new official publishing surface non-destructively while retaining the archival `amc_networks_press` source for older evidence. The whitelist must not be silently widened inside 7B.1.

## Deferred from Phase 7A/7B

- automated press-site collectors;
- regional watch-provider availability;
- non-US catalog expansion;
- additional notification classes.

Collector automation should be evaluated separately only for publishers whose public formats prove stable enough for deterministic extraction and identity-safe matching.
