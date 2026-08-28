# Phase 5E-D4 — Acceptance

**Accepted:** 2026-08-28 (Asia/Hong_Kong)  
**Status:** Accepted for production

## Acceptance decision

Phase 5E-D4 has completed the real-device product acceptance gate defined in `docs/PHASE5E_D_PLAN.md`.

The production UI was reviewed on a real phone after the final schedule/product refinements and the project owner explicitly confirmed: **「驗收正常」**.

This satisfies the Phase 5E-D gate that required the current US-series experience to be operationally healthy and sufficiently polished for routine mobile use before non-US expansion.

## Final production changes covered by acceptance

- The long landing-page explainer was removed so the active Today / This Week content is the first main product section.
- Multiple episodes from the same show on the same local date are grouped into a single show card instead of filling the page with repeated cards.
- Same-time multi-episode releases receive a compact `一次上架 N 集` label; same-day episodes at different times remain grouped without being misrepresented as a batch release.
- Airing catalog cards now expose the next real TVmaze episode timestamp when available.
- If TVmaze has only a date, the UI states that the time is pending.
- If no future TVmaze episode exists, the UI states that the next schedule is unconfirmed instead of fabricating a date or time.
- A production browser audit found and fixed a 390 px mobile regression where the horizontal filter strip could be positioned outside the viewport.

## Production verification evidence

The final production browser audit completed successfully after the mobile filter fix:

- 390 × 844 phone layout: passed
- normal desktop layout: passed
- Today / This Week controls remain visible on phone: passed
- content-first landing flow: passed
- same-show daily grouping: passed
- multi-episode batch labeling: passed
- Airing next-schedule visibility: passed
- missing future schedule remains explicit rather than fabricated: passed
- horizontal viewport/runtime checks: passed

Observed production data during the audit:

- Today: 10 episodes rendered as 3 show cards
- one real same-time release rendered as `一次上架 8 集`
- This Week: 17 episodes rendered as 10 show cards
- Airing: 13 shows, with 8 exposing precise future timestamps at audit time
- `House of the Dragon` had no future TVmaze episode at audit time and correctly rendered the latest known episode plus `下集待確認`

Relevant production runs:

- final production deploy: GitHub Actions run `33141206448` — success
- production VAPID readiness: GitHub Actions run `33141206455` — success
- final phone/desktop browser audit: GitHub Actions run `33141016787` (rerun after the mobile filter fix) — success

## Phase gate

The Phase 5E-D4 acceptance requirement is now satisfied.

**Phase 5E US-series maturity closeout is complete. Phase 6 non-US expansion is no longer blocked by the Phase 5E-D4 product-acceptance gate.**

Any later regressions should be handled as normal product maintenance and should not silently reopen the completed Phase 5E acceptance gate unless they invalidate a core acceptance criterion.
