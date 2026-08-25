import test from "node:test";
import assert from "node:assert/strict";

import {
  TRACKING_STORAGE_KEY,
  isTrackedShow,
  loadTrackedShowIds,
  normalizeTrackedShowIds,
  saveTrackedShowIds,
  toggleTrackedShowId
} from "../public/tracking.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test("tracked show IDs are positive unique integers", () => {
  assert.deepEqual(normalizeTrackedShowIds([3, "3", 7, 0, -1, "bad", 8.5, 9]), [3, 7, 9]);
});

test("tracking storage loads safely and ignores corrupt data", () => {
  const storage = memoryStorage({ [TRACKING_STORAGE_KEY]: JSON.stringify([7, 9, 7]) });
  assert.deepEqual(loadTrackedShowIds(storage), [7, 9]);

  const corrupt = memoryStorage({ [TRACKING_STORAGE_KEY]: "{" });
  assert.deepEqual(loadTrackedShowIds(corrupt), []);
});

test("toggle adds and removes one show without disturbing the rest", () => {
  assert.deepEqual(toggleTrackedShowId([7, 9], 11), [7, 9, 11]);
  assert.deepEqual(toggleTrackedShowId([7, 9], 7), [9]);
  assert.equal(isTrackedShow([7, 9], 9), true);
  assert.equal(isTrackedShow([7, 9], 10), false);
});

test("save writes the normalized versioned payload", () => {
  const storage = memoryStorage();
  assert.deepEqual(saveTrackedShowIds([5, "5", 6], storage), [5, 6]);
  assert.equal(storage.getItem(TRACKING_STORAGE_KEY), "[5,6]");
});
