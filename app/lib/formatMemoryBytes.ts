export function formatMemoryBytes(
  bytes: readonly number[],
  initialized?: readonly boolean[],
): string {
  return bytes
    .map((byte, index) =>
      initialized?.[index] === false
        ? "??"
        : byte.toString(16).padStart(2, "0"),
    )
    .join(" ");
}
