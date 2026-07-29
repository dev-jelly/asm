"use client";

import { useMemo, useState } from "react";
import { formatHex } from "../../lib/rv32i/memory";
import type {
  MemoryAccess,
  MemoryPatch,
  Snapshot,
  StepDelta,
} from "../../lib/rv32i/types";

const PAGE_SIZE = 16;

type UnitSize = 1 | 2 | 4;
type NumberFormat = "hex" | "unsigned" | "signed";
type InitializationState = "initialized" | "partial" | "uninitialized" | "unknown";

type SnapshotWithInitialization = Snapshot & {
  memoryInitialized?: boolean[];
};

type MemoryAccessWithInitialization = MemoryAccess & {
  initialized?: boolean[];
};

type MemoryPatchWithInitialization = MemoryPatch & {
  initializedBefore?: boolean[];
  initializedAfter?: boolean[];
};

type MemoryVisualizerProps = {
  snapshot: Snapshot;
  lastDelta: StepDelta | null;
  focusAddress?: number | null;
  preferredUnit?: UnitSize | null;
};

const UNIT_LABELS: Record<UnitSize, string> = {
  1: "1바이트 (byte)",
  2: "2바이트 (halfword)",
  4: "4바이트 (word)",
};

const NUMBER_FORMAT_LABELS: Record<NumberFormat, string> = {
  hex: "16진수",
  unsigned: "부호 없음",
  signed: "부호 있음",
};

