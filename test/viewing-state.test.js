import test from "node:test";
import assert from "node:assert/strict";
import {
  VIEWING_STATE_STORAGE_KEY,
  getViewingState,
  loadViewingStates,
  normalizeViewingStates,
  saveViewingStates,
  setViewingState
} from "../public/viewing-state.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    value(key) { return data.get(key); }
  };
}

test("Phase 5C viewing states accept only positive show IDs and supported states", () => {
  assert.deepEqual(normalizeViewingStates({
    1: "watching",
    2: "waiting",
    3: "completed",
    4: "paused",
    0: "watching",
    bad: "watching",
    5: "other"
  }), {
    1: "watching",
    2: "waiting",
    3: "completed",
    4: "paused"
  });
});

test("Phase 5C viewing states persist locally and can be cleared without touching tracking", () => {
  const storage = memoryStorage();
  let states = setViewingState({}, 12, "watching");
  states = saveViewingStates(states, storage);
  assert.equal(storage.value(VIEWING_STATE_STORAGE_KEY), '{"12":"watching"}');
  assert.equal(getViewingState(loadViewingStates(storage), 12), "watching");

  states = setViewingState(states, 12, "");
  assert.deepEqual(states, {});
});

test("invalid or unavailable local storage falls back safely", () => {
  const broken = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); }
  };
  assert.deepEqual(loadViewingStates(broken), {});
  assert.deepEqual(saveViewingStates({ 7: "paused" }, broken), { 7: "paused" });
});
