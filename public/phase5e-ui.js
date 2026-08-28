const SUPPORTED_VIEWS = new Set(["today", "week", "airing", "upcoming", "planned", "my-shows"]);
const MY_SHOWS_VIEW = "my-shows";

function currentView() {
  const myShows = document.querySelector("#my-shows-filter");
  if (myShows?.classList.contains("active")) return MY_SHOWS_VIEW;
  const regular = document.querySelector(".filter.active[data-view]");
  return SUPPORTED_VIEWS.has(regular?.dataset?.view) ? regular.dataset.view : "today";
}

function syncPressedState() {
  const selected = currentView();
  for (const button of document.querySelectorAll(".filter[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === selected));
  }
  const myShows = document.querySelector("#my-shows-filter");
  if (myShows) myShows.setAttribute("aria-pressed", String(selected === MY_SHOWS_VIEW));
}

function revealActiveFilter() {
  const selected = document.querySelector(".filter.active[data-view], #my-shows-filter.active");
  if (!selected || typeof selected.scrollIntoView !== "function") return;
  try {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    selected.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
  } catch {
    // Older browsers can safely keep the current scroll position.
  }
}

function writeViewToUrl(view, { replace = false } = {}) {
  if (!SUPPORTED_VIEWS.has(view)) return;
  const url = new URL(window.location.href);
  if (url.searchParams.get("view") === view) return;
  url.searchParams.set("view", view);
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ seriesHubView: view }, "", `${url.pathname}${url.search}${url.hash}`);
}

function afterBaseLoad(callback) {
  const count = document.querySelector("#show-count");
  if (!count || count.textContent !== "載入中…") {
    callback();
    return;
  }

  let finished = false;
  let observer = null;
  let timer = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    observer?.disconnect();
    if (timer !== null) window.clearTimeout(timer);
    callback();
  };

  observer = new MutationObserver(() => {
    if (count.textContent !== "載入中…") finish();
  });
  observer.observe(count, { childList: true, characterData: true, subtree: true });
  timer = window.setTimeout(finish, 15000);
}

function activateView(view) {
  if (!SUPPORTED_VIEWS.has(view)) return;
  if (view === currentView()) {
    syncPressedState();
    revealActiveFilter();
    return;
  }

  if (view === MY_SHOWS_VIEW) {
    afterBaseLoad(() => document.querySelector("#my-shows-filter")?.click());
    return;
  }

  document.querySelector(`.filter[data-view="${view}"]`)?.click();
}

function boot() {
  const retry = document.querySelector("#retry-view-button");
  retry?.addEventListener("click", () => {
    retry.disabled = true;
    window.dispatchEvent(new CustomEvent("series-hub:retry", { detail: { view: currentView() } }));
    window.setTimeout(() => { retry.disabled = false; }, 700);
  });

  let applyingHistory = false;

  const myShowsButton = document.querySelector("#my-shows-filter");
  if (myShowsButton) {
    const myShowsObserver = new MutationObserver(() => {
      if (!myShowsButton.classList.contains("active")) return;
      syncPressedState();
      revealActiveFilter();
      if (!applyingHistory) writeViewToUrl(MY_SHOWS_VIEW);
    });
    myShowsObserver.observe(myShowsButton, { attributes: true, attributeFilter: ["class"] });
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const regular = target?.closest(".filter[data-view]");
    const myShows = target?.closest("#my-shows-filter");
    if (!regular && !myShows) return;

    window.queueMicrotask(() => {
      syncPressedState();
      revealActiveFilter();
      if (applyingHistory) return;
      writeViewToUrl(myShows ? MY_SHOWS_VIEW : regular.dataset.view);
    });
  });

  window.addEventListener("popstate", () => {
    const requested = new URL(window.location.href).searchParams.get("view") || "today";
    if (!SUPPORTED_VIEWS.has(requested)) return;
    applyingHistory = true;
    activateView(requested);
    window.setTimeout(() => {
      applyingHistory = false;
      syncPressedState();
    }, 0);
  });

  const requested = new URL(window.location.href).searchParams.get("view");
  if (SUPPORTED_VIEWS.has(requested)) activateView(requested);
  syncPressedState();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
