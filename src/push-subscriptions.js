const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

const TITLE_REGIONS = new Set(["HK", "TW", "CN"]);
const MAX_SHOW_IDS = 100;
const MAX_BODY_BYTES = 32768;

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  for (const [key, value] of Object.entries(JSON_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function pushSubscriptionsEnabled(env) {
  return String(env?.PUSH_SUBSCRIPTIONS_ENABLED || "").toLowerCase() === "true";
}

export function normalizeTitleRegion(value) {
  const region = String(value || "HK").toUpperCase();
  return TITLE_REGIONS.has(region) ? region : "HK";
}

export function normalizeShowIds(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const id = Number(item);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= MAX_SHOW_IDS) break;
  }
  return result;
}

export function validTimezone(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function validPushSubscription(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.endpoint !== "string" || value.endpoint.length < 16 || value.endpoint.length > 4096) return false;
  try {
    const endpoint = new URL(value.endpoint);
    if (endpoint.protocol !== "https:") return false;
  } catch {
    return false;
  }
  const keys = value.keys;
  return Boolean(
    keys &&
    typeof keys === "object" &&
    typeof keys.p256dh === "string" &&
    keys.p256dh.length >= 16 &&
    keys.p256dh.length <= 1024 &&
    typeof keys.auth === "string" &&
    keys.auth.length >= 8 &&
    keys.auth.length <= 512
  );
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

function randomManagementToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+([A-Za-z0-9_-]{32,256})$/);
  return match ? match[1] : null;
}

async function readJsonBody(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { error: json({ ok: false, error: "request_too_large" }, { status: 413 }) };
  }
  try {
    return { value: await request.json() };
  } catch {
    return { error: json({ ok: false, error: "invalid_json" }, { status: 400 }) };
  }
}

async function publicKey(env) {
  if (!env.DB) return null;
  try {
    const row = await env.DB.prepare(
      "SELECT config_value FROM push_config WHERE config_key = 'vapid_public_key' LIMIT 1"
    ).first();
    return row?.config_value || null;
  } catch {
    return null;
  }
}

export async function pushCapability(env) {
  const configuredKey = await publicKey(env);
  return {
    enabled: pushSubscriptionsEnabled(env),
    configured: Boolean(configuredKey),
    publicKey: pushSubscriptionsEnabled(env) ? configuredKey : null,
    maxShows: MAX_SHOW_IDS,
    privacy: "device-subscription-and-selected-show-ids-only"
  };
}

async function assertShowIdsExist(env, showIds) {
  if (showIds.length === 0) return true;
  const placeholders = showIds.map((_, index) => `?${index + 1}`).join(", ");
  const result = await env.DB.prepare(`SELECT id FROM shows WHERE id IN (${placeholders})`).bind(...showIds).all();
  const existing = new Set((result.results || []).map((row) => Number(row.id)));
  return showIds.every((id) => existing.has(id));
}

function mappingStatements(env, subscriptionId, showIds) {
  return showIds.map((showId) => env.DB.prepare(
    "INSERT INTO push_subscription_shows (subscription_id, show_id) VALUES (?1, ?2)"
  ).bind(subscriptionId, showId));
}

async function replaceMappings(env, subscriptionId, showIds) {
  const statements = [
    env.DB.prepare("DELETE FROM push_subscription_shows WHERE subscription_id = ?1").bind(subscriptionId),
    ...mappingStatements(env, subscriptionId, showIds)
  ];
  await env.DB.batch(statements);
}

