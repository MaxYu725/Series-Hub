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
const exploreTools = document.querySelector("#phase8-explore-tools");
const featuredToggle = document.querySelector("#phase8-featured-toggle");
const browseToggle = document.querySelector("#phase8-browse-toggle");
const browseControls = document.querySelector("#phase8-browse-controls");
const networkFilter = document.querySelector("#phase8-network-filter");
const genreFilter = document.querySelector("#phase8-genre-filter");
const statusFilter = document.querySelector("#phase8-status-filter");
const yearFilter = document.querySelector("#phase8-year-filter");
const sortFilter = document.querySelector("#phase8-sort-filter");
const resetFilters = document.querySelector("#phase8-reset-filters");

const STATUS_LABELS = Object.freeze({
  airing: "播映中",
  upcoming: "即將播映",
  planned: "計劃播出",
  completed: "已完結",
  unknown: "狀態待確認"
});

let active = false;
let mode = "featured";
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

function renderFeaturedSkeleton() {
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

function renderBrowseSkeleton() {
  showGrid.replaceChildren(...Array.from({ length: 12 }, createSkeletonCard));
}

function setModeVisuals(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".filter.active, #my-shows-filter.active").forEach((button) => button.classList.remove("active"));
  discoverButton?.classList.add("active");
  featuredToggle?.classList.toggle("active", mode === "featured");
  browseToggle?.classList.toggle("active", mode === "browse");
  if (exploreTools) exploreTools.hidden = false;
  if (browseControls) browseControls.hidden = mode !== "browse";
  if (regionSelect) regionSelect.disabled = false;
  showGrid.hidden = false;
  showGrid.classList.toggle("is-discovery", mode === "featured");
  showGrid.classList.toggle("is-browse", mode === "browse");
  scheduleList.hidden = true;
  emptyState.hidden = true;
  emptyState.removeAttribute("data-state");
  if (emptyActions) emptyActions.hidden = true;
  if (retryViewButton) retryViewButton.hidden = true;
  viewKicker.textContent = "DISCOVER";
  viewTitle.textContent = mode === "browse" ? "瀏覽全部劇集" : "探索劇集";
  viewContext.textContent = mode === "browse"
    ? "按原始平台、類型、狀態及首播年份篩選 Series Hub catalog；地區觀看供應仍由劇集詳情頁獨立顯示。"
    : "從已收錄的美劇 catalog 即時整理熱門、新劇、即將開播與高評分內容；不額外呼叫 TMDB discovery。";
}

function leaveDiscoveryMode() {
  if (!active) return;
  active = false;
  requestId += 1;
  discoverButton?.classList.remove("active");
  showGrid?.classList.remove("is-discovery", "is-browse");
  if (exploreTools) exploreTools.hidden = true;
  if (browseControls) browseControls.hidden = true;
}

function releaseGlobalSearch() {
  if (!searchInput?.value) return;
  window.dispatchEvent(new CustomEvent("series-hub:leave-global-search"));
}

