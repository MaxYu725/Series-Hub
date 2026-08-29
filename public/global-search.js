const searchInput = document.querySelector("#search-input");
const regionSelect = document.querySelector("#title-region-select");
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
const myShowsButton = document.querySelector("#my-shows-filter");

const REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });
const STATUS_LABELS = Object.freeze({
  airing: "播映中",
  upcoming: "即將播映",
  planned: "計劃播出",
  completed: "已完結",
  unknown: "狀態待確認"
});

let active = false;
let previousView = "today";
let previousWasMyShows = false;
let previousRegionDisabled = false;
let initialRegion = regionSelect?.value || "HK";
let requestId = 0;
let searchTimer = null;
let allowUnderlyingRegionChange = false;
let deferredRegionSync = false;

function saveRegion(region) {
  try {
    window.localStorage.setItem("series-hub-title-region", region);
  } catch {
    // Region persistence is optional; the active select value still works.
  }
}

function currentRegion() {
  return Object.hasOwn(REGION_LABELS, regionSelect?.value) ? regionSelect.value : "HK";
}

function currentQuery() {
  return searchInput?.value.trim() || "";
}

function setGlobalSearchHeading(query) {
  viewKicker.textContent = "SEARCH";
  viewTitle.textContent = "搜尋結果";
  viewContext.textContent = `正在搜尋整個劇集庫，包括劇名、中文譯名及單集名稱。搜尋字：${query}`;
}

function setSearchModeVisuals() {
  document.querySelectorAll(".filter.active, #my-shows-filter.active").forEach((button) => button.classList.remove("active"));
  if (regionSelect) regionSelect.disabled = false;
  showGrid.hidden = false;
  scheduleList.hidden = true;
  emptyState.hidden = true;
  emptyState.removeAttribute("data-state");
  if (emptyActions) emptyActions.hidden = true;
  if (retryViewButton) retryViewButton.hidden = true;
}

