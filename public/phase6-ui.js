const TITLE_REGION_STORAGE_KEY = "series-hub-title-region";
const CARD_SELECTOR = ".show-card[data-show-id], .schedule-show-group[data-show-id]";
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, label";

function titleRegion() {
  try {
    const value = window.localStorage.getItem(TITLE_REGION_STORAGE_KEY);
    return new Set(["HK", "TW", "CN"]).has(value) ? value : "HK";
  } catch {
    return "HK";
  }
}

function detailUrl(card) {
  const showId = Number(card?.dataset?.showId);
  if (!Number.isSafeInteger(showId) || showId <= 0) return null;
  const params = new URLSearchParams({ id: String(showId), region: titleRegion() });
  return `/show.html?${params}`;
}

function decorateCard(card) {
  if (!(card instanceof HTMLElement)) return;
  const href = detailUrl(card);
  if (!href) return;
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.dataset.detailHref = href;
  if (!card.hasAttribute("aria-label")) {
    const title = card.querySelector("h4")?.textContent?.trim();
    card.setAttribute("aria-label", title ? `查看 ${title} 詳情` : "查看劇集詳情");
  }
}

function decorateWithin(root) {
  if (!(root instanceof Element)) return;
  if (root.matches(CARD_SELECTOR)) decorateCard(root);
  root.querySelectorAll(CARD_SELECTOR).forEach(decorateCard);
}

function activateCard(card) {
  const href = card?.dataset?.detailHref || detailUrl(card);
  if (href) window.location.assign(href);
}

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return;
  const card = target.closest(CARD_SELECTOR);
  if (!card) return;
  activateCard(card);
});

document.addEventListener("keydown", (event) => {
  if (event.defaultPrevented || !new Set(["Enter", " "]).has(event.key)) return;
  const target = event.target;
  if (!(target instanceof Element) || !target.matches(CARD_SELECTOR)) return;
  event.preventDefault();
  activateCard(target);
});

for (const container of [document.querySelector("#show-grid"), document.querySelector("#schedule-list")].filter(Boolean)) {
  decorateWithin(container);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) decorateWithin(node);
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
}
