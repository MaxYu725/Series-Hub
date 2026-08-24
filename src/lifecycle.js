export const LIFECYCLE_EVENT_TYPES = new Set([
  "renewed",
  "ordered",
  "cancelled",
  "final_season",
  "ended",
  "pre_production",
  "filming",
  "wrapped",
  "post_production",
  "production_paused",
  "premiere_dated",
  "delayed"
]);

export const LIFECYCLE_CONFIDENCE = new Set(["official", "high", "normal", "unverified"]);

const DECISION_EVENTS = new Set(["renewed", "ordered", "cancelled", "final_season", "ended"]);
const PRODUCTION_EVENTS = new Set(["pre_production", "filming", "wrapped", "post_production", "production_paused"]);
const SCHEDULE_EVENTS = new Set(["premiere_dated", "delayed"]);

const EVENT_PRIORITY = Object.freeze({
  ended: 50,
  cancelled: 45,
  final_season: 40,
  renewed: 30,
  ordered: 20,
  production_paused: 50,
  post_production: 40,
  wrapped: 35,
  filming: 30,
  pre_production: 20,
  delayed: 40,
  premiere_dated: 30
});

export function lifecycleDimension(eventType) {
  if (DECISION_EVENTS.has(eventType)) return "decision";
  if (PRODUCTION_EVENTS.has(eventType)) return "production";
  if (SCHEDULE_EVENTS.has(eventType)) return "schedule";
  return "other";
}

function eventTime(event) {
  const value = event?.source_published_at || event?.created_at || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventPriority(event) {
  return EVENT_PRIORITY[event?.event_type] || 0;
}

function newestFirst(left, right) {
  const delta = eventTime(right) - eventTime(left);
  if (delta !== 0) return delta;
  const priorityDelta = eventPriority(right) - eventPriority(left);
  if (priorityDelta !== 0) return priorityDelta;
  return Number(right?.id || 0) - Number(left?.id || 0);
}

function summarizeBucket(events) {
  const summary = { decision: null, production: null, schedule: null, latest: null };
  for (const event of [...events].sort(newestFirst)) {
    if (!summary.latest) summary.latest = event;
    const dimension = lifecycleDimension(event.event_type);
    if (dimension !== "other" && !summary[dimension]) summary[dimension] = event;
  }
  return summary;
}

export function summarizeLifecycleEvents(events = []) {
  const active = events.filter((event) => Number(event?.is_retracted || 0) === 0);
  const overall = summarizeBucket(active);
  const bySeason = {};

  for (const event of active) {
    const key = event.season_number == null ? "series" : String(event.season_number);
    if (!bySeason[key]) bySeason[key] = [];
    bySeason[key].push(event);
  }

  return {
    ...overall,
    bySeason: Object.fromEntries(Object.entries(bySeason).map(([key, rows]) => [key, summarizeBucket(rows)])),
    eventCount: active.length
  };
}

function cleanText(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (text.length > maxLength || /[\u0000-\u001f]/.test(text)) return null;
  return text;
}

function normalizePublishedAt(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z)?$/.test(text)) return null;
  if (!Number.isFinite(Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text))) return null;
  return text;
}

function invalid(message) {
  return { status: 400, body: { ok: false, error: "invalid_lifecycle_evidence", message } };
}

export function normalizeLifecycleEvidence(payload) {
  const action = String(payload?.action || "upsert").trim();
  if (!new Set(["upsert", "retract"]).has(action)) return invalid("action must be upsert or retract");

  if (action === "retract") {
    const eventId = Number(payload?.eventId);
    const retractionNote = cleanText(payload?.retractionNote, 300);
    if (!Number.isSafeInteger(eventId) || eventId <= 0) return invalid("eventId must be a positive integer");
    if (!retractionNote) return invalid("retractionNote is required and must be at most 300 printable characters");
    return { status: 200, value: { action, eventId, retractionNote } };
  }

  const showId = Number(payload?.showId);
  const rawSeason = payload?.seasonNumber;
  const seasonNumber = rawSeason === null || rawSeason === undefined || rawSeason === "" ? null : Number(rawSeason);
  const eventType = String(payload?.eventType || "").trim();
  const sourceKey = String(payload?.sourceKey || "").trim();
  const sourceUrl = String(payload?.sourceUrl || "").trim();
  const sourceTitle = cleanText(payload?.sourceTitle, 240);
  const sourcePublishedAt = normalizePublishedAt(payload?.sourcePublishedAt);
  const confidence = String(payload?.confidence || "official").trim();
  const evidenceNote = payload?.evidenceNote == null || payload?.evidenceNote === "" ? null : cleanText(payload?.evidenceNote, 500);

  if (!Number.isSafeInteger(showId) || showId <= 0) return invalid("showId must be a positive integer");
  if (seasonNumber !== null && (!Number.isSafeInteger(seasonNumber) || seasonNumber < 0)) return invalid("seasonNumber must be null or a non-negative integer");
  if (!LIFECYCLE_EVENT_TYPES.has(eventType)) return invalid("unsupported eventType");
  if (!/^[a-z0-9_]{2,64}$/.test(sourceKey)) return invalid("sourceKey is invalid");
  if (!LIFECYCLE_CONFIDENCE.has(confidence)) return invalid("confidence must be official, high, normal or unverified");
  if (!sourceTitle) return invalid("sourceTitle is required and must be at most 240 printable characters");
  if (!sourcePublishedAt) return invalid("sourcePublishedAt must be YYYY-MM-DD or an ISO UTC timestamp");
  if (payload?.evidenceNote && !evidenceNote) return invalid("evidenceNote must be at most 500 printable characters");

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return invalid("sourceUrl must be a valid URL");
  }
  if (parsedUrl.protocol !== "https:") return invalid("sourceUrl must use https");

  return {
    status: 200,
    value: {
      action,
      showId,
      seasonNumber,
      eventType,
      sourceKey,
      sourceUrl: parsedUrl.toString(),
      sourceTitle,
      sourcePublishedAt,
      confidence,
      evidenceNote
    }
  };
}

export function sourceUrlMatchesBase(sourceUrl, sourceBaseUrl) {
  try {
    const url = new URL(sourceUrl);
    const base = new URL(sourceBaseUrl);
    return url.protocol === "https:" && url.hostname === base.hostname && url.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
}

export async function lifecycleEvidenceKey(input) {
  const material = [
    input.showId,
    input.seasonNumber ?? "series",
    input.eventType,
    input.sourceKey,
    input.sourceUrl,
    input.sourcePublishedAt
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
