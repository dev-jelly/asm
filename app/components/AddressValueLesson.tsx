"use client";

import { useEffect, useMemo, useState } from "react";
import type { MachineOptions } from "../../lib/rv32i/types";
import { formatHex } from "../../lib/rv32i/memory";
import { useRv32iWorker } from "../hooks/useRv32iWorker";
import { markLocalProgress } from "../lib/progress";

const SOURCE = `addi x5, x10, 0
lw   x6, 0(x10)`;

const OPTIONS: MachineOptions = {
  initialMemory: [
    { address: 0x1000, bytes: [0x2a, 0x00, 0x00, 0x00] },
  ],
};

export function AddressValueLesson() {
  const options = useMemo(() => OPTIONS, []);
  const lab = useRv32iWorker(SOURCE, options);
  const [prediction, setPrediction] = useState("");
  const [submittedPrediction, setSubmittedPrediction] = useState<string | null>(
    null,
  );
  const revealed = lab.status === "completed";

  useEffect(() => {
    if (revealed) markLocalProgress("address-versus-value");
  }, [revealed]);

  function reset() {
    setPrediction("");
    setSubmittedPrediction(null);
    lab.reset();
  }

  function runComparison() {
    if (!prediction || submittedPrediction !== null) return;
    setSubmittedPrediction(prediction);
    lab.run();
  }

  const resultMessage =
    submittedPrediction === "correct"
      ? "예측이 맞았습니다."
      : submittedPrediction === "reversed"
        ? "예측이 달랐습니다. addi는 주소를 복사하고 lw는 그 주소의 값을 읽습니다."
        : "정답은 x5가 주소, x6가 값입니다. 실제 결과에서 두 값을 확인해 보세요.";

  return (
    <div className="address-lesson">
      <div className="address-lesson-copy">
        <h2 id="practice-title">같은 x10을 읽어도 결과는 다릅니다.</h2>
        <p>
          <code>x10</code>에는 주소 <code>0x00001000</code>이 있고, 그 주소의
          4바이트에는 값 <code>0x0000002a</code>가 저장되어 있습니다.
        </p>
        <pre aria-label="주소와 값을 비교하는 RV32I 코드">
          <code>{SOURCE}</code>
        </pre>
      </div>

      <div className="address-activity">
        <fieldset
          disabled={
            lab.status === "loading" ||
            lab.status === "running" ||
            revealed ||
            submittedPrediction !== null
          }
        >
          <legend>두 명령어의 실행 결과를 예측하세요.</legend>
          <label>
            <input
              type="radio"
              name="address-value-prediction"
              value="correct"
              checked={prediction === "correct"}
              onChange={(event) => setPrediction(event.target.value)}
            />
            <span>
              <code>x5</code>는 주소, <code>x6</code>는 그 주소의 값
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="address-value-prediction"
              value="reversed"
              checked={prediction === "reversed"}
              onChange={(event) => setPrediction(event.target.value)}
            />
            <span>
              <code>x5</code>는 값, <code>x6</code>는 주소
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="address-value-prediction"
              value="unsure"
              checked={prediction === "unsure"}
              onChange={(event) => setPrediction(event.target.value)}
            />
            <span>잘 모르겠어요. 실제 결과를 확인하겠습니다.</span>
          </label>
        </fieldset>
        <div className="activity-actions">
          <button
            type="button"
            className="primary-control"
            onClick={runComparison}
            disabled={
              !prediction ||
              submittedPrediction !== null ||
              lab.status === "loading" ||
              lab.status === "running" ||
              lab.status === "completed" ||
              lab.status === "error"
            }
          >
            비교 실행
          </button>
          <button
            type="button"
            onClick={lab.pause}
            disabled={lab.status !== "running"}
          >
            Pause
          </button>
          <button type="button" onClick={reset} disabled={lab.status === "running"}>
            다시 예측
          </button>
        </div>

        {lab.error ? (
          <div className="inline-message error-message" role="alert">
            {lab.error}
          </div>
        ) : null}

        <div
          className="address-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">{lab.announcement}</span>
          {revealed && lab.snapshot && submittedPrediction ? (
            <div className="address-result">
              <p
                className={
                  submittedPrediction === "correct"
                    ? "success-text"
                    : "warning-text"
                }
              >
                {resultMessage}
              </p>
              <dl>
                <div>
                  <dt>
                    <code>addi x5, x10, 0</code>
                  </dt>
                  <dd>
                    x10의 숫자 자체를 복사해 x5 ={" "}
                    <strong>{formatHex(lab.snapshot.registers[5])}</strong>
                  </dd>
                </div>
                <div>
                  <dt>
                    <code>lw x6, 0(x10)</code>
                  </dt>
                  <dd>
                    유효 주소 0x00001000의 바이트 2a 00 00 00을 읽어 x6 ={" "}
                    <strong>{formatHex(lab.snapshot.registers[6])}</strong>
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="empty-state">
              답을 고르면 두 명령어의 실행 결과를 확인할 수 있습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
