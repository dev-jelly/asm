"use client";

import { useEffect, useMemo, useState } from "react";
import type { MachineOptions } from "../../lib/rv32i/types";
import { useRv32iWorker } from "../hooks/useRv32iWorker";
import { markLocalProgress } from "../lib/progress";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { LabControls } from "./LabControls";
import { MachineStateView } from "./MachineStateView";
import { expectedPrediction, PredictionGate } from "./PredictionGate";

type LabPreset = {
  id: string;
  activityId: string;
  title: string;
  summary: string;
  focus: string;
  source: string;
  options?: MachineOptions;
};

const LAB_PRESETS: readonly LabPreset[] = [
  {
    id: "word-roundtrip",
    activityId: "tracer-bullet",
    title: "워드 왕복",
    summary: "값을 저장하고 다시 읽은 뒤 분기 결과를 확인합니다.",
    focus: "주소 계산, 4바이트 store/load, 분기",
    source: `addi x5, x0, 7
sw   x5, 0(x10)
lw   x6, 0(x10)
beq  x5, x6, done
addi x7, x0, 1
done:`,
  },
  {
    id: "signed-loads",
    activityId: "signed-loads",
    title: "부호 확장",
    summary: "같은 바이트를 signed와 unsigned load로 다르게 읽습니다.",
    focus: "lb/lbu, lh/lhu, 32비트 부호 확장",
    source: `lb   x5, 0(x10)
lbu  x6, 0(x10)
lh   x7, 2(x10)
lhu  x8, 2(x10)`,
    options: {
      initialMemory: [
        { address: 0x1000, bytes: [0x80, 0x7f, 0x00, 0x80] },
      ],
    },
  },
  {
    id: "little-endian",
    activityId: "little-endian",
    title: "바이트 조립",
    summary: "폭이 다른 store가 한 워드 안에 배치되는 순서를 관찰합니다.",
    focus: "sb/sh/sw, little-endian, 부분 쓰기",
    source: `addi x5, x0, 127
sb   x5, 0(x10)
addi x6, x0, -1
sh   x6, 2(x10)
lw   x7, 0(x10)`,
  },
] as const;

