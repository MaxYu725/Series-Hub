# US Coverage Hardening

Status: implementation candidate after the 2026-09-15 read-only production audit.

## Baseline

The production US catalog contained 150 active rows: 21 airing, 39 upcoming and 90 planned. A read-only audit sampled 719 TMDB discovery candidates and detail-audited the 120 highest-priority candidates not already active in production. Three rows already passed the existing US admission policy but were absent from D1: High Potential (ABC), Tracker (CBS) and Naughty Business (Prime Video). High Potential and Tracker were visible on future-schedule page 2 while the production broad/schedule discovery path was fixed to page 1.

## Policy

This hardening does not relax the accepted US scripted/network admission gate and does not increase the TMDB request ceiling. Each run remains bounded to 6 dedicated network discovery requests, 1 future-schedule discovery request, 1 broad discovery request and at most 40 detail requests: 48 external requests total.

The change improves selection efficiency by rotating broad and schedule discovery across pages 1-3, expanding the schedule look-ahead from 90 to 180 days, filtering terminal statuses from broad/network discovery, building a bounded 120-candidate in-memory pool, and prioritizing at most 32 unseen candidates while preserving refresh capacity for existing active shows. Future-date schedule discovery deliberately remains unfiltered by TMDB status so stale terminal metadata cannot hide a real future episode date.

No provider, schema, migration, market selector or US admission rule changes are included.
