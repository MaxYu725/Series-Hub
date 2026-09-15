const fs = require('fs');
const path = 'docs/PHASE10_KOREA.md';
const text = fs.readFileSync(path, 'utf8');
const from = `## Phase 10E — Korean Catalog Coverage Expansion

Status: implementation candidate after the 2026-09-15 production coverage audit.

The live Korean catalog had reached only 13 active rows even though a bounded read-only TMDB audit found a much larger eligible candidate pool. Phase 10E therefore hardens discovery efficiency before a second geographic market is started. It keeps the 24-request KR ceiling, caps schedule-gap maintenance at four detail slots, prioritizes unseen candidates, rotates broad/schedule discovery pages 1–3, expands schedule look-ahead to 180 days, and pushes the already-accepted fiction/status rules into discovery where safe. See \`PHASE10E_KOREA_COVERAGE.md\`.

## Phase 10 closeout / next geographic track

Phase 10A–10D remain production accepted. Phase 10E reopens only Korean catalog coverage efficiency; it does not reopen the accepted schedule, market-selector or lifecycle contracts.

Deferred work that remains outside Phase 10E:
- additional Korean official publishers only after canonical URL verification;
- automated lifecycle collectors only after the Phase 4 collector gate;
- expansion to another geographic catalog market.

Japan / Taiwan / Europe evaluation remains the next geographic track after Phase 10E reaches production acceptance.`;
const to = `## Phase 10E — Korean Catalog Coverage Expansion

Status: accepted in production on 2026-09-15.

The live Korean catalog had reached only 13 active rows even though a bounded read-only TMDB audit found a much larger eligible candidate pool. Phase 10E repaired discovery efficiency without raising the 24-request KR ceiling or relaxing the Phase 10A.1 quality gate. It caps schedule-gap maintenance at four detail slots, prioritizes unseen candidates, rotates broad/schedule discovery pages 1–3, expands schedule look-ahead to 180 days, and applies the accepted fiction/status rules during discovery where safe.

Production acceptance after PR #128 confirmed:
- active Korean catalog **13 → 42**;
- future Korean TVmaze-owned episodes **123 → 241**;
- three bounded KR convergence syncs each stayed within **24 requests / 18 detail selections / 4 schedule-gap candidates**;
- 54 accepted row writes across those three syncs;
- 0 out-of-policy active Korean rows;
- 0 future non-Korean TMDB fallback leakage;
- 4 benchmark titles entered naturally without manual seeds: Flex X Cop, Made in Korea, The Ordinary Jackpot and A Love Other Than Yours;
- \`tmdb_kr\` and production operational health remained successful.

See \`PHASE10E_KOREA_COVERAGE.md\` for the baseline audit, selection policy, exact acceptance run and production metrics.

## Phase 10 closeout / next geographic track

Phase 10A–10E are now production accepted. The first non-US market has accepted catalog ingestion, catalog quality controls, schedule coverage, shared market UI filtering, official lifecycle evidence and materially broader catalog coverage without a parallel Korea-specific data stack.

Deferred work that remains outside the accepted Phase 10 scope:
- additional Korean official publishers only after canonical URL verification;
- automated lifecycle collectors only after the Phase 4 collector gate;
- expansion to another geographic catalog market.

Japan / Taiwan / Europe evaluation is now the next geographic track. The next market should be selected by source quality, schedule coverage and Chinese-title availability rather than by adding all regions at once.`;
if (!text.includes(from)) throw new Error('Phase 10E roadmap closeout anchor not found');
if (text.indexOf(from) !== text.lastIndexOf(from)) throw new Error('Phase 10E roadmap closeout anchor is not unique');
fs.writeFileSync(path, text.replace(from, to));
