export const PERSONAL_STATE_WEIGHTS = Object.freeze({
  watching: 4,
  waiting: 3,
  completed: 2,
  paused: 0.75,
  unset: 1.5
});

function normalizeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function splitSignalTags(value) {
  return [...new Set(String(value || "")
    .split(/\s*[·|,]\s*/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function stateWeight(states, showId) {
  const state = String(states?.[String(showId)] || "");
  return PERSONAL_STATE_WEIGHTS[state] || PERSONAL_STATE_WEIGHTS.unset;
}

function addScore(map, key, weight) {
  map.set(key, (map.get(key) || 0) + weight);
}

function rankedSignals(map, limit = 4) {
  const rows = [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
  const max = rows[0]?.[1] || 0;
  return rows.map(([value, score]) => ({
    value,
    score,
    normalized: max > 0 ? score / max : 0
  }));
}

export function buildPersonalProfile(signalShows, trackedIds, viewingStates = {}) {
  const tracked = new Set((Array.isArray(trackedIds) ? trackedIds : [])
    .map(normalizeId)
    .filter(Boolean));
  const genres = new Map();
  const networks = new Map();
  let matchedTrackedShows = 0;

  for (const show of Array.isArray(signalShows) ? signalShows : []) {
    const id = normalizeId(show?.id);
    if (!id || !tracked.has(id)) continue;
    const showGenres = splitSignalTags(show?.genres);
    const showNetworks = splitSignalTags(show?.networks);
    if (showGenres.length === 0 && showNetworks.length === 0) continue;

    matchedTrackedShows += 1;
    const weight = stateWeight(viewingStates, id);
    for (const genre of showGenres) addScore(genres, genre, weight);
    for (const network of showNetworks) addScore(networks, network, weight);
  }

  const topGenres = rankedSignals(genres);
  const topNetworks = rankedSignals(networks);
  return {
    personalized: matchedTrackedShows > 0 && (topGenres.length > 0 || topNetworks.length > 0),
    trackedCount: tracked.size,
    matchedTrackedShows,
    topGenres,
    topNetworks
  };
}

function genericQuality(show) {
  const popularity = Math.max(0, Number(show?.popularity) || 0);
  const rating = Math.max(0, Math.min(10, Number(show?.vote_average) || 0));
  const votes = Math.max(0, Number(show?.vote_count) || 0);
  const ratingConfidence = Math.min(1, votes / 500);
  return Math.min(2, Math.log10(popularity + 1) / 2) + (rating / 10) * ratingConfidence;
}

function activeStatusBoost(status) {
  if (status === "airing") return 0.45;
  if (status === "upcoming") return 0.35;
  if (status === "planned") return 0.2;
  return 0;
}

function matchSignals(candidateValues, profileSignals) {
  const values = new Set(candidateValues);
  return profileSignals.filter((item) => values.has(item.value));
}

export function scorePersonalCandidate(show, profile) {
  const genres = splitSignalTags(show?.genres);
  const networks = splitSignalTags(show?.networks);
  const genreMatches = matchSignals(genres, profile?.topGenres || []);
  const networkMatches = matchSignals(networks, profile?.topNetworks || []);
  const tasteScore = genreMatches.reduce((sum, item) => sum + item.normalized * 5, 0)
    + networkMatches.reduce((sum, item) => sum + item.normalized * 3, 0);
  const score = tasteScore + genericQuality(show) + activeStatusBoost(show?.status);

  let reason = "熱門與評分較高";
  if (genreMatches.length > 0 && networkMatches.length > 0) {
    reason = `符合偏好：${genreMatches[0].value} · ${networkMatches[0].value}`;
  } else if (genreMatches.length > 0) {
    reason = `同類型偏好：${genreMatches[0].value}`;
  } else if (networkMatches.length > 0) {
    reason = `同平台偏好：${networkMatches[0].value}`;
  }

  return { score, reason, genreMatches, networkMatches };
}

export function rankPersonalCandidates(candidates, signalShows, trackedIds, viewingStates = {}, limit = 18) {
  const tracked = new Set((Array.isArray(trackedIds) ? trackedIds : [])
    .map(normalizeId)
    .filter(Boolean));
  const profile = buildPersonalProfile(signalShows, trackedIds, viewingStates);
  const seen = new Set();
  const ranked = [];

  for (const show of Array.isArray(candidates) ? candidates : []) {
    const id = normalizeId(show?.id);
    if (!id || tracked.has(id) || seen.has(id)) continue;
    seen.add(id);
    const scored = scorePersonalCandidate(show, profile);
    ranked.push({
      ...show,
      personal_score: scored.score,
      personal_reason: profile.personalized ? scored.reason : "熱門與評分較高",
      personal_matched: scored.genreMatches.length > 0 || scored.networkMatches.length > 0
    });
  }

  ranked.sort((a, b) => {
    if (profile.personalized && Boolean(a.personal_matched) !== Boolean(b.personal_matched)) {
      return a.personal_matched ? -1 : 1;
    }
    return Number(b.personal_score || 0) - Number(a.personal_score || 0)
      || Number(b.popularity || 0) - Number(a.popularity || 0)
      || Number(a.id || 0) - Number(b.id || 0);
  });

  const boundedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Math.trunc(Number(limit)), 1), 40)
    : 18;
  return { profile, items: ranked.slice(0, boundedLimit) };
}
