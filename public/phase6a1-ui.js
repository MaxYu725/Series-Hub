const TMDB_STATUS_LABELS = Object.freeze({
  "Returning Series": "持續播映",
  Ended: "已完結",
  Canceled: "已取消",
  Cancelled: "已取消",
  "In Production": "製作中",
  Planned: "計劃中",
  Pilot: "試播"
});

const SERIES_TYPE_LABELS = Object.freeze({
  Scripted: "劇情劇",
  Miniseries: "迷你劇",
  Documentary: "紀錄片",
  Reality: "真人秀",
  News: "新聞",
  Talk: "清談節目",
  Video: "影片"
});

const GENRE_LABELS = Object.freeze({
  "Action & Adventure": "動作與冒險",
  Animation: "動畫",
  Comedy: "喜劇",
  Crime: "犯罪",
  Documentary: "紀錄片",
  Drama: "劇情",
  Family: "家庭",
  Kids: "兒童",
  Mystery: "懸疑",
  News: "新聞",
  Reality: "真人秀",
  "Sci-Fi & Fantasy": "科幻與奇幻",
  Soap: "肥皂劇",
  Talk: "清談",
  "War & Politics": "戰爭與政治",
  Western: "西部"
});

const VIDEO_TYPE_LABELS = Object.freeze({
  Trailer: "預告片",
  Teaser: "前導預告",
  Clip: "片段",
  Featurette: "花絮",
  "Behind the Scenes": "幕後花絮",
  Bloopers: "NG 片段",
  "Opening Credits": "片頭"
});

const GENERIC_VIDEO_TITLES = Object.freeze({
  "Official Trailer": "官方預告片",
  Trailer: "預告片",
  "Official Teaser": "官方前導預告",
  Teaser: "前導預告"
});

const params = new URLSearchParams(window.location.search);
const showId = Number(params.get("id"));
let episodesCache = null;
let episodesPromise = null;
let polishQueued = false;

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function translateCompound(value, labels) {
  return String(value || "")
    .split(" · ")
    .map((part) => labels[part] || part)
    .join(" · ");
}

function polishFactsAndChips() {
  for (const row of document.querySelectorAll("#detail-facts .detail-fact-row")) {
    const label = row.querySelector("dt")?.textContent?.trim();
    const value = row.querySelector("dd");
    if (!value) continue;
    if (label === "TMDB 狀態") setText(value, TMDB_STATUS_LABELS[value.textContent.trim()] || value.textContent);
    if (label === "劇集形式") setText(value, SERIES_TYPE_LABELS[value.textContent.trim()] || value.textContent);
    if (label === "類型") setText(value, translateCompound(value.textContent, GENRE_LABELS));
  }

  for (const chip of document.querySelectorAll("#detail-meta-chips .detail-meta-chip")) {
    const raw = chip.textContent.trim();
    setText(chip, GENRE_LABELS[raw] || TMDB_STATUS_LABELS[raw] || SERIES_TYPE_LABELS[raw] || raw);
  }
}

function polishSeasons() {
  for (const card of document.querySelectorAll("#detail-seasons .detail-season-card")) {
    const title = card.querySelector(".detail-season-heading strong");
    const number = title?.textContent?.match(/(?:Season|第)\s*(\d+)/i)?.[1];
    if (title && number) setText(title, `第 ${Number(number)} 季`);
    card.querySelector(".detail-season-overview")?.remove();
    card.classList.add("is-condensed");
  }
}

function polishLifecycle() {
  for (const title of document.querySelectorAll("#detail-lifecycle .detail-lifecycle-row strong")) {
    setText(title, title.textContent.replace(/Season\s+(\d+)/gi, (_, number) => `第 ${Number(number)} 季`));
  }
}

function translateVideoMeta(text) {
  let result = String(text || "");
  for (const [english, chinese] of Object.entries(VIDEO_TYPE_LABELS)) {
    result = result.replaceAll(english, chinese);
  }
  return result.replaceAll("Video", "影片");
}

function polishTrailers() {
  const primaryHint = document.querySelector("#detail-trailer .detail-trailer-play > span:last-child");
  if (primaryHint) setText(primaryHint, translateVideoMeta(primaryHint.textContent));

  const list = document.querySelector("#detail-trailer-list");
  if (!list) return;
  const primaryIsTrailer = primaryHint?.textContent?.includes("預告片") === true;
  const options = [...list.querySelectorAll(".detail-trailer-option")];
  for (const option of options) {
    const title = option.querySelector("strong");
    const meta = option.querySelector("span");
    const rawMeta = meta?.textContent || "";
    if (primaryIsTrailer && /(^| · )Trailer($| · )/.test(rawMeta)) {
      option.remove();
      continue;
    }
    if (title) setText(title, GENERIC_VIDEO_TITLES[title.textContent.trim()] || title.textContent);
    if (meta) setText(meta, translateVideoMeta(rawMeta));
  }

  let subheading = document.querySelector("#detail-trailer-subheading");
  if (!subheading) {
    subheading = document.createElement("p");
    subheading.id = "detail-trailer-subheading";
    subheading.className = "detail-trailer-subheading";
    subheading.textContent = "其他影片";
    list.before(subheading);
  }
  subheading.hidden = list.children.length === 0;
}

