# Data Model

## Design rule: season first

Series Hub treats a season as a first-class lifecycle entity. A show-level status such as `returning` is insufficient for the product because a completed season and a newly ordered season can coexist under the same series.

```text
shows
  └── seasons
        └── episodes
```

## `shows`

Canonical series identity and broad metadata.

Important fields:

- `original_title`
- `original_language`
- `origin_country`
- `first_air_date`
- `status`
- external IDs such as `tmdb_id` and `tvmaze_id`

`shows.status` is intentionally broad. Detailed release/production state belongs to the relevant season.

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

Expected lifecycle vocabulary will be normalized in later phases. Candidate states include:

- `announced`
- `renewed`
- `ordered`
- `pre_production`
- `filming`
- `post_production`
- `upcoming_dated`
- `airing`
- `completed`
- `cancelled`
- `unknown`

The database does not enforce this list yet because Phase 0 should not prematurely lock lifecycle semantics before real data-source testing.

## `episodes`

Episode-level release records. TVmaze is expected to become an important schedule source in Phase 2.

## `title_aliases`

Chinese and alternative naming is modeled as data, not as one fixed title column.

Examples of possible locale/region combinations:

- `zh-Hant` + `HK`
- `zh-Hant` + `TW`
- `zh-Hans` + `CN`

Fields include `source_key`, `is_preferred` and `confidence` so Series Hub can distinguish an official/localized title from a community alias or manual override.

## `providers`

Canonical networks or streaming-service identities. Provider identity is independent of region.

## `availability`

Regional availability. This is deliberately separate from original network/service attribution.

Conceptually:

```text
Original network: FX
US availability: Hulu
HK availability: Disney+
```

A later migration may add a dedicated series/season origin-network relation when upstream-source testing confirms the required granularity.

## `sources`

Registry of external data sources and their trust level. This supports source attribution and allows one source to be disabled without changing canonical records.

## `sync_runs`

Operational record of ingestion attempts. Phase 0 creates it before collectors exist so later phases have an audit trail from their first run.

## Time representation

Dates are stored as ISO-style text because upstream TV data often provides date-only values without timezone semantics. Precise timestamps such as sync times use SQLite `CURRENT_TIMESTAMP` initially.

Do not invent a timezone when the source only provides a calendar date.

## IDs

Internal integer IDs are the canonical relational keys. External IDs (`tmdb_id`, `tvmaze_id`) are mappings, not primary keys. This prevents the internal model from becoming dependent on a single upstream provider.
