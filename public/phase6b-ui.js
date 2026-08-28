const MEDIA_LABELS = Object.freeze({
  all: "全部",
  backdrop: "劇照",
  poster: "海報"
});

let galleryItems = [];
let galleryFilter = "all";
let galleryExpanded = false;
let gallerySignature = "";
let lightboxItems = [];
let lightboxIndex = 0;
let lightboxToken = 0;
let lastGalleryTrigger = null;
let enhanceQueued = false;
let swipeStart = null;

function kindForElement(element) {
  if (element.classList.contains("is-poster")) return "poster";
  return "backdrop";
}

function filteredGalleryItems() {
  return galleryFilter === "all"
    ? galleryItems
    : galleryItems.filter((item) => item.kind === galleryFilter);
}

function buildGalleryItem(element) {
  const image = element.querySelector("img");
  return {
    element,
    kind: kindForElement(element),
    preview: image?.currentSrc || image?.src || element.href,
    full: element.href,
    alt: image?.alt || "Series image"
  };
}

function mediaCount(kind) {
  if (kind === "all") return galleryItems.length;
  return galleryItems.filter((item) => item.kind === kind).length;
}

function updateGalleryCount() {
  const count = document.querySelector("#detail-image-count");
  if (!count) return;
  const filtered = filteredGalleryItems();
  if (galleryFilter === "all") {
    count.textContent = `共 ${filtered.length} 張`;
  } else {
    count.textContent = `${MEDIA_LABELS[galleryFilter]} ${filtered.length} 張`;
  }
}

function updateFilterButtons() {
  const toolbar = document.querySelector("#detail-media-toolbar");
  if (!toolbar) return;
  for (const button of toolbar.querySelectorAll("[data-media-filter]")) {
    const filter = button.dataset.mediaFilter;
    button.textContent = `${MEDIA_LABELS[filter]} ${mediaCount(filter)}`;
    const active = filter === galleryFilter;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function updateGalleryVisibility() {
  const filtered = filteredGalleryItems();
  const filteredSet = new Set(filtered);
  let visibleIndex = 0;

  for (const item of galleryItems) {
    if (!filteredSet.has(item)) {
      item.element.hidden = true;
      continue;
    }
    item.element.hidden = !galleryExpanded && visibleIndex >= 6;
    visibleIndex += 1;
  }

  updateGalleryCount();
  updateFilterButtons();

  const toggle = document.querySelector("#detail-phase6b-image-toggle");
  if (!toggle) return;
  toggle.hidden = filtered.length <= 6;
  toggle.textContent = galleryExpanded ? "收起圖片" : `查看全部 ${filtered.length} 張`;
  toggle.setAttribute("aria-expanded", String(galleryExpanded));
}

function setGalleryFilter(filter) {
  if (!Object.hasOwn(MEDIA_LABELS, filter)) return;
  galleryFilter = filter;
  galleryExpanded = false;
  updateGalleryVisibility();
}

function createGalleryToolbar(gallery) {
  document.querySelector("#detail-media-toolbar")?.remove();
  document.querySelectorAll(".detail-image-toggle").forEach((node) => node.remove());

  const toolbar = document.createElement("div");
  toolbar.id = "detail-media-toolbar";
  toolbar.className = "detail-media-toolbar";
  toolbar.setAttribute("aria-label", "圖片分類");

  const filters = document.createElement("div");
  filters.className = "detail-media-filters";
  filters.setAttribute("role", "group");
  filters.setAttribute("aria-label", "篩選圖片");

  for (const filter of ["all", "backdrop", "poster"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.mediaFilter = filter;
    button.addEventListener("click", () => setGalleryFilter(filter));
    filters.append(button);
  }

  const hint = document.createElement("span");
  hint.className = "detail-media-hint";
  hint.textContent = "點擊圖片全螢幕瀏覽";
  toolbar.append(filters, hint);
  gallery.before(toolbar);

  const toggle = document.createElement("button");
  toggle.id = "detail-phase6b-image-toggle";
  toggle.type = "button";
  toggle.className = "detail-image-toggle phase6b-image-toggle";
  toggle.setAttribute("aria-controls", "detail-image-gallery");
  toggle.addEventListener("click", () => {
    galleryExpanded = !galleryExpanded;
    updateGalleryVisibility();
  });
  gallery.after(toggle);
}

function orderGalleryElements(elements) {
  const backdrops = elements.filter((element) => kindForElement(element) === "backdrop");
  const posters = elements.filter((element) => kindForElement(element) === "poster");
  const featured = [...backdrops.slice(0, 4), ...posters.slice(0, 2)];
  const featuredSet = new Set(featured);
  return [...featured, ...elements.filter((element) => !featuredSet.has(element))];
}

function galleryFingerprint(elements) {
  return elements.map((element) => `${element.href}|${kindForElement(element)}`).join("\n");
}

function enhanceGallery() {
  const gallery = document.querySelector("#detail-image-gallery");
  if (!gallery) return;
  const elements = [...gallery.querySelectorAll("a.detail-gallery-item")];
  if (!elements.length) return;

  const signature = galleryFingerprint(elements);
  if (signature === gallerySignature && document.querySelector("#detail-media-toolbar")) return;

  if (document.querySelector("#phase6b-lightbox")?.open) closeLightbox();
  gallerySignature = signature;
  galleryFilter = "all";
  galleryExpanded = false;

  const ordered = orderGalleryElements(elements);
  for (const element of ordered) {
    element.dataset.phase6a1Arranged = "1";
    element.setAttribute("aria-haspopup", "dialog");
    element.title = "開啟圖片瀏覽器";
  }
  gallery.replaceChildren(...ordered);
  galleryItems = ordered.map(buildGalleryItem);

  createGalleryToolbar(gallery);
  updateGalleryVisibility();

  if (gallery.dataset.phase6bBound !== "1") {
    gallery.dataset.phase6bBound = "1";
    gallery.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a.detail-gallery-item") : null;
      if (!link) return;
      const pool = filteredGalleryItems();
      const selected = galleryItems.find((item) => item.element === link);
      const index = pool.indexOf(selected);
      if (index < 0) return;
      event.preventDefault();
      lastGalleryTrigger = link;
      openLightbox(pool, index);
    });
  }
}

function createButton(className, label, text) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.textContent = text;
  return button;
}

