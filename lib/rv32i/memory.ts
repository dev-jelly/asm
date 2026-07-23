import { DATA_BASE, DATA_SIZE, Rv32iError } from "./types";

export class ByteMemory {
  readonly base: number;
  readonly size: number;
  private readonly bytes: Uint8Array;

  constructor(base = DATA_BASE, size = DATA_SIZE) {
    this.base = base >>> 0;
    this.size = size;
    this.bytes = new Uint8Array(size);
  }

  private index(address: number, size: number): number {
    const normalized = address >>> 0;
    const offset = normalized - this.base;
    if (
      !Number.isInteger(address) ||
      normalized < this.base ||
      offset < 0 ||
      offset + size > this.size
    ) {
      throw new Rv32iError(
        "MEMORY_BOUNDS",
        `주소 ${formatHex(normalized)}의 ${size}바이트 접근은 데이터 영역 밖입니다.`,
      );
    }
    return offset;
  }

  readBytes(address: number, size: number): number[] {
    const start = this.index(address, size);
    return Array.from(this.bytes.slice(start, start + size));
  }

  writeBytes(address: number, values: readonly number[]): void {
    const start = this.index(address, values.length);
    const normalized = values.map((value) => value & 0xff);
    this.bytes.set(normalized, start);
  }

  readWord(address: number): { value: number; bytes: number[] } {
    this.assertWordAlignment(address);
    const bytes = this.readBytes(address, 4);
    const value =
      (bytes[0] |
        (bytes[1] << 8) |
        (bytes[2] << 16) |
        (bytes[3] << 24)) >>>
      0;
    return { value, bytes };
  }

  wordBytes(value: number): number[] {
    const normalized = value >>> 0;
    return [
      normalized & 0xff,
      (normalized >>> 8) & 0xff,
      (normalized >>> 16) & 0xff,
      (normalized >>> 24) & 0xff,
    ];
  }

  validateWordWrite(address: number): void {
    this.assertWordAlignment(address);
    this.index(address, 4);
  }

  private assertWordAlignment(address: number): void {
    if ((address >>> 0) % 4 !== 0) {
      throw new Rv32iError(
        "MISALIGNED_WORD",
        `주소 ${formatHex(address)}는 4바이트 word 경계에 정렬되지 않았습니다.`,
      );
    }
  }

  toArray(): number[] {
    return Array.from(this.bytes);
  }

  restore(values: readonly number[]): void {
    if (values.length !== this.size) {
      throw new Rv32iError(
        "MEMORY_SNAPSHOT",
        "메모리 스냅샷 크기가 교육용 데이터 영역과 다릅니다.",
      );
    }
    this.bytes.set(values);
  }
}

export function formatHex(value: number, width = 8): string {
  return `0x${(value >>> 0).toString(16).padStart(width, "0")}`;
}
