import { ByteMemory } from "./memory";
import { parseProgram } from "./parser";
import {
  DATA_BASE,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  type MachineOptions,
  type Program,
  Rv32iError,
  type Snapshot,
  type StepDelta,
} from "./types";

export class Rv32iMachine {
  readonly program: Program;
  private readonly registers = new Uint32Array(32);
  private readonly memory = new ByteMemory();
  private readonly instructionByAddress = new Map(
    [] as Array<[number, Program["instructions"][number]]>,
  );
  private readonly history: StepDelta[] = [];
  private readonly initialRegisters: number[];
  private readonly initialMemory: number[];
  private readonly historyLimit: number;
  private pc = 0;
  private stepIndex = 0;
  private status: "ready" | "completed";

  constructor(source: string, options: MachineOptions = {}) {
    this.program = parseProgram(source);
    const requestedHistoryLimit =
      options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
    if (
      !Number.isInteger(requestedHistoryLimit) ||
      requestedHistoryLimit < 0
    ) {
      throw new Rv32iError(
        "HISTORY_LIMIT",
        "되돌리기 기록 제한은 0 이상의 정수여야 합니다.",
      );
    }
    this.historyLimit = Math.min(
      requestedHistoryLimit,
      MAX_HISTORY_LIMIT,
    );
    this.program.instructions.forEach((instruction) => {
      this.instructionByAddress.set(instruction.address, instruction);
    });

    this.registers[10] = DATA_BASE;
    Object.entries(options.initialRegisters ?? {}).forEach(([index, value]) => {
      const register = Number(index);
      if (!Number.isInteger(register) || register < 0 || register > 31) {
        throw new Rv32iError(
          "INITIAL_REGISTER",
          `초기 레지스터 x${index}를 설정할 수 없습니다.`,
        );
      }
      if (register !== 0) this.registers[register] = value >>> 0;
    });
    for (const patch of options.initialMemory ?? []) {
      this.memory.writeBytes(patch.address, patch.bytes);
    }
    this.registers[0] = 0;
    this.initialRegisters = Array.from(this.registers);
    this.initialMemory = this.memory.toArray();
    this.status = this.program.instructions.length === 0 ? "completed" : "ready";
  }

