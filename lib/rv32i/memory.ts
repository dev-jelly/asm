import {
  DATA_BASE,
  DATA_SIZE,
  type MemoryAccessSize,
  Rv32iError,
} from "./types";

export class ByteMemory {
  readonly base: number;
  readonly size: number;
  private readonly bytes: Uint8Array;
  private readonly initialized: Uint8Array;

  constructor(base = DATA_BASE, size = DATA_SIZE) {
    this.base = base >>> 0;
    this.size = size;
    this.bytes = new Uint8Array(size);
    this.initialized = new Uint8Array(size);
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

  readInitialized(address: number, size: number): boolean[] {
    const start = this.index(address, size);
    return Array.from(
      this.initialized.slice(start, start + size),
      (value) => value !== 0,
    );
  }

  writeBytes(
    address: number,
    values: readonly number[],
    initialized: readonly boolean[] = values.map(() => true),
  ): void {
    if (initialized.length !== values.length) {
      throw new Rv32iError(
        "MEMORY_SHADOW",
        "메모리 byte와 initialized shadow의 길이가 다릅니다.",
      );
    }
    const start = this.index(address, values.length);
    const normalized = values.map((value) => value & 0xff);
    this.bytes.set(normalized, start);
    this.initialized.set(
      initialized.map((value) => (value ? 1 : 0)),
      start,
    );
  }

  read(
    address: number,
    size: MemoryAccessSize,
  ): { value: number; bytes: number[]; initialized: boolean[] } {
    this.validateAccess(address, size);
    const bytes = this.readBytes(address, size);
    let value = 0;
    bytes.forEach((byte, index) => {
      value = (value | (byte << (index * 8))) >>> 0;
    });
    return {
      value: value >>> 0,
      bytes,
      initialized: this.readInitialized(address, size),
    };
  }

  valueBytes(value: number, size: MemoryAccessSize): number[] {
    const normalized = value >>> 0;
    return Array.from(
      { length: size },
      (_, index) => (normalized >>> (index * 8)) & 0xff,
    );
  }

  validateAccess(address: number, size: MemoryAccessSize): void {
    this.assertAlignment(address, size);
    this.index(address, size);
  }

  private assertAlignment(address: number, size: MemoryAccessSize): void {
    if (size === 1 || (address >>> 0) % size === 0) return;
    if (size === 4) {
      throw new Rv32iError(
        "MISALIGNED_WORD",
        `주소: ${formatHex(address)}. 4바이트 word 경계에 정렬되지 않았습니다.`,
      );
    }
    throw new Rv32iError(
      "MISALIGNED_HALF",
      `주소: ${formatHex(address)}. 2바이트 halfword 경계에 정렬되지 않았습니다.`,
    );
  }

  toArray(): number[] {
    return Array.from(this.bytes);
  }

  initializedToArray(): boolean[] {
    return Array.from(this.initialized, (value) => value !== 0);
  }

  restore(
    values: readonly number[],
    initialized: readonly boolean[],
  ): void {
    if (values.length !== this.size || initialized.length !== this.size) {
      throw new Rv32iError(
        "MEMORY_SNAPSHOT",
        "메모리 또는 initialized shadow 스냅샷 크기가 교육용 데이터 영역과 다릅니다.",
      );
    }
    this.bytes.set(values);
    this.initialized.set(initialized.map((value) => (value ? 1 : 0)));
  }
}

export function formatHex(value: number, width = 8): string {
  return `0x${(value >>> 0).toString(16).padStart(width, "0")}`;
}
