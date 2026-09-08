import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import phase7Worker from "../src/phase7-worker.js";
import { buildWatchAvailability, normalizeWatchProviders } from "../src/phase7-watch.js";

const [html, ui, css, wrangler] = await Promise.all([
  readFile(new URL("../public/show.html", import.meta.url), "utf8"),
  readFile(new URL("../public/phase7c-ui.js", import.meta.url), "utf8"),
  readFile(new URL("../public/phase7c.css", import.meta.url), "utf8"),
  readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
]);

function fakeDb(show = { id: 7, tmdb_id: 123, english_title: "Example", original_title: "Example" }) {
  return {
    prepare(sql) {
      assert.match(sql, /SELECT id, tmdb_id/);
      return {
        bind(id) {
          return {
            first: async () => Number(id) === Number(show.id) ? show : null
          };
        }
      };
    }
  };
}

test("Phase 7C normalizes HK and US JustWatch provider groups without inventing deep links", () => {
  const normalized = normalizeWatchProviders({
    results: {
      HK: {
        link: "https://www.themoviedb.org/tv/123/watch?locale=HK",
        flatrate: [
          { provider_id: 8, provider_name: "Netflix", logo_path: "/netflix.jpg", display_priority: 2 },
          { provider_id: 8, provider_name: "Netflix duplicate", logo_path: "/duplicate.jpg", display_priority: 3 },
          { provider_id: 350, provider_name: "Apple TV Plus", logo_path: "/apple.jpg", display_priority: 1 }
        ],
        rent: [{ provider_id: 2, provider_name: "Apple TV", logo_path: null, display_priority: 4 }]
      },
      US: {
        link: "https://evil.example/watch",
        free: [{ provider_id: 73, provider_name: "Tubi TV", logo_path: "/tubi.jpg", display_priority: 5 }],
        ads: [{ provider_id: 73, provider_name: "Tubi TV", logo_path: "/tubi.jpg", display_priority: 5 }]
      }
    }
  });

  assert.equal(normalized.regions.HK.available, true);
  assert.equal(normalized.regions.HK.flatrate.length, undefined);
  assert.deepEqual(normalized.regions.HK.groups.flatrate.map((provider) => provider.provider_id), [350, 8]);
  assert.equal(normalized.regions.HK.groups.rent[0].name, "Apple TV");
  assert.match(normalized.regions.HK.groups.flatrate[0].logo_url, /image\.tmdb\.org\/t\/p\/w92\/apple\.jpg$/);
  assert.match(normalized.regions.HK.link, /^https:\/\/www\.themoviedb\.org\//);
  assert.equal(normalized.regions.US.available, true);
  assert.equal(normalized.regions.US.link, null);
  assert.equal(normalized.attribution.source, "JustWatch");
  assert.equal(normalized.attribution.required, true);
});

test("Phase 7C availability is a safe empty layer when TMDB credentials are unavailable", async () => {
  const result = await buildWatchAvailability({ DB: fakeDb() }, 7);
  assert.equal(result.status, 200);
  assert.equal(result.body.meta.configured, false);
  assert.equal(result.body.meta.phase, "7c-watch-availability");
  assert.deepEqual(result.body.meta.checkedRegions, ["HK", "US"]);
  assert.equal(result.body.data.regions.HK.available, false);
  assert.equal(result.body.data.regions.US.available, false);
  assert.equal(result.body.data.attribution.source, "JustWatch");
});

test("Phase 7C Worker route stays isolated from the accepted Phase 6 detail route", async () => {
  const response = await phase7Worker.fetch(
    new Request("https://example.test/api/shows/7/watch-providers"),
    { DB: fakeDb() },
    {}
  );
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.phase, "7c-watch-availability");
  assert.equal(payload.meta.showId, 7);
});

test("Phase 7C detail UI keeps availability region separate and visibly attributes JustWatch", () => {
  assert.match(wrangler, /src\/phase7-worker\.js/);
  assert.match(html, /phase7c\.css/);
  assert.match(html, /phase7c-ui\.js/);
  assert.match(html, /JustWatch/);
  assert.match(ui, /series-hub-watch-region-v1/);
  assert.match(ui, /data-watch-region=\"HK\"/);
  assert.match(ui, /data-watch-region=\"US\"/);
  assert.match(ui, /觀看供應資料由/);
  assert.match(ui, /JustWatch/);
  assert.match(ui, /TMDB/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /min-height: 44px/);
});
