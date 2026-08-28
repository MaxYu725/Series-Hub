import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = String(process.env.PRODUCTION_URL || "https://series-hub.max-yu-jp.workers.dev").replace(/\/$/, "");
const screenshotDir = process.env.SCREENSHOT_DIR || "";
const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function note(message) {
  notes.push(message);
  console.log(message);
}

async function waitForStableView(page, label) {
  await page.waitForFunction(() => {
    const count = document.querySelector("#show-count");
    const panel = document.querySelector(".content-panel");
    return count && count.textContent !== "載入中…" && panel?.getAttribute("aria-busy") === "false";
  }, { timeout: 20000 });

  const state = await page.evaluate(() => ({
    count: document.querySelector("#show-count")?.textContent || "",
    error: document.querySelector("#empty-state")?.dataset?.state || "",
    title: document.querySelector("#view-title")?.textContent || ""
  }));
  check(state.error !== "error", `${label}: rendered an API/error empty state`);
  check(state.count !== "載入中…", `${label}: remained stuck in loading state`);
  note(`${label}: ${state.title} · ${state.count}`);
}

async function assertNoPageOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  check(metrics.documentWidth <= metrics.viewport + 1, `${label}: document horizontal overflow ${metrics.documentWidth}px > ${metrics.viewport}px`);
  check(metrics.bodyWidth <= metrics.viewport + 1, `${label}: body horizontal overflow ${metrics.bodyWidth}px > ${metrics.viewport}px`);
}

async function assertTouchTargets(page, label) {
  const undersized = await page.evaluate(() => {
    const selectors = [
      ".filter:not([disabled])",
      ".phase5-filter:not([disabled])",
      ".tracking-toggle:not([disabled])",
      ".retry-button:not([disabled])",
      ".show-viewing-state-select:not([disabled])",
      ".viewing-state-filter select:not([disabled])",
      ".push-settings-button:not([disabled])"
    ];
    const nodes = [...document.querySelectorAll(selectors.join(","))]
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
    return nodes
      .map((node) => ({
        tag: node.tagName,
        id: node.id || null,
        className: node.className || null,
        text: String(node.textContent || "").trim().slice(0, 40),
        height: Math.round(node.getBoundingClientRect().height)
      }))
      .filter((item) => item.height < 43);
  });
  check(undersized.length === 0, `${label}: undersized touch targets ${JSON.stringify(undersized)}`);
}

async function openBaseView(page, view) {
  await page.locator(`.filter[data-view="${view}"]`).click();
  await page.waitForTimeout(80);
  await waitForStableView(page, `view:${view}`);
  const active = await page.locator(`.filter[data-view="${view}"]`).evaluate((node) => node.classList.contains("active"));
  check(active, `view:${view}: filter did not become active`);
  await assertNoPageOverflow(page, `view:${view}`);
}

async function findCatalogCard(page) {
  for (const view of ["airing", "upcoming", "planned"]) {
    await openBaseView(page, view);
    const cards = page.locator("#show-grid > .show-card[data-show-id]");
    if (await cards.count()) return { view, card: cards.first() };
  }
  throw new Error("No active catalog card available for D4 tracking flow");
}

