export const MEMORY_MISSION_IDS = [
  "pc-next",
  "x-zero-wrap",
  "memory-address-value",
  "memory-store-byte",
  "memory-little-endian",
  "memory-partial-store",
  "memory-signed-loads",
  "branch-memory-loop",
] as const;

export type MemoryMissionId = (typeof MEMORY_MISSION_IDS)[number];
export type MemoryMissionModuleId = "pc" | "x" | "m" | "b";
