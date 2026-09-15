import fs from 'node:fs';
import {
  CORE_NETWORK_SEEDS,
  TMDB_SYNC_BUDGET,
  selectNetworkSeedsForSync,
  networkDiscoveryPage,
  networkDiscoveryParams,
  candidateRotationOffset,
  networkCandidateRotationOffset,
  selectRoundRobinCandidates
} from '../src/tmdb.js';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const token = process.env.TMDB_API_TOKEN;
if (!token) throw new Error('TMDB_API_TOKEN missing');

const dbPayload = JSON.parse(fs.readFileSync(process.env.US_DB_JSON || '/tmp/us-db.json', 'utf8'));
const rows = [];
const walk = (value) => {
  if (Array.isArray(value)) return value.forEach(walk);
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value.results)) {
    for (const row of value.results) {
      if (row && Object.prototype.hasOwnProperty.call(row, 'tmdb_id')) rows.push(row);
    }
  }
  for (const child of Object.values(value)) walk(child);
};
walk(dbPayload);

const dbByTmdb = new Map(rows.map((row) => [Number(row.tmdb_id), row]));
const activeStatuses = new Set(['airing', 'upcoming', 'planned']);
const activeDb = new Set(rows.filter((row) => activeStatuses.has(row.status)).map((row) => Number(row.tmdb_id)));
const statusCounts = rows.reduce((acc, row) => {
  acc[row.status || 'null'] = (acc[row.status || 'null'] || 0) + 1;
  return acc;
}, {});

const excludedGenreIds = new Set([16, 99, 10762, 10763, 10764, 10767]);
const excludedDiscoverGenres = [...excludedGenreIds].join('|');
const targetNetworkNames = new Set([
  'ABC','AMC','AMC+','Amazon','Amazon Prime Video','Apple TV','Apple TV+','CBS','Disney+','FOX','FX','FXX',
  'Freeform','HBO','HBO Max','Hulu','Max','MGM+','NBC','Netflix','Paramount+','Peacock','Prime Video','Showtime',
  'Starz','Syfy','The CW','USA Network'
].map((name) => name.toLowerCase()));

const today = new Date().toISOString().slice(0, 10);
const dateAhead = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dateAgo = (days) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};
const recentThreshold = dateAgo(35);

