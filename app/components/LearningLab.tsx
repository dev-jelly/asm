"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMemoryMission,
  MEMORY_MISSIONS,
  type MemoryMissionCheckpoint,
  type MemoryMissionId,
} from "../content/memoryMissions";
import { useRv32iWorker } from "../hooks/useRv32iWorker";
import {
  emptyProgress,
  markLocalMissionProgress,
  readProgress,
  setLocalLastMission,
  type ProgressData,
} from "../lib/progress";
import { ExecutionTimeline } from "./ExecutionTimeline";
import { LabControls } from "./LabControls";
import { MachineStateView } from "./MachineStateView";
import { MissionNavigator } from "./MissionNavigator";
import {
  MissionTransfer,
  type TransferResult,
} from "./MissionTransfer";
import {
  expectedPrediction,
  predictionLabel,
  PredictionGate,
} from "./PredictionGate";
import { PredictionComparison } from "./PredictionComparison";

const DEFAULT_MISSION = MEMORY_MISSIONS[0];

type SubmittedPrediction = {
  value: string;
  label: string;
  skipped: boolean;
  stepIndex: number;
  pcBefore: number;
  sourceLine: number;
  expected: string;
  checkpoint: MemoryMissionCheckpoint | null;
};

export function LearningLab() {
  const [missionId, setMissionId] =
    useState<MemoryMissionId>(DEFAULT_MISSION.id);
  const missionIdRef = useRef<MemoryMissionId>(DEFAULT_MISSION.id);
  const missionHeadingRef = useRef<HTMLHeadingElement>(null);
  const completedKeyboardFocusRequestRef = useRef(0);
  const latestPredictionAnnouncementRef = useRef("");
  const selectedMission = getMemoryMission(missionId) ?? DEFAULT_MISSION;
  const [source, setSource] = useState(DEFAULT_MISSION.source);
  const [draftSource, setDraftSource] = useState(DEFAULT_MISSION.source);
  const [programRequestId, setProgramRequestId] = useState(0);
  const [progress, setProgress] = useState<ProgressData>(emptyProgress);
  const lab = useRv32iWorker(
    source,
    selectedMission.options,
    programRequestId,
  );
  const programReady = lab.programReady;
  const visibleStatus = lab.error
    ? "error"
    : programReady
      ? lab.status
      : "loading";
  const visibleSnapshot = programReady ? lab.snapshot : null;
  const isCustomProgram = source !== selectedMission.source;
  const [gate, setGate] = useState({
    stepIndex: -1,
    prediction: "",
    skipped: false,
  });
  const [submittedPrediction, setSubmittedPrediction] =
    useState<SubmittedPrediction | null>(null);
  const [checkpointPrediction, setCheckpointPrediction] =
    useState<SubmittedPrediction | null>(null);
  const [runConfirmed, setRunConfirmed] = useState(false);
  const [keyboardFocusRequest, setKeyboardFocusRequest] = useState(0);
  const [checkpointAttempted, setCheckpointAttempted] = useState(false);
  const [transferChoice, setTransferChoice] = useState("");
  const [transferResult, setTransferResult] =
    useState<TransferResult>(null);
  const currentStepIndex = visibleSnapshot?.stepIndex ?? -1;
  const activeGate =
    gate.stepIndex === currentStepIndex
      ? gate
      : { stepIndex: currentStepIndex, prediction: "", skipped: false };
  const activeCheckpoint =
    !isCustomProgram &&
    currentStepIndex === selectedMission.checkpoint.stepIndex &&
    visibleSnapshot?.currentInstruction?.sourceLine ===
      selectedMission.checkpoint.sourceLine
      ? selectedMission.checkpoint
      : null;
  const comparisonPrediction =
    visibleStatus === "completed" && checkpointPrediction
      ? checkpointPrediction
      : submittedPrediction;
  const showingReviewedPrediction =
    visibleStatus === "completed" && comparisonPrediction !== null;
  const showingCheckpointReview =
    visibleStatus === "completed" &&
    checkpointPrediction !== null &&
    comparisonPrediction === checkpointPrediction;
  const displayedCheckpoint = showingReviewedPrediction
    ? comparisonPrediction.checkpoint
    : activeCheckpoint;
  const displayedPrediction = showingReviewedPrediction
    ? comparisonPrediction.value
    : activeGate.prediction;
  const displayedSkipped = showingReviewedPrediction
    ? comparisonPrediction.skipped
    : activeGate.skipped;
  const canReveal = Boolean(activeGate.prediction || activeGate.skipped);
  const canRunMission = isCustomProgram || checkpointAttempted;
  const transferReady =
    !isCustomProgram &&
    visibleStatus === "completed" &&
    checkpointAttempted;
  const currentMissionIndex = MEMORY_MISSIONS.findIndex(
    (mission) => mission.id === selectedMission.id,
  );
  const nextMissionId =
    MEMORY_MISSIONS[currentMissionIndex + 1]?.id ?? null;

  useEffect(() => {
    const refresh = () => {
      try {
        setProgress(readProgress(window.localStorage));
      } catch {
        setProgress(emptyProgress());
      }
    };
    refresh();
    window.addEventListener("asm-progress", refresh);
    window.addEventListener("asm-progress-unavailable", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("asm-progress", refresh);
      window.removeEventListener("asm-progress-unavailable", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    const loadMissionFromLocation = (allowResume: boolean) => {
      const url = new URL(window.location.href);
      const hasLesson = url.searchParams.has("lesson");
      const explicitMission = hasLesson
        ? getMemoryMission(url.searchParams.get("lesson") ?? "")
        : undefined;
      let requested = explicitMission;
      let resumedFromStorage = false;
      if (!requested && allowResume && !hasLesson) {
        try {
          const resumeId = readProgress(window.localStorage).lastMissionId;
          requested = resumeId ? getMemoryMission(resumeId) : undefined;
          resumedFromStorage = Boolean(requested);
        } catch {
          requested = undefined;
        }
      }
      requested ??= DEFAULT_MISSION;
      if (resumedFromStorage || (hasLesson && !explicitMission)) {
        url.searchParams.set("lesson", requested.id);
        url.hash = "playground";
        window.history.replaceState(
          { lesson: requested.id },
          "",
          url,
        );
      }
      if (
        hasLesson ||
        resumedFromStorage ||
        requested.id !== missionIdRef.current
      ) {
        setLocalLastMission(requested.id);
      }
      if (requested.id === missionIdRef.current) return;
      missionIdRef.current = requested.id;
      setMissionId(requested.id);
      setSource(requested.source);
      setDraftSource(requested.source);
      setProgramRequestId((requestId) => requestId + 1);
      resetLearningState();
    };

    const handlePopState = () => loadMissionFromLocation(false);
    loadMissionFromLocation(true);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (
      lab.status === "completed" &&
      lab.programReady &&
      source === selectedMission.source &&
      checkpointAttempted
    ) {
      markLocalMissionProgress(selectedMission.id, {
        status: "guided",
      });
    }
  }, [
    checkpointAttempted,
    lab.programReady,
    lab.status,
    selectedMission.id,
    selectedMission.source,
    source,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.defaultPrevented ||
        lab.commandPending
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.matches(
          "textarea, select, [contenteditable='true'], input:not([type='radio']):not([type='checkbox']):not([type='button']):not([type='submit'])",
        )
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      const readyForExecution =
        visibleStatus === "ready" || visibleStatus === "paused";
      if (key === "s" && canReveal && readyForExecution) {
        event.preventDefault();
        if (submitAndRun(lab.step)) requestKeyboardFocus();
      } else if (
        key === "b" &&
        visibleStatus !== "running" &&
        (visibleSnapshot?.historyDepth ?? 0) > 0
      ) {
        event.preventDefault();
        if (backLab()) requestKeyboardFocus();
      } else if (
        key === "r" &&
        canReveal &&
        canRunMission &&
        runConfirmed &&
        readyForExecution
      ) {
        event.preventDefault();
        if (submitAndRun(lab.run)) requestKeyboardFocus();
      } else if (key === "p" && visibleStatus === "running") {
        event.preventDefault();
        if (pauseLab()) requestKeyboardFocus();
      } else if (
        event.key === "0" &&
        visibleStatus !== "loading" &&
        visibleStatus !== "running" &&
        visibleStatus !== "error"
      ) {
        event.preventDefault();
        if (resetLab()) requestKeyboardFocus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (
      keyboardFocusRequest === completedKeyboardFocusRequestRef.current ||
      lab.commandPending ||
      visibleStatus === "loading" ||
      visibleStatus === "running"
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const checkedPrediction =
        document.querySelector<HTMLElement>(
          ".learning-lab .prediction-gate input[type='radio']:checked:not(:disabled)",
        );
      const firstPrediction =
        document.querySelector<HTMLElement>(
          ".learning-lab .prediction-gate input[type='radio']:not(:disabled)",
        );
      const checkedTransfer =
        document.querySelector<HTMLElement>(
          ".learning-lab .mission-transfer input[type='radio']:checked:not(:disabled)",
        );
      const firstTransfer =
        document.querySelector<HTMLElement>(
          ".learning-lab .mission-transfer input[type='radio']:not(:disabled)",
        );
      const target =
        visibleStatus === "completed"
          ? checkedTransfer ?? firstTransfer
          : visibleStatus === "error"
            ? document.querySelector<HTMLElement>(
                ".learning-lab [role='alert'] button",
              )
            : checkedPrediction ?? firstPrediction;
      const fallback = document.querySelector<HTMLElement>(
        ".learning-lab button:not(:disabled)",
      );
      (target ?? fallback)?.focus();
      completedKeyboardFocusRequestRef.current = keyboardFocusRequest;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    currentStepIndex,
    keyboardFocusRequest,
    lab.commandPending,
    visibleStatus,
  ]);

  const comparisonDelta = useMemo(
    () =>
      comparisonPrediction
        ? lab.trace.find(
            (delta) =>
              delta.stepIndexBefore === comparisonPrediction.stepIndex &&
              delta.pcBefore === comparisonPrediction.pcBefore &&
              delta.instruction.sourceLine ===
                comparisonPrediction.sourceLine,
          ) ?? null
        : null,
    [comparisonPrediction, lab.trace],
  );
  const announcementDelta = useMemo(
    () =>
      submittedPrediction
        ? lab.trace.find(
            (delta) =>
              delta.stepIndexBefore === submittedPrediction.stepIndex &&
              delta.pcBefore === submittedPrediction.pcBefore &&
              delta.instruction.sourceLine ===
                submittedPrediction.sourceLine,
          ) ?? null
        : null,
    [lab.trace, submittedPrediction],
  );
  const latestMemoryDelta = useMemo(
    () => {
      for (let index = lab.trace.length - 1; index >= 0; index -= 1) {
        const delta = lab.trace[index];
        if (
          delta.memoryAccesses.length > 0 ||
          delta.memoryPatches.length > 0
        ) {
          return delta;
        }
      }
      return null;
    },
    [lab.trace],
  );
  const comparisonCorrect =
    comparisonPrediction && !comparisonPrediction.skipped
      ? comparisonPrediction.value === comparisonPrediction.expected
      : null;
  const latestPredictionCorrect =
    submittedPrediction && !submittedPrediction.skipped
      ? submittedPrediction.value === submittedPrediction.expected
      : null;
  const newPredictionAnnouncement =
    submittedPrediction && announcementDelta
      ? submittedPrediction.skipped
        ? `Step ${announcementDelta.stepIndexAfter}: 예측 없이 실제 결과를 확인했습니다.`
        : latestPredictionCorrect
          ? `Step ${announcementDelta.stepIndexAfter}: 예측이 실제 결과와 일치했습니다.`
          : `Step ${announcementDelta.stepIndexAfter}: 예측과 실제 결과가 다릅니다.`
      : "";
  const latestPredictionResult =
    showingCheckpointReview &&
    submittedPrediction &&
    submittedPrediction !== checkpointPrediction &&
    announcementDelta
      ? submittedPrediction.skipped
        ? `방금 실행한 Step ${announcementDelta.stepIndexAfter}: 예측 없이 실행했습니다.`
        : latestPredictionCorrect
          ? `방금 실행한 Step ${announcementDelta.stepIndexAfter}: 예측이 실제 결과와 일치했습니다.`
          : `방금 실행한 Step ${announcementDelta.stepIndexAfter}: 예측과 실제 결과가 다릅니다.`
      : undefined;
  if (visibleStatus === "error") {
    latestPredictionAnnouncementRef.current = "";
  } else if (newPredictionAnnouncement) {
    latestPredictionAnnouncementRef.current =
      newPredictionAnnouncement;
  }
  const predictionAnnouncement =
    visibleStatus === "running"
      ? ""
      : latestPredictionAnnouncementRef.current;

  function resetLearningState() {
    setGate({ stepIndex: -1, prediction: "", skipped: false });
    latestPredictionAnnouncementRef.current = "";
    setSubmittedPrediction(null);
    setCheckpointPrediction(null);
    setRunConfirmed(false);
    setCheckpointAttempted(false);
    setTransferChoice("");
    setTransferResult(null);
  }

  function requestKeyboardFocus() {
    setKeyboardFocusRequest((request) => request + 1);
  }

  function submitAndRun(action: () => boolean): boolean {
    const instruction = visibleSnapshot?.currentInstruction;
    if (!canReveal || !instruction) return false;
    if (!action()) return false;
    const checkpoint = activeCheckpoint;
    const expected = expectedPrediction(
      instruction,
      checkpoint,
      visibleSnapshot?.registers,
    );
    const submission: SubmittedPrediction = {
      value: activeGate.prediction,
      label: activeGate.skipped
        ? "예측하지 않고 실제 결과 확인"
        : predictionLabel(
            activeGate.prediction,
            checkpoint,
            instruction,
            visibleSnapshot?.registers,
          ),
      skipped: activeGate.skipped,
      stepIndex: currentStepIndex,
      pcBefore: instruction.address,
      sourceLine: instruction.sourceLine,
      expected,
      checkpoint,
    };
    setSubmittedPrediction(submission);
    if (!isCustomProgram) {
      if (checkpoint) {
        setCheckpointPrediction(submission);
        setCheckpointAttempted(true);
        markLocalMissionProgress(selectedMission.id, {
          predictionAttempt: !activeGate.skipped,
          predictionCorrect:
            !activeGate.skipped && activeGate.prediction === expected,
          predictionSkipped: activeGate.skipped,
        });
      } else {
        markLocalMissionProgress(selectedMission.id);
      }
    }
    return true;
  }

  function resetLab(): boolean {
    const accepted = lab.reset();
    if (accepted) resetLearningState();
    return accepted;
  }

  function backLab(): boolean {
    const accepted = lab.back();
    if (!accepted) return false;
    latestPredictionAnnouncementRef.current = "";
    setSubmittedPrediction(null);
    return true;
  }

  function pauseLab(): boolean {
    const accepted = lab.pause();
    if (!accepted) return false;
    latestPredictionAnnouncementRef.current = "";
    setSubmittedPrediction(null);
    return true;
  }

  function restartWorker() {
    resetLearningState();
    lab.retry();
    requestKeyboardFocus();
  }

  function restoreMissionAfterError() {
    lab.retry();
    prepareNewProgram(selectedMission.source);
    requestKeyboardFocus();
  }

  function prepareNewProgram(nextSource: string) {
    resetLearningState();
    setProgramRequestId((requestId) => requestId + 1);
    setSource(nextSource);
    setDraftSource(nextSource);
  }

  function selectMission(nextMissionId: MemoryMissionId) {
    const nextMission = getMemoryMission(nextMissionId);
    if (
      !nextMission ||
      nextMission.id === missionIdRef.current ||
      lab.commandPending
    ) {
      return;
    }
    if (lab.status === "running") lab.pause();
    missionIdRef.current = nextMission.id;
    setMissionId(nextMission.id);
    prepareNewProgram(nextMission.source);
    setLocalLastMission(nextMission.id);
    const url = new URL(window.location.href);
    url.searchParams.set("lesson", nextMission.id);
    url.hash = "playground";
    window.history.pushState({ lesson: nextMission.id }, "", url);
  }

  function selectNextMission(nextMissionId: MemoryMissionId) {
    selectMission(nextMissionId);
    window.requestAnimationFrame(() => {
      missionHeadingRef.current?.focus();
      missionHeadingRef.current?.scrollIntoView({
        block: "start",
      });
    });
  }

  function applyDraft() {
    if (
      !draftSource.trim() ||
      lab.status === "running" ||
      lab.commandPending
    ) {
      return;
    }
    prepareNewProgram(draftSource);
  }

  function checkTransfer() {
    if (!transferReady || !transferChoice) return;
    const correct =
      transferChoice === selectedMission.transfer.correctChoiceId;
    const evidence = progress.missions[selectedMission.id];
    const firstAttempt = evidence.transferAttempts === 0;
    setTransferResult(
      correct
        ? evidence.transferPassed
          ? "confirmed"
          : firstAttempt
          ? "independent"
          : "reviewed"
        : "different",
    );
    markLocalMissionProgress(selectedMission.id, {
      transferAttempt: !evidence.transferCompleted,
      transferCompleted: correct,
      transferPassed: correct && firstAttempt,
      status: correct
        ? evidence.transferPassed || firstAttempt
          ? "independent"
          : "guided"
        : undefined,
    });
  }

  return (
    <section className="learning-lab" aria-labelledby="lab-title">
      <header className="lab-intro">
        <h1 id="lab-title">한 줄의 코드가 상태를 바꿉니다.</h1>
        <p>
          실행 전에 PC, 레지스터, 메모리, 분기를 예측하고 실제 변화를 한
          단계씩 확인하세요.
        </p>
        <ul className="lab-promises" aria-label="학습 환경 안내">
          <li>로그인 없이 시작</li>
          <li>브라우저 안에서 실행</li>
          <li>키보드와 스크린 리더 지원</li>
        </ul>
      </header>

      <MissionNavigator
        selectedMission={selectedMission}
        progress={progress}
        disabled={lab.status === "running" || lab.commandPending}
        onSelect={selectMission}
      />

      <header className="mission-context">
        <span className="path-marker" aria-hidden="true">
          {selectedMission.marker}
        </span>
        <div>
          <h2 ref={missionHeadingRef} tabIndex={-1}>
            {selectedMission.title}
          </h2>
          <p>{selectedMission.objective}</p>
        </div>
        <strong>
          {progress.missions[selectedMission.id].status === "independent"
            ? "혼자 해결"
            : progress.missions[selectedMission.id].transferCompleted
              ? "복습 후 해결"
              : progress.missions[selectedMission.id].status === "guided"
                ? "연습 완료"
                : progress.missions[selectedMission.id].predictionAttempts > 0 ||
                    progress.missions[selectedMission.id].predictionSkipped ||
                    progress.missions[selectedMission.id].lastAttemptAt !== null
                ? "학습 중"
                : "시작 전"}
        </strong>
      </header>

      <div className="lab-workspace" id="playground">
        <div className="lab-source-and-prediction">
          <section className="source-panel" aria-labelledby="source-title">
            <div className="section-heading-row">
              <h2 id="source-title">RV32I 코드</h2>
              <span>
                {isCustomProgram
                  ? "사용자 코드, 선택한 미션으로 복원 가능"
                  : selectedMission.summary}
              </span>
            </div>
            <ol className="source-code" aria-label="실행할 RV32I 프로그램">
              {source.split("\n").map((line, index) => {
                const lineNumber = index + 1;
                const current =
                  visibleSnapshot?.currentInstruction?.sourceLine ===
                  lineNumber;
                return (
                  <li
                    key={`${lineNumber}-${line}`}
                    data-current={current || undefined}
                  >
                    <span className="current-marker" aria-hidden="true">
                      {current ? "›" : " "}
                    </span>
                    <code>{line || " "}</code>
                    {current ? (
                      <span className="sr-only">현재 명령어</span>
                    ) : null}
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
                    lab.commandPending ||
                    !draftSource.trim() ||
                    draftSource === source
                  }
                >
                  프로그램 불러오기
                </button>
                <button
                  type="button"
                  onClick={() => prepareNewProgram(selectedMission.source)}
                  disabled={
                    lab.status === "running" ||
                    lab.commandPending ||
                    (draftSource === selectedMission.source &&
                      source === selectedMission.source)
                  }
                >
                  미션으로 복원
                </button>
              </div>
            </details>
          </section>

          <PredictionGate
            instruction={visibleSnapshot?.currentInstruction ?? null}
            registers={visibleSnapshot?.registers ?? []}
            checkpoint={displayedCheckpoint}
            selected={displayedPrediction}
            skipped={displayedSkipped}
            disabled={
              visibleStatus === "loading" ||
              lab.commandPending ||
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
            className="lab-announcement sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {[lab.announcement, predictionAnnouncement]
              .filter(Boolean)
              .join(" ")}
          </div>
          <div className="lab-feedback">
            {comparisonPrediction && comparisonDelta ? (
              <PredictionComparison
                delta={comparisonDelta}
                predictionLabel={comparisonPrediction.label}
                correct={comparisonCorrect}
                skipped={comparisonPrediction.skipped}
                explanation={comparisonPrediction.checkpoint?.explanation}
                isCheckpointReview={showingCheckpointReview}
                latestResult={latestPredictionResult}
              />
            ) : null}
          </div>
        </div>

        <LabControls
          status={visibleStatus}
          commandPending={lab.commandPending}
          canReveal={canReveal}
          canBack={(visibleSnapshot?.historyDepth ?? 0) > 0}
          canRun={canRunMission}
          runLockedReason={
            canRunMission
              ? undefined
              : "미션의 핵심 예측이 있는 명령어까지 Step으로 진행하세요."
          }
          runConfirmed={runConfirmed}
          onRunConfirmed={setRunConfirmed}
          onStep={() => submitAndRun(lab.step)}
          onBack={backLab}
          onReset={resetLab}
          onRun={() => submitAndRun(lab.run)}
          onPause={pauseLab}
        />

        <div className="lab-state-panel">
          {lab.error ? (
            <div className="lab-message error-message" role="alert">
              <strong>실행을 계속할 수 없습니다</strong>
              <p>{lab.error}</p>
              <p>Worker를 다시 시작하거나 현재 미션으로 복원하세요.</p>
              <div className="lab-error-actions">
                <button
                  type="button"
                  onClick={restartWorker}
                >
                  Worker 다시 시작
                </button>
                <button
                  type="button"
                  className="primary-control"
                  onClick={restoreMissionAfterError}
                >
                  미션으로 복원
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
                key={isCustomProgram ? "custom-program" : selectedMission.id}
                snapshot={visibleSnapshot}
                lastDelta={lab.lastDelta}
                latestMemoryDelta={latestMemoryDelta}
                focus={isCustomProgram ? undefined : selectedMission.focus}
              />
              <ExecutionTimeline trace={lab.trace} />
            </>
          )}
        </div>
      </div>

      <MissionTransfer
        mission={selectedMission}
        ready={transferReady}
        selected={transferChoice}
        result={transferResult}
        nextMissionId={nextMissionId}
        onSelect={(choiceId) => {
          setTransferChoice(choiceId);
        }}
        onCheck={checkTransfer}
        onNext={selectNextMission}
      />
    </section>
  );
}
