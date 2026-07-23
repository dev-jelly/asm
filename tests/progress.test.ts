import assert from "node:assert/strict";
import test from "node:test";
import {
  clearProgress,
  completeActivity,
  emptyProgress,
  PROGRESS_KEY,
  readProgress,
  type StorageAdapter,
} from "../app/lib/progress";

function createStorage(): StorageAdapter & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

test("local progress starts empty and records unique completed activities", () => {
  const storage = createStorage();
  assert.deepEqual(readProgress(storage), emptyProgress());

  completeActivity(storage, "tracer-bullet");
  const result = completeActivity(storage, "tracer-bullet");
  assert.deepEqual(result.completedActivities, ["tracer-bullet"]);
  assert.deepEqual(readProgress(storage), result);
});

test("invalid or incompatible progress falls back safely", () => {
  const storage = createStorage();
  storage.values.set(PROGRESS_KEY, "{not-json");
  assert.deepEqual(readProgress(storage), emptyProgress());

  storage.values.set(
    PROGRESS_KEY,
    JSON.stringify({ version: 99, completedActivities: ["old"] }),
  );
  assert.deepEqual(readProgress(storage), emptyProgress());
});

test("device reset removes only the versioned progress key", () => {
  const storage = createStorage();
  storage.values.set(PROGRESS_KEY, JSON.stringify(emptyProgress()));
  storage.values.set("unrelated", "keep");

  assert.deepEqual(clearProgress(storage), emptyProgress());
  assert.equal(storage.values.has(PROGRESS_KEY), false);
  assert.equal(storage.values.get("unrelated"), "keep");
});
