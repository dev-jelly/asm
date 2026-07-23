import type { StepDelta } from "./types";

export const DEFAULT_TRACE_LIMIT = 256;

export function appendTrace(
  current: readonly StepDelta[],
  additions: readonly StepDelta[],
  limit = DEFAULT_TRACE_LIMIT,
): StepDelta[] {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError("trace limit must be a non-negative integer");
  }
  if (limit === 0) return [];
  if (additions.length >= limit) {
    return additions.slice(-limit);
  }
  const keepFromCurrent = Math.max(0, limit - additions.length);
  return [
    ...current.slice(-keepFromCurrent),
    ...additions,
  ];
}
