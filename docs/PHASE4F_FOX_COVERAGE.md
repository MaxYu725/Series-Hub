# Phase 4F FOX catalog coverage repair

Phase 4F repairs a catalog-discovery blind spot found while expanding official FOX lifecycle evidence.

## Problem

The existing FOX TMDB discovery feed used `popularity.desc` without a first-air bound. That caused historical FOX hits such as *House*, *Bones*, *Prison Break* and *The X-Files* to dominate the first page. Because Series Hub deliberately caps TMDB detail requests and round-robins across discovery feeds, current FOX scripted series could be excluded before detail normalization.

A live audit confirmed that *Murder in a Small Town* (TMDB 241549) is a current scripted returning FOX series but is absent from the unbounded popularity first page.

## Repair

Only the FOX core-network seed uses a rolling first-air lower bound:

`first_air_date.gte = January 1 of (current UTC year - 3)`

For 2026 this resolves to `2023-01-01`.

The feed still sorts by `popularity.desc`, and every other core-network discovery request remains unchanged.

## Why three years

The live FOX audit found the target rank was:

- absent from the current unbounded popularity first page;
- 6 with a 2022 lower bound;
- 5 with a 2023 lower bound;
- 4 with a 2024 lower bound.

The three-year rolling window is the least restrictive tested option that places the current FOX target inside the approximate five-candidate-per-feed round-robin allocation while retaining additional recent FOX series.

## Budget and safety

This change adds no external request. The TMDB sync budget remains:

- 6 core-network discovery requests;
- 1 schedule discovery request;
- 1 broad discovery request;
- 40 detail requests;
- 48 total external requests at the configured maximum.

This is a discovery-quality repair only. It does not seed lifecycle evidence, change lifecycle normalization, or directly mutate production D1 outside the normal TMDB sync path.
