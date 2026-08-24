# Phase 3 — Chinese title policy

Phase 3 refines Chinese naming without replacing the existing `title_aliases` model.

## Phase 3A contract

Series Hub keeps every title as an attributed alias. The preferred title for each show and region is resolved independently for `HK`, `TW` and `CN`.

Preference order:

1. preferred `manual` alias;
2. another preferred source alias (currently TMDB);
3. non-preferred `manual` alias;
4. any remaining alias.

Confidence breaks ties in this order: `official` → `high` → `normal` → `unverified`.

A manual alias does not modify or delete the TMDB record. TMDB catalog refresh deletes/replaces only aliases whose `source_key = 'tmdb'`, so manual records survive normal synchronization.

## Regional display fallback

The requested region is always tried first:

- HK: HK → TW → CN
- TW: TW → HK → CN
- CN: CN → TW → HK

The API exposes both the requested region and the region actually used. A cross-region fallback is therefore visible rather than silently presented as a local title.

## API additions

`GET /api/shows?region=HK|TW|CN`

`GET /api/schedule?region=HK|TW|CN`

Both preserve the existing `title_zh_hk`, `title_zh_tw` and `title_zh_cn` fields and add a resolved `display_title_zh` plus source/confidence/fallback metadata.

`GET /api/title-audit`

Returns active-catalog HK/TW/CN coverage percentages, missing-title lists and the count of shows currently using a manual preferred title.

`GET /api/shows/:id/aliases?region=HK|TW|CN`

Returns every show-level alias with provenance and the resolved preferred title for the requested region.

## Manual override workflow

GitHub Actions → **Title alias override** is the controlled browser-only editor. It derives the same protected internal key already used by catalog sync and calls `POST /api/internal/title-override`; no admin credential or write control is exposed to the frontend.

The Worker validates the request, uses bound D1 prepared statements, and submits related mutations through one `DB.batch()` transaction. Cloudflare D1 rolls back the batch if a statement fails.

Supported actions:

- `set-preferred`: add/replace the preferred manual title for one show/region;
- `add-alias`: add a searchable alternate manual title without replacing the preferred title;
- `remove-alias`: remove the exact manual alias and allow normal preference/fallback rules to take over.

The target show must already exist in production. Preview Workers do not receive the TMDB secret and therefore cannot authorize the mutation endpoint.

## Frontend

The title-region selector defaults to Hong Kong and is stored in browser `localStorage`. The selected region is sent to both catalog and schedule APIs. Search continues to match every stored Chinese alias, not only the currently displayed preferred title.

The UI only adds provenance text when it matters:

- `人工校正` when the displayed preferred title comes from the manual source;
- a regional fallback note when the requested region has no title and another region is used.

## Phase 3B acceptance

After Phase 3A is deployed:

1. read `/api/title-audit` from production;
2. inspect missing/low-quality HK/TW/CN titles with `/api/shows/:id/aliases`;
3. verify questionable translations against suitable regional/official references;
4. use the controlled override workflow for corrections and alternate aliases;
5. run a TMDB refresh and prove manual preferred titles survive;
6. live-audit catalog/search/schedule behavior for all three regional preferences;
7. only then promote the service phase identifier to Phase 3 and mark Phase 3 complete.

Do not start Phase 4 renewal/production scraping until these acceptance steps are complete.


### Accepted production snapshot — 2026-08-24

- active series 28; HK 28/28; TW 28/28; CN 24/28;
- `The Shards` → `青春碎片` (HK), `manual / official`;
- post-override TMDB refresh `success`, 137 seen / 23 changed;
- manual preferred title survived the refresh;
- 36/36 tests plus isolated preview and production regression passed.

Phase 3 is complete; this regional-title policy remains authoritative during Phase 4.
