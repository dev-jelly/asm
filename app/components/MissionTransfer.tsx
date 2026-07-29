"use client";

import type {
  MemoryMission,
  MemoryMissionId,
} from "../content/memoryMissions";

type TransferResult = "correct" | "different" | null;

type MissionTransferProps = {
  mission: MemoryMission;
  ready: boolean;
  selected: string;
  result: TransferResult;
  nextMissionId: MemoryMissionId | null;
  onSelect: (choiceId: string) => void;
  onCheck: () => void;
  onNext: (missionId: MemoryMissionId) => void;
};

export function MissionTransfer({
  mission,
  ready,
  selected,
  result,
  nextMissionId,
  onSelect,
  onCheck,
  onNext,
}: MissionTransferProps) {
  return (
    <section
      className="mission-transfer"
      id="practice"
      aria-labelledby="mission-transfer-title"
    >
      <div>
        <h2 id="mission-transfer-title">시각화를 줄인 새 문제로 확인합니다.</h2>
        <p>
          실행에서 확인한 규칙을 다른 값에 적용하면 이 미션을 혼자 해결한
          것으로 기록합니다.
        </p>
      </div>

      <div className="mission-transfer-activity">
        <fieldset disabled={!ready || result === "correct"}>
          <legend>{mission.transfer.prompt}</legend>
          {!ready ? (
            <p className="field-help">
              핵심 단계의 결과를 확인하고 프로그램을 완료하면 답할 수 있습니다.
            </p>
          ) : null}
          <div className="transfer-options">
            {mission.transfer.choices.map((choice) => (
              <label key={choice.id}>
                <input
                  type="radio"
                  name={`transfer-${mission.id}`}
                  value={choice.id}
                  checked={selected === choice.id}
                  onChange={() => onSelect(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="transfer-actions">
          <button
            type="button"
            className="primary-control"
            disabled={!ready || !selected || result === "correct"}
            onClick={onCheck}
          >
            독립 문제 확인
          </button>
          {result === "correct" && nextMissionId ? (
            <button type="button" onClick={() => onNext(nextMissionId)}>
              다음 미션
            </button>
          ) : null}
        </div>

        <div
          className="transfer-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-result={result ?? undefined}
        >
          {result ? (
            <>
              <strong>
                {result === "correct"
                  ? "새 문제를 해결했습니다."
                  : "다시 확인할 규칙이 있습니다."}
              </strong>
              <p>{mission.transfer.explanation}</p>
            </>
          ) : (
            <p>실행을 완료한 뒤 다른 값에서도 같은 규칙이 성립하는지 확인합니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export type { TransferResult };
