import { formatHex } from "../../lib/rv32i/memory";
import type { WorkerResponse } from "../../lib/rv32i/protocol";
import type { StepDelta } from "../../lib/rv32i/types";

export function summarizeResponse(
  response: Exclude<WorkerResponse, { type: "ERROR" }>,
  runDeltas?: readonly StepDelta[],
): string {
  if (response.reason === "loaded") return "RV32I 실험실이 준비되었습니다.";
  if (response.reason === "reset") return "초기 상태로 돌아왔습니다.";
  if (response.reason === "back") {
    return `한 단계를 되돌렸습니다. PC ${formatHex(response.snapshot.pc)}.`;
  }
  if (response.reason === "empty-history") {
    return "되돌릴 이전 단계가 없습니다.";
  }
  if (response.reason === "user") {
    return runDeltas
      ? `연속 실행을 일시정지했습니다. ${summarizeDeltaBatch(
          runDeltas,
          response.snapshot.pc,
        )}`
      : `실행을 일시정지했습니다. PC ${formatHex(response.snapshot.pc)}.`;
  }
  if (response.reason === "instruction-budget") {
    return `명령어 제한으로 일시정지했습니다. ${summarizeDeltaBatch(
      runDeltas ?? response.deltas ?? [],
      response.snapshot.pc,
    )}`;
  }
  if (runDeltas) {
    const lead =
      response.status === "completed"
        ? "연속 실행을 완료했습니다."
        : "연속 실행 결과입니다.";
    return `${lead} ${summarizeDeltaBatch(
      runDeltas,
      response.snapshot.pc,
    )}`;
  }
  const delta = response.delta ?? response.deltas?.at(-1);
  if (response.status === "completed" && !delta) {
    return "프로그램 실행이 완료되었습니다.";
  }
  if (!delta) return `현재 PC ${formatHex(response.snapshot.pc)}.`;

  const changes = delta.registerWrites
    .map((write) =>
      write.committed
        ? `x${write.register} 값이 ${formatHex(write.before)}에서 ${formatHex(write.after)}로 바뀌었습니다`
        : "x0 쓰기는 무시되었습니다",
    )
    .concat(
      delta.memoryPatches.map(
        (patch) =>
          `메모리 ${formatHex(patch.address)}에 ${patch.after.length}바이트를 썼습니다`,
      ),
    );
  const suffix = changes.length
    ? changes.join(". ")
    : "레지스터와 메모리에 쓴 값은 없습니다";
  const warning = delta.warnings.length
    ? ` 주의. ${delta.warnings.map((item) => item.message).join(" ")}`
    : "";
  const completion =
    response.status === "completed" ? " 프로그램 실행 완료." : "";
  return `PC ${formatHex(delta.pcAfter)}. ${suffix}.${warning}${completion}`;
}

export function summarizeDeltaBatch(
  deltas: readonly StepDelta[],
  pc: number,
): string {
  const registerWrites = deltas.reduce(
    (count, delta) =>
      count + delta.registerWrites.filter((write) => write.committed).length,
    0,
  );
  const memoryReads = deltas.reduce(
    (count, delta) =>
      count +
      delta.memoryAccesses.filter((access) => access.kind === "read").length,
    0,
  );
  const memoryWrites = deltas.reduce(
    (count, delta) => count + delta.memoryPatches.length,
    0,
  );
  const uninitializedAddresses = [
    ...new Set(
      deltas.flatMap((delta) =>
        delta.warnings.flatMap((warning) => warning.addresses),
      ),
    ),
  ];
  const warningSummary = uninitializedAddresses.length
    ? ` 주의. 초기화되지 않은 메모리 ${uninitializedAddresses
        .map((address) => formatHex(address))
        .join(", ")}에서 읽기를 수행했습니다.`
    : "";
  return `${deltas.length}개 명령어를 실행했습니다. 레지스터 쓰기 ${registerWrites}회, 메모리 읽기 ${memoryReads}회, 메모리 쓰기 ${memoryWrites}회. 현재 PC ${formatHex(pc)}.${warningSummary}`;
}

export function traceAfterBack(trace: readonly StepDelta[]): StepDelta[] {
  return trace.slice(0, -1);
}

export function summarizeError(
  message: string,
  committedDeltas: readonly StepDelta[],
): string {
  if (!committedDeltas.length) return `실행 오류. ${message}`;
  const pc = committedDeltas.at(-1)?.pcAfter ?? 0;
  return `실행 오류. 오류 전에 ${summarizeDeltaBatch(
    committedDeltas,
    pc,
  )} ${message}`;
}
