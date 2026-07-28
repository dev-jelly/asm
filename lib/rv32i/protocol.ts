import type {
  InitialMemoryPatch,
  Instruction,
  MachineOptions,
  MachineStatus,
  MemoryAccess,
  MemoryPatch,
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
  status: Exclude<MachineStatus, "error">;
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
  if (!isRecord(value)) return false;
  if (
    !hasOwnKeys(value, [
      "protocolVersion",
      "runId",
      "commandId",
      "type",
    ]) ||
    value.protocolVersion !== PROTOCOL_VERSION ||
    !isNonEmptyString(value.runId) ||
    !isNonEmptyString(value.commandId)
  ) {
    return false;
  }

  if (value.type === "LOAD") {
    return (
      hasOnlyKeys(value, [
        "protocolVersion",
        "runId",
        "commandId",
        "type",
        "source",
        "options",
      ]) &&
      Object.hasOwn(value, "source") &&
      typeof value.source === "string" &&
      (value.options === undefined || isMachineOptions(value.options))
    );
  }

  if (
    value.type === "STEP" ||
    value.type === "BACK" ||
    value.type === "RESET" ||
    value.type === "RUN" ||
    value.type === "PAUSE"
  ) {
    return hasOnlyKeys(value, [
      "protocolVersion",
      "runId",
      "commandId",
      "type",
    ]);
  }

  return false;
}

export function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (
    !isRecord(value) ||
    !hasOwnKeys(value, [
      "protocolVersion",
      "runId",
      "commandId",
      "seq",
      "type",
      "status",
    ]) ||
    value.protocolVersion !== PROTOCOL_VERSION ||
    !isNonEmptyString(value.runId) ||
    !isNonEmptyString(value.commandId) ||
    !isPositiveInteger(value.seq)
  ) {
    return false;
  }

  if (value.type === "STATE") {
    return (
      hasOnlyKeys(value, [
        "protocolVersion",
        "runId",
        "commandId",
        "seq",
        "type",
        "status",
        "snapshot",
        "delta",
        "deltas",
        "reason",
      ]) &&
      isStateStatus(value.status) &&
      isSnapshot(value.snapshot) &&
      value.snapshot.status === value.status &&
      (value.delta === undefined || isStepDelta(value.delta)) &&
      (value.deltas === undefined ||
        (Array.isArray(value.deltas) && value.deltas.every(isStepDelta))) &&
      (value.reason === undefined || isResponseReason(value.reason))
    );
  }

  if (value.type === "ERROR") {
    return (
      hasOnlyKeys(value, [
        "protocolVersion",
        "runId",
        "commandId",
        "seq",
        "type",
        "status",
        "code",
        "message",
        "snapshot",
        "deltas",
      ]) &&
      value.status === "error" &&
      isNonEmptyString(value.code) &&
      isNonEmptyString(value.message) &&
      (value.snapshot === undefined ||
        (isSnapshot(value.snapshot) && value.snapshot.status === "error")) &&
      (value.deltas === undefined ||
        (Array.isArray(value.deltas) && value.deltas.every(isStepDelta)))
    );
  }

  return false;
}

function isMachineOptions(value: unknown): value is MachineOptions {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "initialRegisters",
      "initialMemory",
      "historyLimit",
    ])
  ) {
    return false;
  }

  if (
    value.historyLimit !== undefined &&
    (typeof value.historyLimit !== "number" ||
      !Number.isInteger(value.historyLimit) ||
      value.historyLimit < 0)
  ) {
    return false;
  }

  if (
    value.initialRegisters !== undefined &&
    !isInitialRegisters(value.initialRegisters)
  ) {
    return false;
  }

  return (
    value.initialMemory === undefined ||
    (Array.isArray(value.initialMemory) &&
      value.initialMemory.every(isInitialMemoryPatch))
  );
}

function isInitialRegisters(
  value: unknown,
): value is Record<number, number> {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([register, registerValue]) =>
      /^(0|[1-9]\d*)$/.test(register) &&
      Number(register) <= 31 &&
      typeof registerValue === "number" &&
      Number.isSafeInteger(registerValue),
  );
}