export function MemoryVisualizer({
  snapshot,
  lastDelta,
  focusAddress = null,
  preferredUnit = null,
}: MemoryVisualizerProps) {
  const initialOffset = clamp(
    focusAddress === null ? 0 : focusAddress - snapshot.memoryBase,
    0,
    Math.max(0, snapshot.memory.length - 1),
  );
  const initialUnit = preferredUnit ?? 1;
  const [unitSize, setUnitSize] = useState<UnitSize>(initialUnit);
  const [numberFormat, setNumberFormat] = useState<NumberFormat>("hex");
  const [requestedPageOffset, setRequestedPageOffset] = useState(
    Math.floor(initialOffset / PAGE_SIZE) * PAGE_SIZE,
  );
  const [selectedOffset, setSelectedOffset] = useState(
    initialOffset - (initialOffset % initialUnit),
  );
  const [addressInput, setAddressInput] = useState(
    formatHex(snapshot.memoryBase + initialOffset),
  );
  const [addressError, setAddressError] = useState("");

  const lastPageOffset = Math.max(
    0,
    Math.floor(Math.max(0, snapshot.memory.length - 1) / PAGE_SIZE) * PAGE_SIZE,
  );
  const pageOffset = clamp(requestedPageOffset, 0, lastPageOffset);
  const pageLength = Math.min(PAGE_SIZE, snapshot.memory.length - pageOffset);
  const pageStart = snapshot.memoryBase + pageOffset;
  const pageEnd = pageStart + Math.max(0, pageLength - 1);
  const memoryEnd =
    snapshot.memoryBase + Math.max(0, snapshot.memory.length - 1);
  const selectedUnitOffset = clamp(
    Math.floor(selectedOffset / unitSize) * unitSize,
    pageOffset,
    Math.max(pageOffset, pageOffset + pageLength - unitSize),
  );

  const initializedMask = (
    snapshot as SnapshotWithInitialization
  ).memoryInitialized;
  const lastAccess = lastDelta?.memoryAccesses.at(
    -1,
  ) as MemoryAccessWithInitialization | undefined;
  const lastPatch = findLastPatch(lastDelta, lastAccess);

  const units = useMemo(() => {
    const result = [];
    for (
      let offset = pageOffset;
      offset < pageOffset + pageLength;
      offset += unitSize
    ) {
      const width = Math.min(unitSize, snapshot.memory.length - offset);
      const bytes = snapshot.memory.slice(offset, offset + width);
      const initialization = getInitialization(
        initializedMask?.slice(offset, offset + width),
        width,
      );
      const address = snapshot.memoryBase + offset;
      const accessKind = overlapsAccess(address, width, lastAccess)
        ? lastAccess?.kind
        : undefined;
      result.push({
        offset,
        address,
        width,
        bytes,
        initialization,
        accessKind,
      });
    }
    return result;
  }, [
    initializedMask,
    lastAccess,
    pageLength,
    pageOffset,
    snapshot.memory,
    snapshot.memoryBase,
    unitSize,
  ]);

  const selectedUnit =
    units.find((unit) => unit.offset === selectedUnitOffset) ?? units[0];

  function moveToOffset(nextOffset: number) {
    const nextSelectedOffset = clamp(
      nextOffset,
      0,
      Math.max(0, snapshot.memory.length - 1),
    );
    const nextPageOffset = clamp(
      Math.floor(nextSelectedOffset / PAGE_SIZE) * PAGE_SIZE,
      0,
      lastPageOffset,
    );
    setRequestedPageOffset(nextPageOffset);
    setSelectedOffset(
      nextSelectedOffset - (nextSelectedOffset % unitSize),
    );
    setAddressInput(formatHex(snapshot.memoryBase + nextSelectedOffset));
    setAddressError("");
  }

  function submitAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAddress(addressInput);
    if (
      parsed === null ||
      parsed < snapshot.memoryBase ||
      parsed > memoryEnd
    ) {
      setAddressError(
        `${formatHex(snapshot.memoryBase)}부터 ${formatHex(memoryEnd)} 사이 주소를 입력하세요.`,
      );
      return;
    }
    const nextOffset = parsed - snapshot.memoryBase;
    const nextPageOffset = Math.floor(nextOffset / PAGE_SIZE) * PAGE_SIZE;
    setRequestedPageOffset(nextPageOffset);
    setSelectedOffset(
      nextOffset - (nextOffset % unitSize),
    );
    setAddressInput(formatHex(parsed));
    setAddressError("");
  }

  function selectUnitSize(nextSize: UnitSize) {
    setUnitSize(nextSize);
    setSelectedOffset(
      pageOffset + Math.floor((selectedUnitOffset - pageOffset) / nextSize) * nextSize,
    );
  }

  function handleCellKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    unitIndex: number,
  ) {
    const navigationKeys = [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Home",
      "End",
    ];
    if (!navigationKeys.includes(event.key)) return;
    event.preventDefault();

    const grid = event.currentTarget.parentElement;
    const columnCount = grid
      ? Math.max(
          1,
          getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean)
            .length,
        )
      : 1;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = Math.min(units.length - 1, unitIndex + 1);
    } else if (event.key === "ArrowLeft") {
      nextIndex = Math.max(0, unitIndex - 1);
    } else if (event.key === "ArrowDown") {
      nextIndex = Math.min(units.length - 1, unitIndex + columnCount);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, unitIndex - columnCount);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = units.length - 1;
    }

    if (nextIndex === null || nextIndex === unitIndex) return;
    const nextCell = event.currentTarget.parentElement?.querySelectorAll<
      HTMLButtonElement
    >("[data-memory-cell]")[nextIndex];
    nextCell?.focus();
    setSelectedOffset(units[nextIndex].offset);
  }

  return (
    <section
      className="memory-visualizer"
      aria-labelledby="memory-visualizer-title"
    >
      <div className="section-heading-row memory-heading">
        <div>
          <h3 id="memory-visualizer-title">메모리 지도</h3>
          <p>
            16바이트 창에서 낮은 주소부터 읽습니다. 빗금은 초기화되지 않은
            바이트입니다.
          </p>
        </div>
        <span>
          {formatHex(snapshot.memoryBase)} - {formatHex(memoryEnd)}
        </span>
      </div>

      <div className="memory-toolbar">
        <form className="memory-address-form" onSubmit={submitAddress}>
          <button
            type="button"
            className="memory-page-button"
            disabled={pageOffset === 0}
            onClick={() => moveToOffset(pageOffset - PAGE_SIZE)}
            aria-label="이전 16바이트 보기"
          >
            이전
          </button>
          <label htmlFor="memory-address">주소 이동</label>
          <input
            id="memory-address"
            value={addressInput}
            inputMode="text"
            spellCheck={false}
            aria-invalid={Boolean(addressError)}
            aria-describedby={
              addressError
                ? "memory-address-help memory-address-error"
                : "memory-address-help"
            }
            onChange={(event) => setAddressInput(event.target.value)}
          />
          <button type="submit">이동</button>
          <button
            type="button"
            className="memory-page-button"
            disabled={pageOffset === lastPageOffset}
            onClick={() => moveToOffset(pageOffset + PAGE_SIZE)}
            aria-label="다음 16바이트 보기"
          >
            다음
          </button>
          <span className="sr-only" id="memory-address-help">
            0x로 시작하는 16진수 또는 10진수 주소
          </span>
        </form>
        {addressError ? (
          <p className="memory-address-error" id="memory-address-error" role="alert">
            {addressError}
          </p>
        ) : null}

        <div className="memory-view-options">
          <fieldset>
            <legend>데이터 크기</legend>
            {([1, 2, 4] as const).map((size) => (
              <label key={size}>
                <input
                  type="radio"
                  name="memory-unit-size"
                  value={size}
                  checked={unitSize === size}
                  onChange={() => selectUnitSize(size)}
                />
                <span>{UNIT_LABELS[size]}</span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>값 표현</legend>
            {(["hex", "unsigned", "signed"] as const).map((format) => (
              <label key={format}>
                <input
                  type="radio"
                  name="memory-number-format"
                  value={format}
                  checked={numberFormat === format}
                  onChange={() => setNumberFormat(format)}
                />
                <span>{NUMBER_FORMAT_LABELS[format]}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <div className="memory-window-caption" aria-live="polite">
        <strong>
          {formatHex(pageStart)} - {formatHex(pageEnd)}
        </strong>
        <span>방향키로 셀을 이동하고 Home과 End로 양 끝을 선택할 수 있습니다.</span>
      </div>

      <div
        className="memory-grid"
        data-unit-size={unitSize}
        role="group"
        aria-label={`${formatHex(pageStart)}부터 ${formatHex(pageEnd)}까지 메모리`}
      >
        {units.map((unit, index) => {
          const selected = unit.offset === selectedUnit?.offset;
          const rawValue = assembleLittleEndian(unit.bytes);
          const value =
            unit.initialization === "uninitialized" ||
            unit.initialization === "partial"
              ? "??"
              : formatValue(rawValue, unit.width, numberFormat);
          return (
            <button
              type="button"
              className="memory-cell"
              key={unit.address}
              data-memory-cell
              data-initialized={unit.initialization}
              data-access={unit.accessKind}
              aria-pressed={selected}
              tabIndex={selected ? 0 : -1}
              aria-label={describeUnit(
                unit.address,
                unit.width,
                value,
                unit.initialization,
                unit.accessKind,
              )}
              onClick={() => setSelectedOffset(unit.offset)}
              onFocus={() => setSelectedOffset(unit.offset)}
              onKeyDown={(event) => handleCellKeyDown(event, index)}
            >
              <span className="memory-cell-address">{formatHex(unit.address)}</span>
              <strong>{value}</strong>
              {unit.width > 1 ? (
                <span className="memory-cell-bytes" aria-hidden="true">
                  {unit.bytes
                    .map((byte, byteIndex) =>
                      initializedByteLabel(
                        byte,
                        initializedMask?.[unit.offset + byteIndex],
                        Boolean(initializedMask),
                      ),
                    )
                    .join(" ")}
                </span>
              ) : null}
              <span className="memory-cell-state">
                {initializationLabel(unit.initialization)}
                {unit.accessKind ? `, 최근 ${unit.accessKind === "read" ? "읽기" : "쓰기"}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {selectedUnit ? (
        <div className="memory-explanation" aria-live="polite">
          <div>
            <span className="state-label">선택한 {UNIT_LABELS[selectedUnit.width as UnitSize]}</span>
            <strong>{formatHex(selectedUnit.address)}</strong>
          </div>
          <div>
            <span className="state-label">낮은 주소가 먼저</span>
            <code>
              {selectedUnit.bytes
                .map((byte, byteIndex) =>
                  initializedByteLabel(
                    byte,
                    initializedMask?.[selectedUnit.offset + byteIndex],
                    Boolean(initializedMask),
                  ),
                )
                .join(" ")}
            </code>
          </div>
          <p>
            {littleEndianExplanation(
              selectedUnit.bytes,
              selectedUnit.initialization,
              selectedUnit.width,
            )}
          </p>
        </div>
      ) : null}

      <RecentMemoryAccess
        access={lastAccess}
        patch={lastPatch}
        memoryBase={snapshot.memoryBase}
        onJump={(address) => moveToOffset(address - snapshot.memoryBase)}
      />

      <div className="memory-legend" aria-label="메모리 표시 범례">
        <span data-legend="initialized">초기화됨</span>
        <span data-legend="uninitialized">초기화되지 않음</span>
        <span data-legend="read">최근 읽기</span>
        <span data-legend="write">최근 쓰기</span>
        {!initializedMask ? <span>초기화 추적 정보 없음</span> : null}
      </div>
    </section>
  );
}

function RecentMemoryAccess({
  access,
  patch,
  memoryBase,
  onJump,
}: {
  access?: MemoryAccessWithInitialization;
  patch?: MemoryPatchWithInitialization;
  memoryBase: number;
  onJump: (address: number) => void;
}) {
  if (!access) {
    return (
      <div className="recent-memory-access">
        <div>
          <h4>최근 메모리 접근</h4>
          <p>아직 읽거나 쓴 범위가 없습니다.</p>
        </div>
      </div>
    );
  }

  const endAddress = access.address + access.size - 1;
  const before = patch
    ? formatBytesWithInitialization(
        patch.before,
        patch.initializedBefore,
      )
    : null;
  const after = patch
    ? formatBytesWithInitialization(
        patch.after,
        patch.initializedAfter,
      )
    : null;

  return (
    <div className="recent-memory-access" data-kind={access.kind}>
      <div>
        <h4>최근 메모리 {access.kind === "read" ? "읽기" : "쓰기"}</h4>
        <p>
          <code>{formatHex(access.address)}</code>
          {access.size > 1 ? (
            <>
              <span aria-hidden="true"> → </span>
              <span className="sr-only">부터 </span>
              <code>{formatHex(endAddress)}</code>
              <span className="sr-only">까지</span>
            </>
          ) : null}
        </p>
      </div>
      <div>
        <span className="state-label">
          {patch ? "실행 전후 바이트" : "읽은 바이트"}
        </span>
        {patch ? (
          <code>
            {before}
            <span aria-hidden="true"> → </span>
            <span className="sr-only">에서 </span>
            {after}
          </code>
        ) : (
          <code>
            {formatBytesWithInitialization(
              access.bytes,
              access.initialized,
            )}
          </code>
        )}
      </div>
      <button
        type="button"
        onClick={() => onJump(Math.max(memoryBase, access.address))}
      >
        이 범위 보기
      </button>
    </div>
  );
}

function findLastPatch(
  delta: StepDelta | null,
  access?: MemoryAccessWithInitialization,
): MemoryPatchWithInitialization | undefined {
  if (!delta || !access || access.kind !== "write") return undefined;
  return [...delta.memoryPatches]
    .reverse()
    .find((patch) => patch.address === access.address) as
    | MemoryPatchWithInitialization
    | undefined;
}

function overlapsAccess(
  address: number,
  size: number,
  access?: MemoryAccessWithInitialization,
): boolean {
  if (!access) return false;
  return (
    address < access.address + access.size &&
    address + size > access.address
  );
}

function getInitialization(
  flags: boolean[] | undefined,
  expectedLength: number,
): InitializationState {
  if (!flags || flags.length !== expectedLength) return "unknown";
  const initializedCount = flags.filter(Boolean).length;
  if (initializedCount === expectedLength) return "initialized";
  if (initializedCount === 0) return "uninitialized";
  return "partial";
}

function initializationLabel(state: InitializationState): string {
  if (state === "initialized") return "초기화됨";
  if (state === "uninitialized") return "초기화되지 않음";
  if (state === "partial") return "일부만 초기화됨";
  return "초기화 여부 미기록";
}

function initializedByteLabel(
  byte: number,
  initialized: boolean | undefined,
  hasMask: boolean,
): string {
  if (hasMask && initialized !== true) return "??";
  return byte.toString(16).padStart(2, "0");
}

function formatBytesWithInitialization(
  bytes: number[],
  initialized?: boolean[],
): string {
  return bytes
    .map((byte, index) =>
      initialized && initialized[index] !== true
        ? "??"
        : byte.toString(16).padStart(2, "0"),
    )
    .join(" ");
}

function assembleLittleEndian(bytes: number[]): number {
  return bytes.reduce(
    (value, byte, index) => value + (byte & 0xff) * 2 ** (index * 8),
    0,
  ) >>> 0;
}

function formatValue(
  value: number,
  width: number,
  numberFormat: NumberFormat,
): string {
  const bits = width * 8;
  if (numberFormat === "hex") {
    return `0x${value.toString(16).padStart(width * 2, "0")}`;
  }
  if (numberFormat === "unsigned") return String(value >>> 0);
  const signBoundary = 2 ** (bits - 1);
  return String(value >= signBoundary ? value - 2 ** bits : value);
}

function littleEndianExplanation(
  bytes: number[],
  initialization: InitializationState,
  width: number,
): string {
  if (initialization === "uninitialized" || initialization === "partial") {
    return "초기화되지 않은 바이트가 있어 조립한 값은 아직 의미가 없습니다.";
  }
  if (width === 1) {
    return "byte는 한 주소의 8비트를 그대로 읽습니다.";
  }
  const value = assembleLittleEndian(bytes);
  return `가장 낮은 주소의 ${bytes[0].toString(16).padStart(2, "0")}가 최하위 8비트입니다. 주소가 높아질수록 더 높은 자리에 놓여 ${formatValue(value, width, "hex")}로 조립됩니다.`;
}

function describeUnit(
  address: number,
  width: number,
  value: string,
  initialization: InitializationState,
  accessKind?: "read" | "write",
): string {
  const parts = [
    `${formatHex(address)}, ${UNIT_LABELS[width as UnitSize]}`,
    value === "??" ? "값 미정" : `값 ${value}`,
    initializationLabel(initialization),
  ];
  if (accessKind) {
    parts.push(`최근 ${accessKind === "read" ? "읽기" : "쓰기"}`);
  }
  return parts.join(", ");
}

function parseAddress(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
