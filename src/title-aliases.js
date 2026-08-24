export const TITLE_REGIONS = Object.freeze(["HK", "TW", "CN"]);

const REGION_FALLBACKS = Object.freeze({
  HK: Object.freeze(["HK", "TW", "CN"]),
  TW: Object.freeze(["TW", "HK", "CN"]),
  CN: Object.freeze(["CN", "TW", "HK"])
});

const CONFIDENCE_RANK = Object.freeze({
  official: 0,
  high: 1,
  normal: 2,
  unverified: 3
});

export function normalizeTitleRegion(value, fallback = "HK") {
  const normalized = String(value || "").trim().toUpperCase();
  return TITLE_REGIONS.includes(normalized) ? normalized : fallback;
}

export function titleRegionFallbacks(value) {
  return REGION_FALLBACKS[normalizeTitleRegion(value)];
}

export function aliasPriority(alias) {
  const sourceKey = String(alias?.source_key || "");
  const preferred = Number(alias?.is_preferred) === 1;
  const preferenceTier = sourceKey === "manual" && preferred
    ? 0
    : preferred
      ? 10
      : sourceKey === "manual"
        ? 20
        : 30;
  const confidence = CONFIDENCE_RANK[String(alias?.confidence || "normal")] ?? 4;
  return preferenceTier + confidence;
}

export function resolveChineseTitle(record, requestedRegion = "HK") {
  const normalizedRegion = normalizeTitleRegion(requestedRegion);

  for (const region of REGION_FALLBACKS[normalizedRegion]) {
    const suffix = region.toLowerCase();
    const title = record?.[`title_zh_${suffix}`];
    if (!title) continue;

    return {
      title,
      requestedRegion: normalizedRegion,
      region,
      source: record?.[`title_zh_${suffix}_source`] || null,
      confidence: record?.[`title_zh_${suffix}_confidence`] || null,
      fallback: region !== normalizedRegion
    };
  }

  return {
    title: null,
    requestedRegion: normalizedRegion,
    region: null,
    source: null,
    confidence: null,
    fallback: false
  };
}

export function withResolvedChineseTitle(record, requestedRegion = "HK") {
  const resolved = resolveChineseTitle(record, requestedRegion);
  return {
    ...record,
    display_title_zh: resolved.title,
    display_title_zh_requested_region: resolved.requestedRegion,
    display_title_zh_region: resolved.region,
    display_title_zh_source: resolved.source,
    display_title_zh_confidence: resolved.confidence,
    display_title_zh_fallback: resolved.fallback
  };
}
