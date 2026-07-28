export const DATA_BASE = 0x1000;
export const DATA_SIZE = 0x1000;
export const PROTOCOL_VERSION = 1 as const;
export const DEFAULT_HISTORY_LIMIT = 256;
export const MAX_HISTORY_LIMIT = 4096;

export type LoadMnemonic = "lb" | "lbu" | "lh" | "lhu" | "lw";
export type StoreMnemonic = "sb" | "sh" | "sw";
export type Mnemonic = "addi" | LoadMnemonic | StoreMnemonic | "beq";
export type MemoryAccessSize = 1 | 2 | 4;

export type RegisterOperand = {
  kind: "register";
  index: number;
};

export type ImmediateOperand = {
  kind: "immediate";
  value: number;
};

export type LabelOperand = {
  kind: "label";
  name: string;
  address: number;
};

export type MemoryOperand = {
  kind: "memory";
  base: number;
  offset: number;
};

export type LoadInstruction = {
  mnemonic: LoadMnemonic;
  operands: [RegisterOperand, MemoryOperand];
  address: number;
  encoding: number;
  sourceLine: number;
  sourceText: string;
};

export type StoreInstruction = {
  mnemonic: StoreMnemonic;
  operands: [RegisterOperand, MemoryOperand];
  address: number;
  encoding: number;
  sourceLine: number;
  sourceText: string;
};

export type Instruction =
  | {
      mnemonic: "addi";
      operands: [RegisterOperand, RegisterOperand, ImmediateOperand];
      address: number;
      encoding: number;
      sourceLine: number;
      sourceText: string;
    }
  | LoadInstruction
  | StoreInstruction
  | {
      mnemonic: "beq";
      operands: [RegisterOperand, RegisterOperand, LabelOperand];
      address: number;
      encoding: number;
      sourceLine: number;
      sourceText: string;
    };

export type Program = {
  source: string;
  instructions: Instruction[];
  labels: Record<string, number>;
  endAddress: number;
};

export type MachineStatus =
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "error";

export type RegisterRead = {
  register: number;
  value: number;
  role: "rs1" | "rs2" | "address";
};

export type RegisterWrite = {
  register: number;
  before: number;
  after: number;
  committed: boolean;
};

export type MemoryAccess = {
  kind: "read" | "write";
  address: number;
  size: MemoryAccessSize;
  bytes: number[];
  initialized?: boolean[];
  value: number;
};

export type MemoryPatch = {
  address: number;
  before: number[];
  after: number[];
  initializedBefore?: boolean[];
  initializedAfter?: boolean[];
};

export type AddressCalculation = {
  baseRegister: number;
  baseValue: number;
  offset: number;
  effectiveAddress: number;
};

export type ControlFlow = {
  kind: "sequential" | "branch";
  taken?: boolean;
  target?: number;
  lhs?: number;
  rhs?: number;
};

export type StepWarning = {
  code: "UNINITIALIZED_READ";
  message: string;
  addresses: number[];
};

export type StepDelta = {
  pcBefore: number;
  pcAfter: number;
  stepIndexBefore: number;
  stepIndexAfter: number;
  statusBefore: "ready" | "completed";
  statusAfter: "ready" | "completed";
  instruction: {
    mnemonic: Mnemonic;
    sourceLine: number;
    sourceText: string;
    encoding: number;
  };
  registerReads: RegisterRead[];
  registerWrites: RegisterWrite[];
  memoryAccesses: MemoryAccess[];
  memoryPatches: MemoryPatch[];
  warnings: StepWarning[];
  addressCalculation?: AddressCalculation;
  controlFlow: ControlFlow;
};

export type SerializedInstruction = {
  mnemonic: Mnemonic;
  address: number;
  encoding: number;
  sourceLine: number;
  sourceText: string;
};

export type Snapshot = {
  profile: "rv32i-edu-v1";
  pc: number;
  registers: number[];
  memoryBase: number;
  memory: number[];
  memoryInitialized: boolean[];
  status: MachineStatus;
  stepIndex: number;
  historyDepth: number;
  currentInstruction: SerializedInstruction | null;
};

export type InitialMemoryPatch = {
  address: number;
  bytes: number[];
};

export type MachineOptions = {
  initialRegisters?: Record<number, number>;
  initialMemory?: InitialMemoryPatch[];
  historyLimit?: number;
};

export class Rv32iError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "Rv32iError";
    this.code = code;
  }
}