function ensureLightbox() {
  let dialog = document.querySelector("#phase6b-lightbox");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "phase6b-lightbox";
  dialog.className = "phase6b-lightbox";
  dialog.setAttribute("aria-label", "劇集圖片瀏覽器");

  const shell = document.createElement("div");
  shell.className = "phase6b-lightbox-shell";

  const header = document.createElement("header");
  header.className = "phase6b-lightbox-header";
  const meta = document.createElement("div");
  meta.className = "phase6b-lightbox-meta";
  const category = document.createElement("strong");
  category.id = "phase6b-lightbox-category";
  const counter = document.createElement("span");
  counter.id = "phase6b-lightbox-counter";
  meta.append(category, counter);

  const actions = document.createElement("div");
  actions.className = "phase6b-lightbox-actions";
  const original = document.createElement("a");
  original.id = "phase6b-lightbox-original";
  original.className = "phase6b-lightbox-original";
  original.target = "_blank";
  original.rel = "noreferrer";
  original.textContent = "開啟原圖 ↗";
  const close = createButton("phase6b-lightbox-close", "關閉圖片瀏覽器", "×");
  close.addEventListener("click", closeLightbox);
  actions.append(original, close);
  header.append(meta, actions);

  const stage = document.createElement("div");
  stage.className = "phase6b-lightbox-stage";
  stage.id = "phase6b-lightbox-stage";
  const previous = createButton("phase6b-lightbox-nav is-prev", "上一張圖片", "‹");
  const next = createButton("phase6b-lightbox-nav is-next", "下一張圖片", "›");
  previous.addEventListener("click", () => moveLightbox(-1));
  next.addEventListener("click", () => moveLightbox(1));

  const figure = document.createElement("figure");
  figure.className = "phase6b-lightbox-figure";
  const image = document.createElement("img");
  image.id = "phase6b-lightbox-image";
  image.alt = "";
  image.decoding = "async";
  const status = document.createElement("span");
  status.id = "phase6b-lightbox-resolution";
  status.className = "phase6b-lightbox-resolution";
  status.textContent = "預覽";
  figure.append(image, status);
  stage.append(previous, figure, next);

  const footer = document.createElement("footer");
  footer.className = "phase6b-lightbox-footer";
  const thumbs = document.createElement("div");
  thumbs.id = "phase6b-lightbox-thumbs";
  thumbs.className = "phase6b-lightbox-thumbs";
  thumbs.setAttribute("aria-label", "圖片縮圖");
  const help = document.createElement("p");
  help.className = "phase6b-lightbox-help";
  help.textContent = "左右滑動或使用 ← → 切換圖片";
  footer.append(thumbs, help);

  shell.append(header, stage, footer);
  dialog.append(shell);
  document.body.append(dialog);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeLightbox();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("phase6b-lightbox-open");
    lastGalleryTrigger?.focus({ preventScroll: true });
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLightbox(1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setLightboxIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setLightboxIndex(lightboxItems.length - 1);
    }
  });

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.target.closest("button")) return;
    swipeStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointerup", (event) => {
    if (!swipeStart || swipeStart.id !== event.pointerId) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
    moveLightbox(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => { swipeStart = null; });

  return dialog;
}

