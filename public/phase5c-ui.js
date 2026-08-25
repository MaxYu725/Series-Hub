import {
  VIEWING_STATES,
  VIEWING_STATE_STORAGE_KEY,
  getViewingState,
  loadViewingStates,
  saveViewingStates,
  setViewingState
} from "./viewing-state.js";

function boot() {
  const myButton = document.querySelector("#my-shows-filter");
  const filters = document.querySelector(".filters");
  const showGrid = document.querySelector("#show-grid");
  const showCount = document.querySelector("#show-count");
  const emptyState = document.querySelector("#empty-state");
  const emptyTitle = document.querySelector("#empty-title");
  const emptyCopy = document.querySelector("#empty-copy");
  if (!myButton || !filters || !showGrid || !showCount || !emptyState || !emptyTitle || !emptyCopy) return;

  const filterWrap = document.createElement("label");
  filterWrap.className = "viewing-state-filter";
  filterWrap.hidden = true;

  const filterLabel = document.createElement("span");
  filterLabel.textContent = "追劇狀態";

  const filterSelect = document.createElement("select");
  filterSelect.id = "viewing-state-filter";
  filterSelect.setAttribute("aria-label", "篩選我的劇集追劇狀態");
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "全部狀態";
  filterSelect.append(allOption);
  for (const [value, label] of Object.entries(VIEWING_STATES)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    filterSelect.append(option);
  }
  filterWrap.append(filterLabel, filterSelect);
  filters.append(filterWrap);

  let states = loadViewingStates();
  let scheduled = false;

  function myShowsActive() {
    return myButton.classList.contains("active");
  }

  function createStateControl(showId) {
    const label = document.createElement("label");
    label.className = "show-viewing-state";

    const text = document.createElement("span");
    text.textContent = "追劇狀態";

    const select = document.createElement("select");
    select.className = "show-viewing-state-select";
    select.dataset.viewingStateShowId = String(showId);
    select.setAttribute("aria-label", `設定劇集 ${showId} 的追劇狀態`);

    const unset = document.createElement("option");
    unset.value = "";
    unset.textContent = "未設定";
    select.append(unset);

    for (const [value, stateLabel] of Object.entries(VIEWING_STATES)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = stateLabel;
      select.append(option);
    }
    select.value = getViewingState(states, showId);
    label.append(text, select);
    return label;
  }

  function decorateCards() {
    if (!myShowsActive()) return;
    for (const card of showGrid.querySelectorAll(":scope > .show-card[data-show-id]")) {
      const showId = Number(card.dataset.showId);
      const body = card.querySelector(":scope > .show-card-body");
      if (!body || !Number.isSafeInteger(showId) || showId <= 0) continue;
      let control = body.querySelector(":scope > .show-viewing-state");
      if (!control) {
        control = createStateControl(showId);
        const footer = body.querySelector(":scope > .show-card-footer");
        if (footer) body.insertBefore(control, footer);
        else body.append(control);
      } else {
        const select = control.querySelector("select");
        if (select) select.value = getViewingState(states, showId);
      }
    }
  }

  function applyFilter() {
    if (!myShowsActive()) return;
    decorateCards();
    const cards = [...showGrid.querySelectorAll(":scope > .show-card[data-show-id]")];
    const selected = filterSelect.value;

    let visible = 0;
    for (const card of cards) {
      const showId = Number(card.dataset.showId);
      const match = !selected || getViewingState(states, showId) === selected;
      card.hidden = !match;
      if (match) visible += 1;
    }

    if (!selected) {
      showCount.textContent = `${cards.length} 套`;
      if (cards.length > 0) emptyState.hidden = true;
      return;
    }

    showCount.textContent = `${visible} 套`;
    emptyState.hidden = visible !== 0;
    if (visible === 0 && cards.length > 0) {
      emptyTitle.textContent = `沒有「${VIEWING_STATES[selected]}」劇集`;
      emptyCopy.textContent = "可在「我的劇集」卡片更改追劇狀態，或切回全部狀態。";
    }
  }

  function syncMode() {
    const active = myShowsActive();
    filterWrap.hidden = !active;
    if (!active) {
      filterSelect.value = "";
      for (const card of showGrid.querySelectorAll(":scope > .show-card")) card.hidden = false;
      return;
    }
    scheduleApply();
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    window.queueMicrotask(() => {
      scheduled = false;
      applyFilter();
    });
  }

  filterSelect.addEventListener("change", applyFilter);

  showGrid.addEventListener("change", (event) => {
    const target = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!target?.matches(".show-viewing-state-select[data-viewing-state-show-id]")) return;
    const showId = Number(target.dataset.viewingStateShowId);
    states = saveViewingStates(setViewingState(states, showId, target.value));
    applyFilter();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== VIEWING_STATE_STORAGE_KEY) return;
    states = loadViewingStates();
    if (myShowsActive()) scheduleApply();
  });

  const myObserver = new MutationObserver(syncMode);
  myObserver.observe(myButton, { attributes: true, attributeFilter: ["class"] });

  const gridObserver = new MutationObserver(() => {
    if (myShowsActive()) scheduleApply();
  });
  gridObserver.observe(showGrid, { childList: true });

  syncMode();
}

if (typeof document !== "undefined" && typeof window !== "undefined") boot();
