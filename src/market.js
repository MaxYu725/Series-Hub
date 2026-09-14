export const CATALOG_MARKETS = Object.freeze(["all", "US", "KR"]);

export function normalizeCatalogMarket(value) {
  const raw = String(value || "all").trim();
  if (!raw || raw.toLowerCase() === "all") return "all";
  const upper = raw.toUpperCase();
  return upper === "US" || upper === "KR" ? upper : "all";
}

export function catalogMarketPattern(value) {
  const market = normalizeCatalogMarket(value);
  return market === "all" ? null : `%,${market},%`;
}
