import {
  isTrackedShow,
  loadTrackedShowIds,
  saveTrackedShowIds,
  toggleTrackedShowId
} from "./tracking.js";

const STATUS_ORDER = ["airing", "upcoming", "planned"];
const TITLE_REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });

function boot() {
  const myButton = document.querySelector("#my-shows-filter");
  const showGrid = document.querySelector("#show-grid");
  const scheduleList = document.querySelector("#schedule-list");
  const viewTitle = document.querySelector("#view-title");
  const viewKicker = document.querySelector("#view-kicker");
  const viewContext = document.querySelector("#view-context");
  const showCount = document.querySelector("#show-count");
  const emptyState = document.querySelector("#empty-state");
  const emptyTitle = document.querySelector("#empty-title");
  const emptyCopy = document.querySelector("#empty-copy");
  const searchInput = document.querySelector("#search-input");
  const regionSelect = document.querySelector("#title-region-select");
  if (!myButton || !showGrid || !scheduleList || !viewTitle || !searchInput || !regionSelect) return;

  let trackedIds = loadTrackedShowIds();
  let myActive = false;
  let requestId = 0;
  let searchTimer = null;

  function titleRegion() {
    return Object.hasOwn(TITLE_REGION_LABELS, regionSelect.value) ? regionSelect.value : "HK";
  }

  function chineseTitle(show) {
    if (show.display_title_zh) return show.display_title_zh;
    const region = titleRegion().toLowerCase();
    return show[`title_zh_${region}`] || show.title_zh_hk || show.title_zh_tw || show.title_zh_cn || "";
  }

  function syncTrackingButton(button, showId) {
    const active = isTrackedShow(trackedIds, showId);
    const pressed = String(active);
    const label = active ? "取消追蹤此劇集" : "追蹤此劇集";
    const text = active ? "✓ 已追蹤" : "+ 追蹤";

    if (button.getAttribute("aria-pressed") !== pressed) button.setAttribute("aria-pressed", pressed);
    if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
    if (button.textContent !== text) button.textContent = text;
  }

  function createTrackingButton(showId) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tracking-toggle";
    button.dataset.trackShowId = String(showId);
    syncTrackingButton(button, showId);
    return button;
  }

  function decorateTrackingButtons() {
    for (const card of showGrid.querySelectorAll(".show-card[data-show-id]")) {
      const showId = Number(card.dataset.showId);
      let button = card.querySelector(":scope .tracking-toggle");
      if (!button) {
        button = createTrackingButton(showId);
        const imageWrap = card.querySelector(":scope .poster-wrap");
        if (imageWrap) imageWrap.append(button);
        else card.prepend(button);
      } else {
        syncTrackingButton(button, showId);
      }
    }
  }

  function createMyCard(show) {
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
    status.textContent = show.status === "airing" ? "播映中" : show.status === "upcoming" ? "即將播映" : "計劃播出";
    imageWrap.append(status, createTrackingButton(show.id));

    const body = document.createElement("div");
    body.className = "show-card-body";
    const title = document.createElement("h4");
    title.textContent = show.english_title || show.original_title;
    const zh = document.createElement("p");
    zh.className = "chinese-title";
    zh.textContent = chineseTitle(show) || "中文譯名待補";
    const meta = document.createElement("div");
    meta.className = "show-meta";
    meta.textContent = [show.latest_season_number ? `Season ${show.latest_season_number}` : null, show.networks]
      .filter(Boolean)
      .join(" · ") || "平台資料待補";
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
    body.append(title, zh, meta, footer);
    card.append(imageWrap, body);
    return card;
  }

  function renderEmpty() {
    const empty = trackedIds.length === 0;
    emptyState.hidden = !empty;
    if (!empty) return;
    emptyTitle.textContent = "尚未追蹤任何劇集";
    emptyCopy.textContent = "到播映中、即將播映或計劃播出，按「+ 追蹤」即可加入我的劇集。";
  }

  async function loadMyShows() {
    const activeRequest = ++requestId;
    showGrid.hidden = false;
    scheduleList.hidden = true;
    showGrid.replaceChildren();
    emptyState.hidden = true;
    showCount.textContent = "載入中…";
    viewKicker.textContent = "MY SHOWS";
    viewTitle.textContent = "我的劇集";
    viewContext.textContent = `只儲存在這個瀏覽器；中文名沿用目前${TITLE_REGION_LABELS[titleRegion()]}譯名設定。`;

    if (trackedIds.length === 0) {
      showCount.textContent = "0 套";
      renderEmpty();
      return;
    }

    try {
      const responses = await Promise.all(STATUS_ORDER.map((status) => {
        const params = new URLSearchParams({ status, limit: "100", region: titleRegion() });
        const query = searchInput.value.trim();
        if (query) params.set("q", query);
        return fetch(`/api/shows?${params}`, { cache: "no-store" });
      }));
      if (activeRequest !== requestId || !myActive) return;
      for (const response of responses) if (!response.ok) throw new Error(`Shows ${response.status}`);
      const payloads = await Promise.all(responses.map((response) => response.json()));
      if (activeRequest !== requestId || !myActive) return;

      const tracked = new Set(trackedIds);
      const seen = new Set();
      const shows = [];
      for (const payload of payloads) {
        for (const show of Array.isArray(payload.data) ? payload.data : []) {
          const id = Number(show.id);
          if (!tracked.has(id) || seen.has(id)) continue;
          seen.add(id);
          shows.push(show);
        }
      }

      showGrid.replaceChildren(...shows.map(createMyCard));
      showCount.textContent = `${shows.length} 套`;
      emptyState.hidden = shows.length !== 0;
      if (shows.length === 0) {
        emptyTitle.textContent = searchInput.value.trim() ? "找不到符合的追蹤劇集" : "追蹤劇集暫未在活動 catalog";
        emptyCopy.textContent = searchInput.value.trim()
          ? `目前沒有追蹤劇集符合「${searchInput.value.trim()}」。`
          : "追蹤 ID 仍保留在瀏覽器，劇集重新進入活動 catalog 後會再次顯示。";
      }
      decorateTrackingButtons();
    } catch (error) {
      if (activeRequest !== requestId || !myActive) return;
      console.error(error);
      showCount.textContent = "讀取失敗";
      emptyState.hidden = false;
      emptyTitle.textContent = "我的劇集暫時無法讀取";
      emptyCopy.textContent = "追蹤清單仍保留在這個瀏覽器，稍後重新開啟即可。";
    }
  }

  function enterMyShows(event) {
    event?.preventDefault();
    event?.stopImmediatePropagation();
    myActive = true;
    regionSelect.disabled = true;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    myButton.classList.add("active");
    loadMyShows();
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const regularFilter = target?.closest(".filter[data-view]");
    if (regularFilter) {
      myActive = false;
      regionSelect.disabled = false;
      myButton.classList.remove("active");
      requestId += 1;
      return;
    }

    if (target?.closest("#my-shows-filter")) {
      enterMyShows(event);
      return;
    }

    const tracking = target?.closest(".tracking-toggle[data-track-show-id]");
    if (!tracking) return;
    event.preventDefault();
    event.stopPropagation();
    const showId = Number(tracking.dataset.trackShowId);
    trackedIds = saveTrackedShowIds(toggleTrackedShowId(trackedIds, showId));
    decorateTrackingButtons();
    if (myActive) loadMyShows();
  }, true);

  document.addEventListener("input", (event) => {
    if (!myActive || event.target !== searchInput) return;
    event.stopImmediatePropagation();
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadMyShows, 250);
  }, true);

  const observer = new MutationObserver(() => {
    if (!myActive) decorateTrackingButtons();
  });
  observer.observe(showGrid, { childList: true });
  decorateTrackingButtons();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