async function testPhone(browser) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "zh-HK",
    timezoneId: "Asia/Hong_Kong",
    reducedMotion: "reduce"
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${baseUrl}/?d4=phone`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForStableView(page, "phone:init");
  await assertNoPageOverflow(page, "phone:init");

  const opsCount = await page.locator("#ops-status .ops-source").count();
  check(opsCount === 3, `phone:init: expected 3 source-status pills, found ${opsCount}`);

  for (const view of ["today", "week", "airing", "upcoming", "planned"]) {
    await openBaseView(page, view);
  }

  const { view: catalogView, card } = await findCatalogCard(page);
  const showId = await card.getAttribute("data-show-id");
  const showTitle = String(await card.locator(".show-card-body h4").textContent()).trim();
  check(Boolean(showId), "phone: catalog card has no stable show ID");
  check(Boolean(showTitle), "phone: catalog card has no visible title");

  const tracking = card.locator(".tracking-toggle");
  await tracking.click();
  check(await tracking.getAttribute("aria-pressed") === "true", "phone: tracking toggle did not enter tracked state");

  await page.locator("#my-shows-filter").click();
  await waitForStableView(page, "phone:my-shows");
  await page.waitForFunction((id) => Boolean(document.querySelector(`#show-grid > .show-card[data-show-id="${id}"]`)), showId, { timeout: 10000 });
  await assertNoPageOverflow(page, "phone:my-shows");
  await assertTouchTargets(page, "phone:my-shows");

  const myCard = page.locator(`#show-grid > .show-card[data-show-id="${showId}"]`);
  check(await myCard.count() === 1, "phone: tracked show missing from My Shows");
  const stateSelect = myCard.locator(".show-viewing-state-select");
  await stateSelect.waitFor({ state: "visible", timeout: 10000 });

  for (const state of ["watching", "waiting", "completed", "paused"]) {
    await stateSelect.selectOption(state);
    check(await stateSelect.inputValue() === state, `phone: viewing state ${state} did not persist in the card control`);
    const filter = page.locator("#viewing-state-filter");
    await filter.selectOption(state);
    await page.waitForTimeout(50);
    check(await myCard.isVisible(), `phone: viewing-state filter ${state} hid its matching show`);
  }
  await page.locator("#viewing-state-filter").selectOption("");

  const search = page.locator("#search-input");
  await search.fill(showTitle);
  await page.waitForTimeout(420);
  await waitForStableView(page, "phone:my-shows-search");
  check(await myCard.isVisible(), "phone: exact My Shows search failed to keep the tracked show visible");
  await search.fill("");
  await page.waitForTimeout(420);
  await waitForStableView(page, "phone:my-shows-search-clear");

  const pushPanel = page.locator(".push-settings");
  await pushPanel.waitFor({ state: "visible", timeout: 10000 });
  const pushCopy = String(await pushPanel.textContent()).trim();
  check(!pushCopy.includes("正在檢查通知功能"), "phone: Push settings remained stuck in checking state");

  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, "phone-my-shows.png"), fullPage: true });
  }

  await page.goto(`${baseUrl}/?view=my-shows&d4=deeplink`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForStableView(page, "phone:deeplink-my-shows");
  check(await page.locator("#my-shows-filter").evaluate((node) => node.classList.contains("active")), "phone: notification My Shows deep-link did not activate My Shows");
  await assertNoPageOverflow(page, "phone:deeplink-my-shows");

  await openBaseView(page, catalogView);
  const region = page.locator("#title-region-select");
  for (const value of ["TW", "CN", "HK"]) {
    await region.selectOption(value);
    await page.waitForTimeout(80);
    await waitForStableView(page, `phone:region-${value}`);
  }

  await openBaseView(page, "week");
  const trackedSchedule = page.locator("#tracked-schedule-filter");
  check(!(await trackedSchedule.isDisabled()), "phone: tracked schedule control unexpectedly disabled in Week view");
  await trackedSchedule.click();
  await page.waitForTimeout(450);
  check(await trackedSchedule.getAttribute("aria-pressed") === "true", "phone: tracked schedule filter did not activate");
  check(await page.locator("#empty-state").getAttribute("data-state") !== "error", "phone: tracked schedule filter produced an error state");
  await assertNoPageOverflow(page, "phone:tracked-week");
  await trackedSchedule.click();

  await openBaseView(page, "airing");
  await openBaseView(page, "upcoming");
  await openBaseView(page, "planned");
  await page.goBack();
  await page.waitForTimeout(100);
  await waitForStableView(page, "phone:history-back");
  check(await page.locator('.filter[data-view="upcoming"]').evaluate((node) => node.classList.contains("active")), "phone: browser Back did not restore Upcoming view");

  const rapid = ["today", "week", "airing", "upcoming", "planned", "airing", "week", "planned", "today", "upcoming", "planned"];
  for (const viewName of rapid) await page.locator(`.filter[data-view="${viewName}"]`).click();
  await waitForStableView(page, "phone:rapid-navigation");
  check(await page.locator('.filter[data-view="planned"]').evaluate((node) => node.classList.contains("active")), "phone: rapid navigation did not settle on final view");
  await assertNoPageOverflow(page, "phone:rapid-navigation");
  await assertTouchTargets(page, "phone:rapid-navigation");

  if (screenshotDir) {
    await page.screenshot({ path: path.join(screenshotDir, "phone-final.png"), fullPage: true });
  }

  check(errors.length === 0, `phone: uncaught browser errors ${JSON.stringify(errors)}`);
  await context.close();
}

async function testDesktop(browser) {
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "zh-HK",
    timezoneId: "Asia/Hong_Kong"
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.goto(`${baseUrl}/?d4=desktop`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForStableView(page, "desktop:init");
  for (const view of ["week", "airing", "upcoming", "planned", "today"]) await openBaseView(page, view);
  await assertNoPageOverflow(page, "desktop:all-views");

  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, "desktop-today.png"), fullPage: true });
  }

  check(errors.length === 0, `desktop: uncaught browser errors ${JSON.stringify(errors)}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await testPhone(browser);
  await testDesktop(browser);
} catch (error) {
  failures.push(`audit exception: ${error?.stack || error}`);
} finally {
  await browser.close();
}

console.log("\nPhase 5E-D4 browser preflight notes:");
for (const item of notes) console.log(`- ${item}`);

if (failures.length) {
  console.error("\nPhase 5E-D4 browser preflight FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nPhase 5E-D4 browser preflight PASSED.");
