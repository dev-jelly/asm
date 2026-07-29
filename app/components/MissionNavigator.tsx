"use client";

import { useEffect, useRef } from "react";
import {
  getMemoryMissionsByModule,
  type MemoryMission,
  type MemoryMissionId,
  type MemoryMissionModuleId,
} from "../content/memoryMissions";
import type { ProgressData } from "../lib/progress";

const MODULES: readonly {
  id: MemoryMissionModuleId;
  marker: string;
  title: string;
}[] = [
  { id: "pc", marker: "PC", title: "현재 명령어" },
  { id: "x", marker: "x", title: "레지스터" },
  { id: "m", marker: "M", title: "주소와 메모리" },
  { id: "b", marker: "B", title: "분기와 반복" },
];

type MissionNavigatorProps = {
  selectedMission: MemoryMission;
  progress: ProgressData;
  disabled?: boolean;
  onSelect: (missionId: MemoryMissionId) => void;
};

export function MissionNavigator({
  selectedMission,
  progress,
  disabled = false,
  onSelect,
}: MissionNavigatorProps) {
  const selectedModuleRef = useRef<HTMLButtonElement>(null);
  const selectedMissionRef = useRef<HTMLButtonElement>(null);
  const visibleMissions = getMemoryMissionsByModule(
    selectedMission.moduleId,
  );

  useEffect(() => {
    selectedModuleRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
    selectedMissionRef.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedMission.id, selectedMission.moduleId]);

  return (
    <section
      className="mission-navigation"
      id="learn"
      aria-labelledby="learn-title"
    >
      <div className="mission-navigation-copy">
        <h2 id="learn-title">작은 상태 변화에서 실제 프로그램까지.</h2>
        <p>
          한 번에 한 개념을 예측하고 실행합니다. 완료 표시는 프로그램 실행과
          독립 문제 결과를 구분합니다.
        </p>
      </div>

      <nav className="module-switcher" aria-label="RV32I 학습 모듈">
        {MODULES.map((module) => {
          const missions = getMemoryMissionsByModule(module.id);
          const independent = missions.filter(
            (mission) =>
              progress.missions[mission.id].status === "independent",
          ).length;
          const selected = selectedMission.moduleId === module.id;
          return (
            <button
              ref={selected ? selectedModuleRef : undefined}
              key={module.id}
              type="button"
              aria-pressed={selected}
              data-selected={selected || undefined}
              disabled={disabled}
              onClick={() => onSelect(missions[0].id)}
            >
              <span className="module-marker" aria-hidden="true">
                {module.marker}
              </span>
              <span>
                <strong>{module.title}</strong>
                <small>
                  혼자 해결 {independent}/{missions.length}
                </small>
              </span>
            </button>
          );
        })}
      </nav>

      <nav className="mission-switcher" aria-label="현재 모듈의 학습 미션">
        {visibleMissions.map((mission) => {
          const evidence = progress.missions[mission.id];
          const status = evidence.status;
          const selected = mission.id === selectedMission.id;
          const statusLabel =
            status === "independent"
              ? "혼자 해결"
              : status === "guided"
                ? "연습 완료"
                : evidence.predictionAttempts > 0
                  ? "학습 중"
                  : "시작 전";
          return (
            <button
              ref={selected ? selectedMissionRef : undefined}
              key={mission.id}
              type="button"
              className="mission-button"
              data-selected={selected || undefined}
              aria-current={selected ? "step" : undefined}
              disabled={disabled}
              onClick={() => onSelect(mission.id)}
            >
              <strong>{mission.title}</strong>
              <span>{mission.summary}</span>
              <small>{statusLabel}</small>
            </button>
          );
        })}
      </nav>
    </section>
  );
}
