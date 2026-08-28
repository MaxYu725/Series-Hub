import {
  loadTrackedShowIds,
  saveTrackedShowIds,
  toggleTrackedShowId,
  isTrackedShow
} from "./tracking.js";
import {
  VIEWING_STATES,
  loadViewingStates,
  saveViewingStates,
  setViewingState,
  getViewingState
} from "./viewing-state.js";

const params = new URLSearchParams(window.location.search);
const showId = Number(params.get("id"));
let trackedIds = loadTrackedShowIds();
let viewingStates = loadViewingStates();
let queued = false;

function updateTrackingButton(button) {
  const tracked = isTrackedShow(trackedIds, showId);
  button.classList.toggle("is-tracked", tracked);
  button.setAttribute("aria-pressed", String(tracked));
  button.textContent = tracked ? "✓ 我的劇集" : "＋ 加入我的劇集";
}

function ensurePersonalTools() {
  if (!Number.isSafeInteger(showId) || showId <= 0) return;
  const explorer = document.querySelector("#phase6c-episode-explorer");
  if (!explorer || explorer.querySelector("#phase6c-personal-tools")) return;
  const summary = explorer.querySelector("#phase6c-season-summary");
  if (!summary) return;

  const tools = document.createElement("div");
  tools.id = "phase6c-personal-tools";
  tools.className = "phase6c-personal-tools";

  const trackingButton = document.createElement("button");
  trackingButton.type = "button";
  trackingButton.className = "phase6c-tracking-button";
  updateTrackingButton(trackingButton);
  trackingButton.addEventListener("click", () => {
    trackedIds = saveTrackedShowIds(toggleTrackedShowId(trackedIds, showId));
    updateTrackingButton(trackingButton);
  });

  const stateLabel = document.createElement("label");
  stateLabel.className = "phase6c-viewing-control";
  const labelText = document.createElement("span");
  labelText.textContent = "觀看狀態";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "設定此劇集的觀看狀態");

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "未設定";
  select.append(blank);
  for (const [value, label] of Object.entries(VIEWING_STATES)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  select.value = getViewingState(viewingStates, showId);
  select.addEventListener("change", () => {
    viewingStates = saveViewingStates(setViewingState(viewingStates, showId, select.value));
  });

  stateLabel.append(labelText, select);
  tools.append(trackingButton, stateLabel);
  summary.after(tools);
}

function queueEnsure() {
  if (queued) return;
  queued = true;
  window.queueMicrotask(() => {
    queued = false;
    ensurePersonalTools();
  });
}

window.addEventListener("series-hub-tracking-changed", (event) => {
  trackedIds = Array.isArray(event?.detail?.showIds) ? event.detail.showIds : loadTrackedShowIds();
  const button = document.querySelector(".phase6c-tracking-button");
  if (button) updateTrackingButton(button);
});

const content = document.querySelector("#detail-content");
if (content) {
  const observer = new MutationObserver(queueEnsure);
  observer.observe(content, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
}
queueEnsure();
