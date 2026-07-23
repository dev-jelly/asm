import type {
  MachineOptions,
  MachineStatus,
  Snapshot,
  StepDelta,
} from "./types";
import { PROTOCOL_VERSION } from "./types";

type CommandBase = {
  protocolVersion: typeof PROTOCOL_VERSION;
  runId: string;
  commandId: string;
};

export type WorkerCommand =
  | (CommandBase & {
      type: "LOAD";
      source: string;
      options?: MachineOptions;
    })
  | (CommandBase & {
      type: "STEP" | "BACK" | "RESET" | "RUN" | "PAUSE";
    });

type ResponseBase = {
  protocolVersion: typeof PROTOCOL_VERSION;
  runId: string;
  commandId: string;
  seq: number;
};

export type WorkerStateResponse = ResponseBase & {
  type: "STATE";
  status: MachineStatus;
  snapshot: Snapshot;
  delta?: StepDelta;
  deltas?: StepDelta[];
  reason?:
    | "loaded"
    | "step"
    | "back"
    | "empty-history"
    | "reset"
    | "run-started"
    | "run-chunk"
    | "user"
    | "instruction-budget"
    | "completed";
};

export type WorkerErrorResponse = ResponseBase & {
  type: "ERROR";
  status: "error";
  code: string;
  message: string;
  snapshot?: Snapshot;
  deltas?: StepDelta[];
};

export type WorkerResponse = WorkerStateResponse | WorkerErrorResponse;

export function isWorkerCommand(value: unknown): value is WorkerCommand {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkerCommand>;
  return (
    candidate.protocolVersion === PROTOCOL_VERSION &&
    typeof candidate.runId === "string" &&
    typeof candidate.commandId === "string" &&
    ["LOAD", "STEP", "BACK", "RESET", "RUN", "PAUSE"].includes(
      candidate.type ?? "",
    )
  );
}
