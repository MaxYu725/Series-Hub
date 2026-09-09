export const LOCAL_CATALOG_SIGNALS_KEY = "series-hub-local-catalog-signals-v1";
export const LOCAL_CATALOG_SIGNAL_LIMIT = 300;

function normalizeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function cleanSignalText(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 240) : "";
}

export function normalizeCatalogSignal(show) {
  const id = normalizeId(show?.id);
  if (!id) return null;
  const networks = cleanSignalText(show?.networks);
  const genres = cleanSignalText(show?.genres);
  if (!networks && !genres) return null;
  return { id, networks, genres };
}

export function normalizeCatalogSignals(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = [];
  for (const [rawId, rawShow] of Object.entries(source)) {
    const signal = normalizeCatalogSignal({ ...rawShow, id: rawId });
    if (signal) entries.push([String(signal.id), signal]);
  }
  return Object.fromEntries(entries.slice(-LOCAL_CATALOG_SIGNAL_LIMIT));
}

export function loadCatalogSignals(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(LOCAL_CATALOG_SIGNALS_KEY);
    if (!raw) return {};
    return normalizeCatalogSignals(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function rememberCatalogSignals(shows, storage = globalThis.localStorage) {
  const current = loadCatalogSignals(storage);
  const ordered = new Map(Object.entries(current));

  for (const show of Array.isArray(shows) ? shows : []) {
    const signal = normalizeCatalogSignal(show);
    if (!signal) continue;
    const key = String(signal.id);
    ordered.delete(key);
    ordered.set(key, signal);
  }

  while (ordered.size > LOCAL_CATALOG_SIGNAL_LIMIT) {
    ordered.delete(ordered.keys().next().value);
  }

  const next = Object.fromEntries(ordered);
  try {
    storage?.setItem?.(LOCAL_CATALOG_SIGNALS_KEY, JSON.stringify(next));
  } catch {
    // Recommendation signals remain optional and browser-local.
  }
  return next;
}

export function catalogSignalValues(value) {
  return Object.values(normalizeCatalogSignals(value));
}
