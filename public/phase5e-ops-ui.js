const STATE_LABELS = Object.freeze({
  ok: "正常",
  warn: "需留意",
  error: "異常",
  unknown: "未確認",
  idle: "待使用"
});

function ageLabel(minutes) {
  if (!Number.isFinite(Number(minutes))) return "未有時間";
  const value = Math.max(0, Number(minutes));
  if (value < 60) return `${Math.round(value)} 分鐘前`;
  const hours = value / 60;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} 小時前`;
  return `${Math.round(hours / 24)} 日前`;
}

function makePill(name, source, detail) {
  const pill = document.createElement("span");
  const state = source?.state || "unknown";
  pill.className = `ops-source ops-${state}`;
  pill.dataset.source = name.toLowerCase();
  pill.textContent = `${name} · ${STATE_LABELS[state] || STATE_LABELS.unknown}${detail ? ` · ${detail}` : ""}`;
  return pill;
}

function syncDetail(source) {
  if (!source?.finishedAt) return "未有同步紀錄";
  return ageLabel(source.ageMinutes);
}

function pushDetail(source) {
  if (!source) return "未有狀態";
  if (!source.vapidConfigured) return "Push key 未完整設定";
  if (source.activeSubscriptions < 1) return "未有裝置訂閱";
  if (source.activeShowMappings < 1) return `${source.activeSubscriptions} 裝置 · 未有追蹤映射`;
  if (source.failed24h > 0) return `${source.failed24h} 次近 24h 失敗`;
  return `${source.activeSubscriptions} 裝置 · ${source.activeShowMappings} 個追蹤映射`;
}

function renderUnavailable(root) {
  root.replaceChildren(
    makePill("TMDB", { state: "unknown" }, "狀態暫不可用"),
    makePill("TVmaze", { state: "unknown" }, "狀態暫不可用"),
    makePill("Push", { state: "unknown" }, "狀態暫不可用")
  );
}

async function loadOperationalStatus(root) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch("/api/ops-status", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Operational status ${response.status}`);
    const payload = await response.json();
    const data = payload?.data;
    if (!data?.tmdb || !data?.tvmaze || !data?.push) throw new Error("Operational status payload is incomplete");

    root.replaceChildren(
      makePill("TMDB", data.tmdb, syncDetail(data.tmdb)),
      makePill("TVmaze", data.tvmaze, syncDetail(data.tvmaze)),
      makePill("Push", data.push, pushDetail(data.push))
    );
    root.dataset.overall = data.overall || "unknown";
  } catch (error) {
    console.error(error);
    renderUnavailable(root);
    root.dataset.overall = "unknown";
  } finally {
    window.clearTimeout(timer);
  }
}

function boot() {
  const root = document.querySelector("#ops-status");
  if (!root) return;

  loadOperationalStatus(root);
  const refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") loadOperationalStatus(root);
  }, 5 * 60 * 1000);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadOperationalStatus(root);
  });

  window.addEventListener("pagehide", () => window.clearInterval(refreshTimer), { once: true });
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
