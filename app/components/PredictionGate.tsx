import type { SerializedInstruction } from "../../lib/rv32i/types";

export type PredictionChoice = {
  id: string;
  label: string;
};

export type PredictionCheckpoint = {
  prompt: string;
  choices: readonly PredictionChoice[];
  correctChoiceId: string;
  explanation: string;
};

type PredictionGateProps = {
  instruction: SerializedInstruction | null;
  checkpoint?: PredictionCheckpoint | null;
  selected: string;
  skipped: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  onSkip: () => void;
};

const OPTIONS: readonly PredictionChoice[] = [
  { id: "register", label: "목적지 레지스터에 결과를 씁니다." },
  { id: "memory", label: "계산한 메모리 주소에 값을 씁니다." },
  { id: "pc", label: "조건 비교 결과로 다음 PC가 정해집니다." },
  {
    id: "none",
    label: "레지스터와 메모리는 그대로이고 PC만 다음 명령어로 이동합니다.",
  },
] as const;

export function expectedPrediction(
  instruction: SerializedInstruction | null,
  checkpoint?: PredictionCheckpoint | null,
): string {
  if (checkpoint) return checkpoint.correctChoiceId;
  if (!instruction) return "none";
  if (
    instruction.mnemonic === "sb" ||
    instruction.mnemonic === "sh" ||
    instruction.mnemonic === "sw"
  ) {
    return "memory";
  }
  if (instruction.mnemonic === "beq") return "pc";
  return "register";
}

export function predictionLabel(
  prediction: string,
  checkpoint?: PredictionCheckpoint | null,
): string {
  if (!prediction) return "예측하지 않음";
  return (
    (checkpoint?.choices ?? OPTIONS).find(
      (choice) => choice.id === prediction,
    )?.label ?? prediction
  );
}

export function PredictionGate({
  instruction,
  checkpoint = null,
  selected,
  skipped,
  disabled = false,
  onSelect,
  onSkip,
}: PredictionGateProps) {
  const choices = checkpoint?.choices ?? OPTIONS;

  return (
    <fieldset
      className="prediction-gate"
      disabled={disabled || !instruction}
      aria-describedby="prediction-help"
    >
      <legend>
        {checkpoint?.prompt ??
          "다음 Step에서 가장 중요한 변화는 무엇일까요?"}
      </legend>
      <p className="field-help" id="prediction-help">
        {checkpoint
          ? "정확한 주소와 값을 먼저 고른 뒤 실제 실행 결과와 비교합니다."
          : "답을 고르거나 잘 모르겠다고 표시하면 실행 결과를 확인할 수 있습니다."}
      </p>
      <div className="prediction-options">
        {choices.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name="step-prediction"
              value={option.id}
              checked={selected === option.id && !skipped}
              onChange={() => onSelect(option.id)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={onSkip}
        disabled={disabled || !instruction}
      >
        잘 모르겠어요. 결과 보기
      </button>
      {skipped ? (
        <p className="skip-note">
          예측 없이 진행합니다. 다른 답을 고르면 예측으로 바뀝니다.
        </p>
      ) : null}
    </fieldset>
  );
}
