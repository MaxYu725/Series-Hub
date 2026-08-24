import { normalizeTitleRegion, withResolvedChineseTitle } from "./title-aliases.js";

const TITLE_ACTIONS = new Set(["set-preferred", "add-alias", "remove-alias"]);
const TITLE_CONFIDENCE = new Set(["official", "high", "normal"]);

function invalid(message) {
  return { status: 400, body: { ok: false, error: "invalid_title_override", message } };
}

export function normalizeTitleOverride(payload) {
  const showId = Number(payload?.showId);
  const rawRegion = String(payload?.region || "").trim().toUpperCase();
  const region = normalizeTitleRegion(rawRegion, "");
  const action = String(payload?.action || "").trim();
  const title = String(payload?.title || "").trim();
  const confidence = String(payload?.confidence || "high").trim();

  if (!Number.isSafeInteger(showId) || showId <= 0) return invalid("showId must be a positive integer");
  if (!region) return invalid("region must be HK, TW or CN");
  if (!TITLE_ACTIONS.has(action)) return invalid("action must be set-preferred, add-alias or remove-alias");
  if (!TITLE_CONFIDENCE.has(confidence)) return invalid("confidence must be official, high or normal");
  if (!title || title.length > 160 || /[\u0000-\u001f]/.test(title)) {
    return invalid("title must contain 1-160 printable characters");
  }

  return { status: 200, value: { showId, region, action, title, confidence } };
}

function manualScope(db, preferred) {
  return db.prepare(
    `UPDATE title_aliases
     SET is_preferred = ?1, updated_at = CURRENT_TIMESTAMP
     WHERE show_id = ?2
       AND season_id IS NULL
       AND locale = 'zh'
       AND region = ?3
       AND source_key = 'manual'`
  ).bind(preferred, preferred === 0 ? null : null, "");
}

function insertManualAlias(db, input, preferred) {
  return db.prepare(
    `INSERT INTO title_aliases (
      show_id, season_id, locale, region, title, source_key,
      is_preferred, confidence, created_at, updated_at
    ) VALUES (?1, NULL, 'zh', ?2, ?3, 'manual', ?4, ?5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(input.showId, input.region, input.title, preferred, input.confidence);
}

function deleteExactManualAlias(db, input) {
  return db.prepare(
    `DELETE FROM title_aliases
     WHERE show_id = ?1
       AND season_id IS NULL
       AND locale = 'zh'
       AND region = ?2
       AND source_key = 'manual'
       AND title = ?3`
  ).bind(input.showId, input.region, input.title);
}

function clearManualPreferred(db, input) {
  return db.prepare(
    `UPDATE title_aliases
     SET is_preferred = 0, updated_at = CURRENT_TIMESTAMP
     WHERE show_id = ?1
       AND season_id IS NULL
       AND locale = 'zh'
       AND region = ?2
       AND source_key = 'manual'
       AND is_preferred <> 0`
  ).bind(input.showId, input.region);
}

export async function applyTitleOverride(request, env) {
  if (!env.DB) return { status: 503, body: { ok: false, error: "database_not_configured" } };

  let payload;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }

  const normalized = normalizeTitleOverride(payload);
  if (!normalized.value) return normalized;
  const input = normalized.value;

  const show = await env.DB.prepare(
    `SELECT id, english_title, original_title FROM shows WHERE id = ?1 LIMIT 1`
  ).bind(input.showId).first();
  if (!show) return { status: 404, body: { ok: false, error: "show_not_found", showId: input.showId } };

  const statements = [];
  if (input.action === "set-preferred") {
    statements.push(clearManualPreferred(env.DB, input));
    statements.push(deleteExactManualAlias(env.DB, input));
    statements.push(insertManualAlias(env.DB, input, 1));
  } else if (input.action === "add-alias") {
    statements.push(deleteExactManualAlias(env.DB, input));
    statements.push(insertManualAlias(env.DB, input, 0));
  } else {
    statements.push(deleteExactManualAlias(env.DB, input));
  }

  const batch = await env.DB.batch(statements);
  const preferredRow = await env.DB.prepare(
    `SELECT * FROM preferred_show_titles WHERE show_id = ?1 LIMIT 1`
  ).bind(input.showId).first();
  const resolved = withResolvedChineseTitle(preferredRow || {}, input.region);

  return {
    status: 200,
    body: {
      ok: true,
      action: input.action,
      show,
      changedTitle: input.title,
      region: input.region,
      confidence: input.confidence,
      preferred: {
        title: resolved.display_title_zh,
        requestedRegion: resolved.display_title_zh_requested_region,
        region: resolved.display_title_zh_region,
        source: resolved.display_title_zh_source,
        confidence: resolved.display_title_zh_confidence,
        fallback: resolved.display_title_zh_fallback
      },
      batch: batch.map((result) => ({ success: result.success, changes: result.meta?.changes ?? null }))
    }
  };
}