export function LearningLab() {
  const [presetId, setPresetId] = useState(LAB_PRESETS[0].id);
  const selectedPreset =
    LAB_PRESETS.find((preset) => preset.id === presetId) ?? LAB_PRESETS[0];
  const [source, setSource] = useState(selectedPreset.source);
  const [draftSource, setDraftSource] = useState(selectedPreset.source);
  const [programRequestId, setProgramRequestId] = useState(0);
  const lab = useRv32iWorker(
    source,
    selectedPreset.options,
    programRequestId,
  );
  const programReady = lab.programReady;
  const visibleStatus = lab.error
    ? "error"
    : programReady
      ? lab.status
      : "loading";
  const visibleSnapshot = programReady ? lab.snapshot : null;
  const isCustomProgram = source !== selectedPreset.source;
  const [gate, setGate] = useState({
    stepIndex: -1,
    prediction: "",
    skipped: false,
  });
  const [submittedPrediction, setSubmittedPrediction] = useState<{
    value: string;
    skipped: boolean;
    stepIndex: number;
    pcBefore: number;
    sourceLine: number;
    expected: string;
  } | null>(null);
  const [runConfirmed, setRunConfirmed] = useState(false);
  const currentStepIndex = visibleSnapshot?.stepIndex ?? -1;
  const activeGate =
    gate.stepIndex === currentStepIndex
      ? gate
      : { stepIndex: currentStepIndex, prediction: "", skipped: false };

  useEffect(() => {
    if (
      lab.status === "completed" &&
      lab.programReady &&
      source === selectedPreset.source
    ) {
      markLocalProgress(selectedPreset.activityId);
    }
  }, [
    lab.programReady,
    lab.status,
    selectedPreset.activityId,
    selectedPreset.source,
    source,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      const readyForExecution =
        visibleStatus === "ready" || visibleStatus === "paused";
      if (key === "s" && canReveal && readyForExecution) {
        event.preventDefault();
        submitAndRun(lab.step);
      } else if (
        key === "b" &&
        visibleStatus !== "running" &&
        (visibleSnapshot?.historyDepth ?? 0) > 0
      ) {
        event.preventDefault();
        lab.back();
      } else if (
        key === "r" &&
        canReveal &&
        runConfirmed &&
        readyForExecution
      ) {
        event.preventDefault();
        submitAndRun(lab.run);
      } else if (key === "p" && visibleStatus === "running") {
        event.preventDefault();
        lab.pause();
      } else if (
        event.key === "0" &&
        visibleStatus !== "loading" &&
        visibleStatus !== "running" &&
        visibleStatus !== "error"
      ) {
        event.preventDefault();
        resetLab();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const canReveal = Boolean(activeGate.prediction || activeGate.skipped);
  const submittedDelta = useMemo(
    () =>
      submittedPrediction
        ? lab.trace.find(
            (delta) =>
              delta.stepIndexBefore === submittedPrediction.stepIndex &&
              delta.pcBefore === submittedPrediction.pcBefore &&
              delta.instruction.sourceLine === submittedPrediction.sourceLine,
          ) ?? null
        : null,
    [lab.trace, submittedPrediction],
  );
  const predictionFeedback =
    submittedPrediction && submittedDelta
      ? submittedPrediction.skipped
        ? "예측하지 않고 실제 변화를 확인했습니다."
        : submittedPrediction.value === submittedPrediction.expected
          ? "예측이 맞았습니다."
          : "예측이 달랐습니다. 상태 변화에서 실행 전후 값을 확인해 보세요."
      : "";

  function submitAndRun(action: () => void) {
    const instruction = visibleSnapshot?.currentInstruction;
    if (!canReveal || !instruction) return;
    setSubmittedPrediction({
      value: activeGate.prediction,
      skipped: activeGate.skipped,
      stepIndex: currentStepIndex,
      pcBefore: instruction.address,
      sourceLine: instruction.sourceLine,
      expected: expectedPrediction(instruction),
    });
    action();
  }

  function resetLab() {
    setGate({ stepIndex: -1, prediction: "", skipped: false });
    setSubmittedPrediction(null);
    setRunConfirmed(false);
    lab.reset();
  }

  function prepareNewProgram(nextSource: string) {
    setGate({ stepIndex: -1, prediction: "", skipped: false });
    setSubmittedPrediction(null);
    setRunConfirmed(false);
    setProgramRequestId((requestId) => requestId + 1);
    setSource(nextSource);
    setDraftSource(nextSource);
  }

  function selectPreset(preset: LabPreset) {
    if (lab.status === "running") lab.pause();
    setPresetId(preset.id);
    prepareNewProgram(preset.source);
  }

  function applyDraft() {
    if (!draftSource.trim() || lab.status === "running") return;
    prepareNewProgram(draftSource);
  }

  return (
    <section className="learning-lab" aria-labelledby="lab-title">
      <header className="lab-intro">
        <h1 id="lab-title">메모리는 바이트 단위로 움직입니다.</h1>
        <p>
          실행 전에 변화를 예측하고, 주소 계산부터 바이트 조립까지 한 화면에서
          추적하세요.
        </p>
        <ul className="lab-promises" aria-label="학습 환경 안내">
          <li>로그인 없이 시작</li>
          <li>브라우저 안에서 실행</li>
          <li>키보드와 스크린 리더 지원</li>
        </ul>
      </header>

      <nav className="lab-preset-nav" aria-label="메모리 실험 선택">
        {LAB_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="lab-preset-button"
            data-selected={
              !isCustomProgram && preset.id === selectedPreset.id
                ? true
                : undefined
            }
            aria-pressed={
              !isCustomProgram && preset.id === selectedPreset.id
            }
            onClick={() => selectPreset(preset)}
            disabled={lab.status === "running"}
          >
            <strong>{preset.title}</strong>
            <span>{preset.summary}</span>
          </button>
        ))}
      </nav>

      <div className="lab-workspace">
        <div className="lab-source-and-prediction">
          <section className="source-panel" aria-labelledby="source-title">
            <div className="section-heading-row">
              <h2 id="source-title">RV32I 코드</h2>
              <span>
                {isCustomProgram
                  ? "사용자 코드 · 선택한 예제로 복원 가능"
                  : selectedPreset.focus}
              </span>
            </div>
            <ol className="source-code" aria-label="실행할 RV32I 프로그램">
              {source.split("\n").map((line, index) => {
                const lineNumber = index + 1;
                const current =
                  visibleSnapshot?.currentInstruction?.sourceLine ===
                  lineNumber;
                return (
                  <li key={`${lineNumber}-${line}`} data-current={current || undefined}>
                    <span className="current-marker" aria-hidden="true">
                      {current ? "›" : " "}
                    </span>
                    <code>{line || " "}</code>
                    {current ? <span className="sr-only">현재 명령어</span> : null}
                  </li>
                );
              })}
            </ol>

            <details className="source-editor">
              <summary>코드 직접 편집</summary>
              <label htmlFor="rv32i-source">
                RV32I 소스
                <span>
                  지원: addi, lb, lbu, lh, lhu, lw, sb, sh, sw, beq
                </span>
              </label>
              <textarea
                id="rv32i-source"
                value={draftSource}
                onChange={(event) => setDraftSource(event.target.value)}
                rows={Math.max(7, draftSource.split("\n").length + 1)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <div className="source-editor-actions">
                <button
                  type="button"
                  className="primary-control"
                  onClick={applyDraft}
                  disabled={
                    lab.status === "running" ||
                    !draftSource.trim() ||
                    draftSource === source
                  }
                >
                  프로그램 불러오기
                </button>
                <button
                  type="button"
                  onClick={() => prepareNewProgram(selectedPreset.source)}
                  disabled={
                    lab.status === "running" ||
                    (draftSource === selectedPreset.source &&
                      source === selectedPreset.source)
                  }
                >
                  예제로 복원
                </button>
              </div>
            </details>
          </section>

          <PredictionGate
            instruction={visibleSnapshot?.currentInstruction ?? null}
            selected={activeGate.prediction}
            skipped={activeGate.skipped}
            disabled={
              visibleStatus === "loading" ||
              visibleStatus === "running" ||
              visibleStatus === "completed" ||
              visibleStatus === "error"
            }
            onSelect={(value) => {
              setSubmittedPrediction(null);
              setGate({
                stepIndex: currentStepIndex,
                prediction: value,
                skipped: false,
              });
            }}
            onSkip={() => {
              setSubmittedPrediction(null);
              setGate({
                stepIndex: currentStepIndex,
                prediction: "",
                skipped: true,
              });
            }}
          />

          <div
            className="lab-feedback"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="sr-only">{lab.announcement}</span>
            {predictionFeedback ? (
              <div className="prediction-result">
                <strong>예측 결과</strong>
                <p>{predictionFeedback}</p>
              </div>
            ) : null}
          </div>
        </div>

        <LabControls
          status={visibleStatus}
          canReveal={canReveal}
          canBack={(visibleSnapshot?.historyDepth ?? 0) > 0}
          runConfirmed={runConfirmed}
          onRunConfirmed={setRunConfirmed}
          onStep={() => submitAndRun(lab.step)}
          onBack={lab.back}
          onReset={resetLab}
          onRun={() => submitAndRun(lab.run)}
          onPause={lab.pause}
        />

        <div className="lab-state-panel">
          {lab.error ? (
            <div className="lab-message error-message" role="alert">
              <strong>실행을 계속할 수 없습니다</strong>
              <p>{lab.error}</p>
              <p>Worker를 다시 시작하거나 선택한 예제로 복원하세요.</p>
              <div className="lab-error-actions">
                <button type="button" onClick={lab.retry}>
                  Worker 다시 시작
                </button>
                <button
                  type="button"
                  className="primary-control"
                  onClick={() => prepareNewProgram(selectedPreset.source)}
                >
                  예제로 복원
                </button>
              </div>
            </div>
          ) : visibleStatus === "loading" || !visibleSnapshot ? (
            <div className="lab-message">
              <strong>실험실 준비 중</strong>
              <p>명령어를 실행할 초기 상태를 준비하고 있습니다.</p>
            </div>
          ) : (
            <>
              <div className="machine-status" data-status={visibleStatus}>
                상태:{" "}
                {visibleStatus === "completed"
                  ? "실행 완료"
                  : visibleStatus === "running"
                    ? "연속 실행 중"
                    : visibleStatus === "paused"
                      ? "일시정지"
                      : "예측 대기"}
              </div>
              <MachineStateView
                snapshot={visibleSnapshot}
                lastDelta={lab.lastDelta}
              />
              <ExecutionTimeline trace={lab.trace} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
