"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  WorkerCommand,
  WorkerResponse,
} from "../../lib/rv32i/protocol";
import {
  PROTOCOL_VERSION,
  type MachineOptions,
  type MachineStatus,
  type Snapshot,
  type StepDelta,
} from "../../lib/rv32i/types";
import { formatHex } from "../../lib/rv32i/memory";
import { appendTrace } from "../../lib/rv32i/trace";

type LabStatus = "loading" | MachineStatus;

export type Rv32iWorkerState = {
  status: LabStatus;
  snapshot: Snapshot | null;
  lastDelta: StepDelta | null;
  trace: StepDelta[];
  error: string | null;
  announcement: string;
  step: () => void;
  back: () => void;
  reset: () => void;
  run: () => void;
  pause: () => void;
};

export function useRv32iWorker(
  source: string,
  options?: MachineOptions,
): Rv32iWorkerState {
  const [status, setStatus] = useState<LabStatus>("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lastDelta, setLastDelta] = useState<StepDelta | null>(null);
  const [trace, setTrace] = useState<StepDelta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    "RV32I 실험실을 준비하고 있습니다.",
  );
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef("");
  const commandSequenceRef = useRef(0);
  const responseSequenceRef = useRef(0);
  const runDeltasRef = useRef<StepDelta[]>([]);
  const runInProgressRef = useRef(false);
  const optionsKey = useMemo(() => JSON.stringify(options ?? {}), [options]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/rv32i.worker.ts", import.meta.url),
      { type: "module", name: "rv32i-learning-machine" },
    );
    const runId = `lesson-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    workerRef.current = worker;
    runIdRef.current = runId;
    commandSequenceRef.current = 0;
    responseSequenceRef.current = 0;
    runDeltasRef.current = [];
    runInProgressRef.current = false;

    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (
        response.runId !== runIdRef.current ||
        response.seq <= responseSequenceRef.current
      ) {
        return;
      }
      responseSequenceRef.current = response.seq;

      if (response.type === "ERROR") {
        const committedDeltas = response.deltas ?? [];
        const fullRunDeltas = runInProgressRef.current
          ? [...runDeltasRef.current, ...committedDeltas]
          : committedDeltas;
        if (committedDeltas.length) {
          setLastDelta(committedDeltas.at(-1) ?? null);
          setTrace((current) => appendTrace(current, committedDeltas));
        }
        if (response.snapshot) setSnapshot(response.snapshot);
        setStatus("error");
        setError(response.message);
        setAnnouncement(summarizeError(response.message, fullRunDeltas));
        runDeltasRef.current = [];
        runInProgressRef.current = false;
        return;
      }

      setStatus(response.status);
      setSnapshot(response.snapshot);
      setError(null);
      if (response.delta) {
        setLastDelta(response.delta);
        setTrace((current) => appendTrace(current, [response.delta as StepDelta]));
      } else if (response.deltas?.length) {
        const finalDelta = response.deltas.at(-1) ?? null;
        setLastDelta(finalDelta);
        setTrace((current) => appendTrace(current, response.deltas!));
      } else if (response.reason === "back") {
        setLastDelta(null);
        setTrace((current) => current.slice(0, -1));
      } else if (response.reason === "reset" || response.reason === "loaded") {
        setLastDelta(null);
        setTrace([]);
      }

      if (response.reason === "run-started") {
        runDeltasRef.current = [];
        runInProgressRef.current = true;
        setAnnouncement("연속 실행을 시작했습니다.");
        return;
      }

      if (response.deltas?.length && runInProgressRef.current) {
        runDeltasRef.current.push(...response.deltas);
      }
      if (response.reason === "run-chunk") return;

      if (
        runInProgressRef.current &&
        (response.reason === "completed" ||
          response.reason === "instruction-budget" ||
          response.reason === "user")
      ) {
        setAnnouncement(
          summarizeResponse(response, runDeltasRef.current),
        );
        runDeltasRef.current = [];
        runInProgressRef.current = false;
        return;
      }

      if (
        response.reason === "back" ||
        response.reason === "reset" ||
        response.reason === "loaded"
      ) {
        runDeltasRef.current = [];
        runInProgressRef.current = false;
      }
      setAnnouncement(summarizeResponse(response));
    });

    worker.addEventListener("error", () => {
      setStatus("error");
      setError("실행 Worker를 시작하지 못했습니다. 페이지를 새로고침해 주세요.");
      setAnnouncement("실행 Worker를 시작하지 못했습니다.");
    });

    const loadCommand: WorkerCommand = {
      protocolVersion: PROTOCOL_VERSION,
      runId,
      commandId: "command-1",
      type: "LOAD",
      source,
      options: JSON.parse(optionsKey) as MachineOptions,
    };
    commandSequenceRef.current = 1;
    worker.postMessage(loadCommand);

    return () => {
      workerRef.current = null;
      worker.terminate();
    };
  }, [source, optionsKey]);

  const send = useCallback((type: Exclude<WorkerCommand["type"], "LOAD">) => {
    const worker = workerRef.current;
    if (!worker) return;
    const commandId = `command-${++commandSequenceRef.current}`;
    worker.postMessage({
      protocolVersion: PROTOCOL_VERSION,
      runId: runIdRef.current,
      commandId,
      type,
    } satisfies WorkerCommand);
  }, []);

  return {
    status,
    snapshot,
    lastDelta,
    trace,
    error,
    announcement,
    step: useCallback(() => send("STEP"), [send]),
    back: useCallback(() => send("BACK"), [send]),
    reset: useCallback(() => send("RESET"), [send]),
    run: useCallback(() => send("RUN"), [send]),
    pause: useCallback(() => send("PAUSE"), [send]),
  };
}

export function summarizeResponse(
  response: Exclude<WorkerResponse, { type: "ERROR" }>,
  runDeltas?: readonly StepDelta[],
): string {
  if (response.reason === "loaded") return "RV32I 실험실이 준비되었습니다.";
  if (response.reason === "reset") return "초기 상태로 돌아왔습니다.";
  if (response.reason === "back") {
    return `한 단계를 되돌렸습니다. PC ${formatHex(response.snapshot.pc)}.`;
  }
  if (response.reason === "empty-history") return "되돌릴 이전 단계가 없습니다.";
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
  if (response.status === "completed" && !delta) return "프로그램 실행이 완료되었습니다.";
  if (!delta) return `현재 PC ${formatHex(response.snapshot.pc)}.`;

  const changes = delta.registerWrites
    .map((write) =>
      write.committed
        ? `x${write.register} 값이 ${formatHex(write.before)}에서 ${formatHex(write.after)}로 바뀌었습니다`
        : "x0 쓰기는 무시되었습니다",
    )
    .concat(
      delta.memoryPatches.map(
        (patch) => `메모리 ${formatHex(patch.address)}에 4바이트를 썼습니다`,
      ),
    );
  const suffix = changes.length
    ? changes.join(". ")
    : "레지스터와 메모리에 쓴 값은 없습니다";
  const completion = response.status === "completed" ? " 프로그램 실행 완료." : "";
  return `PC ${formatHex(delta.pcAfter)}. ${suffix}.${completion}`;
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
  return `${deltas.length}개 명령어를 실행했습니다. 레지스터 쓰기 ${registerWrites}회, 메모리 읽기 ${memoryReads}회, 메모리 쓰기 ${memoryWrites}회. 현재 PC ${formatHex(pc)}.`;
}

function summarizeError(
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
