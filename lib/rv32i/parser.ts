import {
  encodeAddi,
  encodeBeq,
  encodeLb,
  encodeLbu,
  encodeLh,
  encodeLhu,
  encodeLw,
  encodeSb,
  encodeSh,
  encodeSw,
} from "./encoding";
import {
  type Instruction,
  type LoadMnemonic,
  type MemoryOperand,
  type Program,
  type RegisterOperand,
  Rv32iError,
  type StoreMnemonic,
} from "./types";

const MAX_SOURCE_BYTES = 16_384;
const MAX_INSTRUCTIONS = 512;
const REGISTER_ALIASES: Record<string, number> = {
  zero: 0,
  ra: 1,
  sp: 2,
  gp: 3,
  tp: 4,
  t0: 5,
  t1: 6,
  t2: 7,
  s0: 8,
  fp: 8,
  s1: 9,
  a0: 10,
  a1: 11,
  a2: 12,
  a3: 13,
  a4: 14,
  a5: 15,
  a6: 16,
  a7: 17,
  s2: 18,
  s3: 19,
  s4: 20,
  s5: 21,
  s6: 22,
  s7: 23,
  s8: 24,
  s9: 25,
  s10: 26,
  s11: 27,
  t3: 28,
  t4: 29,
  t5: 30,
  t6: 31,
};

type SourceInstruction = {
  address: number;
  sourceLine: number;
  sourceText: string;
  text: string;
};

const LOAD_ENCODERS: Record<
  LoadMnemonic,
  (rd: number, rs1: number, offset: number) => number
> = {
  lb: encodeLb,
  lbu: encodeLbu,
  lh: encodeLh,
  lhu: encodeLhu,
  lw: encodeLw,
};

const STORE_ENCODERS: Record<
  StoreMnemonic,
  (rs2: number, rs1: number, offset: number) => number
> = {
  sb: encodeSb,
  sh: encodeSh,
  sw: encodeSw,
};

