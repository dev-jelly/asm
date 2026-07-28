"use client";

import { useMemo, useState } from "react";
import { formatHex } from "../../lib/rv32i/memory";
import type { StepDelta } from "../../lib/rv32i/types";

type ExecutionTimelineProps = {
  trace: readonly StepDelta[];
};

const VISIBLE_STEPS = 12;

export function ExecutionTimeline({ trace }: ExecutionTimelineProps) {
  const visibleTrace = useMemo(
    () => trace.slice(-VISIBLE_STEPS),
    [trace],
  );
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const selected =
    visibleTrace.find((delta) => delta.stepIndexAfter === selectedStep) ??
    visibleTrace.at(-1) ??
    null;

  return (
    <section className="execution-timeline" aria-labelledby="timeline-title">
      <div className="section-heading-row">
        <div>
          <h3 id="timeline-title">실행 기록</h3>
          <p className="timeline-help">
            명령어를 선택하면 그 Step에서 읽고 쓴 상태를 다시 확인할 수 있습니다.
          </p>
        </div>
        <span>
          최근 {visibleTrace.length} / 전체 {trace.length}
        </span>
      </div>

      {visibleTrace.length === 0 ? (
        <p className="empty-state">
          아직 실행 기록이 없습니다. 예측을 남기고 Step을 실행하세요.
        </p>
      ) : (
        <>
          <ol className="timeline-track" aria-label="최근 실행 명령어">
            {visibleTrace.map((delta) => {
              const active = delta.stepIndexAfter === selected?.stepIndexAfter;
              return (
                <li key={`${delta.stepIndexAfter}-${delta.pcBefore}`}>
                  <button
                    type="button"
                    className="timeline-step"
                    data-selected={active || undefined}
                    aria-pressed={active}
                    onClick={() => setSelectedStep(delta.stepIndexAfter)}
                  >
                    <span className="timeline-sequence">
                      Step {delta.stepIndexAfter}
                    </span>
                    <code>{delta.instruction.mnemonic}</code>
                    <span>
                      {formatHex(delta.pcBefore)} → {formatHex(delta.pcAfter)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {selected ? (
            <div
              className="timeline-inspector"
              aria-live="polite"
              aria-atomic="true"
            >
              <div>
                <span className="state-label">
                  Step {selected.stepIndexAfter} 명령어
                </span>
                <code>{selected.instruction.sourceText}</code>
              </div>
              <div>
                <span className="state-label">레지스터</span>
                <span>{registerSummary(selected)}</span>
              </div>
              <div>
                <span className="state-label">메모리</span>
                <span>{memorySummary(selected)}</span>
              </div>
              <div>
                <span className="state-label">실행 흐름</span>
                <span>{controlSummary(selected)}</span>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function registerSummary(delta: StepDelta): string {
  const writes = delta.registerWrites.filter((write) => write.committed);
  if (!writes.length) return "쓰기 없음";
  return writes
    .map(
      (write) =>
        `x${write.register} ${formatHex(write.before)} → ${formatHex(write.after)}`,
    )
    .join(", ");
}

function memorySummary(delta: StepDelta): string {
  if (!delta.memoryAccesses.length) return "접근 없음";
  return delta.memoryAccesses
    .map(
      (access) =>
        `${access.kind === "read" ? "읽기" : "쓰기"} ${formatHex(access.address)} (${access.size}B)`,
    )
    .join(", ");
}

function controlSummary(delta: StepDelta): string {
  if (delta.controlFlow.kind !== "branch") {
    return `다음 PC ${formatHex(delta.pcAfter)}`;
  }
  return `${delta.controlFlow.taken ? "분기함" : "분기하지 않음"}, 다음 PC ${formatHex(delta.pcAfter)}`;
}
