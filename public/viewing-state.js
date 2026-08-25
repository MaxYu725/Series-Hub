export const VIEWING_STATE_STORAGE_KEY = "series-hub-viewing-states-v1";

export const VIEWING_STATES = Object.freeze({
  watching: "追看中",
  waiting: "等下一季",
  completed: "已看完",
  paused: "暫停"
});

export function normalizeViewingStates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const normalized = {};

  for (const [rawId, rawState] of Object.entries(value)) {
    const id = Number(rawId);
    const state = String(rawState || "");
    if (!Number.isSafeInteger(id) || id <= 0 || !Object.hasOwn(VIEWING_STATES, state)) continue;
    normalized[String(id)] = state;
  }

  return normalized;
}

export function loadViewingStates(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(VIEWING_STATE_STORAGE_KEY);
    if (!raw) return {};
    return normalizeViewingStates(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveViewingStates(states, storage = globalThis.localStorage) {
  const normalized = normalizeViewingStates(states);
  try {
    storage?.setItem?.(VIEWING_STATE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Viewing state remains usable in-memory if storage is unavailable.
  }
  return normalized;
}

export function setViewingState(states, showId, state) {
  const normalized = normalizeViewingStates(states);
  const id = Number(showId);
  if (!Number.isSafeInteger(id) || id <= 0) return normalized;

  const next = { ...normalized };
  if (!state) {
    delete next[String(id)];
    return next;
  }
  if (!Object.hasOwn(VIEWING_STATES, state)) return normalized;
  next[String(id)] = state;
  return next;
}

export function getViewingState(states, showId) {
  const id = Number(showId);
  if (!Number.isSafeInteger(id) || id <= 0) return "";
  return normalizeViewingStates(states)[String(id)] || "";
}
