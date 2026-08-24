import {
  lifecycleEvidenceKey,
  normalizeLifecycleEvidence,
  sourceUrlMatchesBase,
  summarizeLifecycleEvents
} from "./lifecycle.js";

export async function applyLifecycleEvidence(request, env) {
  if (!env.DB) return { status: 503, body: { ok: false, error: "database_not_configured" } };

  let payload;
  try {
    payload = await request.json();
  } catch {
    return { status: 400, body: { ok: false, error: "invalid_json" } };
  }

  const normalized = normalizeLifecycleEvidence(payload);
  if (!normalized.value) return normalized;
  const input = normalized.value;

  if (input.action === "retract") {
    const existing = await env.DB.prepare(
      `SELECT id, show_id, event_type, source_url, is_retracted
       FROM lifecycle_events
       WHERE id = ?1
       LIMIT 1`
    ).bind(input.eventId).first();
    if (!existing) return { status: 404, body: { ok: false, error: "lifecycle_event_not_found", eventId: input.eventId } };

    await env.DB.prepare(
      `UPDATE lifecycle_events
       SET is_retracted = 1,
           retracted_at = CURRENT_TIMESTAMP,
           retraction_note = ?2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    ).bind(input.eventId, input.retractionNote).run();

    return {
      status: 200,
      body: { ok: true, action: "retract", event: { ...existing, is_retracted: 1 }, retractionNote: input.retractionNote }
    };
  }

  const [show, source] = await Promise.all([
    env.DB.prepare(
      `SELECT id, english_title, original_title FROM shows WHERE id = ?1 LIMIT 1`
    ).bind(input.showId).first(),
    env.DB.prepare(
      `SELECT id, source_key, source_type, display_name, base_url, trust_level, enabled
       FROM sources
       WHERE source_key = ?1
       LIMIT 1`
    ).bind(input.sourceKey).first()
  ]);

  if (!show) return { status: 404, body: { ok: false, error: "show_not_found", showId: input.showId } };
  if (!source || Number(source.enabled) !== 1) {
    return { status: 400, body: { ok: false, error: "source_not_enabled", sourceKey: input.sourceKey } };
  }
  if (!source.base_url || !sourceUrlMatchesBase(input.sourceUrl, source.base_url)) {
    return { status: 400, body: { ok: false, error: "source_url_mismatch", sourceKey: input.sourceKey } };
  }
  if (input.confidence === "official" && source.trust_level !== "official") {
    return { status: 400, body: { ok: false, error: "official_confidence_requires_official_source" } };
  }

  let seasonId = null;
  if (input.seasonNumber !== null) {
    const season = await env.DB.prepare(
      `SELECT id FROM seasons WHERE show_id = ?1 AND season_number = ?2 LIMIT 1`
    ).bind(input.showId, input.seasonNumber).first();
    seasonId = season?.id ?? null;
  }

  const evidenceKey = await lifecycleEvidenceKey(input);
  await env.DB.prepare(
    `INSERT INTO lifecycle_events (
      evidence_key,
      show_id,
      season_id,
      season_number,
      event_type,
      source_id,
      source_url,
      source_title,
      source_published_at,
      confidence,
      evidence_note,
      is_retracted,
      retracted_at,
      retraction_note,
      created_at,
      updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(evidence_key) DO UPDATE SET
      season_id = excluded.season_id,
      source_title = excluded.source_title,
      confidence = excluded.confidence,
      evidence_note = excluded.evidence_note,
      is_retracted = 0,
      retracted_at = NULL,
      retraction_note = NULL,
      updated_at = CURRENT_TIMESTAMP`
  ).bind(
    evidenceKey,
    input.showId,
    seasonId,
    input.seasonNumber,
    input.eventType,
    source.id,
    input.sourceUrl,
    input.sourceTitle,
    input.sourcePublishedAt,
    input.confidence,
    input.evidenceNote
  ).run();

  const event = await env.DB.prepare(
    `SELECT * FROM active_lifecycle_events WHERE evidence_key = ?1 LIMIT 1`
  ).bind(evidenceKey).first();
  const allEvents = await env.DB.prepare(
    `SELECT * FROM active_lifecycle_events WHERE show_id = ?1 ORDER BY source_published_at DESC, id DESC`
  ).bind(input.showId).all();

  return {
    status: 200,
    body: {
      ok: true,
      action: "upsert",
      show,
      source: {
        key: source.source_key,
        name: source.display_name,
        trustLevel: source.trust_level
      },
      event,
      summary: summarizeLifecycleEvents(allEvents.results || [])
    }
  };
}