async function fetchFeatured(region, timeoutMs = 12000) {
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

function browseFilterValues() {
  return {
    network: networkFilter?.value || "",
    genre: genreFilter?.value || "",
    status: statusFilter?.value || "",
    year: yearFilter?.value || "",
    sort: sortFilter?.value || "popular"
  };
}

async function fetchBrowse(region, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const filters = browseFilterValues();
    const params = new URLSearchParams({ region, mode: "browse", limit: "80", sort: filters.sort });
    for (const key of ["network", "genre", "status", "year"]) {
      if (filters[key]) params.set(key, filters[key]);
    }
    const response = await fetch(`/api/discover?${params}`, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Browse ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function populateFacetSelect(select, options, firstLabel) {
  if (!select || !Array.isArray(options)) return;
  const selected = select.value;
  const nodes = [new Option(firstLabel, "")];
  for (const item of options) {
    if (!item?.value) continue;
    nodes.push(new Option(`${item.label || item.value} (${Number(item.count) || 0})`, item.value));
  }
  select.replaceChildren(...nodes);
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function populateFacets(facets) {
  populateFacetSelect(networkFilter, facets?.networks, "全部平台");
  populateFacetSelect(genreFilter, facets?.genres, "全部類型");
  populateFacetSelect(statusFilter, facets?.statuses, "全部狀態");
  populateFacetSelect(yearFilter, facets?.years, "全部年份");
}

async function loadFeatured() {
  active = true;
  setModeVisuals("featured");
  const activeRequest = ++requestId;
  const region = currentRegion();
  contentPanel?.setAttribute("aria-busy", "true");
  showCount.textContent = "整理中…";
  renderFeaturedSkeleton();

  try {
    const payload = await fetchFeatured(region);
    if (!active || mode !== "featured" || activeRequest !== requestId || currentRegion() !== region) return;
    const sections = (Array.isArray(payload?.data?.sections) ? payload.data.sections : [])
      .filter((section) => Array.isArray(section?.items) && section.items.length > 0);

    showGrid.replaceChildren(...sections.map(createRail));
    showCount.textContent = `${sections.length} 組精選`;
    emptyState.hidden = sections.length !== 0;
    if (sections.length === 0) {
      emptyTitle.textContent = "暫未能整理探索內容";
      emptyCopy.textContent = "目前 catalog 沒有足夠資料建立探索分類；可切換至「全部劇集」瀏覽現有收錄。";
    }
  } catch (error) {
    if (!active || mode !== "featured" || activeRequest !== requestId) return;
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
    if (active && mode === "featured" && activeRequest === requestId) contentPanel?.setAttribute("aria-busy", "false");
  }
}

async function loadBrowse() {
  active = true;
  setModeVisuals("browse");
  const activeRequest = ++requestId;
  const region = currentRegion();
  contentPanel?.setAttribute("aria-busy", "true");
  showCount.textContent = "篩選中…";
  renderBrowseSkeleton();

  try {
    const payload = await fetchBrowse(region);
    if (!active || mode !== "browse" || activeRequest !== requestId || currentRegion() !== region) return;
    const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
    populateFacets(payload?.data?.facets);
    showGrid.replaceChildren(...items.map(createCard));

    const total = Number(payload?.meta?.totalCount);
    const totalCount = Number.isFinite(total) ? total : items.length;
    showCount.textContent = payload?.meta?.truncated ? `顯示 ${items.length} / ${totalCount} 套` : `${totalCount} 套`;
    emptyState.hidden = items.length !== 0;
    if (items.length === 0) {
      emptyTitle.textContent = "沒有符合條件的劇集";
      emptyCopy.textContent = "可清除部分平台、類型、狀態或年份篩選，再查看目前 catalog。";
    }
  } catch (error) {
    if (!active || mode !== "browse" || activeRequest !== requestId) return;
    console.error(error);
    showGrid.replaceChildren();
    showCount.textContent = "篩選失敗";
    emptyState.hidden = false;
    emptyState.dataset.state = "error";
    emptyTitle.textContent = "劇集瀏覽暫時無法使用";
    emptyCopy.textContent = error?.name === "AbortError"
      ? "篩選等候超過 12 秒，請稍後再試。"
      : "Browse API 暫時無法回應；精選探索及其他 Series Hub 功能不受影響。";
  } finally {
    if (active && mode === "browse" && activeRequest === requestId) contentPanel?.setAttribute("aria-busy", "false");
  }
}

function clearBrowseFilters() {
  if (networkFilter) networkFilter.value = "";
  if (genreFilter) genreFilter.value = "";
  if (statusFilter) statusFilter.value = "";
  if (yearFilter) yearFilter.value = "";
  if (sortFilter) sortFilter.value = "popular";
}

if (discoverButton && regionSelect && contentPanel && showGrid && scheduleList && emptyState) {
  discoverButton.addEventListener("click", () => {
    releaseGlobalSearch();
    loadFeatured();
  });

  featuredToggle?.addEventListener("click", () => loadFeatured());
  browseToggle?.addEventListener("click", () => loadBrowse());
  resetFilters?.addEventListener("click", () => {
    clearBrowseFilters();
    loadBrowse();
  });

  for (const select of [networkFilter, genreFilter, statusFilter, yearFilter, sortFilter]) {
    select?.addEventListener("change", () => {
      if (active && mode === "browse") loadBrowse();
    });
  }

  window.addEventListener("input", (event) => {
    if (event.target === searchInput && active) leaveDiscoveryMode();
  }, true);

  window.addEventListener("change", (event) => {
    if (event.target !== regionSelect || !active) return;
    event.stopImmediatePropagation();
    saveRegion(currentRegion());
    if (mode === "browse") loadBrowse();
    else loadFeatured();
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const regularControl = target?.closest(".filter[data-view], #my-shows-filter");
    if (regularControl && active) leaveDiscoveryMode();
  }, true);
}