const cache = new Map();
async function tmdb(pathname, params = {}) {
  const url = new URL(`${TMDB_API_BASE}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  const key = url.toString();
  if (cache.has(key)) return cache.get(key);
  const response = await fetch(url, { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`TMDB ${response.status}: ${pathname}`);
  const data = await response.json();
  cache.set(key, data);
  return data;
}

function discoverParams(extra = {}) {
  return {
    include_adult: false,
    language: 'en-US',
    sort_by: 'popularity.desc',
    with_origin_country: 'US',
    with_type: '2|4',
    without_genres: excludedDiscoverGenres,
    ...extra
  };
}

function normalizeLifecycle(details) {
  const firstAirDate = /^\d{4}-\d{2}-\d{2}$/.test(details.first_air_date || '') ? details.first_air_date : null;
  const lastRaw = details.last_episode_to_air?.air_date || details.last_air_date;
  const lastAirDate = /^\d{4}-\d{2}-\d{2}$/.test(lastRaw || '') ? lastRaw : null;
  const nextRaw = details.next_episode_to_air?.air_date;
  const explicitNext = /^\d{4}-\d{2}-\d{2}$/.test(nextRaw || '') ? nextRaw : null;
  const futureSeason = (details.seasons || [])
    .filter((s) => Number(s.season_number) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(s.air_date || '') && s.air_date > today)
    .map((s) => s.air_date).sort()[0] || null;
  const recentlyActive = Boolean(lastAirDate && lastAirDate >= recentThreshold);
  if (firstAirDate && firstAirDate > today) return 'upcoming';
  if (explicitNext && explicitNext >= today) return recentlyActive ? 'airing' : 'upcoming';
  if (futureSeason) return 'upcoming';
  if (!['Ended', 'Canceled'].includes(details.status) && recentlyActive) return 'airing';
  if (['Ended', 'Canceled'].includes(details.status)) return 'completed';
  if (['Returning Series', 'In Production', 'Planned', 'Pilot'].includes(details.status)) return 'planned';
  return 'unknown';
}

function eligible(details) {
  if (!details || !['Scripted', 'Miniseries'].includes(details.type)) return false;
  if (!Array.isArray(details.origin_country) || !details.origin_country.includes('US')) return false;
  if ((details.genres || []).some((g) => excludedGenreIds.has(Number(g.id)))) return false;
  if (!(details.networks || []).some((n) => targetNetworkNames.has(String(n.name || '').trim().toLowerCase()))) return false;
  return activeStatuses.has(normalizeLifecycle(details));
}

async function detailsBatch(candidates, limit) {
  const selected = candidates.slice(0, limit);
  const output = [];
  for (let i = 0; i < selected.length; i += 8) {
    const batch = selected.slice(i, i + 8);
    const settled = await Promise.all(batch.map(async (candidate) => {
      const details = await tmdb(`/tv/${candidate.id}`, { language: 'en-US' });
      return { candidate, details };
    }));
    output.push(...settled);
  }
  return output;
}

// A. Simulate the current production US selector for this six-hour slot.
const now = new Date();
const activeSeeds = selectNetworkSeedsForSync(CORE_NETWORK_SEEDS, TMDB_SYNC_BUDGET.networkDiscoveryRequests, now);
const currentNetworkFeeds = [];
const currentNetworkMeta = [];
for (const seed of activeSeeds) {
  const page = networkDiscoveryPage(seed, now);
  const result = await tmdb('/discover/tv', { page, ...discoverParams(networkDiscoveryParams(seed, now)) });
  currentNetworkFeeds.push(result.results || []);
  currentNetworkMeta.push({ seed, page });
}
const currentSchedule = await tmdb('/discover/tv', { page: 1, ...discoverParams({ 'air_date.gte': today, 'air_date.lte': dateAhead(90) }) });
const currentBroad = await tmdb('/discover/tv', { page: 1, ...discoverParams() });
const currentFeeds = [...currentNetworkFeeds, currentSchedule.results || [], currentBroad.results || []];
const currentOffset = candidateRotationOffset(currentFeeds, TMDB_SYNC_BUDGET.detailRequests, now);
const activeFeedCount = Math.max(1, currentFeeds.filter((feed) => Array.isArray(feed) && feed.length).length);
const stride = Math.max(1, Math.floor(TMDB_SYNC_BUDGET.detailRequests / activeFeedCount));
const networkOffsets = currentNetworkFeeds.map((feed, index) => networkCandidateRotationOffset(
  currentNetworkMeta[index].seed,
  currentNetworkMeta[index].page,
  feed.length,
  stride,
  now
));
const currentSelected = selectRoundRobinCandidates(
  currentFeeds,
  TMDB_SYNC_BUDGET.detailRequests,
  [...networkOffsets, currentOffset, currentOffset]
);
const currentDetails = await detailsBatch(currentSelected, currentSelected.length);
const currentSelectedStats = currentDetails.reduce((acc, { candidate, details }) => {
  const id = Number(candidate.id);
  if (activeDb.has(id)) acc.alreadyActive += 1;
  else if (dbByTmdb.has(id)) acc.presentInactive += 1;
  else acc.absent += 1;
  if (eligible(details)) {
    acc.eligible += 1;
    if (activeDb.has(id)) acc.eligibleAlreadyActive += 1;
    else if (dbByTmdb.has(id)) acc.eligiblePresentInactive += 1;
    else acc.eligibleAbsent += 1;
  }
  return acc;
}, { alreadyActive: 0, presentInactive: 0, absent: 0, eligible: 0, eligibleAlreadyActive: 0, eligiblePresentInactive: 0, eligibleAbsent: 0 });

// B. Broader read-only sample: broad/schedule pages 1-3 and all core network pages 1-3.
const candidateMap = new Map();
const addResults = (results, source) => {
  for (const item of results || []) {
    const id = Number(item?.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const existing = candidateMap.get(id) || { ...item, sources: [] };
    existing.popularity = Math.max(Number(existing.popularity || 0), Number(item.popularity || 0));
    existing.sources.push(source);
    candidateMap.set(id, existing);
  }
};
for (let page = 1; page <= 3; page += 1) {
  const broad = await tmdb('/discover/tv', { page, ...discoverParams() });
  addResults(broad.results, `broad:${page}`);
  const schedule = await tmdb('/discover/tv', { page, ...discoverParams({ 'air_date.gte': today, 'air_date.lte': dateAhead(180) }) });
  addResults(schedule.results, `schedule180:${page}`);
}
for (const seed of CORE_NETWORK_SEEDS) {
  for (let page = 1; page <= 3; page += 1) {
    const result = await tmdb('/discover/tv', { page, ...discoverParams({ with_networks: seed.tmdbNetworkId, ...(networkDiscoveryParams(seed, now)['first_air_date.gte'] ? { 'first_air_date.gte': networkDiscoveryParams(seed, now)['first_air_date.gte'] } : {}) }) });
    addResults(result.results, `network:${seed.name}:${page}`);
  }
}

const allCandidates = [...candidateMap.values()].sort((a, b) => Number(b.popularity || 0) - Number(a.popularity || 0));
const notActive = allCandidates.filter((candidate) => !activeDb.has(Number(candidate.id)));
const auditDetails = await detailsBatch(notActive, 120);
const eligibleMissing = [];
for (const { candidate, details } of auditDetails) {
  if (!eligible(details)) continue;
  const id = Number(candidate.id);
  eligibleMissing.push({
    id,
    name: details.name || details.original_name || String(id),
    lifecycle: normalizeLifecycle(details),
    tmdbStatus: details.status || null,
    popularity: Number(candidate.popularity || details.popularity || 0),
    dbState: dbByTmdb.has(id) ? String(dbByTmdb.get(id).status || 'present') : 'absent',
    networks: (details.networks || []).map((n) => n.name).filter(Boolean).slice(0, 3),
    sources: [...new Set(candidate.sources)].slice(0, 5)
  });
}
eligibleMissing.sort((a, b) => b.popularity - a.popularity);

const summary = {
  auditDate: today,
  productionDb: {
    usRowsTotal: rows.length,
    usActiveRows: activeDb.size,
    statusCounts
  },
  currentRunSimulation: {
    discoveryRequests: currentFeeds.length,
    detailSlots: currentSelected.length,
    selectedStats: currentSelectedStats,
    activeSeeds: currentNetworkMeta.map(({ seed, page }) => ({ name: seed.name, page })),
    candidateOffset: currentOffset
  },
  broaderSample: {
    discoveryRequestsEquivalent: 48,
    uniqueCandidates: allCandidates.length,
    notCurrentlyActiveCandidates: notActive.length,
    detailAudited: auditDetails.length,
    eligibleActiveMissingInAuditedTop120: eligibleMissing.length,
    eligibleAbsent: eligibleMissing.filter((x) => x.dbState === 'absent').length,
    eligiblePresentButInactive: eligibleMissing.filter((x) => x.dbState !== 'absent').length,
    topEligibleMissing: eligibleMissing.slice(0, 25)
  }
};

console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync('/tmp/us-coverage-summary.json', JSON.stringify(summary, null, 2));