function isInitialMemoryPatch(
  value: unknown,
): value is InitialMemoryPatch {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["address", "bytes"]) &&
    typeof value.address === "number" &&
    Number.isInteger(value.address) &&
    value.address >= 0 &&
    value.address <= 0xffffffff &&
    Array.isArray(value.bytes) &&
    value.bytes.every(
      (byte) =>
        typeof byte === "number" &&
        Number.isInteger(byte) &&
        byte >= 0 &&
        byte <= 0xff,
    )
  );
}

function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "profile",
      "pc",
      "registers",
      "memoryBase",
      "memory",
      "memoryInitialized",
      "status",
      "stepIndex",
      "historyDepth",
      "currentInstruction",
    ]) &&
    value.profile === "rv32i-edu-v1" &&
    isUint32(value.pc) &&
    Array.isArray(value.registers) &&
    value.registers.length === 32 &&
    value.registers.every(isUint32) &&
    isUint32(value.memoryBase) &&
    Array.isArray(value.memory) &&
    value.memory.every(isByte) &&
    Array.isArray(value.memoryInitialized) &&
    value.memoryInitialized.length === value.memory.length &&
    value.memoryInitialized.every(
      (initialized) => typeof initialized === "boolean",
    ) &&
    isMachineStatus(value.status) &&
    isNonNegativeInteger(value.stepIndex) &&
    isNonNegativeInteger(value.historyDepth) &&
    (value.currentInstruction === null ||
      isSerializedInstruction(value.currentInstruction))
  );
}

function isSerializedInstruction(
  value: unknown,
): value is Snapshot["currentInstruction"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "mnemonic",
      "address",
      "encoding",
      "sourceLine",
      "sourceText",
    ]) &&
    isMnemonic(value.mnemonic) &&
    isUint32(value.address) &&
    isUint32(value.encoding) &&
    isPositiveInteger(value.sourceLine) &&
    typeof value.sourceText === "string"
  );
}

function isStepDelta(value: unknown): value is StepDelta {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "pcBefore",
      "pcAfter",
      "stepIndexBefore",
      "stepIndexAfter",
      "statusBefore",
      "statusAfter",
      "instruction",
      "registerReads",
      "registerWrites",
      "memoryAccesses",
      "memoryPatches",
      "warnings",
      "addressCalculation",
      "controlFlow",
    ]) &&
    isUint32(value.pcBefore) &&
    isUint32(value.pcAfter) &&
    isNonNegativeInteger(value.stepIndexBefore) &&
    isNonNegativeInteger(value.stepIndexAfter) &&
    isStepStatus(value.statusBefore) &&
    isStepStatus(value.statusAfter) &&
    isDeltaInstruction(value.instruction) &&
    Array.isArray(value.registerReads) &&
    value.registerReads.every(isRegisterRead) &&
    Array.isArray(value.registerWrites) &&
    value.registerWrites.every(isRegisterWrite) &&
    Array.isArray(value.memoryAccesses) &&
    value.memoryAccesses.every(isMemoryAccess) &&
    Array.isArray(value.memoryPatches) &&
    value.memoryPatches.every(isMemoryPatch) &&
    Array.isArray(value.warnings) &&
    value.warnings.every(isStepWarning) &&
    (value.addressCalculation === undefined ||
      isAddressCalculation(value.addressCalculation)) &&
    isControlFlow(value.controlFlow)
  );
}

function isDeltaInstruction(value: unknown): value is StepDelta["instruction"] {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "mnemonic",
      "sourceLine",
      "sourceText",
      "encoding",
    ]) &&
    isMnemonic(value.mnemonic) &&
    isPositiveInteger(value.sourceLine) &&
    typeof value.sourceText === "string" &&
    isUint32(value.encoding)
  );
}

function isRegisterRead(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["register", "value", "role"]) &&
    isRegisterIndex(value.register) &&
    isUint32(value.value) &&
    (value.role === "rs1" ||
      value.role === "rs2" ||
      value.role === "address")
  );
}

function isRegisterWrite(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "register",
      "before",
      "after",
      "committed",
    ]) &&
    isRegisterIndex(value.register) &&
    isUint32(value.before) &&
    isUint32(value.after) &&
    typeof value.committed === "boolean"
  );
}

