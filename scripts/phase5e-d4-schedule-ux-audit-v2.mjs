import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const baseUrl = String(process.env.PRODUCTION_URL || "https://series-hub.max-yu-jp.workers.dev").replace(/\/$/, "");
const screenshotDir = process.env.SCREENSHOT_DIR || "";
const failures = [];
const notes = [];
const check = (value, message) => { if (!value) failures.push(message); };
const note = (value) => { notes.push(value); console.log(value); };

async function stable(page, label) {
  await page.waitForFunction(() => document.querySelector("#show-count")?.textContent !== "載入中…" && document.querySelector(".content-panel")?.getAttribute("aria-busy") === "false", { timeout: 20000 });
  const state = await page.evaluate(() => ({
    title: document.querySelector("#view-title")?.textContent || "",
    count: document.querySelector("#show-count")?.textContent || "",
    error: document.querySelector("#empty-state")?.dataset?.state || ""
  }));
  check(state.error !== "error", `${label}: error state`);
  note(`${label}: ${state.title} · ${state.count}`);
}

async function openView(page, view) {
  const button = page.locator(`.filter[data-view="${view}"]`);
  await button.evaluate((node) => node.click());
  await stable(page, view);
  check(await button.evaluate((node) => node.classList.contains("active")), `${view}: filter did not activate`);
}

async function overflow(page, label) {
  const m = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  check(m.doc <= m.viewport + 1, `${label}: document overflow ${m.doc}/${m.viewport}`);
  check(m.body <= m.viewport + 1, `${label}: body overflow ${m.body}/${m.viewport}`);
}

async function phone(browser) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-HK", timezoneId: "Asia/Hong_Kong" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${baseUrl}/?d4=schedule-ux-v2`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await stable(page, "phone:init");
  await overflow(page, "phone:init");

  const landing = await page.evaluate(() => ({
    hero: Boolean(document.querySelector(".hero")),
    title: document.querySelector("#view-title")?.textContent || "",
    titleTop: Math.round(document.querySelector("#view-title")?.getBoundingClientRect().top || 0),
    contentTop: document.querySelector(".content-panel")?.getBoundingClientRect().top || 0,
    serviceTop: document.querySelector(".service-status")?.getBoundingClientRect().top || 0,
    todayRect: (() => { const r = document.querySelector('.filter[data-view="today"]')?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; })(),
    weekRect: (() => { const r = document.querySelector('.filter[data-view="week"]')?.getBoundingClientRect(); return r ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null; })()
  }));
  check(!landing.hero, "phone: long hero still present");
  check(landing.title === "今日播映", `phone: unexpected landing title ${landing.title}`);
  check(landing.serviceTop > landing.contentTop, "phone: service status precedes main content");
  check(landing.todayRect && landing.todayRect.left >= -1 && landing.todayRect.right <= 391, `phone: Today control outside horizontal viewport ${JSON.stringify(landing.todayRect)}`);
  check(landing.weekRect && landing.weekRect.left >= -1 && landing.weekRect.right <= 391, `phone: Week control outside horizontal viewport ${JSON.stringify(landing.weekRect)}`);
  note(`phone: content-first title top=${landing.titleTop}px`);

  const today = await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".schedule-show-group")];
    const rows = [...document.querySelectorAll(".schedule-row")];
    const multi = groups.map((g) => ({ rows: g.querySelectorAll(".schedule-row").length, label: g.querySelector(".schedule-batch-label")?.textContent || "" })).filter((x) => x.rows > 1);
    return { groups: groups.length, rows: rows.length, multi };
  });
  check(today.groups > 0 && today.rows > 0, "phone: Today schedule did not render grouped cards");
  check(today.multi.length > 0, "phone: production Today data has no detected multi-episode group");
  check(today.multi.every((x) => /一次上架|同日播映/.test(x.label)), `phone: bad multi-episode labels ${JSON.stringify(today.multi)}`);
  note(`phone: Today ${today.rows} episodes => ${today.groups} show cards; ${JSON.stringify(today.multi)}`);

  await openView(page, "week");
  await overflow(page, "phone:week");
  const week = await page.evaluate(() => ({ groups: document.querySelectorAll(".schedule-show-group").length, rows: document.querySelectorAll(".schedule-row").length }));
  check(week.groups > 0 && week.groups <= week.rows, `phone: invalid Week grouping ${JSON.stringify(week)}`);
  note(`phone: Week ${week.rows} episodes => ${week.groups} show cards`);

  await openView(page, "airing");
  await overflow(page, "phone:airing");
  const ui = await page.evaluate(() => {
    const items = [...document.querySelectorAll("#show-grid > .show-card")].map((card) => ({
      title: card.querySelector(".show-card-body h4")?.textContent?.trim() || "",
      status: card.querySelector(".status-badge")?.textContent?.trim() || "",
      note: card.querySelector(".show-schedule-note")?.textContent?.trim() || ""
    }));
    return { items, house: items.find((x) => x.title === "House of the Dragon") || null };
  });
  check(ui.items.length > 0, "phone: no Airing cards");
  check(ui.items.every((x) => x.status !== "播映中"), `phone: generic Airing badge remains ${JSON.stringify(ui.items.filter((x) => x.status === "播映中"))}`);
  check(ui.items.every((x) => Boolean(x.note)), "phone: Airing card without schedule explanation");

  const api = await page.evaluate(async () => {
    const payload = await fetch("/api/shows?status=airing&limit=60&region=HK", { cache: "no-store" }).then((r) => r.json());
    const data = payload.data || [];
    return { total: data.length, exact: data.filter((x) => x.tvmaze_next_episode_timestamp).length, house: data.find((x) => x.english_title === "House of the Dragon") || null };
  });
  check(api.total > 0, "phone: Airing API empty");
  note(`phone: Airing precise next timestamps ${api.exact}/${api.total}`);
  if (api.house) {
    if (api.house.tvmaze_next_episode_timestamp) {
      check(Boolean(ui.house?.status?.includes("下集")), "phone: House has precise next timestamp but UI does not show it");
      note(`phone: House of the Dragon => ${ui.house?.status} | ${api.house.tvmaze_next_episode_timestamp}`);
    } else {
      check(Boolean(ui.house?.note?.includes("不會推測或補造播映時間")), "phone: House has no future TVmaze episode but UI does not explain uncertainty");
      note(`phone: House of the Dragon => ${ui.house?.status} | no future TVmaze episode; no time fabricated`);
    }
  } else {
    note("phone: House of the Dragon not in current Airing response");
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

async function desktop(browser) {
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-HK", timezoneId: "Asia/Hong_Kong" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(`${baseUrl}/?d4=schedule-ux-v2-desktop`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await stable(page, "desktop:init");
  for (const view of ["week", "airing", "upcoming", "planned", "today"]) {
    await openView(page, view);
    await overflow(page, `desktop:${view}`);
  }
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, "desktop-today.png"), fullPage: true });
  check(errors.length === 0, `desktop: browser errors ${JSON.stringify(errors)}`);
  await context.close();
}

const browser = await chromium.launch({ headless: true });
try { await phone(browser); await desktop(browser); }
catch (error) { failures.push(`audit exception: ${error?.stack || error}`); }
finally { await browser.close(); }
console.log("\nD4 schedule UX v2 notes:");
for (const item of notes) console.log(`- ${item}`);
if (failures.length) {
  console.error("\nD4 schedule UX v2 FAILED:");
  for (const item of failures) console.error(`- ${item}`);
  process.exit(1);
}
console.log("\nD4 schedule UX v2 PASSED.");
