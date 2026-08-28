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
  error: null,
  requestId: 0
};

const healthText = document.querySelector("#health-text");
const syncText = document.querySelector("#sync-text");
const statusDot = document.querySelector("#status-dot");
const contentPanel = document.querySelector(".content-panel");
const viewTitle = document.querySelector("#view-title");
const viewKicker = document.querySelector("#view-kicker");
const viewContext = document.querySelector("#view-context");
const showCount = document.querySelector("#show-count");
const showGrid = document.querySelector("#show-grid");
const scheduleList = document.querySelector("#schedule-list");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const emptyActions = document.querySelector("#empty-actions");
const retryViewButton = document.querySelector("#retry-view-button");
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

function formatLocalDateTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("zh-HK", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
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

function showEpisodeCode(show) {
  const season = Number(show.tvmaze_next_episode_season_number);
  const episode = Number(show.tvmaze_next_episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(episode) || episode < 1) return null;
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

function statusLine(show) {
  const tvmazeDate = show.tvmaze_next_episode_date || null;
  const tmdbDate = show.next_air_date || null;
  const exact = formatLocalDateTime(show.tvmaze_next_episode_timestamp);

  if (show.status === "airing") {
    if (exact) return `下集 ${exact}`;
    if (tvmazeDate) {
      return show.tvmaze_next_episode_air_time
        ? `下集 ${formatDate(tvmazeDate)} · 原播 ${show.tvmaze_next_episode_air_time}`
        : `下集 ${formatDate(tvmazeDate)} · 時間待定`;
    }
    if (tmdbDate) return `下集 ${formatDate(tmdbDate)} · 時間待確認`;
    if (show.tvmaze_last_episode_date) return `最近一集 ${formatDate(show.tvmaze_last_episode_date)} · 下集待確認`;
    return "播映中 · 下集待確認";
  }
  if (show.status === "upcoming") {
    if (exact) return `首播 ${exact}`;
    const scheduleDate = tvmazeDate || tmdbDate;
    return scheduleDate ? `首播 ${formatDate(scheduleDate)}` : "已公布播映日期";
  }
  if (show.status === "planned") return "已續訂／製作中 · 日期待定";
  return show.tmdb_status || show.status || "狀態待確認";
}

function scheduleNote(show) {
  const code = showEpisodeCode(show);
  const name = show.tvmaze_next_episode_name || null;
  if (show.tvmaze_next_episode_timestamp) {
    return {
      text: [code, name, "TVmaze 已確認逐集時間"].filter(Boolean).join(" · "),
      confirmed: true
    };
  }
  if (show.tvmaze_next_episode_date) {
    return {
      text: [code, name, "逐集日期已確認，時間待定"].filter(Boolean).join(" · "),
      confirmed: false
    };
  }
  if (show.status === "airing") {
    return {
      text: "TVmaze 暫未有下一集排程；不會推測或補造播映時間。",
      confirmed: false
    };
  }
  return null;
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

  const timing = scheduleNote(show);
  const timingNote = timing ? document.createElement("p") : null;
  if (timingNote) {
    timingNote.className = timing.confirmed ? "show-schedule-note is-confirmed" : "show-schedule-note";
    timingNote.textContent = timing.text;
  }

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

  body.append(title, zhTitle, meta);
  if (timingNote) body.append(timingNote);
  body.append(footer);
  card.append(imageWrap, body);
  return card;
}

function createSchedulePoster(episode) {
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
  return posterWrap;
}

function scheduleBatchLabel(episodes) {
  if (episodes.length <= 1) return null;
  const timingKeys = episodes
    .map((episode) => episode.air_timestamp || (episode.air_date && episode.air_time ? `${episode.air_date}T${episode.air_time}` : null))
    .filter(Boolean);
  const sameTime = timingKeys.length === episodes.length && new Set(timingKeys).size === 1;
  return sameTime ? `一次上架 ${episodes.length} 集` : `同日播映 ${episodes.length} 集`;
}

function createScheduleShowHeader(episodes) {
  const episode = episodes[0];
  const header = document.createElement("div");
  header.className = "schedule-show-header";
  header.append(createSchedulePoster(episode));

  const copy = document.createElement("div");
  copy.className = "schedule-show-copy";
  const zh = chineseTitle(episode);
  const title = document.createElement("h4");
  title.textContent = zh || episode.english_title || episode.original_title;
  copy.append(title);

  if (zh && episode.english_title) {
    const english = document.createElement("p");
    english.className = "schedule-english";
    english.textContent = episode.english_title;
    appendTitleSourceNote(english, episode);
    copy.append(english);
  }

  const meta = document.createElement("div");
  meta.className = "schedule-meta";
  if (episode.networks) {
    const network = document.createElement("span");
    network.textContent = episode.networks;
    meta.append(network);
  }
  copy.append(meta);

  const batchLabel = scheduleBatchLabel(episodes);
  if (batchLabel) {
    const batch = document.createElement("span");
    batch.className = "schedule-batch-label";
    batch.textContent = batchLabel;
    copy.append(batch);
  }

  header.append(copy);
  return header;
}

function createScheduleRow(episode) {
  const row = document.createElement("div");
  row.className = "schedule-row";
  row.dataset.showId = String(episode.show_id || "");

  const body = document.createElement("div");
  body.className = "schedule-body";
  const episodeLine = document.createElement("p");
  episodeLine.className = "episode-line";
  episodeLine.textContent = [episodeCode(episode), episode.episode_name].filter(Boolean).join(" · ") || "集數資料待補";
  body.append(episodeLine);

  if (Number(episode.runtime_minutes) > 0) {
    const meta = document.createElement("div");
    meta.className = "schedule-meta";
    const runtime = document.createElement("span");
    runtime.textContent = `${Number(episode.runtime_minutes)} 分鐘`;
    meta.append(runtime);
    body.append(meta);
  }

  const side = document.createElement("div");
  side.className = "schedule-side";
  const time = formatEpisodeTime(episode);
  const timeText = document.createElement("strong");
  timeText.className = time.exactLocal ? "schedule-time exact" : "schedule-time";
  timeText.textContent = time.text;
  side.append(timeText);

  const timeNote = document.createElement("span");
  timeNote.className = "schedule-time-note";
  timeNote.textContent = time.exactLocal ? "本地時間" : "TVmaze 來源時間";
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

  row.append(body, side);
  return row;
}

function createScheduleShowGroup(episodes) {
  const group = document.createElement("article");
  group.className = "schedule-show-group";
  group.dataset.showId = String(episodes[0]?.show_id || "");
  group.append(createScheduleShowHeader(episodes));

  const episodeList = document.createElement("div");
  episodeList.className = "schedule-episode-list";
  for (const episode of episodes) episodeList.append(createScheduleRow(episode));
  group.append(episodeList);
  return group;
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
  const dateGroups = new Map();
  for (const episode of state.episodes) {
    const dateKey = episodeLocalDateKey(episode, browserTimeZone) || episode.air_date || "unknown";
    if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, []);
    dateGroups.get(dateKey).push(episode);
  }

  for (const [dateKey, episodes] of dateGroups) {
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
    const showGroups = new Map();
    for (const episode of episodes) {
      const key = Number.isSafeInteger(Number(episode.show_id))
        ? `show:${Number(episode.show_id)}`
        : `title:${episode.english_title || episode.original_title || "unknown"}`;
      if (!showGroups.has(key)) showGroups.set(key, []);
      showGroups.get(key).push(episode);
    }
    for (const groupedEpisodes of showGroups.values()) rows.append(createScheduleShowGroup(groupedEpisodes));

    day.append(heading, rows);
    scheduleList.append(day);
  }
}

function createCatalogSkeleton() {
  const card = document.createElement("article");
  card.className = "loading-skeleton-card";
  card.setAttribute("aria-hidden", "true");
  const poster = document.createElement("div");
  poster.className = "loading-skeleton-poster";
  const lines = document.createElement("div");
  lines.className = "loading-skeleton-lines";
  for (const className of ["loading-skeleton-line", "loading-skeleton-line short", "loading-skeleton-line tiny"]) {
    const line = document.createElement("div");
    line.className = className;
    lines.append(line);
  }
  card.append(poster, lines);
  return card;
}

function createScheduleSkeletonRow() {
  const row = document.createElement("div");
  row.className = "loading-skeleton-row";
  row.setAttribute("aria-hidden", "true");
  const thumb = document.createElement("div");
  thumb.className = "loading-skeleton-thumb";
  const lines = document.createElement("div");
  lines.className = "loading-skeleton-lines";
  for (const className of ["loading-skeleton-line", "loading-skeleton-line short", "loading-skeleton-line tiny"]) {
    const line = document.createElement("div");
    line.className = className;
    lines.append(line);
  }
  const time = document.createElement("div");
  time.className = "loading-skeleton-time";
  row.append(thumb, lines, time);
  return row;
}

function renderLoadingPlaceholders(isSchedule) {
  if (!state.loading) return;
  if (isSchedule && state.episodes.length === 0) {
    const shell = document.createElement("div");
    shell.className = "loading-skeleton-list";
    for (let index = 0; index < 4; index += 1) shell.append(createScheduleSkeletonRow());
    scheduleList.replaceChildren(shell);
  } else if (!isSchedule && state.shows.length === 0) {
    showGrid.replaceChildren(...Array.from({ length: 6 }, createCatalogSkeleton));
  }
}

function render() {
  const view = views[state.view];
  const isSchedule = view.type === "schedule";
  const regionLabel = TITLE_REGION_LABELS[state.titleRegion];
  viewTitle.textContent = view.title;
  viewKicker.textContent = view.kicker;
  viewContext.textContent = isSchedule
    ? `中文名優先使用${regionLabel}譯名；同日多集會合併為一張劇集卡，精確時間按 ${browserTimeZone} 顯示。`
    : `中文名優先使用${regionLabel}譯名；播映中劇集會直接顯示下一集已確認時間，未有逐集資料時明確標示待確認。`;

  contentPanel?.setAttribute("aria-busy", String(state.loading));
  emptyState.removeAttribute("data-state");
  emptyActions.hidden = true;
  retryViewButton.hidden = true;
  showGrid.hidden = isSchedule;
  scheduleList.hidden = !isSchedule;
  showGrid.replaceChildren();
  if (isSchedule) renderSchedule();
  else for (const show of state.shows) showGrid.append(createShowCard(show));
  renderLoadingPlaceholders(isSchedule);

  const count = isSchedule ? state.episodes.length : state.shows.length;
  showCount.textContent = state.loading ? "載入中…" : isSchedule ? `${count} 集` : `${count} 套`;
  if (state.loading) {
    emptyState.hidden = true;
    return;
  }

  if (state.error) {
    emptyState.hidden = false;
    emptyState.dataset.state = "error";
    emptyTitle.textContent = isSchedule ? "排程暫時無法載入" : "劇集暫時無法載入";
    emptyCopy.textContent = state.error === "timeout"
      ? "連線等候超過 12 秒。可立即重試；追蹤及追劇狀態不受影響。"
      : "網絡或 API 暫時無法回應。可立即重試；本機追蹤資料不會被清除。";
    emptyActions.hidden = false;
    retryViewButton.hidden = false;
    return;
  }

  const isEmpty = count === 0;
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

async function fetchJson(url, label, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`${label} ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadCatalog(view, requestId) {
  const params = new URLSearchParams({ status: view.status, limit: "60", region: state.titleRegion });
  if (state.query) params.set("q", state.query);
  const payload = await fetchJson(`/api/shows?${params}`, "Shows");
  if (requestId !== state.requestId) return;
  state.shows = Array.isArray(payload.data) ? payload.data : [];
  state.episodes = [];
}

async function loadSchedule(view, requestId) {
  const today = localDateKey();
  const from = addDateKeyDays(today, -1);
  const apiDays = Math.min(view.days + 2, 14);
  const params = new URLSearchParams({ from, days: String(apiDays), region: state.titleRegion });
  const payload = await fetchJson(`/api/schedule?${params}`, "Schedule");
  if (requestId !== state.requestId) return;
  const windowEpisodes = scheduleWindow(payload.data, today, view.days, browserTimeZone);
  state.episodes = windowEpisodes.filter((episode) => matchesScheduleQuery(episode, state.query));
  state.shows = [];
}

async function loadCurrentView() {
  const requestId = ++state.requestId;
  const view = views[state.view];
  state.loading = true;
  state.error = null;
  render();

  try {
    if (view.type === "schedule") await loadSchedule(view, requestId);
    else await loadCatalog(view, requestId);
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error(error);
    state.shows = [];
    state.episodes = [];
    state.error = error?.name === "AbortError" ? "timeout" : "request";
    setHealth("error", view.type === "schedule" ? "排程 API 暫時無法讀取" : "劇集 API 暫時無法讀取");
  } finally {
    if (requestId === state.requestId) {
      state.loading = false;
      render();
      if (!state.error && statusDot.classList.contains("error")) loadSystemStatus();
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

window.addEventListener("series-hub:retry", (event) => {
  if (event?.detail?.view === "my-shows") return;
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
