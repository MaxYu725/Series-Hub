const searchInput = document.querySelector("#search-input");
const discoverButton = document.querySelector("#discover-filter");
const featuredToggle = document.querySelector("#phase8-featured-toggle");
const personalToggle = document.querySelector("#phase8-personal-toggle");
const browseToggle = document.querySelector("#phase8-browse-toggle");

const MODE_BUTTONS = Object.freeze({
  featured: featuredToggle,
  personal: personalToggle,
  browse: browseToggle
});

function activeDiscoveryMode() {
  if (!discoverButton?.classList.contains("active")) return null;
  for (const [mode, button] of Object.entries(MODE_BUTTONS)) {
    if (button?.classList.contains("active")) return mode;
  }
  return "featured";
}

function syncPressedState() {
  for (const [mode, button] of Object.entries(MODE_BUTTONS)) {
    if (!button) continue;
    button.setAttribute("aria-pressed", String(activeDiscoveryMode() === mode));
  }
}

if (searchInput && discoverButton) {
  window.addEventListener("input", (event) => {
    if (event.target !== searchInput || !searchInput.value.trim()) return;
    const mode = activeDiscoveryMode();
    if (!mode) return;
    window.dispatchEvent(new CustomEvent("series-hub:search-origin", {
      detail: { view: "discover", mode }
    }));
  }, true);

  window.addEventListener("series-hub:restore-discovery", (event) => {
    const mode = event?.detail?.mode;
    const button = MODE_BUTTONS[mode] || featuredToggle || discoverButton;
    button?.click();
  });

  new MutationObserver(syncPressedState).observe(discoverButton, {
    attributes: true,
    attributeFilter: ["class"]
  });
}

for (const button of Object.values(MODE_BUTTONS)) {
  if (!button) continue;
  new MutationObserver(syncPressedState).observe(button, {
    attributes: true,
    attributeFilter: ["class"]
  });
}

syncPressedState();
