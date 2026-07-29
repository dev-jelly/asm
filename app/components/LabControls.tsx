type LabControlsProps = {
  status: string;
  commandPending?: boolean;
  canReveal: boolean;
  canBack: boolean;
  canRun?: boolean;
  runLockedReason?: string;
  runConfirmed: boolean;
  onRunConfirmed: (checked: boolean) => void;
  onStep: () => void;
  onBack: () => void;
  onReset: () => void;
  onRun: () => void;
  onPause: () => void;
};

export function LabControls({
  status,
  commandPending = false,
  canReveal,
  canBack,
  canRun = true,
  runLockedReason,
  runConfirmed,
  onRunConfirmed,
  onStep,
  onBack,
  onReset,
  onRun,
  onPause,
}: LabControlsProps) {
  const busy = status === "loading" || commandPending;
  const running = status === "running";
  const completed = status === "completed";
  const error = status === "error";

  return (
    <fieldset className="lab-controls">
      <legend className="sr-only">실행 제어</legend>
      <div className="control-buttons">
        <button
          type="button"
          onClick={onBack}
          disabled={busy || running || !canBack}
        >
          Back
        </button>
        <button
          type="button"
          className="primary-control"
          onClick={onStep}
          disabled={busy || running || completed || error || !canReveal}
          aria-describedby="step-requirement"
        >
          Step
        </button>
        <label className="run-confirmation">
          <input
            type="checkbox"
            checked={runConfirmed}
            onChange={(event) => onRunConfirmed(event.target.checked)}
            disabled={busy || running || completed}
          />
          <span>Run은 현재 예측 이후 단계의 확인 과정을 건너뜁니다.</span>
        </label>
        <button
          type="button"
          onClick={onRun}
          disabled={
            busy ||
            running ||
            completed ||
            error ||
            !canReveal ||
            !canRun ||
            !runConfirmed
          }
          aria-describedby={runLockedReason ? "run-requirement" : undefined}
        >
          Run
        </button>
        <button
          type="button"
          onClick={onPause}
          disabled={!running}
        >
          Pause
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={busy || running || error}
        >
          Reset
        </button>
      </div>
      <p className="control-note" id="step-requirement">
        Step과 Run은 답을 고르거나 잘 모르겠다고 표시한 뒤 사용할 수 있습니다.
        단축키는 Alt+S, Alt+B, Alt+R, Alt+P, Alt+0입니다.
      </p>
      {runLockedReason ? (
        <p className="control-note" id="run-requirement">
          {runLockedReason}
        </p>
      ) : null}
    </fieldset>
  );
}
