import { formatHex } from "../../lib/rv32i/memory";
import type { StepDelta } from "../../lib/rv32i/types";
import { formatMemoryBytes } from "../lib/formatMemoryBytes";

type PredictionComparisonProps = {
  delta: StepDelta;
  predictionLabel: string;
  correct: boolean | null;
  skipped: boolean;
  explanation?: string;
  isCheckpointReview?: boolean;
  latestResult?: string;
};

export function PredictionComparison({
  delta,
  predictionLabel,
  correct,
  skipped,
  explanation,
  isCheckpointReview = false,
  latestResult,
}: PredictionComparisonProps) {
  return (
    <section
      className="prediction-comparison"
      data-result={
        skipped ? "skipped" : correct === true ? "correct" : "different"
      }
      aria-labelledby="prediction-comparison-title"
    >
      {latestResult ? (
        <p className="latest-prediction-result">{latestResult}</p>
      ) : null}
      <div className="prediction-comparison-heading">
        <h3 id="prediction-comparison-title">
          {isCheckpointReview
            ? "미션 핵심 예측과 실제 변화"
            : "예측과 실제 변화"}
        </h3>
        <strong>
          {isCheckpointReview
            ? skipped
              ? "핵심 예측 없이 확인"
              : correct
                ? "핵심 예측 일치"
                : "핵심 예측과 다름"
            : skipped
              ? "실제 결과 확인"
              : correct
                ? "예측 일치"
                : "다른 결과 발견"}
        </strong>
      </div>
      {isCheckpointReview ? (
        <p className="prediction-review-context">
          {latestResult ? (
            <>
              Step {delta.stepIndexAfter}, 코드 {delta.instruction.sourceLine}행의
              결과를 보존해 표시합니다. 방금 실행한 Step의 안내와는
              별도입니다.
            </>
          ) : (
            <>
              Step {delta.stepIndexAfter}, 코드 {delta.instruction.sourceLine}행은
              이 미션의 핵심 예측 결과입니다.
            </>
          )}
        </p>
      ) : null}
      <dl>
        <div>
          <dt>예측</dt>
          <dd>{predictionLabel}</dd>
        </div>
        <div>
          <dt>실제</dt>
          <dd>{describeDelta(delta)}</dd>
        </div>
      </dl>
      {explanation ? <p>{explanation}</p> : null}
    </section>
  );
}

export function describeDelta(delta: StepDelta): string {
  const memoryWrite = delta.memoryPatches.at(-1);
  if (memoryWrite) {
    const endAddress = memoryWrite.address + memoryWrite.after.length - 1;
    const range =
      memoryWrite.after.length === 1
        ? formatHex(memoryWrite.address)
        : `${formatHex(memoryWrite.address)}부터 ${formatHex(endAddress)}`;
    return `${range}의 바이트가 ${formatMemoryBytes(memoryWrite.before, memoryWrite.initializedBefore)}에서 ${formatMemoryBytes(memoryWrite.after, memoryWrite.initializedAfter)}로 바뀌었습니다.`;
  }

  const memoryRead = delta.memoryAccesses
    .filter((access) => access.kind === "read")
    .at(-1);
  const registerWrite = delta.registerWrites
    .filter((write) => write.committed)
    .at(-1);
  if (memoryRead && registerWrite) {
    return `${formatHex(memoryRead.address)}에서 ${memoryRead.size}바이트를 읽었습니다. 읽은 바이트: ${formatMemoryBytes(memoryRead.bytes)}. 레지스터 x${registerWrite.register}에 기록된 값: ${formatHex(registerWrite.after)}. 메모리는 바뀌지 않았습니다.`;
  }

  const ignoredWrite = delta.registerWrites.find(
    (write) => !write.committed,
  );
  if (ignoredWrite) {
    return `x${ignoredWrite.register} 쓰기가 무시되어 값은 ${formatHex(ignoredWrite.after)}입니다. 다음 PC는 ${formatHex(delta.pcAfter)}입니다.`;
  }

  if (registerWrite) {
    return `레지스터 x${registerWrite.register} 값이 ${formatHex(registerWrite.before)}에서 ${formatHex(registerWrite.after)}로 바뀌고 PC는 ${formatHex(delta.pcAfter)}로 이동했습니다.`;
  }

  if (delta.controlFlow.kind === "branch") {
    return `${delta.controlFlow.taken ? "분기 조건이 참입니다" : "분기 조건이 거짓입니다"}. 다음 PC는 ${formatHex(delta.pcAfter)}입니다.`;
  }

  return `레지스터와 메모리는 바뀌지 않았고 PC는 ${formatHex(delta.pcAfter)}로 이동했습니다.`;
}