function isMemoryAccess(value: unknown): value is MemoryAccess {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "kind",
      "address",
      "size",
      "bytes",
      "initialized",
      "value",
    ]) &&
    (value.kind === "read" || value.kind === "write") &&
    isUint32(value.address) &&
    isMemoryAccessSize(value.size) &&
    Array.isArray(value.bytes) &&
    value.bytes.length === value.size &&
    value.bytes.every(isByte) &&
    (value.initialized === undefined ||
      (Array.isArray(value.initialized) &&
        value.initialized.length === value.size &&
        value.initialized.every(
          (initialized) => typeof initialized === "boolean",
        ))) &&
    isUint32(value.value)
  );
}

function isMemoryPatch(value: unknown): value is MemoryPatch {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "address",
      "before",
      "after",
      "initializedBefore",
      "initializedAfter",
    ]) &&
    isUint32(value.address) &&
    Array.isArray(value.before) &&
    isMemoryAccessSize(value.before.length) &&
    value.before.every(isByte) &&
    Array.isArray(value.after) &&
    value.after.length === value.before.length &&
    value.after.every(isByte) &&
    isOptionalBooleanArray(value.initializedBefore, value.before.length) &&
    isOptionalBooleanArray(value.initializedAfter, value.before.length)
  );
}

function isStepWarning(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["code", "message", "addresses"]) &&
    value.code === "UNINITIALIZED_READ" &&
    isNonEmptyString(value.message) &&
    Array.isArray(value.addresses) &&
    value.addresses.length > 0 &&
    value.addresses.every(isUint32)
  );
}

function isAddressCalculation(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "baseRegister",
      "baseValue",
      "offset",
      "effectiveAddress",
    ]) &&
    isRegisterIndex(value.baseRegister) &&
    isUint32(value.baseValue) &&
    isSafeInteger(value.offset) &&
    isUint32(value.effectiveAddress)
  );
}

function isControlFlow(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["kind", "taken", "target", "lhs", "rhs"])
  ) {
    return false;
  }
  if (value.kind === "sequential") {
    return (
      value.taken === undefined &&
      value.target === undefined &&
      value.lhs === undefined &&
      value.rhs === undefined
    );
  }
  return (
    value.kind === "branch" &&
    typeof value.taken === "boolean" &&
    isUint32(value.target) &&
    isUint32(value.lhs) &&
    isUint32(value.rhs)
  );
}

function isOptionalBooleanArray(
  value: unknown,
  expectedLength: number,
): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length === expectedLength &&
      value.every((item) => typeof item === "boolean"))
  );
}

function isResponseReason(
  value: unknown,
): value is WorkerStateResponse["reason"] {
  return (
    value === "loaded" ||
    value === "step" ||
    value === "back" ||
    value === "empty-history" ||
    value === "reset" ||
    value === "run-started" ||
    value === "run-chunk" ||
    value === "user" ||
    value === "instruction-budget" ||
    value === "completed"
  );
}

function isMachineStatus(value: unknown): value is MachineStatus {
  return (
    value === "ready" ||
    value === "running" ||
    value === "paused" ||
    value === "completed" ||
    value === "error"
  );
}

function isStateStatus(
  value: unknown,
): value is Exclude<MachineStatus, "error"> {
  return (
    value === "ready" ||
    value === "running" ||
    value === "paused" ||
    value === "completed"
  );
}

function isStepStatus(value: unknown): value is StepDelta["statusBefore"] {
  return value === "ready" || value === "completed";
}

function isMnemonic(value: unknown): value is Instruction["mnemonic"] {
  return (
    value === "addi" ||
    value === "lb" ||
    value === "lbu" ||
    value === "lh" ||
    value === "lhu" ||
    value === "lw" ||
    value === "sb" ||
    value === "sh" ||
    value === "sw" ||
    value === "beq"
  );
}

function isMemoryAccessSize(value: unknown): value is 1 | 2 | 4 {
  return value === 1 || value === 2 || value === 4;
}

function isRegisterIndex(value: unknown): boolean {
  return isNonNegativeInteger(value) && value <= 31;
}

function isByte(value: unknown): boolean {
  return isNonNegativeInteger(value) && value <= 0xff;
}

function isUint32(value: unknown): value is number {
  return isNonNegativeInteger(value) && value <= 0xffffffff;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function hasOwnKeys(
  value: Record<string, unknown>,
  requiredKeys: readonly string[],
): boolean {
  return requiredKeys.every((key) => Object.hasOwn(value, key));
}
