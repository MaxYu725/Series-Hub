import webpush from "web-push";
import { withResolvedChineseTitle } from "./title-aliases.js";

export const EPISODE_REMINDER_CRON = "7 * * * *";
export const EPISODE_REMINDER_KIND = "episode_24h";
export const MAX_DELIVERIES_PER_RUN = 30;
const MIN_AHEAD_MS = 23 * 60 * 60 * 1000;
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 90;

export function episodeRemindersEnabled(env) {
  return String(env?.EPISODE_REMINDERS_ENABLED || "").toLowerCase() === "true";
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function reminderWindow(now = new Date()) {
  const base = asDate(now) || new Date();
  return {
    after: new Date(base.getTime() + MIN_AHEAD_MS),
    through: new Date(base.getTime() + MAX_AHEAD_MS)
  };
}

export function episodeEntityKey(episodeId) {
  const id = Number(episodeId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("invalid_episode_id");
  return `episode:${id}`;
}

export function classifyPushFailure(error) {
  const statusCode = Number(error?.statusCode || 0);
  if (statusCode === 404 || statusCode === 410) {
    return { status: "permanent_subscription", errorCode: `http_${statusCode}`, statusCode };
  }
  if (statusCode === 408 || statusCode === 425 || statusCode === 429 || statusCode >= 500) {
    return { status: "failed_transient", errorCode: statusCode ? `http_${statusCode}` : "network", statusCode };
  }
  if (statusCode >= 400) {
    return { status: "failed_terminal", errorCode: `http_${statusCode}`, statusCode };
  }
  return { status: "failed_transient", errorCode: "network", statusCode: null };
}

function formatLocalTime(timestamp, timezone) {
  const date = asDate(timestamp);
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat("zh-HK", {
      timeZone: timezone || "UTC",
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("zh-HK", {
      timeZone: "UTC",
      weekday: "short",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }
}

function episodeCode(row) {
  const season = Number(row.season_number);
  const episode = Number(row.episode_number);
  if (!Number.isSafeInteger(season) || season <= 0 || !Number.isSafeInteger(episode) || episode <= 0) return null;
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function notificationPayload(row) {
  const resolved = withResolvedChineseTitle(row, row.title_region || "HK");
  const showTitle = resolved.display_title_zh || row.english_title || row.original_title || "Series Hub";
  const code = episodeCode(row);
  const localTime = formatLocalTime(row.air_timestamp, row.timezone);
  const episodeName = row.episode_name ? String(row.episode_name).trim() : "";
  const detail = [code, episodeName].filter(Boolean).join(" · ");
  const timing = localTime ? `${localTime} 播映` : "約 24 小時後播映";

  return {
    title: `${showTitle} · 明日提醒`,
    body: [detail, timing].filter(Boolean).join("\n"),
    tag: `${EPISODE_REMINDER_KIND}-${row.episode_id}`,
    data: {
      url: "/?view=my-shows",
      kind: EPISODE_REMINDER_KIND,
      showId: Number(row.show_id),
      episodeId: Number(row.episode_id)
    }
  };
}

async function vapidPublicKey(env) {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT config_value FROM push_config WHERE config_key = 'vapid_public_key' LIMIT 1"
  ).first();
  return row?.config_value || null;
}

async function purgeStaleSubscriptions(env, now) {
  const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const result = await env.DB.prepare(
    "DELETE FROM push_subscriptions WHERE julianday(last_seen_at) < julianday(?1)"
  ).bind(cutoff).run();
  return Number(result?.meta?.changes || 0);
}

async function candidateRows(env, now, limit = MAX_DELIVERIES_PER_RUN) {
  const window = reminderWindow(now);
  const result = await env.DB.prepare(
    `SELECT
      ps.id AS subscription_id,
      ps.endpoint,
      ps.p256dh,
      ps.auth,
      ps.timezone,
      ps.title_region,
      e.id AS episode_id,
      e.episode_number,
      e.name AS episode_name,
      e.air_timestamp,
      se.season_number,
      s.id AS show_id,
      s.english_title,
      s.original_title,
      pt.title_zh_hk,
      pt.title_zh_hk_source,
      pt.title_zh_hk_confidence,
      pt.title_zh_tw,
      pt.title_zh_tw_source,
      pt.title_zh_tw_confidence,
      pt.title_zh_cn,
      pt.title_zh_cn_source,
      pt.title_zh_cn_confidence,
      nd.status AS delivery_status
    FROM push_subscriptions ps
    JOIN push_subscription_shows pss ON pss.subscription_id = ps.id
    JOIN shows s ON s.id = pss.show_id
    JOIN seasons se ON se.show_id = s.id
    JOIN episodes e ON e.season_id = se.id
    LEFT JOIN preferred_show_titles pt ON pt.show_id = s.id
    LEFT JOIN notification_deliveries nd
      ON nd.subscription_id = ps.id
      AND nd.kind = ?1
      AND nd.entity_key = ('episode:' || e.id)
    WHERE ps.disabled_at IS NULL
      AND e.air_timestamp IS NOT NULL
      AND e.episode_number > 0
      AND se.season_number > 0
      AND julianday(e.air_timestamp) > julianday(?2)
      AND julianday(e.air_timestamp) <= julianday(?3)
      AND (nd.id IS NULL OR nd.status = 'failed_transient')
    ORDER BY julianday(e.air_timestamp) ASC, ps.id ASC, e.id ASC
    LIMIT ?4`
  ).bind(
    EPISODE_REMINDER_KIND,
    window.after.toISOString(),
    window.through.toISOString(),
    Math.min(Math.max(Number(limit) || MAX_DELIVERIES_PER_RUN, 1), MAX_DELIVERIES_PER_RUN)
  ).all();
  return result.results || [];
}

async function claimDelivery(env, row) {
  const entityKey = episodeEntityKey(row.episode_id);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO notification_deliveries (
      subscription_id, kind, entity_key, scheduled_for, status, error_code, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, 'sending', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).bind(row.subscription_id, EPISODE_REMINDER_KIND, entityKey, row.air_timestamp).run();

  const existing = await env.DB.prepare(
    `SELECT id, status
     FROM notification_deliveries
     WHERE subscription_id = ?1 AND kind = ?2 AND entity_key = ?3
     LIMIT 1`
  ).bind(row.subscription_id, EPISODE_REMINDER_KIND, entityKey).first();

  if (!existing?.id) return null;
  if (existing.status === "sending") return Number(existing.id);
  if (existing.status !== "failed_transient") return null;

  const updated = await env.DB.prepare(
    `UPDATE notification_deliveries
     SET status = 'sending', scheduled_for = ?2, error_code = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1 AND status = 'failed_transient'`
  ).bind(Number(existing.id), row.air_timestamp).run();
  return Number(updated?.meta?.changes || 0) === 1 ? Number(existing.id) : null;
}

async function markDelivery(env, deliveryId, status, errorCode = null) {
  await env.DB.prepare(
    `UPDATE notification_deliveries
     SET status = ?2,
         error_code = ?3,
         sent_at = CASE WHEN ?2 = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  ).bind(deliveryId, status, errorCode).run();
}

async function deleteSubscription(env, subscriptionId) {
  await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(subscriptionId).run();
}

function subscriptionObject(row) {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth
    }
  };
}

async function defaultSender(subscription, payload) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60 * 60,
    urgency: "normal"
  });
}

export async function runEpisodeReminderDelivery(env, options = {}) {
  const now = asDate(options.now) || new Date();
  const dryRun = options.dryRun === true;
  const forceEnabled = options.forceEnabled === true;
  const enabled = forceEnabled || episodeRemindersEnabled(env);

  if (!env.DB) return { ok: false, error: "database_not_configured", enabled, dryRun };
  const purgedStale = await purgeStaleSubscriptions(env, now);
  const rows = await candidateRows(env, now, options.limit);

  if (dryRun || !enabled) {
    return {
      ok: true,
      enabled,
      dryRun: true,
      candidates: rows.length,
      purgedStale,
      attempted: 0,
      sent: 0,
      transientFailures: 0,
      terminalFailures: 0,
      purgedPermanent: 0
    };
  }

  const publicKey = await vapidPublicKey(env);
  if (!publicKey || !env.VAPID_PRIVATE_KEY) {
    return { ok: false, error: "vapid_not_configured", enabled, dryRun: false, candidates: rows.length, purgedStale };
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT || "https://series-hub.max-yu-jp.workers.dev",
    publicKey,
    env.VAPID_PRIVATE_KEY
  );

  const sender = options.sendNotification || defaultSender;
  const stats = {
    ok: true,
    enabled: true,
    dryRun: false,
    candidates: rows.length,
    purgedStale,
    attempted: 0,
    sent: 0,
    transientFailures: 0,
    terminalFailures: 0,
    purgedPermanent: 0
  };

  for (const row of rows) {
    const deliveryId = await claimDelivery(env, row);
    if (!deliveryId) continue;
    stats.attempted += 1;

    try {
      await sender(subscriptionObject(row), notificationPayload(row), row);
      await markDelivery(env, deliveryId, "sent");
      stats.sent += 1;
    } catch (error) {
      const classification = classifyPushFailure(error);
      if (classification.status === "permanent_subscription") {
        await deleteSubscription(env, Number(row.subscription_id));
        stats.purgedPermanent += 1;
        continue;
      }
      await markDelivery(env, deliveryId, classification.status, classification.errorCode);
      if (classification.status === "failed_transient") stats.transientFailures += 1;
      else stats.terminalFailures += 1;
    }
  }

  return stats;
}
