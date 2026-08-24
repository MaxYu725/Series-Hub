const views = {
  airing: { title: "播映中", kicker: "AIRING" },
  upcoming: { title: "即將播映", kicker: "UPCOMING" },
  planned: { title: "計劃播出", kicker: "PLANNED" }
};

const state = {
  view: "airing",
  shows: [],
  query: "",
  loading: false,
  requestId: 0
};

const healthText = document.querySelector("#health-text");
const syncText = document.querySelector("#sync-text");
const statusDot = document.querySelector("#status-dot");
const viewTitle = document.querySelector("#view-title");
const viewKicker = document.querySelector("#view-kicker");
const showCount = document.querySelector("#show-count");
const showGrid = document.querySelector("#show-grid");
const emptyState = document.querySelector("#empty-state");
const emptyTitle = document.querySelector("#empty-title");
const emptyCopy = document.querySelector("#empty-copy");
const searchInput = document.querySelector("#search-input");

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

function chineseTitle(show) {
  const titles = [show.title_zh_hk, show.title_zh_tw, show.title_zh_cn].filter(Boolean);
  return [...new Set(titles)].join(" / ");
}

function statusLine(show) {
  if (show.status === "airing") {
    return show.next_air_date ? `下集 ${formatDate(show.next_air_date)}` : "播映中";
  }

  if (show.status === "upcoming") {
    return show.next_air_date
      ? `首播 ${formatDate(show.next_air_date)}`
      : "已公布播映日期";
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

function render() {
  const view = views[state.view];
  viewTitle.textContent = view.title;
  viewKicker.textContent = view.kicker;
  showCount.textContent = state.loading ? "載入中…" : `${state.shows.length} 套`;
  showGrid.replaceChildren();

  for (const show of state.shows) {
    showGrid.append(createShowCard(show));
  }

  const isEmpty = !state.loading && state.shows.length === 0;
  emptyState.hidden = !isEmpty;

  if (state.query && isEmpty) {
    emptyTitle.textContent = "找不到符合的劇集";
    emptyCopy.textContent = `目前「${view.title}」沒有符合「${state.query}」的結果。`;
  } else if (isEmpty) {
    emptyTitle.textContent = `${view.title}暫未有劇集資料`;
    emptyCopy.textContent = "Phase 1 catalog 已準備好，完成 TMDB token 設定及首次同步後便會顯示劇集。";
  }
}

async function loadShows() {
  const requestId = ++state.requestId;
  state.loading = true;
  render();

  const params = new URLSearchParams({ status: state.view, limit: "60" });
  if (state.query) params.set("q", state.query);

  try {
    const response = await fetch(`/api/shows?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Shows ${response.status}`);
    const payload = await response.json();
    if (requestId !== state.requestId) return;
    state.shows = Array.isArray(payload.data) ? payload.data : [];
  } catch (error) {
    if (requestId !== state.requestId) return;
    console.error(error);
    state.shows = [];
    setHealth("error", "劇集 API 暫時無法讀取");
  } finally {
    if (requestId === state.requestId) {
      state.loading = false;
      render();
    }
  }
}

async function loadSystemStatus() {
  try {
    const [healthResponse, syncResponse] = await Promise.all([
      fetch("/health", { cache: "no-store" }),
      fetch("/api/sync-status", { cache: "no-store" })
    ]);

    if (!healthResponse.ok) throw new Error(`Health ${healthResponse.status}`);
    const health = await healthResponse.json();

    if (health.databaseConfigured && health.databaseReachable && health.tmdbConfigured) {
      setHealth("ok", "API 正常 · D1 已連接 · TMDB 已設定");
    } else if (health.databaseConfigured && health.databaseReachable) {
      setHealth("warn", "API 正常 · D1 已連接 · TMDB token 待設定");
    } else if (health.databaseConfigured) {
      setHealth("error", "API 正常 · D1 binding 存在但未能查詢");
    } else {
      setHealth("error", "API 正常 · D1 未設定");
    }

    if (syncResponse.ok) {
      const sync = await syncResponse.json();
      if (sync.data?.finished_at) {
        const changed = Number(sync.data.records_changed || 0);
        syncText.textContent = `TMDB 最近同步：${sync.data.finished_at} · 更新 ${changed} 套`;
      }
    }
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
    loadShows();
  }, 250);
});

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.view === state.view) return;
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    state.shows = [];
    loadShows();
  });
});

render();
loadSystemStatus();
loadShows();
