"use client";

import { useEffect, useMemo, useState } from "react";
import { useRv32iWorker } from "../hooks/useRv32iWorker";
import { markLocalProgress } from "../lib/progress";
import { LabControls } from "./LabControls";
import { MachineStateView } from "./MachineStateView";
import { expectedPrediction, PredictionGate } from "./PredictionGate";

const TRACER_SOURCE = `addi x5, x0, 7
sw   x5, 0(x10)
lw   x6, 0(x10)
beq  x5, x6, done
addi x7, x0, 1
done:`;

export function LearningLab() {
  const lab = useRv32iWorker(TRACER_SOURCE);
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
  const currentStepIndex = lab.snapshot?.stepIndex ?? -1;
  const activeGate =
    gate.stepIndex === currentStepIndex
      ? gate
      : { stepIndex: currentStepIndex, prediction: "", skipped: false };

  useEffect(() => {
    if (lab.status === "completed") markLocalProgress("tracer-bullet");
  }, [lab.status]);

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
      if (key === "s" && canReveal && lab.status === "ready") {
        event.preventDefault();
        submitAndRun(lab.step);
      } else if (key === "b" && (lab.snapshot?.historyDepth ?? 0) > 0) {
        event.preventDefault();
        lab.back();
      } else if (
        key === "r" &&
        canReveal &&
        runConfirmed &&
        lab.status === "ready"
      ) {
        event.preventDefault();
        submitAndRun(lab.run);
      } else if (key === "p" && lab.status === "running") {
        event.preventDefault();
        lab.pause();
      } else if (event.key === "0" && lab.status !== "running") {
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
    const instruction = lab.snapshot?.currentInstruction;
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

  return (
    <section className="learning-lab" aria-labelledby="lab-title">
      <header className="lab-intro">
        <h1 id="lab-title">실행 전에 다음 상태를 예측하세요.</h1>
        <p>
          한 줄씩 실행하며 PC, 레지스터, 메모리 변화를 같은 화면에서
          확인합니다.
        </p>
        <ul className="lab-promises" aria-label="학습 환경 안내">
          <li>로그인 없이 시작</li>
          <li>브라우저 안에서 실행</li>
          <li>키보드와 스크린 리더 지원</li>
        </ul>
      </header>

      <div className="lab-workspace">
        <div className="lab-source-and-prediction">
          <section className="source-panel" aria-labelledby="source-title">
            <div className="section-heading-row">
              <h2 id="source-title">RV32I 코드</h2>
              <span>명령어 네 개 · 상태 추적</span>
            </div>
            <ol className="source-code" aria-label="실행할 RV32I 프로그램">
              {TRACER_SOURCE.split("\n").map((line, index) => {
                const lineNumber = index + 1;
                const current =
                  lab.snapshot?.currentInstruction?.sourceLine === lineNumber;
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
          </section>

          <PredictionGate
            instruction={lab.snapshot?.currentInstruction ?? null}
            selected={activeGate.prediction}
            skipped={activeGate.skipped}
            disabled={
              lab.status === "loading" ||
              lab.status === "running" ||
              lab.status === "completed" ||
              lab.status === "error"
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
          status={lab.status}
          canReveal={canReveal}
          canBack={(lab.snapshot?.historyDepth ?? 0) > 0}
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
              <p>Reset으로 초기 상태를 복원하거나 페이지를 새로고침해 주세요.</p>
            </div>
          ) : lab.status === "loading" || !lab.snapshot ? (
            <div className="lab-message">
              <strong>실험실 준비 중</strong>
              <p>명령어를 실행할 초기 상태를 준비하고 있습니다.</p>
            </div>
          ) : (
            <>
              <div className="machine-status" data-status={lab.status}>
                상태:{" "}
                {lab.status === "completed"
                  ? "실행 완료"
                  : lab.status === "running"
                    ? "연속 실행 중"
                    : lab.status === "paused"
                      ? "일시정지"
                      : "예측 대기"}
              </div>
              <MachineStateView
                snapshot={lab.snapshot}
                lastDelta={lab.lastDelta}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
