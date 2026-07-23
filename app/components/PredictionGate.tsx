import type { SerializedInstruction } from "../../lib/rv32i/types";

type PredictionGateProps = {
  instruction: SerializedInstruction | null;
  selected: string;
  skipped: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  onSkip: () => void;
};

const OPTIONS = [
  { value: "register", label: "목적지 레지스터에 결과를 씁니다." },
  { value: "memory", label: "계산한 메모리 주소에 4바이트를 씁니다." },
  { value: "pc", label: "조건 비교 결과로 다음 PC가 정해집니다." },
  {
    value: "none",
    label: "레지스터와 메모리는 그대로이고 PC만 다음 명령어로 이동합니다.",
  },
] as const;

export function expectedPrediction(
  instruction: SerializedInstruction | null,
): string {
  if (!instruction) return "none";
  if (instruction.mnemonic === "sw") return "memory";
  if (instruction.mnemonic === "beq") return "pc";
  return "register";
}

export function PredictionGate({
  instruction,
  selected,
  skipped,
  disabled = false,
  onSelect,
  onSkip,
}: PredictionGateProps) {
  return (
    <fieldset
      className="prediction-gate"
      disabled={disabled || !instruction}
      aria-describedby="prediction-help"
    >
      <legend>다음 Step에서 가장 중요한 변화는 무엇일까요?</legend>
      <p className="field-help" id="prediction-help">
        답을 고르거나 잘 모르겠다고 표시하면 실행 결과를 확인할 수 있습니다.
      </p>
      <div className="prediction-options">
        {OPTIONS.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name="step-prediction"
              value={option.value}
              checked={selected === option.value && !skipped}
              onChange={() => onSelect(option.value)}
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
