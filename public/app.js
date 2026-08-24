import {
  addDateKeyDays,
  episodeCode,
  episodeLocalDateKey,
  localDateKey,
  scheduleWindow
} from "./schedule-utils.js";

const views = {
  today: { title: "今日播映", kicker: "TODAY", type: "schedule", days: 1 },
  week: { title: "本週播映", kicker: "THIS WEEK", type: "schedule", days: 7 },
  airing: { title: "播映中", kicker: "AIRING", type: "catalog", status: "airing" },
  upcoming: { title: "即將播映", kicker: "UPCOMING", type: "catalog", status: "upcoming" },
  planned: { title: "計劃播出", kicker: "PLANNED", type: "catalog", status: "planned" }
};

const TITLE_REGION_STORAGE_KEY = "series-hub-title-region";
const TITLE_REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

function storedTitleRegion() {
  try {
    const value = window.localStorage.getItem(TITLE_REGION_STORAGE_KEY);
    return Object.hasOwn(TITLE_REGION_LABELS, value) ? value : "HK";
  } catch {
    return "HK";
  }
}

function saveTitleRegion(region) {
  try {
    window.localStorage.setItem(TITLE_REGION_STORAGE_KEY, region);
  } catch {
    // Storage is optional. The active in-memory preference still works.
  }
}

const state = {
  view: "today",
  shows: [],
  episodes: [],
  query: "",
  titleRegion: storedTitleRegion(),
  loading: false,
  requestId: 0
};

const healthText = document.querySelector("#health-text");
const syncText = document.querySelector("#sync-text");
const statusDot = document.querySelector("#status-dot");
const viewTitle = document.querySelector("#view-title");
const viewKicker = document.querySelector("#view-kicker");
const viewContext = document.querySelector("#view-context");
const showCount = document.querySelector("#show-count");
const showGrid = document.querySelector("#show-grid");
const scheduleList = document.querySelector("#schedule-list");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const searchInput = document.querySelector("#search-input");
const titleRegionSelect = document.querySelector("#title-region-select");

titleRegionSelect.value = state.titleRegion;

function setHealth(type, text) {
  statusDot.className = `status-dot ${type}`;
  healthText.textContent = text;
}

function formatDate(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("zh-HK", {
    month: "short",
    day: "numeric",
    year: parsed.getUTCFullYear() === new Date().getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

function formatScheduleDate(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  const formatted = new Intl.DateTimeFormat("zh-HK", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC"
  }).format(parsed);
  return dateKey === localDateKey() ? `今日 · ${formatted}` : formatted;
}

function formatEpisodeTime(episode) {
  if (episode.air_timestamp) {
    const parsed = new Date(episode.air_timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        text: new Intl.DateTimeFormat("zh-HK", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }).format(parsed),
        exactLocal: true
      };
    }
  }

  if (episode.air_time) return { text: `原播 ${episode.air_time}`, exactLocal: false };
  return { text: "時間未定", exactLocal: false };
}

function formatSyncStamp(value) {
  if (!value) return null;
  const normalized = /Z$|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(parsed);
}

function chineseTitle(item) {
  if (item.display_title_zh) return item.display_title_zh;
  const requested = item[`title_zh_${state.titleRegion.toLowerCase()}`];
  if (requested) return requested;
  return item.title_zh_hk || item.title_zh_tw || item.title_zh_cn || "";
}

function titleSourceNote(item) {
  const notes = [];
  if (item.display_title_zh_source === "manual") notes.push("人工校正");
  if (item.display_title_zh_fallback && item.display_title_zh_region) {
    notes.push(`使用${TITLE_REGION_LABELS[item.display_title_zh_region] || item.display_title_zh_region}譯名`);
  }
  return notes.join(" · ");
}

function appendTitleSourceNote(container, item) {
  const text = titleSourceNote(item);
  if (!text) return;
  const note = document.createElement("span");
  note.className = "title-source-note";
  note.textContent = text;
  container.append(note);
}

