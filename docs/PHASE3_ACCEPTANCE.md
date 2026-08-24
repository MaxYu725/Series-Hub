# Phase 3B acceptance

Phase 3 is accepted only after all of the following are true in production:

- the active catalog exposes region-specific HK / TW / CN Chinese titles with documented fallback order;
- title search continues to match every stored Chinese alias;
- the protected title-override route rejects unauthenticated writes;
- a verified manual preferred alias is written to production with provenance/confidence;
- at least one manual preferred alias survives a real TMDB catalog refresh;
- the live title audit reports the manual override and regional coverage correctly;
- no unsupported or invented regional title is added only to increase coverage;
- isolated D1 rebuild and preview Worker regression remain green.

Live editorial acceptance case:

- Show: `The Shards`
- Region: `HK`
- Preferred title: `青春碎片`
- Evidence level: official Hong Kong provider page
- Stored provenance: `manual`
- Stored confidence: `official`

The four currently missing CN-specific titles (`Ted Lasso`, `Wednesday`, `For All Mankind`, `Severance`) are intentionally allowed to use the documented cross-region fallback until a reliable mainland-China-specific title source exists. Coverage percentage is not treated as a reason to invent or mislabel a regional title.