function arrangeImages() {
  const gallery = document.querySelector("#detail-image-gallery");
  const count = document.querySelector("#detail-image-count");
  if (!gallery) return;

  const all = [...gallery.querySelectorAll(".detail-gallery-item")];
  if (!all.length || all[0].dataset.phase6a1Arranged === "1") return;
  if (gallery.nextElementSibling?.classList.contains("detail-image-toggle")) gallery.nextElementSibling.remove();
  const backdrops = all.filter((item) => item.classList.contains("is-backdrop"));
  const posters = all.filter((item) => item.classList.contains("is-poster"));
  const featured = [...backdrops.slice(0, 4), ...posters.slice(0, 2)];
  const featuredSet = new Set(featured);
  const ordered = [...featured, ...all.filter((item) => !featuredSet.has(item))];
  ordered.forEach((item) => { item.dataset.phase6a1Arranged = "1"; });
  gallery.replaceChildren(...ordered);

  const total = ordered.length;
  if (count) count.textContent = `共 ${total} 張`;
  if (total <= 6) return;

  const setExpanded = (expanded) => {
    ordered.forEach((item, index) => { item.hidden = !expanded && index >= 6; });
    toggle.textContent = expanded ? "收起圖片" : `查看全部 ${total} 張`;
    toggle.setAttribute("aria-expanded", String(expanded));
  };

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "detail-image-toggle";
  toggle.setAttribute("aria-controls", "detail-image-gallery");
  toggle.addEventListener("click", () => setExpanded(toggle.getAttribute("aria-expanded") !== "true"));
  gallery.after(toggle);
  setExpanded(false);
}

function episodeSortValue(episode) {
  const exact = Date.parse(episode?.air_timestamp || "");
  if (Number.isFinite(exact)) return exact;
  const fallback = Date.parse(`${episode?.air_date || "1900-01-01"}T${episode?.air_time || "00:00"}:00Z`);
  return Number.isFinite(fallback) ? fallback : 0;
}

function formatEpisodeDate(episode) {
  const exact = episode?.air_timestamp ? new Date(episode.air_timestamp) : null;
  if (exact && !Number.isNaN(exact.getTime())) {
    return new Intl.DateTimeFormat("zh-HK", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(exact);
  }
  if (episode?.air_date) {
    const parsed = new Date(`${episode.air_date}T00:00:00Z`);
    const date = Number.isNaN(parsed.getTime()) ? episode.air_date : new Intl.DateTimeFormat("zh-HK", {
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    }).format(parsed);
    return [date, episode.air_time ? `原播 ${episode.air_time}` : null].filter(Boolean).join(" · ");
  }
  return "播映時間待定";
}

function episodeCode(episode) {
  const season = Number(episode?.season_number);
  const number = Number(episode?.episode_number);
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(number) || number < 1) return null;
  return `S${String(season).padStart(2, "0")}E${String(number).padStart(2, "0")}`;
}

function buildEpisodeRow(episode) {
  const row = document.createElement("div");
  row.className = "detail-episode-row";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = [episodeCode(episode), episode.name].filter(Boolean).join(" · ") || "集數待補";
  const meta = document.createElement("span");
  meta.textContent = formatEpisodeDate(episode);
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
  return row;
}

function buildEpisodeGroup(titleText, episodes, className) {
  if (!episodes.length) return null;
  const group = document.createElement("section");
  group.className = `detail-episode-group ${className}`;
  const heading = document.createElement("h4");
  heading.textContent = titleText;
  group.append(heading, ...episodes.map(buildEpisodeRow));
  return group;
}

async function loadEpisodes() {
  if (episodesCache) return episodesCache;
  if (episodesPromise) return episodesPromise;
  if (!Number.isSafeInteger(showId) || showId <= 0) return [];
  episodesPromise = fetch(`/api/shows/${showId}/episodes?limit=100`, { cache: "no-store" })
    .then((response) => response.ok ? response.json() : { data: [] })
    .then((payload) => Array.isArray(payload?.data) ? payload.data : [])
    .catch(() => [])
    .then((episodes) => {
      episodesCache = episodes;
      return episodes;
    });
  return episodesPromise;
}

async function polishEpisodes() {
  const container = document.querySelector("#detail-episodes");
  if (!container || container.querySelector(".detail-episode-group")) return;
  const episodes = await loadEpisodes();
  if (!episodes.length) return;

  const now = Date.now();
  const future = episodes.filter((episode) => episodeSortValue(episode) >= now)
    .sort((a, b) => episodeSortValue(a) - episodeSortValue(b)).slice(0, 3);
  const past = episodes.filter((episode) => episodeSortValue(episode) < now)
    .sort((a, b) => episodeSortValue(b) - episodeSortValue(a)).slice(0, future.length ? 3 : 5);
  const futureGroup = buildEpisodeGroup("即將播出", future, "is-upcoming");
  const pastGroup = buildEpisodeGroup("最近播出", past, "is-recent");
  container.replaceChildren(...[futureGroup, pastGroup].filter(Boolean));
}

function polish() {
  const content = document.querySelector("#detail-content");
  if (!content || content.hidden) return;
  polishFactsAndChips();
  polishSeasons();
  polishLifecycle();
  polishTrailers();
  arrangeImages();
  void polishEpisodes();
}

function queuePolish() {
  if (polishQueued) return;
  polishQueued = true;
  window.queueMicrotask(() => {
    polishQueued = false;
    polish();
  });
}

const content = document.querySelector("#detail-content");
if (content) {
  const observer = new MutationObserver(queuePolish);
  observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
}
queuePolish();
