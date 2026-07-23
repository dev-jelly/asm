"use client";

import { useEffect, useState } from "react";
import {
  clearProgress,
  emptyProgress,
  type ProgressData,
  readProgress,
} from "../lib/progress";

const ACTIVITIES = [
  { id: "tracer-bullet", label: "첫 상태 변화 추적" },
  { id: "address-versus-value", label: "주소와 값 구분" },
] as const;

type ProgressState =
  | { status: "loading"; data: ProgressData }
  | { status: "ready"; data: ProgressData }
  | { status: "unavailable"; data: ProgressData };

export function ProgressPanel() {
  const [state, setState] = useState<ProgressState>({
    status: "loading",
    data: emptyProgress(),
  });

  useEffect(() => {
    const refresh = () => {
      try {
        setState({ status: "ready", data: readProgress(window.localStorage) });
      } catch {
        setState({ status: "unavailable", data: emptyProgress() });
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

  function resetDeviceProgress() {
    try {
      setState({
        status: "ready",
        data: clearProgress(window.localStorage),
      });
    } catch {
      setState({ status: "unavailable", data: emptyProgress() });
    }
  }

  const completed = state.data.completedActivities.length;

  return (
    <div className="progress-panel">
      <div>
        <h2 id="progress-title">로그인 없이 이 브라우저에 저장합니다.</h2>
        <p>
          계정이나 서버 저장소는 사용하지 않습니다. 이 기기에서 완료한 활동만
          기록합니다.
        </p>
      </div>
      <div className="progress-detail" aria-live="polite">
        {state.status === "loading" ? (
          <p>진도를 불러오는 중입니다.</p>
        ) : state.status === "unavailable" ? (
          <p className="warning-text">
            이 브라우저에서는 기기 진도를 저장할 수 없습니다.
          </p>
        ) : (
          <>
            <p className="progress-summary">
              <strong>
                {completed === 0
                  ? "아직 완료한 활동이 없습니다."
                  : completed === ACTIVITIES.length
                    ? "첫 학습 경로를 완료했습니다."
                    : "첫 학습 경로를 진행 중입니다."}
              </strong>
              <span>
                {completed} / {ACTIVITIES.length} 활동 완료
              </span>
            </p>
            <ul className="progress-list">
              {ACTIVITIES.map((activity) => {
                const done = state.data.completedActivities.includes(activity.id);
                return (
                  <li key={activity.id}>
                    <span aria-hidden="true">{done ? "✓" : "○"}</span>
                    <span>{activity.label}</span>
                    <strong>{done ? "완료" : "미완료"}</strong>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="text-button danger-action"
              onClick={resetDeviceProgress}
              disabled={completed === 0}
            >
              이 기기의 진도 지우기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
