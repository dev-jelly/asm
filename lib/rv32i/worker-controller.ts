import { Rv32iMachine } from "./machine";
import type {
  WorkerCommand,
  WorkerErrorResponse,
  WorkerResponse,
  WorkerStateResponse,
} from "./protocol";
import { PROTOCOL_VERSION, Rv32iError } from "./types";

type TimerHandle = ReturnType<typeof setTimeout>;
type Scheduler = (callback: () => void) => TimerHandle;
type Canceler = (handle: TimerHandle) => void;

export type WorkerControllerOptions = {
  chunkSize?: number;
  instructionBudget?: number;
  schedule?: Scheduler;
  cancel?: Canceler;
};

export class Rv32iWorkerController {
  private machine: Rv32iMachine | null = null;
  private activeRunId = "";
  private responseSequence = 0;
  private timer: TimerHandle | null = null;
  private running = false;
  private runInstructionCount = 0;
  private readonly chunkSize: number;
  private readonly instructionBudget: number;
  private readonly schedule: Scheduler;
  private readonly cancel: Canceler;

  constructor(
    private readonly emit: (response: WorkerResponse) => void,
    options: WorkerControllerOptions = {},
  ) {
    this.chunkSize = options.chunkSize ?? 12;
    this.instructionBudget = options.instructionBudget ?? 512;
    this.schedule =
      options.schedule ?? ((callback) => setTimeout(callback, 0));
    this.cancel = options.cancel ?? ((handle) => clearTimeout(handle));
  }

  handle(command: WorkerCommand): void {
    if (command.protocolVersion !== PROTOCOL_VERSION) {
      this.emitError(command, "PROTOCOL_VERSION", "지원하지 않는 protocol version입니다.");
      return;
    }

    if (command.type === "LOAD") {
      this.stopRun();
      this.activeRunId = command.runId;
      try {
        this.machine = new Rv32iMachine(command.source, command.options);
        this.emitState(command, this.machine.snapshot().status, "loaded");
      } catch (error) {
        this.machine = null;
        this.emitCaughtError(command, error);
      }
      return;
    }

    if (!this.machine) {
      this.emitError(command, "NOT_LOADED", "먼저 프로그램을 불러와야 합니다.");
      return;
    }
    if (command.runId !== this.activeRunId) {
      this.emitError(command, "STALE_RUN", "이전 실행에서 도착한 명령을 무시했습니다.");
      return;
    }

    if (command.type === "STEP") {
      this.stopRun();
      try {
        const delta = this.machine.step();
        this.emitState(
          command,
          this.machine.snapshot().status,
          this.machine.snapshot().status === "completed" ? "completed" : "step",
          { delta },
        );
      } catch (error) {
        this.emitCaughtError(command, error);
      }
      return;
    }

    if (command.type === "BACK") {
      this.stopRun();
      const delta = this.machine.back();
      this.emitState(
        command,
        this.machine.snapshot().status,
        delta ? "back" : "empty-history",
      );
      return;
    }

    if (command.type === "RESET") {
      this.stopRun();
      this.machine.reset();
      this.emitState(command, this.machine.snapshot().status, "reset");
      return;
    }

    if (command.type === "PAUSE") {
      this.stopRun();
      const completed = this.machine.snapshot().status === "completed";
      this.emitState(
        command,
        completed ? "completed" : "paused",
        completed ? "completed" : "user",
      );
      return;
    }

    if (this.machine.snapshot().status === "completed") {
      this.emitState(command, "completed", "completed");
      return;
    }
    this.stopRun();
    this.running = true;
    this.runInstructionCount = 0;
    this.emitState(command, "running", "run-started");
    this.timer = this.schedule(() => this.runChunk(command));
  }

  reject(value: unknown): void {
    if (!isMessageEnvelope(value)) return;
    this.stopRun();
    const code =
      value.protocolVersion === PROTOCOL_VERSION
        ? "INVALID_COMMAND"
        : "PROTOCOL_VERSION";
    const message =
      code === "PROTOCOL_VERSION"
        ? "지원하지 않는 protocol version입니다."
        : "Worker 명령 형식이 올바르지 않습니다.";
    const response: WorkerErrorResponse = {
      protocolVersion: PROTOCOL_VERSION,
      runId: value.runId,
      commandId: value.commandId,
      seq: ++this.responseSequence,
      type: "ERROR",
      status: "error",
      code,
      message,
      snapshot:
        this.machine && value.runId === this.activeRunId
          ? { ...this.machine.snapshot(), status: "error" }
          : undefined,
    };
    this.emit(response);
  }

  dispose(): void {
    this.stopRun();
    this.machine = null;
  }

  private runChunk(command: WorkerCommand): void {
    if (!this.running || !this.machine) return;
    this.timer = null;
    const deltas = [];

    try {
      for (let index = 0; index < this.chunkSize; index += 1) {
        if (this.runInstructionCount >= this.instructionBudget) {
          this.running = false;
          this.emitState(command, "paused", "instruction-budget", { deltas });
          return;
        }
        deltas.push(this.machine.step());
        this.runInstructionCount += 1;
        if (this.machine.snapshot().status === "completed") {
          this.running = false;
          this.emitState(command, "completed", "completed", { deltas });
          return;
        }
      }
      this.emitState(command, "running", "run-chunk", { deltas });
      this.timer = this.schedule(() => this.runChunk(command));
    } catch (error) {
      this.running = false;
      this.emitCaughtError(command, error, deltas);
    }
  }

  private stopRun(): void {
    this.running = false;
    if (this.timer !== null) {
      this.cancel(this.timer);
      this.timer = null;
    }
  }

  private emitState(
    command: WorkerCommand,
    status: WorkerStateResponse["status"],
    reason: WorkerStateResponse["reason"],
    additions: Pick<WorkerStateResponse, "delta" | "deltas"> = {},
  ): void {
    if (!this.machine) return;
    const snapshot = { ...this.machine.snapshot(), status };
    this.emit({
      protocolVersion: PROTOCOL_VERSION,
      runId: command.runId,
      commandId: command.commandId,
      seq: ++this.responseSequence,
      type: "STATE",
      status,
      snapshot,
      reason,
      ...additions,
    });
  }

  private emitCaughtError(
    command: WorkerCommand,
    error: unknown,
    deltas: NonNullable<WorkerErrorResponse["deltas"]> = [],
  ): void {
    const code = error instanceof Rv32iError ? error.code : "UNEXPECTED";
    const message =
      error instanceof Error ? error.message : "알 수 없는 실행 오류가 발생했습니다.";
    this.emitError(command, code, message, deltas);
  }

  private emitError(
    command: WorkerCommand,
    code: string,
    message: string,
    deltas: NonNullable<WorkerErrorResponse["deltas"]> = [],
  ): void {
    const response: WorkerErrorResponse = {
      protocolVersion: PROTOCOL_VERSION,
      runId: command.runId,
      commandId: command.commandId,
      seq: ++this.responseSequence,
      type: "ERROR",
      status: "error",
      code,
      message,
      snapshot: this.machine
        ? { ...this.machine.snapshot(), status: "error" }
        : undefined,
      ...(deltas.length ? { deltas } : {}),
    };
    this.emit(response);
  }
}

function isMessageEnvelope(
  value: unknown,
): value is {
  protocolVersion?: unknown;
  runId: string;
  commandId: string;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.runId === "string" &&
    record.runId.trim().length > 0 &&
    typeof record.commandId === "string" &&
    record.commandId.trim().length > 0
  );
}
