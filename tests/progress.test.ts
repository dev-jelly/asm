import assert from "node:assert/strict";
import test from "node:test";
import {
  clearProgress,
  completeActivity,
  emptyProgress,
  exportProgress,
  LEGACY_ACTIVITY_TO_MISSION,
  markMissionProgress,
  MISSION_IDS,
  PROGRESS_KEY,
  PROGRESS_VERSION,
  readProgress,
  saveMissionProgress,
  serializeProgress,
  setLastMission,
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

test("v3 progress starts as a complete, stable mission snapshot", () => {
  const progress = emptyProgress();

  assert.equal(progress.version, PROGRESS_VERSION);
  assert.deepEqual(Object.keys(progress.missions), [...MISSION_IDS]);
  assert.equal(progress.lastMissionId, null);
  for (const mission of Object.values(progress.missions)) {
    assert.deepEqual(mission, {
      status: "not-started",
      predictionAttempts: 0,
      predictionCorrect: false,
      predictionSkipped: false,
      transferAttempts: 0,
      transferCompleted: false,
      transferPassed: false,
      lastAttemptAt: null,
    });
  }

  assert.notEqual(
    emptyProgress().missions["pc-next"],
    emptyProgress().missions["pc-next"],
  );
});

test("markMissionProgress merges evidence monotonically without mutation", () => {
  const original = emptyProgress();
  const guided = markMissionProgress(original, "pc-next", {
    status: "guided",
    predictionAttempts: 2,
    predictionCorrect: true,
    predictionSkipped: true,
    lastAttemptAt: "2026-07-29T01:02:03+09:00",
  });

  assert.deepEqual(original, emptyProgress());
  assert.deepEqual(guided.missions["pc-next"], {
    status: "guided",
    predictionAttempts: 2,
    predictionCorrect: true,
    predictionSkipped: true,
    transferAttempts: 0,
    transferCompleted: false,
    transferPassed: false,
    lastAttemptAt: "2026-07-28T16:02:03.000Z",
  });
  assert.equal(guided.lastMissionId, "pc-next");

  const independent = markMissionProgress(guided, "pc-next", {
    status: "not-started",
    predictionAttempts: 1,
    predictionAttempt: true,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempt: true,
    transferCompleted: true,
    transferPassed: true,
    lastAttemptAt: "2026-07-20T00:00:00Z",
  });
  assert.deepEqual(independent.missions["pc-next"], {
    status: "independent",
    predictionAttempts: 3,
    predictionCorrect: true,
    predictionSkipped: true,
    transferAttempts: 1,
    transferCompleted: true,
    transferPassed: true,
    lastAttemptAt: "2026-07-28T16:02:03.000Z",
  });
});

test("only a first-attempt transfer success becomes independent", () => {
  const firstWrong = markMissionProgress(emptyProgress(), "pc-next", {
    status: "guided",
    transferAttempt: true,
    lastAttemptAt: "2026-07-29T00:00:00Z",
  });
  const reviewed = markMissionProgress(firstWrong, "pc-next", {
    transferAttempt: true,
    transferCompleted: true,
    transferPassed: true,
    lastAttemptAt: "2026-07-29T00:01:00Z",
  });

  assert.deepEqual(reviewed.missions["pc-next"], {
    status: "guided",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 2,
    transferCompleted: true,
    transferPassed: false,
    lastAttemptAt: "2026-07-29T00:01:00.000Z",
  });

  const cannotMoveBackwards = markMissionProgress(reviewed, "pc-next", {
    status: "not-started",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 0,
    transferCompleted: false,
    transferPassed: false,
    lastAttemptAt: "2026-07-20T00:00:00Z",
  });
  assert.deepEqual(cannotMoveBackwards, reviewed);
});

test("setLastMission changes only the resume target", () => {
  const progress = markMissionProgress(emptyProgress(), "x-zero-wrap", {
    predictionAttempt: true,
    lastAttemptAt: "2026-07-29T00:00:00Z",
  });
  const result = setLastMission(progress, "memory-store-byte");

  assert.equal(result.lastMissionId, "memory-store-byte");
  assert.equal(result.missions["x-zero-wrap"].status, "not-started");
  assert.deepEqual(result.missions, progress.missions);
  assert.notEqual(result, progress);
});

test("prediction attempts accumulate without claiming guided completion", () => {
  const first = markMissionProgress(emptyProgress(), "pc-next", {
    predictionAttempt: true,
    lastAttemptAt: "2026-07-29T00:00:00Z",
  });
  const second = markMissionProgress(first, "pc-next", {
    predictionAttempt: true,
    lastAttemptAt: "2026-07-29T00:01:00Z",
  });

  assert.deepEqual(second.missions["pc-next"], {
    status: "not-started",
    predictionAttempts: 2,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 0,
    transferCompleted: false,
    transferPassed: false,
    lastAttemptAt: "2026-07-29T00:01:00.000Z",
  });
});

test("v1 completed activities migrate to canonical guided mission evidence", () => {
  const storage = createStorage();
  storage.values.set(
    PROGRESS_KEY,
    JSON.stringify({
      version: 1,
      completedActivities: [
        "tracer-bullet",
        "signed-loads",
        "little-endian",
        42,
        "unknown",
        "address-versus-value",
      ],
    }),
  );

  const result = readProgress(storage);
  assert.equal(result.version, 3);
  assert.equal(
    result.missions[LEGACY_ACTIVITY_TO_MISSION["tracer-bullet"]].status,
    "guided",
  );
  assert.equal(result.missions["memory-signed-loads"].status, "guided");
  assert.equal(result.missions["memory-address-value"].status, "guided");
  assert.equal(result.missions["memory-store-byte"].status, "not-started");
  assert.equal(result.lastMissionId, "memory-address-value");
  assert.equal(result.missions["memory-little-endian"].predictionAttempts, 0);
  assert.equal(result.missions["memory-little-endian"].predictionCorrect, false);
  assert.equal(result.missions["memory-little-endian"].predictionSkipped, false);
  assert.equal(result.missions["memory-little-endian"].transferAttempts, 0);
  assert.equal(result.missions["memory-little-endian"].transferCompleted, false);
  assert.equal(result.missions["memory-little-endian"].transferPassed, false);
});

test("v2 independent evidence migrates conservatively to reviewed completion", () => {
  const storage = createStorage();
  storage.values.set(
    PROGRESS_KEY,
    JSON.stringify({
      version: 2,
      missions: {
        unknown: {
          status: "independent",
          predictionAttempts: 99,
          transferPassed: true,
          lastAttemptAt: "2026-01-01",
        },
        "memory-signed-loads": {
          status: "guided",
          predictionAttempts: 2.9,
          transferPassed: false,
          lastAttemptAt: "2026-07-29T09:00:00+09:00",
        },
        "pc-next": {
          status: "invalid",
          predictionAttempts: -10,
          transferPassed: true,
          lastAttemptAt: "not-a-date",
        },
        "x-zero-wrap": {
          status: "independent",
          predictionAttempts: 1,
          transferPassed: false,
          lastAttemptAt: "2026-07-29T10:00:00+09:00",
        },
      },
      lastMissionId: "unknown",
    }),
  );

  const result = readProgress(storage);
  assert.deepEqual(Object.keys(result.missions), [...MISSION_IDS]);
  assert.deepEqual(result.missions["memory-signed-loads"], {
    status: "guided",
    predictionAttempts: 2,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 0,
    transferCompleted: false,
    transferPassed: false,
    lastAttemptAt: "2026-07-29T00:00:00.000Z",
  });
  assert.deepEqual(result.missions["pc-next"], {
    status: "guided",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 1,
    transferCompleted: true,
    transferPassed: false,
    lastAttemptAt: null,
  });
  assert.deepEqual(result.missions["x-zero-wrap"], {
    status: "guided",
    predictionAttempts: 1,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 1,
    transferCompleted: true,
    transferPassed: false,
    lastAttemptAt: "2026-07-29T01:00:00.000Z",
  });
  assert.equal(result.lastMissionId, null);
  assert.equal(exportProgress(storage), `${serializeProgress(result, true)}\n`);
  assert.deepEqual(
    Object.keys(JSON.parse(exportProgress(storage)).missions),
    [...MISSION_IDS],
  );
});

test("v3 reads are sanitized and exports have deterministic ordering", () => {
  const storage = createStorage();
  storage.values.set(
    PROGRESS_KEY,
    JSON.stringify({
      version: 3,
      missions: {
        unknown: {
          status: "independent",
          predictionAttempts: 99,
          predictionCorrect: true,
          predictionSkipped: true,
          transferAttempts: 99,
          transferCompleted: true,
          transferPassed: true,
          lastAttemptAt: "2026-01-01",
        },
        "memory-signed-loads": {
          status: "guided",
          predictionAttempts: 2.9,
          predictionCorrect: true,
          predictionSkipped: true,
          transferAttempts: 2.9,
          transferCompleted: true,
          transferPassed: false,
          lastAttemptAt: "2026-07-29T09:00:00+09:00",
        },
        "pc-next": {
          status: "independent",
          predictionAttempts: -10,
          predictionCorrect: "yes",
          predictionSkipped: 1,
          transferAttempts: -2,
          transferCompleted: false,
          transferPassed: false,
          lastAttemptAt: "not-a-date",
        },
        "memory-store-byte": {
          status: "not-started",
          transferAttempts: 0,
          transferCompleted: false,
          transferPassed: true,
        },
        "memory-partial-store": {
          status: "independent",
          transferAttempts: 2,
          transferCompleted: false,
          transferPassed: true,
        },
      },
      lastMissionId: "unknown",
    }),
  );

  const result = readProgress(storage);
  assert.deepEqual(Object.keys(result.missions), [...MISSION_IDS]);
  assert.deepEqual(result.missions["memory-signed-loads"], {
    status: "guided",
    predictionAttempts: 2,
    predictionCorrect: true,
    predictionSkipped: true,
    transferAttempts: 2,
    transferCompleted: true,
    transferPassed: false,
    lastAttemptAt: "2026-07-29T00:00:00.000Z",
  });
  assert.deepEqual(result.missions["pc-next"], {
    status: "guided",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 0,
    transferCompleted: false,
    transferPassed: false,
    lastAttemptAt: null,
  });
  assert.deepEqual(result.missions["memory-store-byte"], {
    status: "independent",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 1,
    transferCompleted: true,
    transferPassed: true,
    lastAttemptAt: null,
  });
  assert.deepEqual(result.missions["memory-partial-store"], {
    status: "guided",
    predictionAttempts: 0,
    predictionCorrect: false,
    predictionSkipped: false,
    transferAttempts: 2,
    transferCompleted: true,
    transferPassed: false,
    lastAttemptAt: null,
  });
  assert.equal(result.lastMissionId, null);
  assert.equal(exportProgress(storage), `${serializeProgress(result, true)}\n`);
  assert.deepEqual(
    Object.keys(JSON.parse(exportProgress(storage)).missions),
    [...MISSION_IDS],
  );
});

test("storage helpers and the v1 completion wrapper persist v3 data", () => {
  const storage = createStorage();
  saveMissionProgress(storage, "memory-store-byte", {
    predictionAttempt: true,
    lastAttemptAt: "2026-07-29T00:00:00Z",
  });
  const result = completeActivity(storage, "little-endian");
  const persisted = JSON.parse(storage.values.get(PROGRESS_KEY) ?? "{}");

  assert.equal(persisted.version, 3);
  assert.equal(result.missions["memory-store-byte"].predictionAttempts, 1);
  assert.equal(result.missions["memory-little-endian"].status, "guided");
  assert.equal(result.lastMissionId, "memory-little-endian");
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

  storage.values.set(
    PROGRESS_KEY,
    JSON.stringify({ version: 1, completedActivities: "not-an-array" }),
  );
  assert.deepEqual(readProgress(storage), emptyProgress());
});

test("device reset removes only the versioned progress key", () => {
  const storage = createStorage();
  storage.values.set(PROGRESS_KEY, serializeProgress(emptyProgress()));
  storage.values.set("unrelated", "keep");

  assert.deepEqual(clearProgress(storage), emptyProgress());
  assert.equal(storage.values.has(PROGRESS_KEY), false);
  assert.equal(storage.values.get("unrelated"), "keep");
});