function createSkeletonCard() {
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

function chineseTitle(show) {
  if (show.display_title_zh) return show.display_title_zh;
  const region = currentRegion().toLowerCase();
  return show[`title_zh_${region}`] || show.title_zh_hk || show.title_zh_tw || show.title_zh_cn || "";
}

function episodeMatchLabel(show) {
  if (!show.search_match_episode) return null;
  const season = Number(show.search_match_season_number);
  const episode = Number(show.search_match_episode_number);
  const code = Number.isInteger(season) && season > 0 && Number.isInteger(episode) && episode > 0
    ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
    : null;
  return `單集命中：${[code, show.search_match_episode].filter(Boolean).join(" · ")}`;
}

function createSearchCard(show) {
  const card = document.createElement("article");
  card.className = "show-card";
  card.dataset.showId = String(show.id);

  const imageWrap = document.createElement("div");
  imageWrap.className = "poster-wrap";
  if (show.poster_url) {
    const image = document.createElement("img");
    image.className = "poster";
    image.src = show.poster_url;
    image.alt = `${show.english_title || show.original_title || "Series Hub"} poster`;
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
  status.textContent = STATUS_LABELS[show.status] || show.tmdb_status || "狀態待確認";
  imageWrap.append(status);

  const body = document.createElement("div");
  body.className = "show-card-body";
  const title = document.createElement("h4");
  title.textContent = show.english_title || show.original_title || "劇名待補";
  const zh = document.createElement("p");
  zh.className = "chinese-title";
  zh.textContent = chineseTitle(show) || "中文譯名待補";
  const meta = document.createElement("div");
  meta.className = "show-meta";
  meta.textContent = [show.latest_season_number ? `Season ${show.latest_season_number}` : null, show.networks]
    .filter(Boolean)
    .join(" · ") || "平台資料待補";

  body.append(title, zh, meta);
  const episodeMatch = episodeMatchLabel(show);
  if (episodeMatch) {
    const note = document.createElement("p");
    note.className = "show-schedule-note is-confirmed";
    note.textContent = episodeMatch;
    body.append(note);
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
    genre.textContent = String(show.genres).split(" · ").slice(0, 2).join(" · ");
    footer.append(genre);
  }
  body.append(footer);
  card.append(imageWrap, body);
  return card;
}

async function fetchSearch(query, region, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({ q: query, region, limit: "100" });
    const response = await fetch(`/api/search?${params}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Search ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function runGlobalSearch(query) {
  if (!active || !query) return;
  const activeRequest = ++requestId;
  const region = currentRegion();
  setSearchModeVisuals();
  setGlobalSearchHeading(query);
  contentPanel?.setAttribute("aria-busy", "true");
  showCount.textContent = "搜尋中…";
  showGrid.replaceChildren(...Array.from({ length: 4 }, createSkeletonCard));

  try {
    const payload = await fetchSearch(query, region);
    if (!active || activeRequest !== requestId || currentQuery() !== query || currentRegion() !== region) return;
    const shows = Array.isArray(payload?.data) ? payload.data : [];
    showGrid.replaceChildren(...shows.map(createSearchCard));
    showCount.textContent = `${shows.length} 套`;
    emptyState.hidden = shows.length !== 0;
    if (shows.length === 0) {
      emptyTitle.textContent = "整個劇集庫找不到符合的劇集";
      emptyCopy.textContent = `沒有任何劇集名稱、中文譯名或單集名稱符合「${query}」。請檢查拼字，或目前資料庫尚未收錄該劇。`;
    }
  } catch (error) {
    if (!active || activeRequest !== requestId) return;
    console.error(error);
    showGrid.replaceChildren();
    showCount.textContent = "搜尋失敗";
    emptyState.hidden = false;
    emptyState.dataset.state = "error";
    emptyTitle.textContent = "全域搜尋暫時無法使用";
    emptyCopy.textContent = error?.name === "AbortError"
      ? "搜尋等候超過 12 秒，請稍後再試。"
      : "網絡或搜尋 API 暫時無法回應；原有劇集資料不受影響。";
  } finally {
    if (active && activeRequest === requestId) contentPanel?.setAttribute("aria-busy", "false");
  }
}

function syncUnderlyingRegion() {
  if (!regionSelect || currentRegion() === initialRegion) return;
  allowUnderlyingRegionChange = true;
  regionSelect.disabled = false;
  regionSelect.dispatchEvent(new Event("change", { bubbles: true }));
  allowUnderlyingRegionChange = false;
  initialRegion = currentRegion();
}

function enterSearchMode() {
  if (active) return;
  active = true;
  const activeFilter = document.querySelector(".filter.active[data-view]");
  previousView = activeFilter?.dataset.view || "today";
  previousWasMyShows = myShowsButton?.classList.contains("active") === true;
  previousRegionDisabled = regionSelect?.disabled === true;
  initialRegion = currentRegion();
  setSearchModeVisuals();
}

function restoreAfterClear() {
  if (!active) return;
  active = false;
  requestId += 1;
  window.clearTimeout(searchTimer);

  if (previousWasMyShows) {
    deferredRegionSync = currentRegion() !== initialRegion;
    if (regionSelect) regionSelect.disabled = previousRegionDisabled;
    myShowsButton?.click();
    return;
  }

  syncUnderlyingRegion();
  if (regionSelect) regionSelect.disabled = false;
  document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button.dataset.view === previousView));
  window.dispatchEvent(new CustomEvent("series-hub:retry", { detail: { view: previousView } }));
}

function leaveSearchForControl(control) {
  if (!active) return;
  active = false;
  requestId += 1;
  window.clearTimeout(searchTimer);
  if (searchInput) searchInput.value = "";

  const regularFilter = control?.matches(".filter[data-view]") === true;
  if (regularFilter) {
    syncUnderlyingRegion();
    deferredRegionSync = false;
    if (regionSelect) regionSelect.disabled = false;
  } else if (currentRegion() !== initialRegion) {
    deferredRegionSync = true;
  }
}

if (searchInput && regionSelect && contentPanel && showGrid && scheduleList && emptyState) {
  document.addEventListener("input", (event) => {
    if (event.target !== searchInput) return;
    event.stopImmediatePropagation();
    window.clearTimeout(searchTimer);
    const query = currentQuery();
    if (!query) {
      restoreAfterClear();
      return;
    }
    enterSearchMode();
    setSearchModeVisuals();
    setGlobalSearchHeading(query);
    searchTimer = window.setTimeout(() => runGlobalSearch(query), 250);
  }, true);

  document.addEventListener("change", (event) => {
    if (event.target !== regionSelect || !active || allowUnderlyingRegionChange) return;
    event.stopImmediatePropagation();
    saveRegion(currentRegion());
    window.clearTimeout(searchTimer);
    const query = currentQuery();
    if (query) searchTimer = window.setTimeout(() => runGlobalSearch(query), 0);
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest(".filter[data-view], #my-shows-filter");
    if (!control) return;

    if (active) {
      leaveSearchForControl(control);
      return;
    }

    if (deferredRegionSync && control.matches(".filter[data-view]")) {
      syncUnderlyingRegion();
      deferredRegionSync = false;
    }
  }, true);
}
