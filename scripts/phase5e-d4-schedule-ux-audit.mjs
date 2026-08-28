import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = String(process.env.PRODUCTION_URL || "https://series-hub.max-yu-jp.workers.dev").replace(/\/$/, "");
const screenshotDir = process.env.SCREENSHOT_DIR || "";
const failures = [];
const notes = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const note = (message) => { notes.push(message); console.log(message); };

async function stable(page, label) {
  await page.waitForFunction(() => {
    const count = document.querySelector("#show-count");
    const panel = document.querySelector(".content-panel");
    return count && count.textContent !== "載入中…" && panel?.getAttribute("aria-busy") === "false";
  }, { timeout: 20000 });
  const state = await page.evaluate(() => ({
    title: document.querySelector("#view-title")?.textContent || "",
    count: document.querySelector("#show-count")?.textContent || "",
    error: document.querySelector("#empty-state")?.dataset?.state || ""
  }));
  check(state.error !== "error", `${label}: error state`);
  note(`${label}: ${state.title} · ${state.count}`);
}

async function noOverflow(page, label) {
  const m = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  check(m.doc <= m.viewport + 1, `${label}: document overflow ${m.doc} > ${m.viewport}`);
  check(m.body <= m.viewport + 1, `${label}: body overflow ${m.body} > ${m.viewport}`);
}

async function openView(page, view) {
  await page.locator(`.filter[data-view="${view}"]`).click();
  await stable(page, view);
}

async function runPhone(browser) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-HK", timezoneId: "Asia/Hong_Kong" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto(`${baseUrl}/?d4=schedule-ux`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await stable(page, "phone:init");
  await noOverflow(page, "phone:init");

  const landing = await page.evaluate(() => {
    const hero = document.querySelector(".hero");
    const title = document.querySelector("#view-title");
    const content = document.querySelector(".content-panel");
    const service = document.querySelector(".service-status");
    return {
      hasHero: Boolean(hero),
      title: title?.textContent || "",
      titleTop: title?.getBoundingClientRect().top ?? 9999,
      contentTop: content?.getBoundingClientRect().top ?? 9999,
      serviceTop: service?.getBoundingClientRect().top ?? -1
    };
  });
  check(!landing.hasHero, "phone: long hero explainer still exists");
  check(landing.title === "今日播映", `phone: landing title is ${landing.title}`);
  check(landing.serviceTop > landing.contentTop, "phone: operational status appears before primary content");
  note(`phone: content-first title top=${Math.round(landing.titleTop)}px`);

  const schedule = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".schedule-show-group")];
    const rows = [...document.querySelectorAll(".schedule-row")];
    const multi = groups.map((group) => ({ rows: group.querySelectorAll(".schedule-row").length, label: group.querySelector(".schedule-batch-label")?.textContent || "" })).filter((item) => item.rows > 1);
    return { groups: groups.length, rows: rows.length, multi };
  });
  check(schedule.groups > 0, "phone: Today has no grouped show cards");
  check(schedule.rows > 0, "phone: Today has no episode rows");
  check(schedule.multi.length > 0, "phone: expected at least one same-show multi-episode group from current production data");
  check(schedule.multi.every((item) => /一次上架|同日播映/.test(item.label)), `phone: grouped multi-episode card lacks batch label ${JSON.stringify(schedule.multi)}`);
  note(`phone: Today ${schedule.rows} episodes rendered as ${schedule.groups} show cards; multi=${JSON.stringify(schedule.multi)}`);

  await openView(page, "week");
  await noOverflow(page, "phone:week");
  const weekGrouping = await page.evaluate(() => ({ groups: document.querySelectorAll(".schedule-show-group").length, rows: document.querySelectorAll(".schedule-row").length }));
  check(weekGrouping.groups <= weekGrouping.rows, "phone: Week grouping produced more cards than episode rows");
  note(`phone: Week ${weekGrouping.rows} episodes / ${weekGrouping.groups} show cards`);

  await openView(page, "airing");
  await noOverflow(page, "phone:airing");
  const airing = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("#show-grid > .show-card")];
    const info = cards.map((card) => ({
      title: card.querySelector(".show-card-body h4")?.textContent?.trim() || "",
      status: card.querySelector(".status-badge")?.textContent?.trim() || "",
      scheduleNote: card.querySelector(".show-schedule-note")?.textContent?.trim() || ""
    }));
    return { info, house: info.find((item) => item.title === "House of the Dragon") || null };
  });
  check(airing.info.length > 0, "phone: Airing has no cards");
  check(airing.info.every((item) => item.status !== "播映中"), `phone: an Airing card still exposes only generic 播映中 ${JSON.stringify(airing.info.filter((item) => item.status === "播映中"))}`);
  check(airing.info.every((item) => item.scheduleNote), "phone: an Airing card lacks next-schedule explanation");
  if (airing.house) note(`phone: House of the Dragon => ${airing.house.status} | ${airing.house.scheduleNote}`);
  else note("phone: House of the Dragon is not in current Airing response");

  const api = await page.evaluate(async () => {
    const response = await fetch("/api/shows?status=airing&limit=60&region=HK", { cache: "no-store" });
    const payload = await response.json();
    const house = (payload.data || []).find((show) => show.english_title === "House of the Dragon") || null;
    const exactCount = (payload.data || []).filter((show) => show.tvmaze_next_episode_timestamp).length;
    return { house, exactCount, total: (payload.data || []).length };
  });
  check(api.total > 0, "phone: Airing API is empty");
  note(`phone: Airing API precise next timestamps ${api.exactCount}/${api.total}`);
  if (api.house) {
    if (api.house.tvmaze_next_episode_timestamp) {
      check(Boolean(airing.house?.status?.includes("下集")), "phone: House of the Dragon has a future timestamp but UI does not show next episode timing");
      note(`phone: House of the Dragon API next=${api.house.tvmaze_next_episode_timestamp}`);
    } else {
      check(Boolean(airing.house?.scheduleNote?.includes("不會推測或補造播映時間")), "phone: House of the Dragon has no future timestamp but UI does not explain that timing is unconfirmed");
      note("phone: House of the Dragon has no future TVmaze episode; UI correctly avoids inventing a time");
    }
  }

  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, "phone-airing.png"), fullPage: true });
    await openView(page, "today");
    await page.screenshot({ path: path.join(screenshotDir, "phone-today.png"), fullPage: true });
  }

  check(errors.length === 0, `phone: browser errors ${JSON.stringify(errors)}`);
  await context.close();
}

async function runDesktop(browser) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK", timezoneId: "Asia/Hong_Kong" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${baseUrl}/?d4=schedule-ux-desktop`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await stable(page, "desktop:init");
  for (const view of ["week", "airing", "upcoming", "planned", "today"]) {
    await openView(page, view);
    await noOverflow(page, `desktop:${view}`);
  }
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, "desktop-today.png"), fullPage: true });
  }
  check(errors.length === 0, `desktop: browser errors ${JSON.stringify(errors)}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await runPhone(browser);
  await runDesktop(browser);
} catch (error) {
  failures.push(`audit exception: ${error?.stack || error}`);
} finally {
  await browser.close();
}

console.log("\nPhase 5E-D4 schedule UX audit notes:");
for (const item of notes) console.log(`- ${item}`);
if (failures.length) {
  console.error("\nPhase 5E-D4 schedule UX audit FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("\nPhase 5E-D4 schedule UX audit PASSED.");
