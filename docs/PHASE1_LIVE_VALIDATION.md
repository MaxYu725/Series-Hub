# Phase 1 Live Validation

This checkpoint activates the first real TMDB-backed catalog after the Phase 1A core is already deployed.

## Production gate

A merge to `main` must:

1. run unit tests;
2. apply pending D1 migrations before deployment;
3. inject the GitHub repository secret `TMDB_API` into the production Worker as `TMDB_API_TOKEN`;
4. deploy the production Worker;
5. perform an immediate bounded TMDB catalog sync;
6. require at least one accepted show;
7. verify `/health`, `/api/shows` and `/api/sync-status`.

PR preview Workers remain isolated and intentionally do not receive the production TMDB secret.

## First live-data review

Do not expand catalog breadth immediately after the first successful sync. Review the actual normalized records first:

- `airing`, `upcoming` and `planned` distribution;
- Apple TV+, HBO/Max, Prime Video, FX and FOX coverage;
- false positives from popularity-based US discovery;
- HK/TW/CN translation availability and obvious mismatches;
- season numbering and selected latest season;
- network labels and artwork availability.

Any Phase 1B correction should be driven by observed live records rather than by adding more hard-coded lifecycle rules in advance.
