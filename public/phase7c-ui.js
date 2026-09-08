const WATCH_REGION_STORAGE_KEY = "series-hub-watch-region-v1";
const WATCH_REGION_LABELS = Object.freeze({ HK: "香港", US: "美國" });
const WATCH_GROUP_LABELS = Object.freeze({
  flatrate: "訂閱",
  free: "免費",
  ads: "廣告",
  rent: "租借",
  buy: "購買"
});

const params = new URLSearchParams(window.location.search);
const showId = Number(params.get("id"));
let activeWatchRegion = "HK";
let watchPayload = null;

try {
  const stored = window.localStorage.getItem(WATCH_REGION_STORAGE_KEY);
  if (Object.hasOwn(WATCH_REGION_LABELS, stored)) activeWatchRegion = stored;
} catch {
  // Availability preference is optional and remains separate from title-region state.
}

function createPanel() {
  const existing = document.querySelector("#detail-watch-section");
  if (existing) return existing;

  const section = document.createElement("section");
  section.id = "detail-watch-section";
  section.className = "detail-panel detail-wide-panel detail-watch-panel";
  section.setAttribute("aria-labelledby", "detail-watch-title");
  section.innerHTML = `
    <div class="detail-section-heading detail-heading-row detail-watch-heading">
      <div>
        <p class="eyebrow">WATCH AVAILABILITY</p>
        <h3 id="detail-watch-title">在哪裡觀看</h3>
      </div>
      <div class="detail-watch-region-tabs" role="group" aria-label="觀看供應地區">
        <button type="button" data-watch-region="HK">香港</button>
        <button type="button" data-watch-region="US">美國</button>
      </div>
    </div>
    <div id="detail-watch-content" class="detail-watch-content" aria-live="polite">
      <p class="detail-muted">正在查詢地區觀看供應…</p>
    </div>
    <div class="detail-watch-footer">
      <p>觀看供應資料由 <a href="https://www.justwatch.com/" target="_blank" rel="noreferrer">JustWatch</a> 提供，經 TMDB 顯示。</p>
      <a id="detail-watch-tmdb-link" class="detail-external-link" target="_blank" rel="noreferrer" hidden>在 TMDB 查看供應 ↗</a>
    </div>
  `;

  const grid = document.querySelector(".detail-section-grid");
  if (grid) grid.insertAdjacentElement("afterend", section);
  else document.querySelector("#detail-content")?.append(section);

  section.querySelectorAll("[data-watch-region]").forEach((button) => {
    button.addEventListener("click", () => {
      const region = button.dataset.watchRegion;
      if (!Object.hasOwn(WATCH_REGION_LABELS, region)) return;
      activeWatchRegion = region;
      try {
        window.localStorage.setItem(WATCH_REGION_STORAGE_KEY, region);
      } catch {
        // In-memory selection still works.
      }
      renderWatchAvailability();
    });
  });

  return section;
}

function providerCard(provider) {
  const card = document.createElement("div");
  card.className = "detail-watch-provider";

  if (provider.logo_url) {
    const image = document.createElement("img");
    image.src = provider.logo_url;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    card.append(image);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "detail-watch-provider-fallback";
    fallback.textContent = String(provider.name || "?").slice(0, 1).toUpperCase();
    card.append(fallback);
  }

  const name = document.createElement("span");
  name.textContent = provider.name || "Provider";
  card.append(name);
  return card;
}

function renderWatchAvailability() {
  const panel = createPanel();
  const content = panel.querySelector("#detail-watch-content");
  const tmdbLink = panel.querySelector("#detail-watch-tmdb-link");

  panel.querySelectorAll("[data-watch-region]").forEach((button) => {
    const selected = button.dataset.watchRegion === activeWatchRegion;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });

  content.replaceChildren();
  tmdbLink.hidden = true;
  tmdbLink.removeAttribute("href");

  if (!watchPayload) {
    const loading = document.createElement("p");
    loading.className = "detail-muted";
    loading.textContent = "正在查詢地區觀看供應…";
    content.append(loading);
    return;
  }

  const region = watchPayload?.data?.regions?.[activeWatchRegion];
  const meta = watchPayload?.meta || {};
  if (!region) {
    const unavailable = document.createElement("p");
    unavailable.className = "detail-muted";
    unavailable.textContent = "暫時無法取得此地區的觀看供應資料。";
    content.append(unavailable);
    return;
  }

  if (region.link) {
    tmdbLink.href = region.link;
    tmdbLink.hidden = false;
  }

  const populatedGroups = Object.entries(WATCH_GROUP_LABELS)
    .map(([key, label]) => ({ key, label, providers: Array.isArray(region.groups?.[key]) ? region.groups[key] : [] }))
    .filter((group) => group.providers.length > 0);

  if (populatedGroups.length === 0) {
    const empty = document.createElement("p");
    empty.className = "detail-muted";
    empty.textContent = meta.error
      ? "觀看供應服務暫時無法回應，其他劇集資料不受影響。"
      : `TMDB／JustWatch 暫未列出${WATCH_REGION_LABELS[activeWatchRegion]}的觀看供應。`;
    content.append(empty);
    return;
  }

  for (const group of populatedGroups) {
    const block = document.createElement("div");
    block.className = "detail-watch-group";
    const heading = document.createElement("strong");
    heading.textContent = group.label;
    const providers = document.createElement("div");
    providers.className = "detail-watch-providers";
    group.providers.forEach((provider) => providers.append(providerCard(provider)));
    block.append(heading, providers);
    content.append(block);
  }
}

async function loadWatchAvailability() {
  if (!Number.isSafeInteger(showId) || showId <= 0) return;
  createPanel();
  renderWatchAvailability();

  try {
    const response = await fetch(`/api/shows/${showId}/watch-providers`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Watch providers ${response.status}`);
    watchPayload = await response.json();
  } catch {
    watchPayload = {
      data: {
        regions: {
          HK: { code: "HK", label: "香港", link: null, available: false, groups: {} },
          US: { code: "US", label: "美國", link: null, available: false, groups: {} }
        }
      },
      meta: { error: "watch_availability_unavailable" }
    };
  }

  renderWatchAvailability();
}

loadWatchAvailability();
