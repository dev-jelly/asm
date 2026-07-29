import {
  MEMORY_MISSION_IDS,
  type MemoryMissionId,
} from "../content/memoryMissionIds";

export const PROGRESS_KEY = "asm-lab-progress";
export const PROGRESS_VERSION = 2 as const;

export const MISSION_IDS = MEMORY_MISSION_IDS;
export type MissionId = MemoryMissionId;
export type MissionStatus = "not-started" | "guided" | "independent";

export type MissionProgress = {
  status: MissionStatus;
  predictionAttempts: number;
  transferPassed: boolean;
  lastAttemptAt: string | null;
};

export type ProgressData = {
  version: typeof PROGRESS_VERSION;
  missions: Record<MissionId, MissionProgress>;
  lastMissionId: MissionId | null;
};

export type MissionProgressUpdate = {
  /**
   * Cumulative attempt count. Updates never lower a count that was already
   * recorded. Use `predictionAttempt: true` to add exactly one attempt.
   */
  predictionAttempts?: number;
  predictionAttempt?: boolean;
  status?: MissionStatus;
  transferPassed?: boolean;
  lastAttemptAt?: string | null;
};

export type StorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export const LEGACY_ACTIVITY_TO_MISSION = {
  "tracer-bullet": "memory-little-endian",
  "signed-loads": "memory-signed-loads",
  "little-endian": "memory-little-endian",
  "address-versus-value": "memory-address-value",
} as const satisfies Record<string, MissionId>;

const MISSION_ID_SET = new Set<string>(MISSION_IDS);
const STATUS_RANK: Record<MissionStatus, number> = {
  "not-started": 0,
  guided: 1,
  independent: 2,
};

function emptyMissionProgress(): MissionProgress {
  return {
    status: "not-started",
    predictionAttempts: 0,
    transferPassed: false,
    lastAttemptAt: null,
  };
}

function createEmptyMissions(): Record<MissionId, MissionProgress> {
  return Object.fromEntries(
    MISSION_IDS.map((missionId) => [missionId, emptyMissionProgress()]),
  ) as Record<MissionId, MissionProgress>;
}

export function emptyProgress(): ProgressData {
  return {
    version: PROGRESS_VERSION,
    missions: createEmptyMissions(),
    lastMissionId: null,
  };
}

export function isMissionId(value: unknown): value is MissionId {
  return typeof value === "string" && MISSION_ID_SET.has(value);
}

export function resolveMissionId(value: string): MissionId | null {
  if (isMissionId(value)) return value;
  return (
    LEGACY_ACTIVITY_TO_MISSION[
      value as keyof typeof LEGACY_ACTIVITY_TO_MISSION
    ] ?? null
  );
}

function isMissionStatus(value: unknown): value is MissionStatus {
  return (
    value === "not-started" ||
    value === "guided" ||
    value === "independent"
  );
}

function normalizeAttemptCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER);
}

function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function laterTimestamp(
  current: string | null,
  candidate: string | null,
): string | null {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) >= Date.parse(current) ? candidate : current;
}

function higherStatus(
  current: MissionStatus,
  candidate: MissionStatus,
): MissionStatus {
  return STATUS_RANK[candidate] > STATUS_RANK[current] ? candidate : current;
}

function normalizeMissionProgress(value: unknown): MissionProgress {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyMissionProgress();
  }

  const candidate = value as Partial<Record<keyof MissionProgress, unknown>>;
  const predictionAttempts = normalizeAttemptCount(
    candidate.predictionAttempts,
  );
  const transferPassed = candidate.transferPassed === true;
  const lastAttemptAt = normalizeTimestamp(candidate.lastAttemptAt);
  let status = isMissionStatus(candidate.status)
    ? candidate.status
    : "not-started";

  if (transferPassed) status = "independent";

  return {
    status,
    predictionAttempts,
    transferPassed,
    lastAttemptAt,
  };
}

function normalizeV2(value: unknown): ProgressData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyProgress();
  }

  const candidate = value as {
    missions?: unknown;
    lastMissionId?: unknown;
  };
  const rawMissions =
    candidate.missions &&
    typeof candidate.missions === "object" &&
    !Array.isArray(candidate.missions)
      ? (candidate.missions as Record<string, unknown>)
      : {};
  const missions = createEmptyMissions();

  for (const missionId of MISSION_IDS) {
    missions[missionId] = normalizeMissionProgress(rawMissions[missionId]);
  }

  return {
    version: PROGRESS_VERSION,
    missions,
    lastMissionId: isMissionId(candidate.lastMissionId)
      ? candidate.lastMissionId
      : null,
  };
}

function migrateV1(value: unknown): ProgressData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyProgress();
  }

  const completedActivities = (
    value as { completedActivities?: unknown }
  ).completedActivities;
  if (!Array.isArray(completedActivities)) return emptyProgress();

  let migrated = emptyProgress();
  for (const activityId of completedActivities) {
    if (typeof activityId !== "string") continue;
    const missionId = resolveMissionId(activityId);
    if (!missionId) continue;
    migrated = markMissionProgress(migrated, missionId, {
      status: "guided",
    });
  }
  return migrated;
}