function statusLine(show) {
  const scheduleDate = show.tvmaze_next_episode_date || show.next_air_date;

  if (show.status === "airing") {
    return scheduleDate ? `下集 ${formatDate(scheduleDate)}` : "播映中";
  }
  if (show.status === "upcoming") {
    return scheduleDate ? `首播 ${formatDate(scheduleDate)}` : "已公布播映日期";
  }
  if (show.status === "planned") return "已續訂／製作中 · 日期待定";
  return show.tmdb_status || show.status || "狀態待確認";
}

function metaParts(show) {
  const values = [];
  if (show.latest_season_number) values.push(`Season ${show.latest_season_number}`);
  if (show.networks) values.push(show.networks);
  return values;
}

function createShowCard(show) {
  const card = document.createElement("article");
  card.className = "show-card";
  card.dataset.showId = String(show.id);

  const imageWrap = document.createElement("div");
  imageWrap.className = "poster-wrap";

  if (show.poster_url) {
    const image = document.createElement("img");
    image.className = "poster";
    image.src = show.poster_url;
    image.alt = `${show.english_title || show.original_title} poster`;
    image.loading = "lazy";
    image.decoding = "async";
    imageWrap.append(image);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "poster poster-placeholder";
    placeholder.textContent = "Series Hub";
    imageWrap.append(placeholder);
  }

  const status = document.createElement("span");
  status.className = `status-badge status-${show.status || "unknown"}`;
  status.textContent = statusLine(show);
  imageWrap.append(status);

  const body = document.createElement("div");
  body.className = "show-card-body";

  const title = document.createElement("h4");
  title.textContent = show.english_title || show.original_title;

  const zhTitle = document.createElement("p");
  zhTitle.className = "chinese-title";
  zhTitle.textContent = chineseTitle(show) || "中文譯名待補";
  appendTitleSourceNote(zhTitle, show);

  const meta = document.createElement("div");
  meta.className = "show-meta";
  meta.textContent = metaParts(show).join(" · ") || "平台資料待補";

  const footer = document.createElement("div");
  footer.className = "show-card-footer";
  if (Number(show.vote_average) > 0) {
    const rating = document.createElement("span");
    rating.textContent = `★ ${Number(show.vote_average).toFixed(1)}`;
    footer.append(rating);
  }
  if (show.genres) {
    const genre = document.createElement("span");
    genre.textContent = show.genres.split(" · ").slice(0, 2).join(" · ");
    footer.append(genre);
  }

  body.append(title, zhTitle, meta, footer);
  card.append(imageWrap, body);
  return card;
}

function createScheduleRow(episode) {
  const row = document.createElement("article");
  row.className = "schedule-row";

  const posterWrap = document.createElement("div");
  posterWrap.className = "schedule-poster-wrap";
  if (episode.poster_url) {
    const poster = document.createElement("img");
    poster.className = "schedule-poster";
    poster.src = episode.poster_url;
    poster.alt = `${episode.english_title || episode.original_title} poster`;
    poster.loading = "lazy";
    poster.decoding = "async";
    posterWrap.append(poster);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "schedule-poster schedule-poster-placeholder";
    placeholder.textContent = "SH";
    posterWrap.append(placeholder);
  }

  const body = document.createElement("div");
  body.className = "schedule-body";
  const zh = chineseTitle(episode);
  const title = document.createElement("h4");
  title.textContent = zh || episode.english_title || episode.original_title;

  if (zh && episode.english_title) {
    const english = document.createElement("p");
    english.className = "schedule-english";
    english.textContent = episode.english_title;
    appendTitleSourceNote(english, episode);
    body.append(title, english);
  } else {
    body.append(title);
  }

  const episodeLine = document.createElement("p");
  episodeLine.className = "episode-line";
  episodeLine.textContent = [episodeCode(episode), episode.episode_name].filter(Boolean).join(" · ") || "集數資料待補";

  const meta = document.createElement("div");
  meta.className = "schedule-meta";
  if (episode.networks) {
    const network = document.createElement("span");
    network.textContent = episode.networks;
    meta.append(network);
  }
  if (Number(episode.runtime_minutes) > 0) {
    const runtime = document.createElement("span");
    runtime.textContent = `${Number(episode.runtime_minutes)} 分鐘`;
    meta.append(runtime);
  }
  body.append(episodeLine, meta);

  const side = document.createElement("div");
  side.className = "schedule-side";
  const time = formatEpisodeTime(episode);
  const timeText = document.createElement("strong");
  timeText.className = time.exactLocal ? "schedule-time exact" : "schedule-time";
  timeText.textContent = time.text;
  side.append(timeText);

  const timeNote = document.createElement("span");
  timeNote.className = "schedule-time-note";
  timeNote.textContent = time.exactLocal ? "本地時間" : "TVmaze 來源日期";
  side.append(timeNote);

  if (episode.source_url) {
    const source = document.createElement("a");
    source.className = "schedule-source";
    source.href = episode.source_url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = "TVmaze";
    side.append(source);
  }

  row.append(posterWrap, body, side);
  return row;
}