function buildLightboxThumbs() {
  const thumbs = document.querySelector("#phase6b-lightbox-thumbs");
  if (!thumbs) return;
  thumbs.replaceChildren();

  lightboxItems.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "phase6b-lightbox-thumb";
    button.dataset.index = String(index);
    button.setAttribute("aria-label", `查看第 ${index + 1} 張${MEDIA_LABELS[item.kind]}`);
    const image = document.createElement("img");
    image.src = item.preview;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    button.append(image);
    button.addEventListener("click", () => setLightboxIndex(index));
    thumbs.append(button);
  });
}

function preloadAdjacent() {
  if (lightboxItems.length < 2) return;
  for (const offset of [-1, 1]) {
    const index = (lightboxIndex + offset + lightboxItems.length) % lightboxItems.length;
    const source = lightboxItems[index]?.preview;
    if (!source) continue;
    const image = new Image();
    image.src = source;
  }
}

function setLightboxIndex(index) {
  if (!lightboxItems.length) return;
  lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
  const item = lightboxItems[lightboxIndex];
  const image = document.querySelector("#phase6b-lightbox-image");
  const category = document.querySelector("#phase6b-lightbox-category");
  const counter = document.querySelector("#phase6b-lightbox-counter");
  const original = document.querySelector("#phase6b-lightbox-original");
  const resolution = document.querySelector("#phase6b-lightbox-resolution");
  if (!image || !category || !counter || !original || !resolution) return;

  lightboxToken += 1;
  const token = lightboxToken;
  image.classList.add("is-switching");
  image.src = item.preview;
  image.alt = `${MEDIA_LABELS[item.kind]} ${lightboxIndex + 1} / ${lightboxItems.length}`;
  category.textContent = MEDIA_LABELS[item.kind];
  counter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
  original.href = item.full;
  resolution.textContent = item.full && item.full !== item.preview ? "高清載入中…" : "高清";

  requestAnimationFrame(() => image.classList.remove("is-switching"));

  for (const thumb of document.querySelectorAll(".phase6b-lightbox-thumb")) {
    const active = Number(thumb.dataset.index) === lightboxIndex;
    thumb.classList.toggle("is-active", active);
    thumb.setAttribute("aria-current", active ? "true" : "false");
    if (active) thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  if (item.full && item.full !== item.preview) {
    const highResolution = new Image();
    highResolution.decoding = "async";
    highResolution.onload = () => {
      if (token !== lightboxToken) return;
      image.src = item.full;
      resolution.textContent = "高清";
    };
    highResolution.onerror = () => {
      if (token !== lightboxToken) return;
      resolution.textContent = "預覽";
    };
    highResolution.src = item.full;
  }

  const previous = document.querySelector(".phase6b-lightbox-nav.is-prev");
  const next = document.querySelector(".phase6b-lightbox-nav.is-next");
  const disabled = lightboxItems.length < 2;
  if (previous) previous.hidden = disabled;
  if (next) next.hidden = disabled;
  preloadAdjacent();
}

function moveLightbox(offset) {
  if (lightboxItems.length < 2) return;
  setLightboxIndex(lightboxIndex + offset);
}

function openLightbox(items, index) {
  if (!items.length) return;
  const dialog = ensureLightbox();
  lightboxItems = [...items];
  buildLightboxThumbs();
  setLightboxIndex(index);
  document.body.classList.add("phase6b-lightbox-open");
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  dialog.querySelector(".phase6b-lightbox-close")?.focus({ preventScroll: true });
}

function closeLightbox() {
  const dialog = document.querySelector("#phase6b-lightbox");
  if (!dialog) return;
  lightboxToken += 1;
  swipeStart = null;
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    document.body.classList.remove("phase6b-lightbox-open");
    lastGalleryTrigger?.focus({ preventScroll: true });
  }
}

function queueEnhanceGallery() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => {
    enhanceQueued = false;
    enhanceGallery();
  });
}

const imagesSection = document.querySelector("#detail-images-section");
if (imagesSection) {
  new MutationObserver(queueEnhanceGallery).observe(imagesSection, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
}
queueEnhanceGallery();