async function registerSubscription(request, env) {
  if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, { status: 403 });
  if (!env.DB) return json({ ok: false, error: "database_not_configured" }, { status: 503 });

  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.value || {};
  const subscription = body.subscription;
  if (!validPushSubscription(subscription)) return json({ ok: false, error: "invalid_subscription" }, { status: 400 });

  const timezone = validTimezone(body.timezone) ? body.timezone : "UTC";
  const titleRegion = normalizeTitleRegion(body.titleRegion);
  const showIds = normalizeShowIds(body.showIds);
  if (!(await assertShowIdsExist(env, showIds))) {
    return json({ ok: false, error: "unknown_show_id" }, { status: 400 });
  }

  const endpointHash = await sha256Hex(subscription.endpoint);
  const manageToken = randomManagementToken();
  const manageTokenHash = await sha256Hex(manageToken);

  await env.DB.prepare(
    `INSERT INTO push_subscriptions (
      endpoint_hash, endpoint, p256dh, auth, manage_token_hash, timezone, title_region,
      created_at, updated_at, last_seen_at, disabled_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
    ON CONFLICT(endpoint_hash) DO UPDATE SET
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      manage_token_hash = excluded.manage_token_hash,
      timezone = excluded.timezone,
      title_region = excluded.title_region,
      updated_at = CURRENT_TIMESTAMP,
      last_seen_at = CURRENT_TIMESTAMP,
      disabled_at = NULL`
  ).bind(
    endpointHash,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    manageTokenHash,
    timezone,
    titleRegion
  ).run();

  const row = await env.DB.prepare(
    "SELECT id FROM push_subscriptions WHERE endpoint_hash = ?1 LIMIT 1"
  ).bind(endpointHash).first();
  if (!row?.id) return json({ ok: false, error: "subscription_persistence_failed" }, { status: 503 });

  await replaceMappings(env, Number(row.id), showIds);
  return json({
    ok: true,
    manageToken,
    endpointHash,
    showCount: showIds.length,
    titleRegion,
    timezone,
    persisted: true
  }, { status: 201 });
}

async function managedSubscription(request, env) {
  const token = bearerToken(request);
  if (!token) return { error: json({ ok: false, error: "management_token_required" }, { status: 401 }) };
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT id, endpoint_hash, timezone, title_region
     FROM push_subscriptions
     WHERE manage_token_hash = ?1 AND disabled_at IS NULL
     LIMIT 1`
  ).bind(tokenHash).first();
  if (!row) return { error: json({ ok: false, error: "subscription_not_found" }, { status: 404 }) };
  return { row };
}

async function updateSubscription(request, env) {
  if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, { status: 403 });
  if (!env.DB) return json({ ok: false, error: "database_not_configured" }, { status: 503 });
  const managed = await managedSubscription(request, env);
  if (managed.error) return managed.error;

  const parsed = await readJsonBody(request);
  if (parsed.error) return parsed.error;
  const body = parsed.value || {};
  const showIds = normalizeShowIds(body.showIds);
  if (!(await assertShowIdsExist(env, showIds))) {
    return json({ ok: false, error: "unknown_show_id" }, { status: 400 });
  }

  const timezone = validTimezone(body.timezone) ? body.timezone : managed.row.timezone || "UTC";
  const titleRegion = normalizeTitleRegion(body.titleRegion || managed.row.title_region);
  await env.DB.prepare(
    `UPDATE push_subscriptions
     SET timezone = ?2,
         title_region = ?3,
         updated_at = CURRENT_TIMESTAMP,
         last_seen_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  ).bind(Number(managed.row.id), timezone, titleRegion).run();
  await replaceMappings(env, Number(managed.row.id), showIds);

  return json({
    ok: true,
    endpointHash: managed.row.endpoint_hash,
    showCount: showIds.length,
    titleRegion,
    timezone
  });
}

async function deleteSubscription(request, env) {
  if (!sameOrigin(request)) return json({ ok: false, error: "same_origin_required" }, { status: 403 });
  if (!env.DB) return json({ ok: false, error: "database_not_configured" }, { status: 503 });
  const managed = await managedSubscription(request, env);
  if (managed.error) return managed.error;
  const subscriptionId = Number(managed.row.id);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM notification_deliveries WHERE subscription_id = ?1").bind(subscriptionId),
    env.DB.prepare("DELETE FROM push_subscription_shows WHERE subscription_id = ?1").bind(subscriptionId),
    env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(subscriptionId)
  ]);
  return json({ ok: true, deleted: true, endpointHash: managed.row.endpoint_hash });
}

export async function handlePushRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/push/public-key") {
    return json(await pushCapability(env));
  }

  if (!pushSubscriptionsEnabled(env)) {
    return json({ ok: false, error: "push_subscriptions_disabled" }, { status: 503 });
  }

  const capability = await pushCapability(env);
  if (!capability.configured) {
    return json({ ok: false, error: "vapid_public_key_not_configured" }, { status: 503 });
  }

  if (request.method === "POST" && url.pathname === "/api/push/subscriptions") {
    return registerSubscription(request, env);
  }
  if (request.method === "PUT" && url.pathname === "/api/push/subscription") {
    return updateSubscription(request, env);
  }
  if (request.method === "DELETE" && url.pathname === "/api/push/subscription") {
    return deleteSubscription(request, env);
  }

  return json({ ok: false, error: "not_found", path: url.pathname }, { status: 404 });
}
