export const PROGRESS_KEY = "asm-lab-progress";
export const PROGRESS_VERSION = 1 as const;

export type ProgressData = {
  version: typeof PROGRESS_VERSION;
  completedActivities: string[];
};

export type StorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function emptyProgress(): ProgressData {
  return { version: PROGRESS_VERSION, completedActivities: [] };
}

export function readProgress(storage: StorageAdapter): ProgressData {
  const raw = storage.getItem(PROGRESS_KEY);
  if (!raw) return emptyProgress();

  let parsed: Partial<ProgressData>;
  try {
    parsed = JSON.parse(raw) as Partial<ProgressData>;
  } catch {
    return emptyProgress();
  }
  if (
    parsed.version !== PROGRESS_VERSION ||
    !Array.isArray(parsed.completedActivities) ||
    parsed.completedActivities.some((item) => typeof item !== "string")
  ) {
    return emptyProgress();
  }
  return {
    version: PROGRESS_VERSION,
    completedActivities: [...new Set(parsed.completedActivities)],
  };
}

export function completeActivity(
  storage: StorageAdapter,
  activityId: string,
): ProgressData {
  const current = readProgress(storage);
  const next = {
    ...current,
    completedActivities: [
      ...new Set([...current.completedActivities, activityId]),
    ],
  };
  storage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
}

export function clearProgress(storage: StorageAdapter): ProgressData {
  storage.removeItem(PROGRESS_KEY);
  return emptyProgress();
}

export function markLocalProgress(activityId: string): void {
  if (typeof window === "undefined") return;
  try {
    const progress = completeActivity(window.localStorage, activityId);
    window.dispatchEvent(
      new CustomEvent("asm-progress", { detail: progress }),
    );
  } catch {
    window.dispatchEvent(new Event("asm-progress-unavailable"));
  }
}
