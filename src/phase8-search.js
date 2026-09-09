function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ")
    .trim();
}

function aliasValues(show) {
  const values = [
    show?.title_zh_hk,
    show?.title_zh_tw,
    show?.title_zh_cn
  ];
  if (show?.chinese_aliases) values.push(...String(show.chinese_aliases).split(" | "));
  return values.map(normalizeSearchText).filter(Boolean);
}

function primaryValues(show) {
  return [
    show?.english_title,
    show?.original_title,
    show?.display_title_zh
  ].map(normalizeSearchText).filter(Boolean);
}

function matchLevel(values, query) {
  if (values.some((value) => value === query)) return 0;
  if (values.some((value) => value.startsWith(query))) return 1;
  if (values.some((value) => value.includes(query))) return 2;
  return 3;
}

export function searchRelevance(show, rawQuery) {
  const query = normalizeSearchText(rawQuery);
  if (!query) return { score: 99, kind: "none", label: null };

  const primaryLevel = matchLevel(primaryValues(show), query);
  if (primaryLevel === 0) return { score: 0, kind: "title_exact", label: "劇名完全符合" };

  const aliasLevel = matchLevel(aliasValues(show), query);
  if (aliasLevel === 0) return { score: 1, kind: "alias_exact", label: "中文譯名／別名完全符合" };
  if (primaryLevel === 1) return { score: 2, kind: "title_prefix", label: "劇名開頭符合" };
  if (aliasLevel === 1) return { score: 3, kind: "alias_prefix", label: "中文譯名／別名開頭符合" };
  if (primaryLevel === 2) return { score: 4, kind: "title_contains", label: "劇名包含搜尋字" };
  if (aliasLevel === 2) return { score: 5, kind: "alias_contains", label: "中文譯名／別名包含搜尋字" };

  const episode = normalizeSearchText(show?.search_match_episode);
  if (episode === query) return { score: 6, kind: "episode_exact", label: "單集名稱完全符合" };
  if (episode.startsWith(query)) return { score: 7, kind: "episode_prefix", label: "單集名稱開頭符合" };
  if (episode.includes(query)) return { score: 8, kind: "episode_contains", label: "單集名稱包含搜尋字" };

  return { score: 9, kind: "other", label: null };
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function rankSearchResults(shows, query) {
  return (Array.isArray(shows) ? shows : [])
    .map((show, index) => {
      const relevance = searchRelevance(show, query);
      return { show, index, relevance };
    })
    .sort((left, right) => {
      if (left.relevance.score !== right.relevance.score) return left.relevance.score - right.relevance.score;
      const popularityDelta = numeric(right.show?.popularity) - numeric(left.show?.popularity);
      if (popularityDelta) return popularityDelta;
      const votesDelta = numeric(right.show?.vote_count) - numeric(left.show?.vote_count);
      if (votesDelta) return votesDelta;
      return left.index - right.index;
    })
    .map(({ show, relevance }) => ({
      ...show,
      search_match_type: relevance.kind,
      search_match_label: relevance.label
    }));
}

export function improveSearchPayload(payload, query) {
  const ranked = rankSearchResults(payload?.data, query);
  return {
    ...payload,
    data: ranked,
    meta: {
      ...(payload?.meta || {}),
      count: ranked.length,
      phase: "8c-search-quality",
      relevanceRanking: "exact-primary > exact-alias > prefix-primary > prefix-alias > contains-primary > contains-alias > episode",
      externalRequestsAdded: 0
    }
  };
}
