const params = new URLSearchParams(window.location.search);
const showId = Number(params.get("id"));
const seasonContainer = document.querySelector("#detail-seasons");

let selectedSeasonNumber = null;
let requestSequence = 0;
let enhanceQueued = false;

function seasonNumberFromCard(card, index, total) {
  const stored = Number(card?.dataset?.seasonNumber);
  if (Number.isInteger(stored) && stored > 0) return stored;
  const title = card?.querySelector(".detail-season-heading strong")?.textContent || "";
  const parsed = Number(title.match(/(?:Season|第)\s*(\d+)/i)?.[1]);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  const fallback = total - index;
  return fallback > 0 ? fallback : null;
}

function episodeCode(episode) {
  const season = Number(episode?.season_number);
  const number = Number(episode?.episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(number) || number < 1) return null;
  return `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(parsed);
}

function formatSchedule(episode) {
  if (episode?.air_timestamp) {
    const parsed = new Date(episode.air_timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("zh-HK", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short"
      }).format(parsed);
    }
  }
  const date = formatDate(episode?.air_date);
  return [date, episode?.air_time ? `原播 ${episode.air_time}` : null].filter(Boolean).join(" · ") || "播映時間待定";
}

function episodeState(episode) {
  const exact = Date.parse(episode?.air_timestamp || "");
  if (Number.isFinite(exact)) {
    return exact > Date.now()
      ? { key: "upcoming", label: "即將播出" }
      : { key: "past", label: "已播出" };
  }

  if (episode?.air_date) {
    const today = new Date().toISOString().slice(0, 10);
    if (episode.air_date > today) return { key: "upcoming", label: "即將播出" };
    if (episode.air_date < today) return { key: "past", label: "已播出" };
    return { key: "today", label: "今日播出" };
  }

  return { key: "unknown", label: "時間待定" };
}

function ensureExplorer() {
  let panel = document.querySelector("#phase6c-episode-explorer");
  if (panel) return panel;
  const seasonPanel = seasonContainer?.closest(".detail-panel");
  if (!seasonPanel) return null;

  panel = document.createElement("section");
  panel.id = "phase6c-episode-explorer";
  panel.className = "detail-panel detail-wide-panel phase6c-explorer";
  panel.setAttribute("aria-labelledby", "phase6c-title");
  panel.innerHTML = `
    <div class="detail-section-heading phase6c-heading">
      <div>
        <p class="eyebrow">SEASON EPISODES</p>
        <h3 id="phase6c-title">季度集數</h3>
      </div>
      <label class="phase6c-season-control">
        <span>季度</span>
        <select id="phase6c-season-select" aria-label="選擇季度"></select>
      </label>
    </div>
    <div id="phase6c-season-summary" class="phase6c-season-summary"></div>
    <div id="phase6c-episode-state-summary" class="phase6c-state-summary" aria-live="polite"></div>
    <div id="phase6c-episode-list" class="phase6c-episode-list" aria-live="polite"></div>
  `;
  seasonPanel.after(panel);

  panel.querySelector("#phase6c-season-select")?.addEventListener("change", (event) => {
    const next = Number(event.currentTarget.value);
    if (Number.isInteger(next) && next > 0) selectSeason(next, { scroll: false });
  });
  return panel;
}

function seasonCards() {
  const cards = [...(seasonContainer?.querySelectorAll(".detail-season-card") || [])];
  return cards.map((card, index) => {
    const number = seasonNumberFromCard(card, index, cards.length);
    if (number) card.dataset.seasonNumber = String(number);
    return { card, number };
  }).filter((entry) => entry.number);
}

function bindSeasonCards(entries) {
  for (const { card, number } of entries) {
    card.classList.add("phase6c-season-selectable");
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", `查看第 ${number} 季集數`);

    if (card.dataset.phase6cBound !== "1") {
      card.dataset.phase6cBound = "1";
      card.addEventListener("click", () => selectSeason(Number(card.dataset.seasonNumber), { scroll: true }));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectSeason(Number(card.dataset.seasonNumber), { scroll: true });
      });
    }

    if (!card.querySelector(".phase6c-season-open")) {
      const hint = document.createElement("span");
      hint.className = "phase6c-season-open";
      hint.textContent = "查看集數 →";
      card.append(hint);
    }
  }
}

function syncSelector(entries) {
  const select = document.querySelector("#phase6c-season-select");
  if (!select) return;
  const previous = Number(select.value);
  select.replaceChildren();
  for (const { number } of entries) {
    const option = document.createElement("option");
    option.value = String(number);
    option.textContent = `第 ${number} 季`;
    select.append(option);
  }
  const desired = entries.some((entry) => entry.number === selectedSeasonNumber)
    ? selectedSeasonNumber
    : entries.some((entry) => entry.number === previous) ? previous : entries[0]?.number;
  if (desired) select.value = String(desired);
}

function updateSelectedCards(entries) {
  for (const { card, number } of entries) {
    const selected = number === selectedSeasonNumber;
    card.classList.toggle("is-phase6c-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
  }
}

function renderSeasonSummary(number) {
  const summary = document.querySelector("#phase6c-season-summary");
  if (!summary) return;
  const entry = seasonCards().find((item) => item.number === number);
  const title = entry?.card?.querySelector(".detail-season-heading strong")?.textContent?.trim() || `第 ${number} 季`;
  const meta = entry?.card?.querySelector(":scope > p")?.textContent?.trim() || "日期／集數待確認";
  summary.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  const span = document.createElement("span");
  span.textContent = meta;
  summary.append(strong, span);
}

function renderLoading(number) {
  const list = document.querySelector("#phase6c-episode-list");
  const state = document.querySelector("#phase6c-episode-state-summary");
  if (state) state.textContent = `正在載入第 ${number} 季逐集資料…`;
  if (!list) return;
  list.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const skeleton = document.createElement("div");
    skeleton.className = "phase6c-episode-skeleton";
    skeleton.innerHTML = '<span></span><div><i></i><i></i><i></i></div>';
    list.append(skeleton);
  }
}

function buildEpisodeCard(episode) {
  const article = document.createElement("article");
  const state = episodeState(episode);
  article.className = `phase6c-episode-card is-${state.key}`;

  const media = document.createElement("div");
  media.className = "phase6c-episode-media";
  if (episode?.image_url) {
    const image = document.createElement("img");
    image.src = episode.image_url;
    image.alt = `${episodeCode(episode) || "集數"} 劇照`;
    image.loading = "lazy";
    image.decoding = "async";
    media.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "phase6c-episode-placeholder";
    placeholder.textContent = episodeCode(episode) || "EP";
    media.append(placeholder);
  }

  const body = document.createElement("div");
  body.className = "phase6c-episode-body";
  const top = document.createElement("div");
  top.className = "phase6c-episode-topline";
  const code = document.createElement("span");
  code.className = "phase6c-episode-code";
  code.textContent = episodeCode(episode) || `第 ${episode?.episode_number || "?"} 集`;
  const badge = document.createElement("span");
  badge.className = `phase6c-episode-state is-${state.key}`;
  badge.textContent = state.label;
  top.append(code, badge);

  const title = document.createElement("h4");
  title.textContent = episode?.name || `第 ${episode?.episode_number || "?"} 集`;

  const meta = document.createElement("p");
  meta.className = "phase6c-episode-meta";
  meta.textContent = [formatSchedule(episode), Number(episode?.runtime_minutes) > 0 ? `${episode.runtime_minutes} 分鐘` : null].filter(Boolean).join(" · ");

  body.append(top, title, meta);

  if (episode?.overview) {
    const overview = document.createElement("p");
    overview.className = "phase6c-episode-overview";
    overview.textContent = episode.overview;
    body.append(overview);

    if (episode.overview.length > 180) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "phase6c-overview-toggle";
      toggle.textContent = "展開簡介";
      toggle.addEventListener("click", () => {
        const expanded = overview.classList.toggle("is-expanded");
        toggle.textContent = expanded ? "收起簡介" : "展開簡介";
      });
      body.append(toggle);
    }
  }

  if (episode?.source_url) {
    const source = document.createElement("a");
    source.className = "phase6c-episode-source";
    source.href = episode.source_url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "TVmaze ↗";
    body.append(source);
  }

  article.append(media, body);
  return article;
}

function renderEpisodes(number, episodes) {
  const list = document.querySelector("#phase6c-episode-list");
  const summary = document.querySelector("#phase6c-episode-state-summary");
  if (!list || !summary) return;
  list.replaceChildren();

  if (!episodes.length) {
    summary.textContent = `第 ${number} 季暫未有 TVmaze 逐集資料。`;
    const empty = document.createElement("p");
    empty.className = "detail-muted phase6c-empty";
    empty.textContent = "季度資料仍會保留；待 TVmaze 有逐集資料後會自動出現在這裡。";
    list.append(empty);
    return;
  }

  const counts = episodes.reduce((result, episode) => {
    const key = episodeState(episode).key;
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});
  const upcoming = (counts.upcoming || 0) + (counts.today || 0);
  summary.textContent = [
    `共 ${episodes.length} 集`,
    upcoming ? `${upcoming} 集待播` : null,
    counts.past ? `${counts.past} 集已播` : null,
    counts.unknown ? `${counts.unknown} 集時間待定` : null
  ].filter(Boolean).join(" · ");

  list.append(...episodes.map(buildEpisodeCard));
}

async function fetchSeasonEpisodes(number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`/api/shows/${showId}/seasons/${number}/episodes`, {
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Season episodes ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload?.data) ? payload.data : [];
  } finally {
    window.clearTimeout(timeout);
  }
}

async function selectSeason(number, { scroll = false } = {}) {
  if (!Number.isSafeInteger(showId) || showId <= 0 || !Number.isInteger(number) || number <= 0) return;
  const panel = ensureExplorer();
  if (!panel) return;
  selectedSeasonNumber = number;
  const entries = seasonCards();
  updateSelectedCards(entries);
  const select = panel.querySelector("#phase6c-season-select");
  if (select) select.value = String(number);
  renderSeasonSummary(number);
  renderLoading(number);
  if (scroll) panel.scrollIntoView({ behavior: "smooth", block: "start" });

  const sequence = ++requestSequence;
  try {
    const episodes = await fetchSeasonEpisodes(number);
    if (sequence !== requestSequence || selectedSeasonNumber !== number) return;
    renderEpisodes(number, episodes);
  } catch (error) {
    if (sequence !== requestSequence || selectedSeasonNumber !== number) return;
    const state = panel.querySelector("#phase6c-episode-state-summary");
    const list = panel.querySelector("#phase6c-episode-list");
    if (state) state.textContent = error?.name === "AbortError" ? "逐集資料載入逾時。" : "逐集資料暫時無法載入。";
    if (list) {
      list.replaceChildren();
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "phase6c-retry";
      retry.textContent = "重新載入此季度";
      retry.addEventListener("click", () => selectSeason(number));
      list.append(retry);
    }
  }
}

function enhanceSeasonNavigator() {
  const content = document.querySelector("#detail-content");
  if (!seasonContainer || !content || content.hidden) return;
  const entries = seasonCards();
  if (!entries.length) return;
  ensureExplorer();
  bindSeasonCards(entries);
  syncSelector(entries);

  const numbers = entries.map((entry) => entry.number);
  const desired = numbers.includes(selectedSeasonNumber) ? selectedSeasonNumber : numbers[0];
  if (desired !== selectedSeasonNumber) {
    void selectSeason(desired);
  } else {
    updateSelectedCards(entries);
    renderSeasonSummary(desired);
  }
}

function queueEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  window.queueMicrotask(() => {
    enhanceQueued = false;
    enhanceSeasonNavigator();
  });
}

if (seasonContainer) {
  const observer = new MutationObserver(queueEnhance);
  observer.observe(seasonContainer, { childList: true, subtree: true });
}
const detailContent = document.querySelector("#detail-content");
if (detailContent) {
  const observer = new MutationObserver(queueEnhance);
  observer.observe(detailContent, { attributes: true, attributeFilter: ["hidden"] });
}
queueEnhance();
