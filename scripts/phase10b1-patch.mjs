import fs from "node:fs";

const path = "src/tmdb-korea.js";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(oldText, newText, label) {
  const count = text.split(oldText).length - 1;
  if (count !== 1) throw new Error(`${label} match count: ${count}`);
  text = text.replace(oldText, newText);
}

const anchor = `function uniqueCandidateCount(feeds) {
  const ids = new Set();
  for (const feed of feeds || []) {
    for (const item of feed || []) {
      if (item?.id !== null && item?.id !== undefined) ids.add(item.id);
    }
  }
  return ids.size;
}
`;

const helpers = `${anchor}
export async function selectKoreanScheduleGapCandidates(db, limit, now = new Date()) {
  const boundedLimit = Math.min(
    Math.max(Number(limit) || KOREA_TMDB_SYNC_BUDGET.detailRequests, 1),
    KOREA_TMDB_SYNC_BUDGET.detailRequests
  );
  const today = todayUtc(now);
  const result = await db
    .prepare(
      \`SELECT s.tmdb_id AS id
       FROM shows s
       WHERE s.tmdb_id IS NOT NULL
         AND (',' || COALESCE(s.origin_country, '') || ',') LIKE '%,KR,%'
         AND s.status IN ('airing', 'upcoming', 'planned')
         AND NOT EXISTS (
           SELECT 1
           FROM seasons se
           JOIN episodes e ON e.season_id = se.id
           WHERE se.show_id = s.id
             AND e.tvmaze_id IS NOT NULL
             AND e.air_date >= ?1
         )
       ORDER BY
         CASE WHEN s.next_air_date IS NULL THEN 1 ELSE 0 END,
         s.next_air_date ASC,
         COALESCE(s.last_synced_at, '1970-01-01') ASC,
         s.id ASC
       LIMIT ?2\`
    )
    .bind(today, boundedLimit)
    .all();

  return (result.results || [])
    .map((row) => ({ id: Number(row.id), scheduleGapPriority: true }))
    .filter((candidate) => Number.isInteger(candidate.id) && candidate.id > 0);
}

export function mergePriorityCandidates(priorityCandidates, discoveredCandidates, limit) {
  const boundedLimit = Math.max(Number(limit) || 0, 0);
  const merged = [];
  const seen = new Set();
  for (const candidate of [...(priorityCandidates || []), ...(discoveredCandidates || [])]) {
    const id = Number(candidate?.id);
    if (!Number.isInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    merged.push(candidate);
    if (merged.length >= boundedLimit) break;
  }
  return merged;
}
`;
replaceOnce(anchor, helpers, "helper anchor");

replaceOnce(
  `    const candidateFeeds = [...networkFeeds, ...scheduleFeeds, ...broadFeeds];
    recordsSeen = uniqueCandidateCount(candidateFeeds);
    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
`,
  `    const candidateFeeds = [...networkFeeds, ...scheduleFeeds, ...broadFeeds];
    const scheduleGapCandidates = await selectKoreanScheduleGapCandidates(env.DB, detailLimit, now);
    recordsSeen = uniqueCandidateCount([...candidateFeeds, scheduleGapCandidates]);
    const candidateOffset = candidateRotationOffset(candidateFeeds, detailLimit, now);
`,
  "candidate feed anchor"
);

replaceOnce(
  `    const selectedCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffsets
    );
    const detailsResults = await fetchDetailsInBatches(env, selectedCandidates);
`,
  `    const discoveredCandidates = selectRoundRobinCandidates(
      candidateFeeds,
      detailLimit,
      candidateOffsets
    );
    const selectedCandidates = mergePriorityCandidates(
      scheduleGapCandidates,
      discoveredCandidates,
      detailLimit
    );
    const detailsResults = await fetchDetailsInBatches(env, selectedCandidates);
`,
  "selected candidate anchor"
);

replaceOnce(
  `      recordsSelected: selectedCandidates.length,
      recordsChanged,
`,
  `      recordsSelected: selectedCandidates.length,
      scheduleGapCandidates: scheduleGapCandidates.length,
      recordsChanged,
`,
  "return metrics anchor"
);

fs.writeFileSync(path, text);
