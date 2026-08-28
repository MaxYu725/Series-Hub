const TITLE_REGION_STORAGE_KEY = "series-hub-title-region";
const TITLE_REGION_LABELS = Object.freeze({ HK: "香港", TW: "台灣", CN: "中國大陸" });
const STATUS_LABELS = Object.freeze({
  airing: "播映中",
  upcoming: "即將播映",
  planned: "計劃播出",
  completed: "已完結",
  unknown: "狀態待確認"
});
const EVENT_LABELS = Object.freeze({
  renewed: "續訂",
  ordered: "訂購新季",
  cancelled: "取消",
  final_season: "最終季",
  ended: "完結",
  pre_production: "前期製作",
  filming: "拍攝中",
  wrapped: "拍攝完成",
  post_production: "後期製作",
  production_paused: "製作暫停",
  premiere_dated: "首播日期確認",
  delayed: "延期"
});

const params = new URLSearchParams(window.location.search);
const showId = Number(params.get("id"));
const loading = document.querySelector("#detail-loading");
const errorPanel = document.querySelector("#detail-error");
const errorCopy = document.querySelector("#detail-error-copy");
const retryButton = document.querySelector("#detail-retry");
const content = document.querySelector("#detail-content");
const regionSelect = document.querySelector("#detail-region-select");

function storedRegion() {
  const requested = params.get("region");
  if (Object.hasOwn(TITLE_REGION_LABELS, requested)) return requested;
  try {
    const stored = window.localStorage.getItem(TITLE_REGION_STORAGE_KEY);
    if (Object.hasOwn(TITLE_REGION_LABELS, stored)) return stored;
  } catch {
    // localStorage is optional.
  }
  return "HK";
}

let activeRegion = storedRegion();
regionSelect.value = activeRegion;

function saveRegion(region) {
  activeRegion = region;
  try {
    window.localStorage.setItem(TITLE_REGION_STORAGE_KEY, region);
  } catch {
    // The in-memory preference still applies.
  }
  const next = new URL(window.location.href);
  next.searchParams.set("region", region);
  window.history.replaceState(null, "", next);
}

function formatDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(parsed);
}

