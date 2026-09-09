const discoverButton = document.querySelector("#discover-filter");
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

const STATUS_LABELS = Object.freeze({
  airing: "播映中",
  upcoming: "即將播映",
  planned: "計劃播出",
  completed: "已完結",
  unknown: "狀態待確認"
});

let active = false;
let requestId = 0;

function currentRegion() {
  return new Set(["HK", "TW", "CN"]).has(regionSelect?.value) ? regionSelect.value : "HK";
}

function saveRegion(region) {
  try {
    window.localStorage.setItem("series-hub-title-region", region);
  } catch {
    // Optional preference only.
  }
}

function chineseTitle(show) {
  if (show.display_title_zh) return show.display_title_zh;
  const region = currentRegion().toLowerCase();
  return show[`title_zh_${region}`] || show.title_zh_hk || show.title_zh_tw || show.title_zh_cn || "";
}

function formatDate(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  try {
    return new Intl.DateTimeFormat("zh-HK", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
      .format(new Date(`${value}T00:00:00Z`));
  } catch {
    return value;
  }
}

function createCard(show) {
  const card = document.createElement("article");
  card.className = "show-card discovery-card";
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
  status.textContent = STATUS_LABELS[show.status] || show.tmdb_status || STATUS_LABELS.unknown;
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
  const date = show.status === "upcoming"
    ? formatDate(show.next_air_date || show.first_air_date)
    : formatDate(show.first_air_date);
  meta.textContent = [show.latest_season_number ? `Season ${show.latest_season_number}` : null, show.networks, date]
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

function createSkeletonCard() {
  const card = document.createElement("article");
  card.className = "loading-skeleton-card discovery-card";
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

function createRail(section) {
  const wrapper = document.createElement("section");
  wrapper.className = "discovery-section";
  wrapper.dataset.discoverySection = section.key;

  const heading = document.createElement("div");
  heading.className = "discovery-section-heading";
  const copy = document.createElement("div");
  const title = document.createElement("h4");
  title.textContent = section.title;
  const description = document.createElement("p");
  description.textContent = section.description || "";
  copy.append(title, description);

  const count = document.createElement("span");
  count.textContent = `${section.items.length} 套`;
  heading.append(copy, count);

  const rail = document.createElement("div");
  rail.className = "discovery-rail";
  rail.append(...section.items.map(createCard));
  wrapper.append(heading, rail);
  return wrapper;
}

function renderSkeleton() {
  const sections = ["熱門追看", "近一年新劇", "即將開播", "高評分"].map((title) => {
    const wrapper = document.createElement("section");
    wrapper.className = "discovery-section";
    const heading = document.createElement("div");
    heading.className = "discovery-section-heading";
    const h4 = document.createElement("h4");
    h4.textContent = title;
    heading.append(h4);
    const rail = document.createElement("div");
    rail.className = "discovery-rail";
    rail.append(...Array.from({ length: 5 }, createSkeletonCard));
    wrapper.append(heading, rail);
    return wrapper;
  });
  showGrid.replaceChildren(...sections);
}

function setDiscoveryModeVisuals() {
  document.querySelectorAll(".filter.active, #my-shows-filter.active").forEach((button) => button.classList.remove("active"));
  discoverButton?.classList.add("active");
  if (regionSelect) regionSelect.disabled = false;
  showGrid.hidden = false;
  showGrid.classList.add("is-discovery");
  scheduleList.hidden = true;
  emptyState.hidden = true;
  emptyState.removeAttribute("data-state");
  if (emptyActions) emptyActions.hidden = true;
  if (retryViewButton) retryViewButton.hidden = true;
  viewKicker.textContent = "DISCOVER";
  viewTitle.textContent = "探索劇集";
  viewContext.textContent = "從已收錄的美劇 catalog 即時整理熱門、新劇、即將開播與高評分內容；不額外呼叫 TMDB discovery。";
}

function leaveDiscoveryMode() {
  if (!active) return;
  active = false;
  requestId += 1;
  discoverButton?.classList.remove("active");
  showGrid?.classList.remove("is-discovery");
}

function releaseGlobalSearch() {
  if (!searchInput?.value) return;
  const bridge = document.createElement("button");
  bridge.type = "button";
  bridge.hidden = true;
  bridge.className = "filter";
  bridge.dataset.view = "phase8-bridge";
  document.body.append(bridge);
  bridge.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  bridge.remove();
  searchInput.value = "";
}

async function fetchDiscovery(region, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const params = new URLSearchParams({ region, limit: "12" });
    const response = await fetch(`/api/discover?${params}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Discover ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function loadDiscovery() {
  active = true;
  const activeRequest = ++requestId;
  const region = currentRegion();
  setDiscoveryModeVisuals();
  contentPanel?.setAttribute("aria-busy", "true");
  showCount.textContent = "整理中…";
  renderSkeleton();

  try {
    const payload = await fetchDiscovery(region);
    if (!active || activeRequest !== requestId || currentRegion() !== region) return;
    const sections = (Array.isArray(payload?.data?.sections) ? payload.data.sections : [])
      .filter((section) => Array.isArray(section?.items) && section.items.length > 0);

    showGrid.replaceChildren(...sections.map(createRail));
    showCount.textContent = `${sections.length} 組精選`;
    emptyState.hidden = sections.length !== 0;
    if (sections.length === 0) {
      emptyTitle.textContent = "暫未能整理探索內容";
      emptyCopy.textContent = "目前 catalog 沒有足夠資料建立探索分類；原有今日、本週及劇集列表仍可正常使用。";
    }
  } catch (error) {
    if (!active || activeRequest !== requestId) return;
    console.error(error);
    showGrid.replaceChildren();
    showCount.textContent = "載入失敗";
    emptyState.hidden = false;
    emptyState.dataset.state = "error";
    emptyTitle.textContent = "探索內容暫時無法使用";
    emptyCopy.textContent = error?.name === "AbortError"
      ? "探索資料等候超過 12 秒，請稍後再試。"
      : "探索 API 暫時無法回應；其他 Series Hub 功能不受影響。";
  } finally {
    if (active && activeRequest === requestId) contentPanel?.setAttribute("aria-busy", "false");
  }
}

if (discoverButton && regionSelect && contentPanel && showGrid && scheduleList && emptyState) {
  discoverButton.addEventListener("click", () => {
    releaseGlobalSearch();
    loadDiscovery();
  });

  window.addEventListener("input", (event) => {
    if (event.target === searchInput && active) leaveDiscoveryMode();
  }, true);

  window.addEventListener("change", (event) => {
    if (event.target !== regionSelect || !active) return;
    event.stopImmediatePropagation();
    saveRegion(currentRegion());
    loadDiscovery();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const regularControl = target?.closest(".filter[data-view], #my-shows-filter");
    if (regularControl && active) leaveDiscoveryMode();
  }, true);
}