  step(): StepDelta {
    if (this.status === "completed") {
      throw new Rv32iError("PROGRAM_COMPLETE", "프로그램이 이미 완료되었습니다.");
    }
    const instruction = this.instructionByAddress.get(this.pc);
    if (!instruction) {
      throw new Rv32iError(
        "INSTRUCTION_ADDRESS",
        `PC 0x${this.pc.toString(16)}에 실행할 instruction이 없습니다.`,
      );
    }

    const delta: StepDelta = {
      pcBefore: this.pc,
      pcAfter: this.pc + 4,
      stepIndexBefore: this.stepIndex,
      stepIndexAfter: this.stepIndex + 1,
      statusBefore: this.status,
      statusAfter: "ready",
      instruction: {
        mnemonic: instruction.mnemonic,
        sourceLine: instruction.sourceLine,
        sourceText: instruction.sourceText,
        encoding: instruction.encoding,
      },
      registerReads: [],
      registerWrites: [],
      memoryAccesses: [],
      memoryPatches: [],
      controlFlow: { kind: "sequential" },
    };

    const readRegister = (
      register: number,
      role: "rs1" | "rs2" | "address",
    ): number => {
      const value = this.registers[register] >>> 0;
      delta.registerReads.push({ register, value, role });
      return value;
    };
    const writeRegister = (register: number, value: number): void => {
      const before = this.registers[register] >>> 0;
      const after = value >>> 0;
      const committed = register !== 0;
      if (committed) this.registers[register] = after;
      this.registers[0] = 0;
      delta.registerWrites.push({
        register,
        before,
        after: committed ? after : 0,
        committed,
      });
    };

    if (instruction.mnemonic === "addi") {
      const [rd, rs1, immediate] = instruction.operands;
      const source = readRegister(rs1.index, "rs1");
      writeRegister(rd.index, (source + immediate.value) >>> 0);
    } else if (instruction.mnemonic === "lw") {
      const [rd, memoryOperand] = instruction.operands;
      const baseValue = readRegister(memoryOperand.base, "address");
      const effectiveAddress = (baseValue + memoryOperand.offset) >>> 0;
      const word = this.memory.readWord(effectiveAddress);
      delta.addressCalculation = {
        baseRegister: memoryOperand.base,
        baseValue,
        offset: memoryOperand.offset,
        effectiveAddress,
      };
      delta.memoryAccesses.push({
        kind: "read",
        address: effectiveAddress,
        size: 4,
        bytes: word.bytes,
        value: word.value,
      });
      writeRegister(rd.index, word.value);
    } else if (instruction.mnemonic === "sw") {
      const [rs2, memoryOperand] = instruction.operands;
      const value = readRegister(rs2.index, "rs2");
      const baseValue = readRegister(memoryOperand.base, "address");
      const effectiveAddress = (baseValue + memoryOperand.offset) >>> 0;
      this.memory.validateWordWrite(effectiveAddress);
      const before = this.memory.readBytes(effectiveAddress, 4);
      const after = this.memory.wordBytes(value);
      this.memory.writeBytes(effectiveAddress, after);
      delta.addressCalculation = {
        baseRegister: memoryOperand.base,
        baseValue,
        offset: memoryOperand.offset,
        effectiveAddress,
      };
      delta.memoryAccesses.push({
        kind: "write",
        address: effectiveAddress,
        size: 4,
        bytes: after,
        value,
      });
      delta.memoryPatches.push({ address: effectiveAddress, before, after });
    } else {
      const [rs1, rs2, label] = instruction.operands;
      const lhs = readRegister(rs1.index, "rs1");
      const rhs = readRegister(rs2.index, "rs2");
      const taken = lhs === rhs;
      delta.pcAfter = taken ? label.address : instruction.address + 4;
      delta.controlFlow = {
        kind: "branch",
        taken,
        target: label.address,
        lhs,
        rhs,
      };
    }

    this.pc = delta.pcAfter >>> 0;
    this.stepIndex = delta.stepIndexAfter;
    this.status = this.pc === this.program.endAddress ? "completed" : "ready";
    delta.statusAfter = this.status;
    this.history.push(delta);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
    return delta;
  }

  back(): StepDelta | null {
    const delta = this.history.pop();
    if (!delta) return null;

    [...delta.memoryPatches].reverse().forEach((patch) => {
      this.memory.writeBytes(patch.address, patch.before);
    });
    [...delta.registerWrites].reverse().forEach((write) => {
      if (write.committed) this.registers[write.register] = write.before >>> 0;
    });
    this.registers[0] = 0;
    this.pc = delta.pcBefore;
    this.stepIndex = delta.stepIndexBefore;
    this.status = delta.statusBefore;
    return delta;
  }

  reset(): void {
    this.registers.set(this.initialRegisters);
    this.registers[0] = 0;
    this.memory.restore(this.initialMemory);
    this.history.length = 0;
    this.pc = 0;
    this.stepIndex = 0;
    this.status = this.program.instructions.length === 0 ? "completed" : "ready";
  }

  snapshot(): Snapshot {
    const current = this.instructionByAddress.get(this.pc);
    return {
      profile: "rv32i-edu-v1",
      pc: this.pc >>> 0,
      registers: Array.from(this.registers, (value) => value >>> 0),
      memoryBase: this.memory.base,
      memory: this.memory.toArray(),
      status: this.status,
      stepIndex: this.stepIndex,
      historyDepth: this.history.length,
      currentInstruction: current
        ? {
            mnemonic: current.mnemonic,
            address: current.address,
            encoding: current.encoding,
            sourceLine: current.sourceLine,
            sourceText: current.sourceText,
          }
        : null,
    };
  }
}
