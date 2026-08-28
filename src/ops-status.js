const SYNC_WARN_MINUTES = 8 * 60;
const SYNC_ERROR_MINUTES = 18 * 60;
const SUCCESS_STATUSES = new Set(["success", "success_with_warnings"]);

function parseUtcTimestamp(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text.replace(" ", "T")}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifySyncSource(row, now = Date.now()) {
  if (!row) {
    return {
      state: "unknown",
      status: null,
      currentStatus: null,
      currentStartedAt: null,
      inProgress: false,
      finishedAt: null,
      ageMinutes: null,
      recordsSeen: 0,
      recordsChanged: 0
    };
  }

  const currentStatus = row.current_status || row.status || null;
  const currentStartedAt = row.current_started_at || null;
  const inProgress = currentStatus === "running";
  const finishedAt = row.finished_at || null;
  const finishedMs = parseUtcTimestamp(finishedAt);
  const ageMinutes = finishedMs == null ? null : Math.max(0, Math.round((now - finishedMs) / 60000));
  const status = row.status || null;
  let state = "ok";

  if (!finishedAt && inProgress) state = "warn";
  else if (!SUCCESS_STATUSES.has(status)) state = "error";
  else if (ageMinutes == null || ageMinutes > SYNC_ERROR_MINUTES) state = "error";
  else if (status === "success_with_warnings" || ageMinutes > SYNC_WARN_MINUTES) state = "warn";

  return {
    state,
    status,
    currentStatus,
    currentStartedAt,
    inProgress,
    finishedAt,
    ageMinutes,
    recordsSeen: Number(row.records_seen || 0),
    recordsChanged: Number(row.records_changed || 0)
  };
}

function enabled(value) {
  return String(value || "").toLowerCase() === "true";
}

export function classifyPushState(metrics = {}, env = {}) {
  const subscriptionsEnabled = enabled(env.PUSH_SUBSCRIPTIONS_ENABLED);
  const remindersEnabled = enabled(env.EPISODE_REMINDERS_ENABLED);
  const publicKeyConfigured = Number(metrics.public_key_configured || 0) > 0;
  const privateKeyConfigured = Boolean(env.VAPID_PRIVATE_KEY);
  const activeSubscriptions = Number(metrics.active_subscriptions || 0);
  const activeShowMappings = Number(metrics.active_show_mappings || 0);
  const sent24h = Number(metrics.sent_24h || 0);
  const failed24h = Number(metrics.failed_24h || 0);

  let state = "ok";
  if (!subscriptionsEnabled || !remindersEnabled) state = "warn";
  else if (!publicKeyConfigured || !privateKeyConfigured) state = "error";
  else if (activeSubscriptions === 0) state = "idle";
  else if (activeShowMappings === 0 || failed24h > 0) state = "warn";

  return {
    state,
    subscriptionsEnabled,
    remindersEnabled,
    vapidConfigured: publicKeyConfigured && privateKeyConfigured,
    activeSubscriptions,
    activeShowMappings,
    sent24h,
    failed24h,
    latestDeliveryAt: metrics.latest_delivery_at || null,
    latestDeliveryStatus: metrics.latest_delivery_status || null
  };
}

function overallState(sources) {
  if (sources.some((source) => source.state === "error")) return "error";
  if (sources.some((source) => source.state === "warn" || source.state === "unknown")) return "warn";
  return "ok";
}

export async function buildOperationalStatus(env, now = Date.now()) {
  if (!env.DB) {
    const tmdb = classifySyncSource(null, now);
    const tvmaze = classifySyncSource(null, now);
    const push = classifyPushState({}, env);
    return {
      ok: false,
      data: { tmdb, tvmaze, push, overall: "error" },
      meta: { generatedAt: new Date(now).toISOString(), aggregateOnly: true }
    };
  }

  const [syncRows, pushMetrics] = await Promise.all([
    env.DB.prepare(
      `WITH latest_any AS (
         SELECT source_id, MAX(id) AS run_id
         FROM sync_runs
         GROUP BY source_id
       ), latest_finished AS (
         SELECT source_id, MAX(id) AS run_id
         FROM sync_runs
         WHERE finished_at IS NOT NULL
         GROUP BY source_id
       )
       SELECT
         s.source_key,
         current_run.status AS current_status,
         current_run.started_at AS current_started_at,
         finished_run.status,
         finished_run.finished_at,
         finished_run.records_seen,
         finished_run.records_changed
       FROM sources s
       LEFT JOIN latest_any la ON la.source_id = s.id
       LEFT JOIN sync_runs current_run ON current_run.id = la.run_id
       LEFT JOIN latest_finished lf ON lf.source_id = s.id
       LEFT JOIN sync_runs finished_run ON finished_run.id = lf.run_id
       WHERE s.source_key IN ('tmdb', 'tvmaze')`
    ).all(),
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM push_subscriptions WHERE disabled_at IS NULL) AS active_subscriptions,
         (SELECT COUNT(*) FROM push_subscription_shows pss JOIN push_subscriptions ps ON ps.id = pss.subscription_id WHERE ps.disabled_at IS NULL) AS active_show_mappings,
         (SELECT COUNT(*) FROM push_config WHERE config_key = 'vapid_public_key' AND LENGTH(config_value) > 0) AS public_key_configured,
         (SELECT COUNT(*) FROM notification_deliveries WHERE status = 'sent' AND julianday(COALESCE(sent_at, updated_at, created_at)) >= julianday('now', '-24 hours')) AS sent_24h,
         (SELECT COUNT(*) FROM notification_deliveries WHERE status IN ('failed_transient', 'failed_terminal') AND julianday(updated_at) >= julianday('now', '-24 hours')) AS failed_24h,
         (SELECT COALESCE(sent_at, updated_at, created_at) FROM notification_deliveries ORDER BY id DESC LIMIT 1) AS latest_delivery_at,
         (SELECT status FROM notification_deliveries ORDER BY id DESC LIMIT 1) AS latest_delivery_status`
    ).first()
  ]);

  const bySource = new Map((syncRows.results || []).map((row) => [row.source_key, row]));
  const tmdb = classifySyncSource(bySource.get("tmdb") || null, now);
  const tvmaze = classifySyncSource(bySource.get("tvmaze") || null, now);
  const push = classifyPushState(pushMetrics || {}, env);

  return {
    ok: true,
    data: {
      tmdb,
      tvmaze,
      push,
      overall: overallState([tmdb, tvmaze, push])
    },
    meta: {
      generatedAt: new Date(now).toISOString(),
      aggregateOnly: true,
      syncFreshness: {
        warnAfterMinutes: SYNC_WARN_MINUTES,
        errorAfterMinutes: SYNC_ERROR_MINUTES
      }
    }
  };
}
