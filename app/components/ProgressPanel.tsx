"use client";

import { useEffect, useState } from "react";
import {
  getMemoryMissionsByModule,
  type MemoryMissionModuleId,
} from "../content/memoryMissions";
import {
  clearProgress,
  emptyProgress,
  exportProgress,
  type ProgressData,
  readProgress,
} from "../lib/progress";

const MODULES: readonly {
  id: MemoryMissionModuleId;
  marker: string;
  label: string;
}[] = [
  { id: "pc", marker: "PC", label: "현재 명령어" },
  { id: "x", marker: "x", label: "레지스터" },
  { id: "m", marker: "M", label: "메모리" },
  { id: "b", marker: "B", label: "분기와 반복" },
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
  const [confirmingReset, setConfirmingReset] = useState(false);

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
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    try {
      const cleared = clearProgress(window.localStorage);
      setState({
        status: "ready",
        data: cleared,
      });
      window.dispatchEvent(
        new CustomEvent("asm-progress", { detail: cleared }),
      );
    } catch {
      setState({ status: "unavailable", data: emptyProgress() });
    }
    setConfirmingReset(false);
  }

  function exportDeviceProgress() {
    let serialized: string;
    try {
      serialized = exportProgress(window.localStorage);
    } catch {
      serialized = `${JSON.stringify(state.data, null, 2)}\n`;
    }
    const blob = new Blob([serialized], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "asm-lab-progress.json";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const started = Object.values(state.data.missions).filter(
    (mission) =>
      mission.status !== "not-started" ||
      mission.predictionAttempts > 0,
  ).length;
  const independent = Object.values(state.data.missions).filter(
    (mission) => mission.status === "independent",
  ).length;

  return (
    <div className="progress-panel">
      <div>
        <h2 id="progress-title">로그인 없이 이 브라우저에 저장합니다.</h2>
        <p>
          계정이나 서버 저장소는 사용하지 않습니다. 미션별 연습 결과와 마지막
          위치를 이 기기에 기록합니다.
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
                {started === 0
                  ? "아직 시작한 미션이 없습니다."
                  : independent === Object.keys(state.data.missions).length
                    ? "모든 미션을 혼자 해결했습니다."
                    : "RV32I 학습 경로를 진행 중입니다."}
              </strong>
              <span>
                시작한 미션 {started}개, 그중 혼자 해결 {independent}개
              </span>
            </p>
            <div className="progress-modules">
              {MODULES.map((module) => (
                <section key={module.id} className="progress-module">
                  <h3>
                    <code>{module.marker}</code>
                    <span>{module.label}</span>
                  </h3>
                  <ul className="progress-list">
                    {getMemoryMissionsByModule(module.id).map((mission) => {
                      const evidence = state.data.missions[mission.id];
                      const statusLabel =
                        evidence.status === "independent"
                          ? "혼자 해결"
                          : evidence.status === "guided"
                            ? "연습 완료"
                            : evidence.predictionAttempts > 0
                              ? "학습 중"
                              : "시작 전";
                      return (
                        <li key={mission.id}>
                          <span aria-hidden="true">
                            {evidence.status === "independent"
                              ? "✓"
                              : evidence.status === "guided"
                                ? "△"
                                : evidence.predictionAttempts > 0
                                  ? "◐"
                                  : "○"}
                          </span>
                          <span>{mission.title}</span>
                          <strong>{statusLabel}</strong>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <div className="progress-actions">
              <button
                type="button"
                onClick={exportDeviceProgress}
              >
                진도 내보내기
              </button>
              <button
                type="button"
                className="text-button danger-action"
                onClick={resetDeviceProgress}
                disabled={started === 0}
              >
                {confirmingReset ? "정말 진도 지우기" : "이 기기의 진도 지우기"}
              </button>
              {confirmingReset ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmingReset(false)}
                >
                  취소
                </button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
