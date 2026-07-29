import { formatHex } from "../../lib/rv32i/memory";
import type { StepDelta } from "../../lib/rv32i/types";

type PredictionComparisonProps = {
  delta: StepDelta;
  predictionLabel: string;
  correct: boolean | null;
  skipped: boolean;
  explanation?: string;
};

export function PredictionComparison({
  delta,
  predictionLabel,
  correct,
  skipped,
  explanation,
}: PredictionComparisonProps) {
  return (
    <section
      className="prediction-comparison"
      data-result={
        skipped ? "skipped" : correct === true ? "correct" : "different"
      }
      aria-labelledby="prediction-comparison-title"
    >
      <div className="prediction-comparison-heading">
        <h3 id="prediction-comparison-title">예측과 실제 변화</h3>
        <strong>
          {skipped
            ? "실제 결과 확인"
            : correct
              ? "예측 일치"
              : "다른 결과 발견"}
        </strong>
      </div>
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

function describeDelta(delta: StepDelta): string {
  const memoryWrite = delta.memoryPatches.at(-1);
  if (memoryWrite) {
    const endAddress = memoryWrite.address + memoryWrite.after.length - 1;
    const range =
      memoryWrite.after.length === 1
        ? formatHex(memoryWrite.address)
        : `${formatHex(memoryWrite.address)}부터 ${formatHex(endAddress)}`;
    return `${range}의 바이트가 ${formatBytes(memoryWrite.before)}에서 ${formatBytes(memoryWrite.after)}로 바뀌었습니다.`;
  }

  const memoryRead = delta.memoryAccesses
    .filter((access) => access.kind === "read")
    .at(-1);
  const registerWrite = delta.registerWrites
    .filter((write) => write.committed)
    .at(-1);
  if (memoryRead && registerWrite) {
    return `${formatHex(memoryRead.address)}에서 ${memoryRead.size}바이트 ${formatBytes(memoryRead.bytes)}를 읽어 x${registerWrite.register}에 ${formatHex(registerWrite.after)}를 썼습니다. 메모리는 바뀌지 않았습니다.`;
  }

  const ignoredWrite = delta.registerWrites.find(
    (write) => !write.committed,
  );
  if (ignoredWrite) {
    return `x${ignoredWrite.register} 쓰기가 무시되어 값은 ${formatHex(ignoredWrite.after)}입니다. 다음 PC는 ${formatHex(delta.pcAfter)}입니다.`;
  }

  if (registerWrite) {
    return `x${registerWrite.register}가 ${formatHex(registerWrite.before)}에서 ${formatHex(registerWrite.after)}로 바뀌고 PC는 ${formatHex(delta.pcAfter)}로 이동했습니다.`;
  }

  if (delta.controlFlow.kind === "branch") {
    return `${delta.controlFlow.taken ? "분기 조건이 참입니다" : "분기 조건이 거짓입니다"}. 다음 PC는 ${formatHex(delta.pcAfter)}입니다.`;
  }

  return `레지스터와 메모리는 바뀌지 않았고 PC는 ${formatHex(delta.pcAfter)}로 이동했습니다.`;
}

function formatBytes(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
}
