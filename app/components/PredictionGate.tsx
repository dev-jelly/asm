import type { SerializedInstruction } from "../../lib/rv32i/types";
import { formatHex } from "../../lib/rv32i/memory";

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
  registers: readonly number[];
  checkpoint?: PredictionCheckpoint | null;
  selected: string;
  skipped: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  onSkip: () => void;
};

const STATE_CHANGE_CHOICES: readonly PredictionChoice[] = [
  { id: "register", label: "목적지 레지스터에 결과를 씁니다." },
  { id: "memory", label: "계산한 메모리 주소에 값을 씁니다." },
  {
    id: "none",
    label: "쓰기 결과는 남지 않고 PC만 다음 명령어로 이동합니다.",
  },
] as const;

export function expectedPrediction(
  instruction: SerializedInstruction | null,
  checkpoint: PredictionCheckpoint | null,
  registers: readonly number[],
): string {
  if (checkpoint) return checkpoint.correctChoiceId;
  if (!instruction) return "none";
  if (instruction.prediction.effect === "branch") {
    const left = registers[instruction.prediction.leftRegister] ?? 0;
    const right = registers[instruction.prediction.rightRegister] ?? 0;
    return left === right ? "branch-taken" : "branch-not-taken";
  }
  if (instruction.prediction.effect === "memory") return "memory";
  return instruction.prediction.destinationRegister === 0
    ? "none"
    : "register";
}

export function predictionLabel(
  prediction: string,
  checkpoint: PredictionCheckpoint | null,
  instruction: SerializedInstruction | null,
  registers: readonly number[],
): string {
  if (!prediction) return "예측하지 않음";
  return (
    predictionChoices(instruction, checkpoint, registers).find(
      (choice) => choice.id === prediction,
    )?.label ?? prediction
  );
}

export function predictionChoices(
  instruction: SerializedInstruction | null,
  checkpoint: PredictionCheckpoint | null,
  registers: readonly number[],
): readonly PredictionChoice[] {
  if (checkpoint) return checkpoint.choices;
  if (!instruction || instruction.prediction.effect !== "branch") {
    return STATE_CHANGE_CHOICES;
  }

  const metadata = instruction.prediction;
  const left = registers[metadata.leftRegister] ?? 0;
  const right = registers[metadata.rightRegister] ?? 0;
  const nextAddress = (instruction.address + 4) >>> 0;
  return [
    {
      id: "branch-taken",
      label: `x${metadata.leftRegister} ${formatHex(left)}와 x${metadata.rightRegister} ${formatHex(right)}가 같아서 ${formatHex(metadata.target)}로 분기합니다.`,
    },
    {
      id: "branch-not-taken",
      label: `x${metadata.leftRegister} ${formatHex(left)}와 x${metadata.rightRegister} ${formatHex(right)}가 달라서 ${formatHex(nextAddress)}로 이동합니다.`,
    },
  ];
}

export function PredictionGate({
  instruction,
  registers,
  checkpoint = null,
  selected,
  skipped,
  disabled = false,
  onSelect,
  onSkip,
}: PredictionGateProps) {
  const choices = predictionChoices(instruction, checkpoint, registers);
  const isBranch =
    !checkpoint && instruction?.prediction.effect === "branch";

  return (
    <fieldset
      className="prediction-gate"
      disabled={disabled || !instruction}
      aria-describedby="prediction-help"
    >
      <legend>
        {checkpoint?.prompt ??
          (isBranch
            ? "분기 조건이 성립할까요? 다음 PC도 함께 예측하세요."
            : "다음 Step에서 가장 중요한 변화는 무엇일까요?")}
      </legend>
      <p className="field-help" id="prediction-help">
        {checkpoint
          ? "답을 하나 고른 뒤 실제 상태 변화와 비교합니다."
          : isBranch
            ? "현재 레지스터 값과 분기 목적지를 함께 확인하세요."
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
