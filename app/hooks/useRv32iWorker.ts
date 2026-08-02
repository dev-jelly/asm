"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isWorkerResponse,
  type WorkerCommand,
  type WorkerResponse,
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
  programReady: boolean;
  commandPending: boolean;
  error: string | null;
  announcement: string;
  step: () => boolean;
  back: () => boolean;
  reset: () => boolean;
  run: () => boolean;
  pause: () => boolean;
  retry: () => void;
};

export function useRv32iWorker(
  source: string,
  options: MachineOptions | undefined,
  requestId: number,
): Rv32iWorkerState {
  const [status, setStatus] = useState<LabStatus>("loading");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [lastDelta, setLastDelta] = useState<StepDelta | null>(null);
  const [trace, setTrace] = useState<StepDelta[]>([]);
  const [loadedRequestId, setLoadedRequestId] = useState<number | null>(null);
  const [commandPending, setCommandPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    "RV32I 실험실을 준비하고 있습니다.",
  );
  const [workerGeneration, setWorkerGeneration] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const traceRef = useRef<StepDelta[]>([]);
  const runIdRef = useRef("");
  const commandSequenceRef = useRef(0);
  const responseSequenceRef = useRef(0);
  const pendingCommandIdRef = useRef<string | null>(null);
  const runDeltasRef = useRef<StepDelta[]>([]);
  const runInProgressRef = useRef(false);
  const optionsKey = useMemo(() => JSON.stringify(options ?? {}), [options]);
  const retry = useCallback(() => {
    pendingCommandIdRef.current = null;
    traceRef.current = [];
    setStatus("loading");
    setSnapshot(null);
    setCommandPending(false);
    setLoadedRequestId(null);
    setLastDelta(null);
    setTrace([]);
    setError(null);
    setAnnouncement("RV32I 실험실을 준비하고 있습니다.");
    setWorkerGeneration((generation) => generation + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    traceRef.current = [];
    runDeltasRef.current = [];
    runInProgressRef.current = false;
    pendingCommandIdRef.current = null;

    let worker: Worker;
    try {
      worker = new Worker(
        new URL("../workers/rv32i.worker.ts", import.meta.url),
        { type: "module", name: "rv32i-learning-machine" },
      );
    } catch {
      queueMicrotask(() => {
        if (disposed) return;
        setStatus(() => "error");
        setLoadedRequestId(null);
        setCommandPending(false);
        setLastDelta(null);
        setTrace([]);
        setError("실행 Worker를 시작하지 못했습니다. 다시 시도해 주세요.");
        setAnnouncement("실행 Worker를 시작하지 못했습니다.");
      });
      return () => {
        disposed = true;
      };
    }

    const runId = `lesson-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    workerRef.current = worker;
    runIdRef.current = runId;
    commandSequenceRef.current = 0;
    responseSequenceRef.current = 0;
    runDeltasRef.current = [];
    runInProgressRef.current = false;

    queueMicrotask(() => {
      if (disposed || workerRef.current !== worker) return;
      setStatus("loading");
      setSnapshot(null);
      setLastDelta(null);
      setTrace([]);
      setLoadedRequestId(null);
      setCommandPending(false);
      setError(null);
      setAnnouncement("RV32I 실험실을 준비하고 있습니다.");
    });

    const failWorker = (message: string, announcementMessage: string) => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      worker.terminate();
      runDeltasRef.current = [];
      runInProgressRef.current = false;
      pendingCommandIdRef.current = null;
      setCommandPending(false);
      setStatus(() => "error");
      setLoadedRequestId(null);
      setError(message);
      setAnnouncement(announcementMessage);
    };

    worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (workerRef.current !== worker) return;
      const response = event.data;
      if (!isWorkerResponse(response)) {
        failWorker(
          "실행 Worker가 올바르지 않은 응답을 보냈습니다. 다시 시도해 주세요.",
          "실행 Worker 응답 형식이 올바르지 않습니다.",
        );
        return;
      }
      if (
        response.runId !== runId ||
        response.seq <= responseSequenceRef.current
      ) {
        return;
      }
      responseSequenceRef.current = response.seq;
      const completesPendingCommand =
        response.commandId === pendingCommandIdRef.current &&
        (response.type === "ERROR" || response.reason !== "run-chunk");
      if (completesPendingCommand) {
        pendingCommandIdRef.current = null;
      }

      if (response.type === "ERROR") {
        const committedDeltas = response.deltas ?? [];
        const fullRunDeltas = runInProgressRef.current
          ? [...runDeltasRef.current, ...committedDeltas]
          : committedDeltas;
        if (committedDeltas.length) {
          setLastDelta(committedDeltas.at(-1) ?? null);
          setTrace((current) => appendTrace(current, committedDeltas));
          traceRef.current = appendTrace(
            traceRef.current,
            committedDeltas,
          );
        }
        if (response.snapshot) setSnapshot(response.snapshot);
        if (!response.snapshot) setLoadedRequestId(null);
        setStatus("error");
        setError(response.message);
        setAnnouncement(summarizeError(response.message, fullRunDeltas));
        if (completesPendingCommand) setCommandPending(false);
        runDeltasRef.current = [];
        runInProgressRef.current = false;
        return;
      }

      setStatus(response.status);
      setSnapshot(response.snapshot);
      if (response.reason === "loaded") setLoadedRequestId(requestId);
      setError(null);
      if (response.delta) {
        setLastDelta(response.delta);
        setTrace((current) => appendTrace(current, [response.delta as StepDelta]));
        traceRef.current = appendTrace(traceRef.current, [
          response.delta as StepDelta,
        ]);
      } else if (response.deltas?.length) {
        const finalDelta = response.deltas.at(-1) ?? null;
        setLastDelta(finalDelta);
        setTrace((current) => appendTrace(current, response.deltas!));
        traceRef.current = appendTrace(traceRef.current, response.deltas);
      } else if (response.reason === "back") {
        const nextTrace = traceAfterBack(traceRef.current);
        traceRef.current = nextTrace;
        setLastDelta(nextTrace.at(-1) ?? null);
        setTrace(nextTrace);
      } else if (response.reason === "reset" || response.reason === "loaded") {
        traceRef.current = [];
        setLastDelta(null);
        setTrace([]);
      }
      if (completesPendingCommand) setCommandPending(false);

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

    worker.addEventListener("error", (event) => {
      event.preventDefault();
      failWorker(
        "실행 Worker가 예기치 않게 중단되었습니다. 다시 시도해 주세요.",
        "실행 Worker가 중단되었습니다. 다시 시도할 수 있습니다.",
      );
    });

    worker.addEventListener("messageerror", () => {
      failWorker(
        "실행 Worker의 응답을 읽지 못했습니다. 다시 시도해 주세요.",
        "실행 Worker 응답을 읽지 못했습니다. 다시 시도할 수 있습니다.",
      );
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
    try {
      worker.postMessage(loadCommand);
    } catch {
      failWorker(
        "실행 Worker에 프로그램을 전달하지 못했습니다. 다시 시도해 주세요.",
        "프로그램을 실행 Worker에 전달하지 못했습니다.",
      );
    }

    return () => {
      disposed = true;
      if (workerRef.current === worker) workerRef.current = null;
      worker.terminate();
    };
  }, [source, optionsKey, requestId, workerGeneration]);

  const send = useCallback((type: Exclude<WorkerCommand["type"], "LOAD">) => {
    const worker = workerRef.current;
    if (!worker || pendingCommandIdRef.current !== null) return false;
    const commandId = `command-${++commandSequenceRef.current}`;
    pendingCommandIdRef.current = commandId;
    setCommandPending(true);
    try {
      worker.postMessage({
        protocolVersion: PROTOCOL_VERSION,
        runId: runIdRef.current,
        commandId,
        type,
      } satisfies WorkerCommand);
      return true;
    } catch {
      if (workerRef.current !== worker) return false;
      workerRef.current = null;
      worker.terminate();
      runDeltasRef.current = [];
      runInProgressRef.current = false;
      pendingCommandIdRef.current = null;
      setCommandPending(false);
      setStatus("error");
      setLoadedRequestId(null);
      setError("실행 Worker에 명령을 전달하지 못했습니다. 다시 시도해 주세요.");
      setAnnouncement("실행 Worker에 명령을 전달하지 못했습니다.");
      return false;
    }
  }, []);

  return {
    status,
    snapshot,
    lastDelta,
    trace,
    programReady: loadedRequestId === requestId,
    commandPending,
    error,
    announcement,
    step: useCallback(() => send("STEP"), [send]),
    back: useCallback(() => send("BACK"), [send]),
    reset: useCallback(() => send("RESET"), [send]),
    run: useCallback(() => send("RUN"), [send]),
    pause: useCallback(() => send("PAUSE"), [send]),
    retry,
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
  const completion = response.status === "completed" ? " 프로그램 실행 완료." : "";
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
        .join(", ")}를 읽었습니다.`
    : "";
  return `${deltas.length}개 명령어를 실행했습니다. 레지스터 쓰기 ${registerWrites}회, 메모리 읽기 ${memoryReads}회, 메모리 쓰기 ${memoryWrites}회. 현재 PC ${formatHex(pc)}.${warningSummary}`;
}

export function traceAfterBack(trace: readonly StepDelta[]): StepDelta[] {
  return trace.slice(0, -1);
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