/**
 * Reads either the current schema or the legacy v1 schema. The returned value
 * is always a complete, canonical v2 snapshot and never exposes parsed input
 * objects by reference.
 */
export function readProgress(storage: StorageAdapter): ProgressData {
  const raw = storage.getItem(PROGRESS_KEY);
  if (!raw) return emptyProgress();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyProgress();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return emptyProgress();
  }

  const version = (parsed as { version?: unknown }).version;
  if (version === PROGRESS_VERSION) return normalizeV2(parsed);
  if (version === 1) return migrateV1(parsed);
  return emptyProgress();
}

/**
 * Purely merges new evidence into one mission. Evidence is monotonic: status,
 * attempt count, transfer success, and attempt time cannot move backwards.
 */
export function markMissionProgress(
  progress: ProgressData,
  missionId: MissionId,
  update: MissionProgressUpdate = {},
): ProgressData {
  const current = normalizeV2(progress);
  if (!isMissionId(missionId)) return current;
  const previous = current.missions[missionId];
  const requestedAttempts = normalizeAttemptCount(update.predictionAttempts);
  const predictionAttempts = update.predictionAttempt
    ? Math.min(previous.predictionAttempts + 1, Number.MAX_SAFE_INTEGER)
    : Math.max(previous.predictionAttempts, requestedAttempts);
  const candidateTimestamp = normalizeTimestamp(update.lastAttemptAt);
  const lastAttemptAt = laterTimestamp(
    previous.lastAttemptAt,
    candidateTimestamp,
  );
  const transferPassed =
    previous.transferPassed || update.transferPassed === true;
  let status = higherStatus(
    previous.status,
    isMissionStatus(update.status) ? update.status : previous.status,
  );

  if (transferPassed) status = "independent";

  return {
    version: PROGRESS_VERSION,
    missions: {
      ...current.missions,
      [missionId]: {
        status,
        predictionAttempts,
        transferPassed,
        lastAttemptAt,
      },
    },
    lastMissionId: missionId,
  };
}

/** Purely changes the resume target without manufacturing learning evidence. */
export function setLastMission(
  progress: ProgressData,
  missionId: MissionId | null,
): ProgressData {
  const current = normalizeV2(progress);
  return {
    ...current,
    lastMissionId: isMissionId(missionId) ? missionId : null,
  };
}

export function serializeProgress(
  progress: ProgressData,
  pretty = false,
): string {
  return JSON.stringify(normalizeV2(progress), null, pretty ? 2 : undefined);
}

export function writeProgress(
  storage: StorageAdapter,
  progress: ProgressData,
): ProgressData {
  const stable = normalizeV2(progress);
  storage.setItem(PROGRESS_KEY, serializeProgress(stable));
  return stable;
}

/** Produces deterministic, human-readable JSON suitable for download/export. */
export function exportProgress(storage: StorageAdapter): string {
  return `${serializeProgress(readProgress(storage), true)}\n`;
}

export function saveMissionProgress(
  storage: StorageAdapter,
  missionId: MissionId,
  update: MissionProgressUpdate = {},
): ProgressData {
  return writeProgress(
    storage,
    markMissionProgress(readProgress(storage), missionId, update),
  );
}

export function saveLastMission(
  storage: StorageAdapter,
  missionId: MissionId | null,
): ProgressData {
  return writeProgress(
    storage,
    setLastMission(readProgress(storage), missionId),
  );
}

export function clearProgress(storage: StorageAdapter): ProgressData {
  storage.removeItem(PROGRESS_KEY);
  return emptyProgress();
}

/**
 * Storage-level compatibility wrapper for callers that still use v1 activity
 * IDs. A completed legacy walkthrough counts as guided evidence, not transfer.
 */
export function completeActivity(
  storage: StorageAdapter,
  activityId: string,
): ProgressData {
  const missionId = resolveMissionId(activityId);
  if (!missionId) return readProgress(storage);
  return saveMissionProgress(storage, missionId, { status: "guided" });
}

function dispatchProgress(progress: ProgressData): void {
  window.dispatchEvent(new CustomEvent("asm-progress", { detail: progress }));
}

export function markLocalMissionProgress(
  missionId: MissionId,
  update: MissionProgressUpdate = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const progress = saveMissionProgress(window.localStorage, missionId, {
      ...update,
      lastAttemptAt:
        update.lastAttemptAt === undefined
          ? new Date().toISOString()
          : update.lastAttemptAt,
    });
    dispatchProgress(progress);
  } catch {
    window.dispatchEvent(new Event("asm-progress-unavailable"));
  }
}

export function setLocalLastMission(missionId: MissionId | null): void {
  if (typeof window === "undefined") return;
  try {
    dispatchProgress(saveLastMission(window.localStorage, missionId));
  } catch {
    window.dispatchEvent(new Event("asm-progress-unavailable"));
  }
}

/** @deprecated Prefer markLocalMissionProgress with a canonical mission ID. */
export function markLocalProgress(activityId: string): void {
  const missionId = resolveMissionId(activityId);
  if (!missionId) return;
  markLocalMissionProgress(missionId, { status: "guided" });
}