function formatDateTime(value) {
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

function episodeCode(episode) {
  const season = Number(episode?.season_number);
  const number = Number(episode?.episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(number) || number < 1) return null;
  return `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`;
}

function showError(message) {
  loading.hidden = true;
  content.hidden = true;
  errorPanel.hidden = false;
  errorCopy.textContent = message;
}

async function fetchJson(url, label, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`${label} ${response.status}`);
    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

function addChip(container, text, className = "") {
  if (!text) return;
  const chip = document.createElement("span");
  chip.className = `detail-meta-chip ${className}`.trim();
  chip.textContent = text;
  container.append(chip);
}

function addFact(list, label, value, href = null) {
  if (value === null || value === undefined || value === "") return;
  const row = document.createElement("div");
  row.className = "detail-fact-row";
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  if (href) {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = value;
    description.append(link);
  } else {
    description.textContent = value;
  }
  row.append(term, description);
  list.append(row);
}

function renderHero(show, media) {
  const hero = document.querySelector("#detail-hero");
  const fallbackBackdrop = media?.images?.backdrops?.[0]?.preview_url || null;
  const backdrop = show.backdrop_url || fallbackBackdrop;
  if (backdrop) hero.style.setProperty("--detail-backdrop", `url("${backdrop}")`);

  const posterSlot = document.querySelector("#detail-poster-slot");
  posterSlot.replaceChildren();
  if (show.poster_url || media?.images?.posters?.[0]?.preview_url) {
    const poster = document.createElement("img");
    poster.src = show.poster_url || media.images.posters[0].preview_url;
    poster.alt = `${show.english_title || show.original_title} poster`;
    poster.className = "detail-poster";
    posterSlot.append(poster);
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "detail-poster detail-poster-placeholder";
    placeholder.textContent = "Series Hub";
    posterSlot.append(placeholder);
  }

  const chinese = show.display_title_zh || show.title_zh_hk || show.title_zh_tw || show.title_zh_cn || "";
  const english = show.english_title || show.original_title || "劇集詳情";
  document.querySelector("#detail-title").textContent = chinese || english;
  const englishNode = document.querySelector("#detail-english-title");
  englishNode.textContent = chinese ? english : "";
  englishNode.hidden = !chinese;
  document.title = `${chinese ? `${chinese} · ` : ""}${english} · Series Hub`;

  const tagline = document.querySelector("#detail-tagline");
  tagline.textContent = media?.tagline || "";
  tagline.hidden = !media?.tagline;

  document.querySelector("#detail-kicker").textContent = `${STATUS_LABELS[show.status] || "SERIES DETAIL"} · ${TITLE_REGION_LABELS[activeRegion]}譯名`;
  const overview = document.querySelector("#detail-overview");
  overview.textContent = show.overview || "暫未有劇情簡介。";

  const chips = document.querySelector("#detail-meta-chips");
  chips.replaceChildren();
  addChip(chips, STATUS_LABELS[show.status] || show.status, `status-${show.status || "unknown"}`);
  if (show.networks) addChip(chips, show.networks);
  if (show.genres) show.genres.split(" · ").slice(0, 3).forEach((genre) => addChip(chips, genre));
  if (Number(show.vote_average) > 0) addChip(chips, `★ ${Number(show.vote_average).toFixed(1)}`);
  if (media?.content_rating_us) addChip(chips, `US ${media.content_rating_us}`);
}

function renderFacts(show, media) {
  const facts = document.querySelector("#detail-facts");
  facts.replaceChildren();
  addFact(facts, "平台／頻道", show.networks);
  addFact(facts, "類型", show.genres);
  addFact(facts, "首播", formatDate(show.first_air_date));
  addFact(facts, "最近播出", formatDate(show.last_air_date));
  addFact(facts, "下一播出", formatDate(show.next_air_date));
  addFact(facts, "季度", Number(show.number_of_seasons) > 0 ? `${show.number_of_seasons} 季` : null);
  addFact(facts, "集數", Number(show.number_of_episodes) > 0 ? `${show.number_of_episodes} 集` : null);
  addFact(facts, "TMDB 狀態", show.tmdb_status);
  addFact(facts, "劇集形式", show.series_type);
  addFact(facts, "創作人", media?.created_by?.join("、") || null);
  addFact(facts, "美國分級", media?.content_rating_us || null);
  addFact(facts, "官方網站", show.homepage_url ? "前往官方網站" : null, show.homepage_url || null);
}

function episodeSortValue(episode) {
  const direct = Date.parse(episode?.air_timestamp || "");
  if (Number.isFinite(direct)) return direct;
  const date = Date.parse(`${episode?.air_date || "1900-01-01"}T${episode?.air_time || "00:00"}:00Z`);
  return Number.isFinite(date) ? date : 0;
}

function renderEpisodes(episodes = []) {
  const container = document.querySelector("#detail-episodes");
  container.replaceChildren();
  if (!episodes.length) {
    const empty = document.createElement("p");
    empty.className = "detail-muted";
    empty.textContent = "暫未有 TVmaze 逐集資料。";
    container.append(empty);
    return;
  }

  const now = Date.now();
  const future = episodes.filter((episode) => episodeSortValue(episode) >= now).sort((a, b) => episodeSortValue(a) - episodeSortValue(b)).slice(0, 3);
  const past = episodes.filter((episode) => episodeSortValue(episode) < now).sort((a, b) => episodeSortValue(b) - episodeSortValue(a)).slice(0, future.length ? 3 : 5);
  const selected = [...future, ...past];

  for (const episode of selected) {
    const row = document.createElement("div");
    row.className = "detail-episode-row";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = [episodeCode(episode), episode.name].filter(Boolean).join(" · ") || "集數待補";
    const meta = document.createElement("span");
    const exact = formatDateTime(episode.air_timestamp);
    meta.textContent = exact || [formatDate(episode.air_date), episode.air_time ? `原播 ${episode.air_time}` : null].filter(Boolean).join(" · ") || "播映時間待定";
    copy.append(title, meta);
    row.append(copy);
    if (episode.source_url) {
      const source = document.createElement("a");
      source.href = episode.source_url;
      source.target = "_blank";
      source.rel = "noreferrer";
      source.textContent = "TVmaze";
      row.append(source);
    }
    container.append(row);
  }
}

function renderSeasons(seasons = []) {
  const container = document.querySelector("#detail-seasons");
  const count = document.querySelector("#detail-season-count");
  container.replaceChildren();
  count.textContent = `${seasons.length} 季`;

  if (!seasons.length) {
    const empty = document.createElement("p");
    empty.className = "detail-muted";
    empty.textContent = "暫未有季度資料。";
    container.append(empty);
    return;
  }

  for (const season of seasons) {
    const card = document.createElement("article");
    card.className = "detail-season-card";
    const heading = document.createElement("div");
    heading.className = "detail-season-heading";
    const title = document.createElement("strong");
    title.textContent = season.name || `Season ${season.season_number}`;
    const badge = document.createElement("span");
    badge.textContent = STATUS_LABELS[season.lifecycle_status] || season.lifecycle_status || "狀態待確認";
    heading.append(title, badge);
    const meta = document.createElement("p");
    meta.textContent = [formatDate(season.premiere_date), Number(season.episode_count) > 0 ? `${season.episode_count} 集` : null].filter(Boolean).join(" · ") || "日期／集數待確認";
    card.append(heading, meta);
    if (season.overview) {
      const overview = document.createElement("p");
      overview.className = "detail-season-overview";
      overview.textContent = season.overview;
      card.append(overview);
    }
    container.append(card);
  }
}

function renderPrimaryTrailer(video) {
  const container = document.querySelector("#detail-trailer");
  const youtube = document.querySelector("#detail-trailer-youtube");
  container.replaceChildren();
  youtube.hidden = !video;
  if (!video) return;
  youtube.href = video.watch_url;

  const play = document.createElement("button");
  play.type = "button";
  play.className = "detail-trailer-play";
  const title = document.createElement("strong");
  title.textContent = video.name || "播放預告片";
  const hint = document.createElement("span");
  hint.textContent = `${video.official ? "官方 · " : ""}${video.type || "Video"} · 點擊播放`;
  const icon = document.createElement("span");
  icon.className = "detail-play-icon";
  icon.textContent = "▶";
  play.append(icon, title, hint);
  play.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = video.embed_url;
    frame.title = video.name || "Series trailer";
    frame.loading = "lazy";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allowFullscreen = true;
    container.replaceChildren(frame);
  }, { once: true });
  container.append(play);
}