function matchesScheduleQuery(episode, query) {
  if (!query) return true;
  const needle = query.toLocaleLowerCase();
  return [
    episode.english_title,
    episode.original_title,
    episode.title_zh_hk,
    episode.title_zh_tw,
    episode.title_zh_cn,
    episode.chinese_aliases,
    episode.episode_name,
    episode.networks
  ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(needle));
}

function renderSchedule() {
  scheduleList.replaceChildren();
  const groups = new Map();
  for (const episode of state.episodes) {
    const dateKey = episodeLocalDateKey(episode, browserTimeZone) || episode.air_date || "unknown";
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(episode);
  }

  for (const [dateKey, episodes] of groups) {
    const day = document.createElement("section");
    day.className = "schedule-day";
    const heading = document.createElement("div");
    heading.className = "schedule-day-heading";
    const title = document.createElement("h4");
    title.textContent = dateKey === "unknown" ? "日期待確認" : formatScheduleDate(dateKey);
    const count = document.createElement("span");
    count.textContent = `${episodes.length} 集`;
    heading.append(title, count);

    const rows = document.createElement("div");
    rows.className = "schedule-rows";
    for (const episode of episodes) rows.append(createScheduleRow(episode));
    day.append(heading, rows);
    scheduleList.append(day);
  }
}

function render() {
  const view = views[state.view];
  const isSchedule = view.type === "schedule";
  const regionLabel = TITLE_REGION_LABELS[state.titleRegion];
  viewTitle.textContent = view.title;
  viewKicker.textContent = view.kicker;
  viewContext.textContent = isSchedule
    ? `中文名優先使用${regionLabel}譯名；時間有精確 timestamp 時按 ${browserTimeZone} 顯示。`
    : `中文名優先使用${regionLabel}譯名；缺少時才跨區 fallback。基礎分類由 TMDB 主資料正規化；如有官方 lifecycle evidence 會另行標示。`;

  showGrid.hidden = isSchedule;
  scheduleList.hidden = !isSchedule;
  showGrid.replaceChildren();
  if (isSchedule) renderSchedule();
  else for (const show of state.shows) showGrid.append(createShowCard(show));

  const count = isSchedule ? state.episodes.length : state.shows.length;
  showCount.textContent = state.loading ? "載入中…" : isSchedule ? `${count} 集` : `${count} 套`;
  const isEmpty = !state.loading && count === 0;
  emptyState.hidden = !isEmpty;

  if (!isEmpty) return;
  if (state.query) {
    emptyTitle.textContent = "找不到符合的資料";
    emptyCopy.textContent = `目前「${view.title}」沒有符合「${state.query}」的結果。`;
  } else if (isSchedule) {
    emptyTitle.textContent = `${view.title}暫未有已確認集數`;
    emptyCopy.textContent = "TVmaze 暫未提供這個時段的逐集排程；劇集本身仍可在播映中／即將播映檢視查看。";
  } else {
    emptyTitle.textContent = `${view.title}暫未有劇集資料`;
    emptyCopy.textContent = "目前 catalog 沒有符合這個 lifecycle 的劇集。";
  }
}

