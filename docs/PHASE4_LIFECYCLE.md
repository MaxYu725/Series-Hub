# Phase 4 lifecycle evidence

Phase 4 adds official renewal, cancellation and production-state evidence without replacing the TMDB/TVmaze catalog and schedule layers.

## Phase structure

- **4A — evidence foundation:** event-sourced lifecycle records, provenance, retraction, protected editorial ingestion and the first Apple TV Press production evidence.
- **4B — visible official projection:** bulk lifecycle API plus season-specific official badges/source links in the catalog UI. Existing `airing` / `upcoming` / `planned` classification remains untouched.
- **4C — verified official source registry:** expand the browser-operated editorial whitelist to additional official publishers only after their canonical domains and URL structure are verified.
- **4D — second-source production acceptance:** prove the same evidence contract against Amazon Entertainment with Reacher season 5.
- **4E — multi-source acceptance:** validate WBD/HBO and Netflix official news against existing production catalog identities.
- **4F — FOX acceptance and catalog coverage repair:** repair FOX discovery/persistence blind spots, naturally ingest a current FOX scripted title, then attach identity-guarded FOXFLASH lifecycle evidence.
- **Later collector phase:** automate only source formats that prove stable enough to parse without weakening provenance, source URL validation or show/season identity rules.

## Evidence model

The evidence layer is event-sourced so facts can coexist over time. A renewal announcement, later filming announcement and eventual final-season announcement are separate attributed records rather than destructive updates.

Phase 4 evidence does **not** directly overwrite `shows.status`, `shows.tmdb_status` or `seasons.production_status`.

## Supported normalized events

Decision events:

- `renewed`
- `ordered`
- `cancelled`
- `final_season`
- `ended`

Production events:

- `pre_production`
- `filming`
- `wrapped`
- `post_production`
- `production_paused`

Schedule evidence:

- `premiere_dated`
- `delayed`

Each event retains:

- Series Hub show ID;
- optional existing season ID;
- season number even if the season row does not exist yet;
- normalized event type;
- registered source;
- exact evidence URL;
- official page/article title;
- publication date;
- confidence;
- short editorial note;
- retraction state and reason.

## Source rules

`official` confidence is accepted only from a source registered with `trust_level=official`. The submitted URL must match that source's registered HTTPS host and path prefix.

Verified source registry through Phase 4F:

| Source key | Display name | Allowed base |
| --- | --- | --- |
| `apple_tv_press` | Apple TV Press | `https://www.apple.com/tv-pr/` |
| `wbd_pressroom` | Warner Bros. Discovery Pressroom | `https://press.wbd.com/` |
| `amazon_entertainment` | Amazon Entertainment | `https://www.aboutamazon.com/news/entertainment/` |
| `netflix_media_center` | Netflix Media Center | `https://media.netflix.com/` |
| `netflix_tudum` | Netflix Tudum | `https://www.netflix.com/tudum/` |
| `fox_flash` | FOXFLASH | `https://www.foxflash.com/` |

The registry is a whitelist, not a scraper list. Registering a source does not authorize automatic extraction and does not make every page on that domain relevant lifecycle evidence.

Do not paste long source text into D1. `evidence_note` is a short editorial summary only; the exact official URL remains the evidence anchor.

### Source choices

Phase 4C uses the public `aboutamazon.com/news/entertainment/` pages rather than an authenticated Amazon MGM Studios press/admin surface. Evidence must remain publicly inspectable from the stored URL.

Netflix Media Center remains valid for official title/property material. Phase 4E registers Netflix Tudum separately because dated public lifecycle news and production updates are published there; provenance should identify the surface actually carrying the evidence instead of treating all Netflix pages as one source.

## Public projection

`GET /api/shows/:id/lifecycle`

returns active attributed events for one show plus a non-destructive current summary:

- latest decision evidence;
- latest production evidence;
- latest schedule evidence;
- the same projection grouped by season.

`GET /api/lifecycle`

provides a bulk projection for active catalog shows so the front end does not need one request per card.

A `final_season` decision and `pre_production`/`filming` state can therefore be represented at the same time.

## UI policy

Phase 4B only renders an event as **官方確認** when both conditions hold:

- `confidence = official`
- registered source `trust_level = official`

At most one current decision badge and one current production badge are shown on a catalog card. The badge remains season-specific, for example `第4季為最終季`; it must not relabel the whole series as completed.

Non-official evidence may remain useful internally later, but it must never inherit the official UI treatment.

## Editorial mutation

`POST /api/internal/lifecycle-evidence` is protected by the existing internal authorization-key contract. Normal browser-only operation uses the GitHub Actions workflow `Lifecycle evidence editorial`.

Supported actions:

- `upsert`: insert or idempotently refresh one evidence event;
- `retract`: preserve a bad/obsolete evidence record but remove it from the active projection.

The evidence key is deterministic from show, season, event type, source and publication identity, so rerunning the same editorial action is safe.

## Production acceptance

Completed acceptance through Phase 4F:

1. `Silo` — season 3 renewed; season 4 renewed and identified as final via Apple TV Press.
2. `For All Mankind` — season 6 renewed as final and conservatively normalized as `pre_production` from Apple TV Press wording.
3. `Reacher` — season 5 renewed via Amazon Entertainment while the series remained catalog `airing` with season 4 as the latest catalog season.
4. `House of the Dragon` — season 4 renewal via WBD/HBO Pressroom while catalog lifecycle remains independent.
5. `Wednesday` — season 3 renewal plus independent `filming` evidence via Netflix Tudum.
6. `Murder in a Small Town` — naturally ingested as Series Hub ID 431 / TMDB 241549 after Phase 4F catalog repairs; season 3 renewal is anchored to the May 7, 2026 FOXFLASH announcement.

### Phase 4F catalog findings

FOX evidence was deliberately blocked until a current FOX scripted title existed naturally in the production catalog. Two independent catalog limitations were found and repaired rather than bypassed with an orphan evidence row:

1. The FOX `popularity.desc` discovery page was dominated by historical hits. The FOX-only feed now uses a rolling three-calendar-year `first_air_date.gte` lower bound while every other core-network request remains unchanged.
2. TMDB sync selected and fetched up to 40 detail candidates but previously stopped after 30 successful writes. The default persistence cap now follows the already-selected `detailLimit`, while explicit lower overrides remain bounded by that limit. This adds no external request and avoids discarding already-fetched candidates.

The same investigation also corrected `show_genres(show_id, genre_id)` persistence to match the Phase 1 schema.

Production acceptance after these repairs resolved `Murder in a Small Town` as catalog `planned`, latest catalog season 2, networks `FOX · Global TV`, with no lifecycle events before the FOX seed.

## Audit policy

Production-network probes are integration/audit checks, not unit tests. They must run through an explicit audit workflow or dedicated integration command and must not be discovered by the default `npm test` suite. This keeps normal validation reproducible when production or DNS is unavailable.

## Collector gate

A source-specific collector may be added only when all of the following are true:

1. public pages are accessible without authentication;
2. canonical article URLs are stable;
3. publication date and title can be extracted deterministically;
4. event wording can be normalized without broad speculative NLP;
5. the target show/season can be mapped without unsafe fuzzy matching;
6. the collector emits the same protected evidence model rather than writing lifecycle fields directly;
7. failures degrade to “no new evidence” instead of inventing or overwriting facts.

Until then, the browser-operated editorial workflow is the authoritative ingestion path.
