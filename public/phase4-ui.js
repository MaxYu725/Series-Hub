const DECISION_EVENTS = new Set(["renewed", "ordered", "cancelled", "final_season", "ended"]);
const PRODUCTION_EVENTS = new Set(["pre_production", "filming", "wrapped", "post_production", "production_paused"]);

const EVENT_PRIORITY = Object.freeze({
  final_season: 50,
  cancelled: 45,
  ended: 40,
  renewed: 30,
  ordered: 20,
  production_paused: 50,
  post_production: 40,
  wrapped: 35,
  filming: 30,
  pre_production: 20
});

function eventTime(event) {
  const value = event?.source_published_at || event?.created_at || "";
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newer(left, right) {
  const timeDelta = eventTime(left) - eventTime(right);
  if (timeDelta !== 0) return timeDelta > 0;
  const priorityDelta = Number(EVENT_PRIORITY[left?.event_type] || 0) - Number(EVENT_PRIORITY[right?.event_type] || 0);
  if (priorityDelta !== 0) return priorityDelta > 0;
  return Number(left?.id || 0) > Number(right?.id || 0);
}

export function isOfficialLifecycleEvent(event) {
  return event?.confidence === "official" && event?.trust_level === "official" && Number(event?.is_retracted || 0) === 0;
}

export function officialLifecycleProjection(events = []) {
  const official = events.filter(isOfficialLifecycleEvent);
  let decision = null;
  let production = null;

  for (const event of official) {
    if (DECISION_EVENTS.has(event.event_type) && (!decision || newer(event, decision))) decision = event;
    if (PRODUCTION_EVENTS.has(event.event_type) && (!production || newer(event, production))) production = event;
  }

  return { decision, production, eventCount: official.length };
}

function seasonPrefix(event) {
  return Number.isInteger(Number(event?.season_number)) && event?.season_number !== null
    ? `第${Number(event.season_number)}季`
    : "";
}

export function lifecycleLabel(event) {
  if (!event) return null;
  const season = seasonPrefix(event);

  switch (event.event_type) {
    case "renewed": return season ? `${season}已續訂` : "已續訂";
    case "ordered": return season ? `${season}已訂製` : "已訂製新一季";
    case "cancelled": return season ? `${season}已取消` : "已取消";
    case "final_season": return season ? `${season}為最終季` : "已確認最終季";
    case "ended": return "正式完結";
    case "pre_production": return season ? `${season}製作準備中` : "製作準備中";
    case "filming": return season ? `${season}拍攝中` : "拍攝中";
    case "wrapped": return season ? `${season}完成拍攝` : "完成拍攝";
    case "post_production": return season ? `${season}後期製作中` : "後期製作中";
    case "production_paused": return season ? `${season}製作暫停` : "製作暫停";
    default: return null;
  }
}

function visibleFacts(record) {
  const projection = officialLifecycleProjection(record?.events || []);
  return [projection.decision, projection.production]
    .filter(Boolean)
    .map((event) => ({ event, label: lifecycleLabel(event) }))
    .filter((item) => item.label);
}

function sourceLinks(facts) {
  const seen = new Set();
  const links = [];
  for (const { event } of facts) {
    if (!event?.source_url || seen.has(event.source_url)) continue;
    seen.add(event.source_url);
    links.push({
      url: event.source_url,
      name: event.source_name || "官方來源"
    });
  }
  return links.slice(0, 2);
}

function evidenceSignature(facts, links) {
  return JSON.stringify({
    facts: facts.map(({ event, label }) => [event.id, event.event_type, label]),
    links
  });
}

function renderEvidence(record) {
  const facts = visibleFacts(record);
  if (!facts.length) return null;
  const links = sourceLinks(facts);

  const panel = document.createElement("div");
  panel.className = "lifecycle-evidence";
  panel.dataset.signature = evidenceSignature(facts, links);

  const badges = document.createElement("div");
  badges.className = "lifecycle-badges";
  for (const { event, label } of facts) {
    const badge = document.createElement("span");
    badge.className = `lifecycle-badge lifecycle-${event.event_type}`;
    badge.textContent = label;
    badges.append(badge);
  }
  panel.append(badges);

  if (links.length) {
    const sourceRow = document.createElement("div");
    sourceRow.className = "lifecycle-sources";
    const prefix = document.createElement("span");
    prefix.textContent = "官方確認";
    sourceRow.append(prefix);

    for (const link of links) {
      const separator = document.createElement("span");
      separator.textContent = " · ";
      sourceRow.append(separator);

      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = link.name;
      sourceRow.append(anchor);
    }
    panel.append(sourceRow);
  }

  return panel;
}

function decorateCard(card, lifecycleByShow) {
  const showId = card.dataset.showId;
  const record = lifecycleByShow?.[showId];
  const current = card.querySelector(":scope .lifecycle-evidence");
  const next = record ? renderEvidence(record) : null;

  if (!next) {
    current?.remove();
    return;
  }
  if (current?.dataset.signature === next.dataset.signature) return;

  if (current) current.replaceWith(next);
  else {
    const meta = card.querySelector(":scope .show-card-body .show-meta");
    if (meta) meta.insertAdjacentElement("afterend", next);
  }
}

function boot() {
  const grid = document.querySelector("#show-grid");
  if (!grid) return;

  let lifecycleByShow = {};
  let scheduled = false;

  const decorate = () => {
    scheduled = false;
    for (const card of grid.querySelectorAll(".show-card[data-show-id]")) decorateCard(card, lifecycleByShow);
  };
  const scheduleDecorate = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(decorate);
  };

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(grid, { childList: true, subtree: true });

  fetch("/api/lifecycle", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Lifecycle ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      lifecycleByShow = payload?.data && typeof payload.data === "object" ? payload.data : {};
      document.documentElement.dataset.lifecycleUi = "ready";
      scheduleDecorate();
    })
    .catch((error) => {
      console.error(error);
      document.documentElement.dataset.lifecycleUi = "unavailable";
    });

  scheduleDecorate();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();