function renderTrailers(videos = []) {
  const section = document.querySelector("#detail-trailer-section");
  const list = document.querySelector("#detail-trailer-list");
  list.replaceChildren();
  section.hidden = videos.length === 0;
  if (!videos.length) return;

  renderPrimaryTrailer(videos[0]);
  for (const video of videos.slice(1, 5)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-trailer-option";
    const title = document.createElement("strong");
    title.textContent = video.name;
    const meta = document.createElement("span");
    meta.textContent = [video.official ? "官方" : null, video.type].filter(Boolean).join(" · ") || "Video";
    button.append(title, meta);
    button.addEventListener("click", () => {
      renderPrimaryTrailer(video);
      document.querySelector("#detail-trailer-section").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    list.append(button);
  }
}

function renderImages(images = {}) {
  const section = document.querySelector("#detail-images-section");
  const gallery = document.querySelector("#detail-image-gallery");
  const count = document.querySelector("#detail-image-count");
  const items = [...(images.backdrops || []), ...(images.posters || []).slice(0, 4)];
  gallery.replaceChildren();
  section.hidden = items.length === 0;
  if (!items.length) return;
  count.textContent = `${items.length} 張`;

  for (const image of items) {
    const link = document.createElement("a");
    link.href = image.full_url || image.preview_url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.className = `detail-gallery-item is-${image.kind}`;
    const img = document.createElement("img");
    img.src = image.preview_url;
    img.alt = image.kind === "poster" ? "Series poster" : "Series backdrop";
    img.loading = "lazy";
    img.decoding = "async";
    link.append(img);
    gallery.append(link);
  }
}

function renderLifecycle(payload) {
  const section = document.querySelector("#detail-lifecycle-section");
  const container = document.querySelector("#detail-lifecycle");
  const events = Array.isArray(payload?.data) ? payload.data.slice(0, 6) : [];
  container.replaceChildren();
  section.hidden = events.length === 0;
  if (!events.length) return;

  for (const event of events) {
    const row = document.createElement("article");
    row.className = "detail-lifecycle-row";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = [event.season_number != null ? `Season ${event.season_number}` : null, EVENT_LABELS[event.event_type] || event.event_type].filter(Boolean).join(" · ");
    const meta = document.createElement("span");
    meta.textContent = [event.source_name, formatDate(String(event.source_published_at || "").slice(0, 10))].filter(Boolean).join(" · ");
    copy.append(title, meta);
    row.append(copy);
    if (event.source_url) {
      const link = document.createElement("a");
      link.href = event.source_url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "官方來源 ↗";
      row.append(link);
    }
    container.append(row);
  }
}

function render(detailPayload, episodesPayload, lifecyclePayload) {
  const data = detailPayload?.data;
  if (!data?.show) throw new Error("Detail payload missing show");
  renderHero(data.show, data.media);
  renderFacts(data.show, data.media);
  renderEpisodes(Array.isArray(episodesPayload?.data) ? episodesPayload.data : []);
  renderTrailers(data.media?.videos || []);
  renderImages(data.media?.images || {});
  renderSeasons(data.seasons || []);
  renderLifecycle(lifecyclePayload);
  loading.hidden = true;
  errorPanel.hidden = true;
  content.hidden = false;
}

async function load() {
  if (!Number.isSafeInteger(showId) || showId <= 0) {
    showError("網址沒有有效的劇集 ID。請返回列表重新選擇劇集。");
    return;
  }

  loading.hidden = false;
  errorPanel.hidden = true;
  content.hidden = true;
  const region = activeRegion;

  try {
    const [detail, episodesResult, lifecycleResult] = await Promise.all([
      fetchJson(`/api/shows/${showId}/details?region=${encodeURIComponent(region)}`, "Details"),
      fetchJson(`/api/shows/${showId}/episodes?limit=100`, "Episodes").catch(() => ({ data: [] })),
      fetchJson(`/api/shows/${showId}/lifecycle`, "Lifecycle").catch(() => ({ data: [] }))
    ]);
    render(detail, episodesResult, lifecycleResult);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    showError(timedOut ? "連線等候超過 12 秒。可立即重新載入。" : "網絡或 API 暫時無法回應。可立即重新載入。" );
  }
}

retryButton.addEventListener("click", load);
regionSelect.addEventListener("change", () => {
  const region = regionSelect.value;
  if (!Object.hasOwn(TITLE_REGION_LABELS, region)) return;
  saveRegion(region);
  load();
});

load();