async function loadCatalog(view, requestId) {
  const params = new URLSearchParams({ status: view.status, limit: "60", region: state.titleRegion });
  if (state.query) params.set("q", state.query);
  const response = await fetch(`/api/shows?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Shows ${response.status}`);
  const payload = await response.json();
  if (requestId !== state.requestId) return;
  state.shows = Array.isArray(payload.data) ? payload.data : [];
  state.episodes = [];
}

async function loadSchedule(view, requestId) {
  const today = localDateKey();
  const from = addDateKeyDays(today, -1);
  const apiDays = Math.min(view.days + 2, 14);
  const params = new URLSearchParams({ from, days: String(apiDays), region: state.titleRegion });
  const response = await fetch(`/api/schedule?${params}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Schedule ${response.status}`);
  const payload = await response.json();
  if (requestId !== state.requestId) return;
  const windowEpisodes = scheduleWindow(payload.data, today, view.days, browserTimeZone);
  state.episodes = windowEpisodes.filter((episode) => matchesScheduleQuery(episode, state.query));
  state.shows = [];
}

async function loadCurrentView() {
  const requestId = ++state.requestId;
  const view = views[state.view];
  state.loading = true;
  render();

  try {
    if (view.type === "schedule") await loadSchedule(view, requestId);
    else await loadCatalog(view, requestId);
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error(error);
    state.shows = [];
    state.episodes = [];
    setHealth("error", view.type === "schedule" ? "排程 API 暫時無法讀取" : "劇集 API 暫時無法讀取");
  } finally {
    if (requestId === state.requestId) {
      state.loading = false;
      render();
    }
  }
}

async function loadSystemStatus() {
  try {
    const [healthResponse, tmdbResponse, tvmazeResponse] = await Promise.all([
      fetch("/health", { cache: "no-store" }),
      fetch("/api/sync-status?source=tmdb", { cache: "no-store" }),
      fetch("/api/sync-status?source=tvmaze", { cache: "no-store" })
    ]);
    if (!healthResponse.ok) throw new Error(`Health ${healthResponse.status}`);
    const health = await healthResponse.json();

    if (health.databaseConfigured && health.databaseReachable && health.tmdbConfigured && health.tvmazeEnabled) {
      setHealth("ok", health.titleAliasPolicy === "phase-3a"
        ? "API 正常 · D1 已連接 · 地區譯名政策已啟用"
        : "API 正常 · D1 已連接 · TMDB + TVmaze 已啟用");
    } else if (health.databaseConfigured && health.databaseReachable && health.tvmazeEnabled) {
      setHealth("warn", "API 正常 · D1 已連接 · TVmaze 排程可用");
    } else if (health.databaseConfigured) {
      setHealth("error", "API 正常 · D1 binding 存在但未能完整查詢");
    } else {
      setHealth("error", "API 正常 · D1 未設定");
    }

    const tmdb = tmdbResponse.ok ? await tmdbResponse.json() : null;
    const tvmaze = tvmazeResponse.ok ? await tvmazeResponse.json() : null;
    const parts = [];
    if (tmdb?.data?.finished_at) parts.push(`TMDB ${formatSyncStamp(tmdb.data.finished_at)}`);
    if (tvmaze?.data?.finished_at) parts.push(`TVmaze ${formatSyncStamp(tvmaze.data.finished_at)}`);
    syncText.textContent = parts.length ? `最近同步：${parts.join(" · ")}` : "尚未有完整同步紀錄";
  } catch (error) {
    console.error(error);
    setHealth("error", "API 暫時無法連線");
  }
}

let searchTimer;
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = searchInput.value.trim();
    loadCurrentView();
  }, 250);
});

titleRegionSelect.addEventListener("change", () => {
  const region = titleRegionSelect.value;
  if (!Object.hasOwn(TITLE_REGION_LABELS, region) || region === state.titleRegion) return;
  state.titleRegion = region;
  saveTitleRegion(region);
  state.shows = [];
  state.episodes = [];
  loadCurrentView();
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === state.view) return;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    state.shows = [];
    state.episodes = [];
    loadCurrentView();
  });
});

render();
loadSystemStatus();
loadCurrentView();