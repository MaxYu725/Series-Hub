# Data Model

## Design rule: season first

Series Hub treats a season as a first-class lifecycle entity. A show-level status such as `returning` is insufficient because a completed season and a newly ordered season can coexist under the same series.

```text
shows
  └── seasons
        └── episodes
```

## `shows`

Canonical series identity and broad metadata.

Important identity/source fields:

- `original_title`
- `english_title`
- `original_language`
- `origin_country`
- `tmdb_id`
- `tvmaze_id`

Lifecycle fields:

- `status` — Series Hub normalized lifecycle (`airing`, `upcoming`, `planned`, `completed`, `unknown`)
- `tmdb_status` — raw TMDB vocabulary retained for provenance/debugging
- `first_air_date`
- `last_air_date`
- `next_air_date`
- `in_production`

Catalog/display fields introduced in Phase 1:

- `series_type`
- `overview`
- `poster_url`
- `backdrop_url`
- `popularity`
- `vote_average`
- `vote_count`
- `homepage_url`
- `number_of_seasons`
- `number_of_episodes`
- `last_synced_at`

Series Hub does not make raw TMDB status the public API contract. Source-specific state remains separate from normalized lifecycle.

## `seasons`

Tracks one numbered season of a series.

Key fields:

- `show_id`
- `season_number`
- `premiere_date`
- `finale_date`
- `episode_count`
- `lifecycle_status`
- `production_status`
- `tmdb_id`

Phase 1 currently writes the broad lifecycle vocabulary needed by the three primary views. More detailed production states such as filming/post-production are intentionally deferred until official-source work in Phase 4.

## `episodes`

Episode-level release records. Phase 1 does not ingest full episode schedules. TVmaze is expected to become the schedule source in Phase 2.

## `title_aliases`

Chinese and alternative naming is modeled as data, not as one fixed title column.

Phase 1 TMDB aliases use:

- `locale = zh`, `region = HK`
- `locale = zh`, `region = TW`
- `locale = zh`, `region = CN`
- `locale = en`, `region = US`

Fields include `source_key`, `is_preferred` and `confidence`. Automated TMDB translations use `source_key = tmdb` and normal confidence. A later manual override layer can coexist without overwriting source-derived aliases.

## `networks`

Introduced in Phase 1 for original/broadcast/streaming network identities supplied by TMDB.

Key fields:

- `tmdb_network_id`
- `canonical_name`
- `origin_country`
- `logo_url`

## `show_networks`

Many-to-many relation between a show and TMDB networks. `is_primary` records source order for display preference.

This is original/service attribution, not regional streaming availability.

## `genres`

Normalized TMDB genre identities.

## `show_genres`

Many-to-many show/genre relation. Phase 1 uses TMDB genre ID 16 to exclude animation from the initial live-action MVP catalog.

## `providers`

Canonical regional availability providers. This table remains reserved for later watch-provider work; it is distinct from `networks`.

## `availability`

Regional availability. This remains deliberately separate from original network/service attribution.

Conceptually:

```text
Original network/service: FX
US availability: Hulu
HK availability: Disney+
```

Phase 1A does not populate watch-provider availability yet.

## `sources`

Registry of external data sources and their trust level. Migration `0002_phase1_tmdb.sql` registers `tmdb` as a metadata API source.

## `sync_runs`

Operational record of ingestion attempts. TMDB catalog runs store:

- start/finish time;
- source;
- run type;
- success/failure status;
- candidates seen;
- accepted/upserted records;
- bounded error summary.

## Time representation

Dates are stored as ISO date text because upstream TV data often provides date-only values without timezone semantics. Precise timestamps such as sync times use SQLite `CURRENT_TIMESTAMP` initially.

Do not invent a timezone when the source provides only a calendar date.

## IDs

Internal integer IDs are the canonical relational keys. External IDs (`tmdb_id`, `tvmaze_id`, TMDB network/genre IDs) are mappings, not primary keys. This prevents the internal model from becoming dependent on a single upstream provider.

## Migration rule

Applied migrations are immutable:

- `0001_initial.sql` — Phase 0 relational foundation;
- `0002_phase1_tmdb.sql` — TMDB catalog fields, networks and genres.

Future changes must add new numbered migration files rather than editing an applied migration.
