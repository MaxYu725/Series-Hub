import {
  addDateKeyDays,
  episodeLocalDateKey,
  localDateKey,
  scheduleWindow
} from "./schedule-utils.js";
import { loadTrackedShowIds } from "./tracking.js";

const SCHEDULE_VIEWS = Object.freeze({ today: 1, week: 7 });
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

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

export function filterTrackedScheduleEpisodes(episodes, trackedIds) {
  const tracked = new Set((trackedIds || []).map(Number));
  return (episodes || []).filter((episode) => tracked.has(Number(episode.show_id)));
}

function boot() {
  const filters = document.querySelector(".filters");
  const weekButton = document.querySelector('.filter[data-view="week"]');
  const scheduleList = document.querySelector("#schedule-list");
  const showCount = document.querySelector("#show-count");
  const viewContext = document.querySelector("#view-context");
  const emptyState = document.querySelector("#empty-state");
  const emptyTitle = document.querySelector("#empty-title");
  const emptyCopy = document.querySelector("#empty-copy");
  const searchInput = document.querySelector("#search-input");
  const regionSelect = document.querySelector("#title-region-select");
  if (!filters || !weekButton || !scheduleList || !showCount || !viewContext || !emptyState || !searchInput || !regionSelect) return;

  const button = document.createElement("button");
  button.type = "button";
  button.id = "tracked-schedule-filter";
  button.className = "phase5-filter tracked-schedule-filter";
  button.textContent = "只看追蹤";
  button.setAttribute("aria-pressed", "false");
  weekButton.insertAdjacentElement("afterend", button);

  let active = false;
  let requestId = 0;
  let debounceTimer = null;
  let snapshot = null;
  let applying = false;

  function activeView() {
    const selected = document.querySelector(".filter.active[data-view]");
    return selected?.dataset.view || null;
  }

  function isScheduleView() {
    return Object.hasOwn(SCHEDULE_VIEWS, activeView());
  }

  function setButtonAvailability() {
    button.disabled = !isScheduleView();
    if (button.disabled && active) deactivate();
  }

  function takeSnapshot() {
    if (snapshot) return;
    snapshot = {
      context: viewContext.textContent,
      emptyHidden: emptyState.hidden,
      emptyTitle: emptyTitle.textContent,
      emptyCopy: emptyCopy.textContent
    };
  }

  function restoreBaseSchedule() {
    for (const row of scheduleList.querySelectorAll(".schedule-row")) row.hidden = false;
    for (const day of scheduleList.querySelectorAll(".schedule-day")) {
      day.hidden = false;
      const rows = day.querySelectorAll(".schedule-row");
      const count = day.querySelector(".schedule-day-heading span");
      if (count) count.textContent = `${rows.length} 集`;
    }
    showCount.textContent = `${scheduleList.querySelectorAll(".schedule-row").length} 集`;
    if (snapshot) {
      viewContext.textContent = snapshot.context;
      emptyState.hidden = snapshot.emptyHidden;
      emptyTitle.textContent = snapshot.emptyTitle;
      emptyCopy.textContent = snapshot.emptyCopy;
    }
    snapshot = null;
  }

  function deactivate() {
    active = false;
    requestId += 1;
    button.classList.remove("active");
    button.setAttribute("aria-pressed", "false");
    restoreBaseSchedule();
  }

  async function fetchCurrentSchedule(view, request) {
    const today = localDateKey();
    const from = addDateKeyDays(today, -1);
    const days = SCHEDULE_VIEWS[view];
    const params = new URLSearchParams({
      from,
      days: String(Math.min(days + 2, 14)),
      region: regionSelect.value || "HK"
    });
    const response = await fetch(`/api/schedule?${params}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Schedule ${response.status}`);
    const payload = await response.json();
    if (request !== requestId || !active) return null;
    return scheduleWindow(payload.data, today, days, browserTimeZone)
      .filter((episode) => matchesScheduleQuery(episode, searchInput.value.trim()));
  }

  function applyRows(episodes) {
    const rows = [...scheduleList.querySelectorAll(".schedule-row")];
    if (rows.length !== episodes.length) return false;

    const tracked = new Set(loadTrackedShowIds().map(Number));
    let visibleTotal = 0;
    rows.forEach((row, index) => {
      const showId = Number(episodes[index]?.show_id);
      row.dataset.showId = Number.isSafeInteger(showId) ? String(showId) : "";
      row.hidden = !tracked.has(showId);
      if (!row.hidden) visibleTotal += 1;
    });

    for (const day of scheduleList.querySelectorAll(".schedule-day")) {
      const dayRows = [...day.querySelectorAll(".schedule-row")];
      const visible = dayRows.filter((row) => !row.hidden).length;
      day.hidden = visible === 0;
      const count = day.querySelector(".schedule-day-heading span");
      if (count) count.textContent = `${visible} 集`;
    }

    showCount.textContent = `${visibleTotal} 集`;
    emptyState.hidden = visibleTotal !== 0;
    if (visibleTotal === 0) {
      emptyTitle.textContent = loadTrackedShowIds().length ? "這個時段沒有已追蹤劇集" : "尚未追蹤任何劇集";
      emptyCopy.textContent = loadTrackedShowIds().length
        ? "目前追蹤清單在這個排程時段沒有已確認集數。"
        : "先在劇集卡片按「+ 追蹤」，再回來查看個人排程。";
    }
    return true;
  }

  async function applyTrackedFilter() {
    if (!active || !isScheduleView()) return;
    const request = ++requestId;
    takeSnapshot();
    const view = activeView();
    viewContext.textContent = `${snapshot.context} · 只顯示這個瀏覽器已追蹤的劇集。`;
    try {
      const episodes = await fetchCurrentSchedule(view, request);
      if (!episodes || request !== requestId || !active) return;
      applying = true;
      const matched = applyRows(episodes);
      applying = false;
      if (!matched) {
        window.setTimeout(() => {
          if (active) applyTrackedFilter();
        }, 80);
      }
    } catch (error) {
      applying = false;
      console.error(error);
      if (request !== requestId || !active) return;
      emptyState.hidden = false;
      emptyTitle.textContent = "追蹤排程暫時無法讀取";
      emptyCopy.textContent = "一般今日／本週排程仍可使用；關閉「只看追蹤」即可返回。";
    }
  }

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isScheduleView()) return;
    if (active) {
      deactivate();
      return;
    }
    active = true;
    button.classList.add("active");
    button.setAttribute("aria-pressed", "true");
    applyTrackedFilter();
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".filter[data-view]") : null;
    if (!target) return;
    window.queueMicrotask(() => {
      setButtonAvailability();
      if (active && isScheduleView()) applyTrackedFilter();
    });
  });

  searchInput.addEventListener("input", () => {
    if (!active) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(applyTrackedFilter, 320);
  });

  regionSelect.addEventListener("change", () => {
    if (active) window.setTimeout(applyTrackedFilter, 0);
  });

  window.addEventListener("storage", (event) => {
    if (active && event.key === "series-hub-tracked-shows-v1") applyTrackedFilter();
  });

  const observer = new MutationObserver(() => {
    if (!active || applying) return;
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(applyTrackedFilter, 80);
  });
  observer.observe(scheduleList, { childList: true, subtree: true });

  setButtonAvailability();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
