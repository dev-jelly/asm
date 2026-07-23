# 어셈블리 학습 사이트 문서

이 디렉터리는 초보자를 위한 어셈블리 학습 사이트를 설계·구현하기 위한 기준 문서 모음이다. 사이트의 중심 경험은 학습자가 코드를 실행하기 전에 상태 변화를 예측하고, 한 명령씩 실행하면서 레지스터와 메모리의 변화를 관찰하며, 되감기와 변형 문제를 통해 정확한 기계 모델을 형성하는 것이다.

문서 기준일은 **2026-07-24**이다. 외부 자료는 원문을 복제하지 않고, 직접 작성한 요약·공식 링크·접근 조건·라이선스·권장 사용 방식으로 기록한다.

## 권장 읽기 순서

| 순서 | 문서 | 목적 |
|---:|---|---|
| 1 | [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | 제품 목표, 범위, 작업 흐름, 단계별 산출물, 의존성, 위험과 종료 조건을 다루는 마스터 계획 |
| 2 | [decisions/ADR-0001-primary-isa-and-runtime.md](./decisions/ADR-0001-primary-isa-and-runtime.md) | RV32I와 TypeScript Worker 런타임을 첫 구현으로 선택한 이유와 결과 |
| 3 | [architecture/RUNTIME_AND_MEMORY_VISUALIZATION.md](./architecture/RUNTIME_AND_MEMORY_VISUALIZATION.md) | 교육용 기계, assembler, 실행 코어, 이벤트, 메모리, 되감기, 보안, 테스트의 기술 설계 |
| 4 | [product/LEARNING_AND_CONTENT_DESIGN.md](./product/LEARNING_AND_CONTENT_DESIGN.md) | 학습 원리, 커리큘럼, 레슨·문제·채점·진도 모델 |
| 5 | [product/UX_AND_ACCESSIBILITY.md](./product/UX_AND_ACCESSIBILITY.md) | 정보 구조, 화면·상호작용, 반응형 디자인, 접근성 기준 |
| 6 | [research/RESEARCH_SYNTHESIS.md](./research/RESEARCH_SYNTHESIS.md) | 조사에서 얻은 결론, ISA 대안, 선행 사례, 오개념과 설계 원칙 |
| 7 | [research/RESOURCE_CATALOG.md](./research/RESOURCE_CATALOG.md) | 공식 명세, 강의, 교재, 도구, 연구 자료, 라이선스와 재사용 범위 |
| 8 | [GLOSSARY.md](./GLOSSARY.md) | 문서와 UI에서 사용할 한·영 용어, 범위 배지, 명명 규칙 |

## 문서 간 책임 경계

- `IMPLEMENTATION_PLAN.md`는 **무엇을 어떤 순서와 조건으로 만들지**를 결정한다.
- `LEARNING_AND_CONTENT_DESIGN.md`는 **무엇을 어떻게 가르치고 평가할지**를 결정한다.
- `UX_AND_ACCESSIBILITY.md`는 **학습자가 무엇을 보고 어떻게 조작할지**를 결정한다.
- `RUNTIME_AND_MEMORY_VISUALIZATION.md`는 **코드를 어떻게 정확하고 안전하게 실행·기록·표시할지**를 결정한다.
- `RESEARCH_SYNTHESIS.md`는 **이 결정들이 어떤 조사와 비교에서 나왔는지**를 설명한다.
- `RESOURCE_CATALOG.md`는 **어떤 외부 자료를 어떤 조건으로 사용할 수 있는지**를 기록한다.
- `GLOSSARY.md`는 모든 문서와 제품 UI가 공유하는 **용어의 단일 기준**이다.
- ADR은 이미 내린 중요한 결정을 보존하며, 결정이 바뀌면 기존 문서를 덮어쓰기보다 새 ADR을 추가한다.

## 전체 제품 원칙

1. 첫 ISA는 RV32I이며, `M`, `C`, privileged ISA와 실제 OS 실행은 후속 단계로 둔다.
2. 첫 행동은 긴 설명을 읽는 것이 아니라 짧은 코드를 예측하고 Step하는 것이다.
3. 시각화는 정답을 대신 보여주는 장식이 아니라 예측·설명·디버깅을 유도하는 도구다.
4. “ISA 규칙”, “ABI 관례”, “교육용 VM 정책”을 항상 구분한다.
5. 실행 코어가 상태의 권위 있는 소유자이며 UI는 버전이 있는 `Snapshot + StepDelta` 프로토콜만 소비한다.
6. 모든 실행은 결정적이고 되감기 가능해야 한다.
7. 동적 시각화와 동일한 정보를 키보드·표·텍스트 trace로도 이용할 수 있어야 한다.
8. 정확성은 자체 예제만이 아니라 공식 Sail 모델과 Architecture Tests를 통해 검증한다.
9. 외부 콘텐츠의 “무료 열람”을 “자유로운 개작 가능”으로 오인하지 않는다.
10. 진도는 클릭 수나 체류 시간이 아니라 독립 해결과 지연 전이 문제로 판단한다.

## 문서 유지 규칙

- 중요한 기술 결정은 ADR로 기록한다.
- 명세·ABI·도구에 의존하는 문서에는 기준 버전 또는 확인일을 남긴다.
- 외부 자료를 추가할 때는 `RESOURCE_CATALOG.md`에 URL, 라이선스, 이용 방식, 확인일을 함께 추가한다.
- 용어가 새로 생기거나 의미가 바뀌면 구현보다 먼저 `GLOSSARY.md`를 갱신한다.
- 레슨이나 문제 스키마를 바꾸면 기존 콘텐츠의 migration 전략을 함께 기록한다.
- “MVP에 포함”과 “후속 후보”를 문서에서 명시적으로 구분한다.
- 시간 추정은 팀 규모에 따라 달라지므로 종료 조건과 의존성을 일정 숫자보다 우선한다.

## 현재 상태

이 문서 세트는 구현 전 기준선이다. 애플리케이션 코드, 패키지 구성, 데이터베이스, 배포 설정은 아직 만들지 않았다. 다음 작업은 `IMPLEMENTATION_PLAN.md`의 “Tracer-bullet 0”에 정의된 교육용 기계 계약과 4개 명령 세로형 프로토타입을 구현하는 것이다.
