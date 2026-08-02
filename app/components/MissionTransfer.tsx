"use client";

import type {
  MemoryMission,
  MemoryMissionId,
} from "../content/memoryMissions";

type TransferResult =
  | "independent"
  | "reviewed"
  | "confirmed"
  | "different"
  | null;

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
  const completed =
    result === "independent" ||
    result === "reviewed" ||
    result === "confirmed";

  return (
    <section
      className="mission-transfer"
      id="practice"
      aria-labelledby="mission-transfer-title"
    >
      <div>
        <h2 id="mission-transfer-title">새 상황에서 한 번 더 확인합니다.</h2>
        <p>
          첫 시도에 맞히면 혼자 해결, 힌트를 확인한 뒤 맞히면 복습 후 해결로
          기록합니다.
        </p>
      </div>

      <div className="mission-transfer-activity">
        <section
          className="transfer-scenario"
          aria-labelledby={`transfer-scenario-${mission.id}`}
        >
          <h3 id={`transfer-scenario-${mission.id}`}>새 문제 조건</h3>
          <pre aria-label="새 문제 RV32I 코드">
            <code>{mission.transfer.scenario.source}</code>
          </pre>
          {mission.transfer.scenario.setup.length ? (
            <ul aria-label="새 문제 초기 상태">
              {mission.transfer.scenario.setup.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <fieldset disabled={!ready || completed}>
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
            disabled={!ready || !selected || completed}
            onClick={onCheck}
          >
            답 확인
          </button>
          {completed && nextMissionId ? (
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
          {result === "independent" ? (
            <>
              <strong>첫 시도에 혼자 해결했습니다.</strong>
              <p>{mission.transfer.explanation}</p>
            </>
          ) : result === "reviewed" ? (
            <>
              <strong>복습 후 해결했습니다.</strong>
              <p>{mission.transfer.explanation}</p>
            </>
          ) : result === "confirmed" ? (
            <>
              <strong>다시 정답입니다.</strong>
              <p>
                이 미션은 이전 첫 시도 결과에 따라 혼자 해결 상태를
                유지합니다. {mission.transfer.explanation}
              </p>
            </>
          ) : result === "different" ? (
            <>
              <strong>한 번 더 생각해 보세요.</strong>
              <p>{mission.transfer.wrongHint}</p>
            </>
          ) : (
            <p>
              실행을 완료하면 새 코드와 초기 상태에 같은 규칙을 적용해 봅니다.
              오답일 때는 정답 대신 힌트만 제공합니다.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export type { TransferResult };