export function parseProgram(source: string): Program {
  if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) {
    throw new Rv32iError(
      "SOURCE_BUDGET",
      `소스는 ${MAX_SOURCE_BYTES}바이트 이하여야 합니다.`,
    );
  }

  const labels = Object.create(null) as Record<string, number>;
  const pending: SourceInstruction[] = [];
  let address = 0;

  source.split(/\r?\n/).forEach((rawLine, lineIndex) => {
    const sourceLine = lineIndex + 1;
    let text = rawLine.replace(/(#|\/\/).*$/, "").trim();
    if (!text) return;

    const labelMatch = text.match(/^([A-Za-z_.$][\w.$]*):\s*(.*)$/);
    if (labelMatch) {
      const [, label, remainder] = labelMatch;
      if (Object.hasOwn(labels, label)) {
        throw new Rv32iError(
          "DUPLICATE_LABEL",
          `${sourceLine}행의 레이블 '${label}'이 중복되었습니다.`,
        );
      }
      labels[label] = address;
      text = remainder.trim();
      if (!text) return;
    }

    pending.push({
      address,
      sourceLine,
      sourceText: rawLine.trim(),
      text,
    });
    address += 4;
    if (pending.length > MAX_INSTRUCTIONS) {
      throw new Rv32iError(
        "INSTRUCTION_BUDGET",
        `프로그램은 ${MAX_INSTRUCTIONS}개 instruction 이하여야 합니다.`,
      );
    }
  });

  const instructions = pending.map((item) => parseInstruction(item, labels));
  return {
    source,
    instructions,
    labels,
    endAddress: instructions.length * 4,
  };
}

function parseInstruction(
  item: SourceInstruction,
  labels: Record<string, number>,
): Instruction {
  const mnemonicMatch = item.text.match(/^([A-Za-z]+)\s*(.*)$/);
  if (!mnemonicMatch) {
    throw lineError(item, "PARSE", "instruction을 해석할 수 없습니다.");
  }
  const mnemonic = mnemonicMatch[1].toLowerCase();
  const operands = splitOperands(mnemonicMatch[2]);

  if (mnemonic === "addi") {
    assertOperandCount(item, operands, 3);
    const rd = parseRegister(item, operands[0]);
    const rs1 = parseRegister(item, operands[1]);
    const immediate = parseImmediate(item, operands[2]);
    return {
      mnemonic,
      operands: [
        registerOperand(rd),
        registerOperand(rs1),
        { kind: "immediate", value: immediate },
      ],
      address: item.address,
      encoding: encodeAddi(rd, rs1, immediate),
      sourceLine: item.sourceLine,
      sourceText: item.sourceText,
    };
  }

  if (isLoadMnemonic(mnemonic) || isStoreMnemonic(mnemonic)) {
    assertOperandCount(item, operands, 2);
    const register = parseRegister(item, operands[0]);
    const memory = parseMemoryOperand(item, operands[1]);
    const common = {
      address: item.address,
      sourceLine: item.sourceLine,
      sourceText: item.sourceText,
    };
    if (isLoadMnemonic(mnemonic)) {
      return {
        ...common,
        mnemonic,
        operands: [registerOperand(register), memory],
        encoding: LOAD_ENCODERS[mnemonic](
          register,
          memory.base,
          memory.offset,
        ),
      };
    }
    return {
      ...common,
      mnemonic,
      operands: [registerOperand(register), memory],
      encoding: STORE_ENCODERS[mnemonic](
        register,
        memory.base,
        memory.offset,
      ),
    };
  }

  if (mnemonic === "beq") {
    assertOperandCount(item, operands, 3);
    const rs1 = parseRegister(item, operands[0]);
    const rs2 = parseRegister(item, operands[1]);
    const label = operands[2];
    if (!/^[A-Za-z_.$][\w.$]*$/.test(label)) {
      throw lineError(item, "LABEL", `'${label}'은 올바른 레이블이 아닙니다.`);
    }
    if (!Object.hasOwn(labels, label)) {
      throw lineError(item, "UNDEFINED_LABEL", `레이블 '${label}'을 찾을 수 없습니다.`);
    }
    const target = labels[label];
    return {
      mnemonic,
      operands: [
        registerOperand(rs1),
        registerOperand(rs2),
        { kind: "label", name: label, address: target },
      ],
      address: item.address,
      encoding: encodeBeq(rs1, rs2, target - item.address),
      sourceLine: item.sourceLine,
      sourceText: item.sourceText,
    };
  }

  throw lineError(
    item,
    "UNKNOWN_MNEMONIC",
    `'${mnemonic}'은 이 첫 실험실에서 지원하지 않습니다.`,
  );
}

function isLoadMnemonic(mnemonic: string): mnemonic is LoadMnemonic {
  return Object.hasOwn(LOAD_ENCODERS, mnemonic);
}

function isStoreMnemonic(mnemonic: string): mnemonic is StoreMnemonic {
  return Object.hasOwn(STORE_ENCODERS, mnemonic);
}

function splitOperands(text: string): string[] {
  if (!text.trim()) return [];
  return text.split(",").map((operand) => operand.trim());
}

function assertOperandCount(
  item: SourceInstruction,
  operands: string[],
  expected: number,
): void {
  if (operands.length !== expected || operands.some((operand) => !operand)) {
    throw lineError(
      item,
      "OPERAND_COUNT",
      `${expected}개의 피연산자가 필요합니다.`,
    );
  }
}

function parseRegister(item: SourceInstruction, text: string): number {
  const normalized = text.toLowerCase();
  const numeric = normalized.match(/^x(\d{1,2})$/);
  const index = numeric ? Number(numeric[1]) : REGISTER_ALIASES[normalized];
  if (!Number.isInteger(index) || index < 0 || index > 31) {
    throw lineError(item, "REGISTER", `'${text}'은 올바른 RV32I 레지스터가 아닙니다.`);
  }
  return index;
}

function parseMemoryOperand(
  item: SourceInstruction,
  text: string,
): MemoryOperand {
  const match = text.match(/^(.+)\(([^)]+)\)$/);
  if (!match) {
    throw lineError(
      item,
      "MEMORY_OPERAND",
      `메모리 피연산자 '${text}'은 offset(base) 형식이어야 합니다.`,
    );
  }
  return {
    kind: "memory",
    offset: parseImmediate(item, match[1].trim()),
    base: parseRegister(item, match[2].trim()),
  };
}

function parseImmediate(item: SourceInstruction, text: string): number {
  const match = text.match(/^([+-]?)(0x[0-9a-f]+|\d+)$/i);
  if (!match) {
    throw lineError(item, "IMMEDIATE", `'${text}'은 올바른 정수 즉시값이 아닙니다.`);
  }
  const magnitude = Number.parseInt(match[2], match[2].toLowerCase().startsWith("0x") ? 16 : 10);
  return match[1] === "-" ? -magnitude : magnitude;
}

function registerOperand(index: number): RegisterOperand {
  return { kind: "register", index };
}

function lineError(
  item: SourceInstruction,
  code: string,
  message: string,
): Rv32iError {
  return new Rv32iError(code, `${item.sourceLine}행: ${message}`);
}
