const views = {
  airing: { title: "播映中", kicker: "AIRING" },
  upcoming: { title: "即將播映", kicker: "UPCOMING" },
  planned: { title: "計劃播出", kicker: "PLANNED" }
};

const state = {
  view: "airing",
  shows: []
};

const healthText = document.querySelector("#health-text");
const statusDot = document.querySelector("#status-dot");
const viewTitle = document.querySelector("#view-title");
const viewKicker = document.querySelector("#view-kicker");
const showCount = document.querySelector("#show-count");
const showGrid = document.querySelector("#show-grid");
const emptyState = document.querySelector("#empty-state");

function setHealth(type, text) {
  statusDot.className = `status-dot ${type}`;
  healthText.textContent = text;
}

function render() {
  const view = views[state.view];
  viewTitle.textContent = view.title;
  viewKicker.textContent = view.kicker;
  showCount.textContent = `${state.shows.length} 套`;
  showGrid.replaceChildren();
  emptyState.hidden = state.shows.length > 0;

  for (const show of state.shows) {
    const card = document.createElement("article");
    card.className = "show-card";

    const poster = document.createElement("div");
    poster.className = "poster";

    if (show.poster_url) {
      const image = document.createElement("img");
      image.className = "poster";
      image.src = show.poster_url;
      image.alt = `${show.original_title} poster`;
      image.loading = "lazy";
      card.append(image);
    } else {
      card.append(poster);
    }

    const title = document.createElement("h4");
    title.textContent = show.original_title;

    const meta = document.createElement("div");
    meta.className = "show-meta";
    meta.textContent = show.status || "Status pending";

    card.append(title, meta);
    showGrid.append(card);
  }
}

async function bootstrap() {
  render();

  try {
    const [healthResponse, showsResponse] = await Promise.all([
      fetch("/health", { cache: "no-store" }),
      fetch("/api/shows", { cache: "no-store" })
    ]);

    if (!healthResponse.ok) throw new Error(`Health ${healthResponse.status}`);

    const health = await healthResponse.json();
    const shows = showsResponse.ok ? await showsResponse.json() : { data: [] };

    state.shows = Array.isArray(shows.data) ? shows.data : [];

    if (health.databaseConfigured && health.databaseReachable) {
      setHealth("ok", "API 正常 · D1 已連接");
    } else if (health.databaseConfigured) {
      setHealth("error", "API 正常 · D1 binding 存在但未能查詢");
    } else {
      setHealth("ok", "API 正常 · 等待 Phase 0 建立 D1");
    }

    render();
  } catch (error) {
    console.error(error);
    setHealth("error", "API 暫時無法連線");
  }
}

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.view = button.dataset.view;
    render();
  });
});

bootstrap();
