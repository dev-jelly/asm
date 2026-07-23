import { Rv32iError } from "./types";

function signedBits(value: number, bits: number): number {
  const minimum = -(2 ** (bits - 1));
  const maximum = 2 ** (bits - 1) - 1;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Rv32iError(
      "IMMEDIATE_RANGE",
      `${bits}비트 signed 즉시값 범위(${minimum}..${maximum})를 벗어났습니다.`,
    );
  }
  return value & (2 ** bits - 1);
}

export function encodeAddi(rd: number, rs1: number, immediate: number): number {
  const imm = signedBits(immediate, 12);
  return (((imm << 20) | (rs1 << 15) | (rd << 7) | 0x13) >>> 0);
}

export function encodeLw(rd: number, rs1: number, offset: number): number {
  const imm = signedBits(offset, 12);
  return (((imm << 20) | (rs1 << 15) | (0b010 << 12) | (rd << 7) | 0x03) >>> 0);
}

export function encodeSw(rs2: number, rs1: number, offset: number): number {
  const imm = signedBits(offset, 12);
  const upper = (imm >>> 5) & 0x7f;
  const lower = imm & 0x1f;
  return (
    ((upper << 25) |
      (rs2 << 20) |
      (rs1 << 15) |
      (0b010 << 12) |
      (lower << 7) |
      0x23) >>>
    0
  );
}

export function encodeBeq(
  rs1: number,
  rs2: number,
  byteOffset: number,
): number {
  if (byteOffset % 2 !== 0) {
    throw new Rv32iError(
      "BRANCH_ALIGNMENT",
      "beq 대상 offset은 2바이트 단위로 정렬되어야 합니다.",
    );
  }
  const imm = signedBits(byteOffset, 13);
  const bit12 = (imm >>> 12) & 0x1;
  const bit11 = (imm >>> 11) & 0x1;
  const bits10to5 = (imm >>> 5) & 0x3f;
  const bits4to1 = (imm >>> 1) & 0xf;

  return (
    ((bit12 << 31) |
      (bits10to5 << 25) |
      (rs2 << 20) |
      (rs1 << 15) |
      (bits4to1 << 8) |
      (bit11 << 7) |
      0x63) >>>
    0
  );
}
