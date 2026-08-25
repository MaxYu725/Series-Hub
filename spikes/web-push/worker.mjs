import webpush from "web-push";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function validSubscription(value) {
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
    keys.p256dh.length > 16 &&
    keys.p256dh.length < 1024 &&
    typeof keys.auth === "string" &&
    keys.auth.length > 8 &&
    keys.auth.length < 512
  );
}

function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      const publicConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PUBLIC_KEY !== "generated-by-ci");
      return json({
        ok: true,
        phase: "5d-a-web-push-spike",
        persistentStorage: false,
        vapidPublicConfigured: publicConfigured,
        vapidPrivateConfigured: Boolean(env.VAPID_PRIVATE_KEY),
        vapidPublicKey: publicConfigured ? env.VAPID_PUBLIC_KEY : null,
        sender: "web-push@3.6.7"
      });
    }

    if (request.method === "POST" && url.pathname === "/send-test") {
      if (!sameOriginRequest(request)) return json({ ok: false, error: "same_origin_required" }, 403);
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
        return json({ ok: false, error: "vapid_not_configured" }, 503);
      }

      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 8192) return json({ ok: false, error: "request_too_large" }, 413);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "invalid_json" }, 400);
      }

      const subscription = body?.subscription;
      if (!validSubscription(subscription)) {
        return json({ ok: false, error: "invalid_subscription" }, 400);
      }

      webpush.setVapidDetails(
        env.VAPID_SUBJECT || "https://series-hub.max-yu-jp.workers.dev",
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({
        title: "Series Hub · Phase 5D-A",
        body: "Web Push preview feasibility test succeeded.",
        tag: "series-hub-phase5d-a",
        data: { url: "/" }
      });

      try {
        const result = await webpush.sendNotification(subscription, payload, {
          TTL: 60,
          urgency: "normal"
        });
        return json({
          ok: true,
          pushServiceStatus: Number(result?.statusCode || 201),
          persisted: false
        });
      } catch (error) {
        const statusCode = Number(error?.statusCode || 0);
        return json({
          ok: false,
          error: "push_delivery_failed",
          pushServiceStatus: statusCode || null,
          permanent: statusCode === 404 || statusCode === 410
        }, statusCode >= 400 && statusCode < 500 ? 422 : 502);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
