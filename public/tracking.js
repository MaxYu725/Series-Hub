export const TRACKING_STORAGE_KEY = "series-hub-tracked-shows-v1";

export function normalizeTrackedShowIds(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const ids = [];

  for (const item of source) {
    const id = Number(item);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function loadTrackedShowIds(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(TRACKING_STORAGE_KEY);
    if (!raw) return [];
    return normalizeTrackedShowIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveTrackedShowIds(ids, storage = globalThis.localStorage) {
  const normalized = normalizeTrackedShowIds(ids);
  try {
    storage?.setItem?.(TRACKING_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Tracking remains usable in-memory if storage is unavailable.
  }
  try {
    if (typeof globalThis.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
      globalThis.dispatchEvent(new CustomEvent("series-hub-tracking-changed", { detail: { showIds: normalized } }));
    }
  } catch {
    // Notification syncing is optional and must never break local tracking.
  }
  return normalized;
}

export function toggleTrackedShowId(ids, showId) {
  const normalized = normalizeTrackedShowIds(ids);
  const id = Number(showId);
  if (!Number.isSafeInteger(id) || id <= 0) return normalized;

  return normalized.includes(id)
    ? normalized.filter((item) => item !== id)
    : [...normalized, id];
}

export function isTrackedShow(ids, showId) {
  const id = Number(showId);
  return Number.isSafeInteger(id) && normalizeTrackedShowIds(ids).includes(id);
}
