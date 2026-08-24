# 현재 구현 상태

- 마지막 코드 대조: 2026-08-12
- 상태 기준: 현재 저장소의 제품 코드와 자동 검사
- 장기 목표: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

이 문서는 현재 동작하는 범위와 아직 구현하지 않은 범위를 구분하는 단일
기준이다. 계획 문서의 설계 예시나 완료 조건은 이 문서에서 명시적으로
“구현됨”으로 표시하지 않는 한 목표 상태로 해석한다.

## 구현됨

- `addi`, `lb`, `lbu`, `lh`, `lhu`, `lw`, `sb`, `sh`, `sw`, `beq`의
  parsing, encoding, 실행과 오류 검증
- Dedicated Web Worker 기반 `LOAD`, `STEP`, `BACK`, `RESET`, `RUN`,
  `PAUSE` 명령, 오래된 응답 차단, 명령 직렬화, Worker 재시작
- 4 KiB byte-addressed data memory, 정렬 검사, little-endian, 초기화 byte
  추적, load 부호·0 확장
- PC·레지스터·메모리 변화, 실행 timeline, 최근 memory access와
  instruction budget 표시
- 실행 전 예측, 핵심 checkpoint, 전이 문제를 포함한 8개 미션과
  브라우저 로컬 진도 v3
- 반응형 light/dark UI, keyboard shortcut, screen-reader 안내,
  reduced-motion과 forced-colors 대응
- 정적 vinext export와 GitHub Pages 배포

## 부분 구현

| 영역 | 현재 범위 | 남은 목표 |
|---|---|---|
| RV32I | 학습에 필요한 10개 명령어 | 전체 RV32I, pseudo-instruction, directive |
| 메모리 | 단일 4 KiB data 영역 | 32비트 sparse region, permission, stack·MMIO |
| 실행 기록 | bounded delta history와 한 단계 Back | checkpoint, 임의 seek, history byte budget |
| 제어 흐름 | `beq`와 loop timeline | breakpoint, watchpoint, `jal`·`jalr` |
| 학습 | 모듈 4개, 미션 8개, 즉시 전이 문제 | 함수·ABI, 지연 복습, capstone, 전체 콘텐츠 |
| 검증 | unit, protocol, rendered HTML, Chromium desktop/mobile | Sail·Architecture Tests, Firefox·Safari, 수동 보조기술 QA |

## 아직 구현하지 않음

- 함수·stack·ILP32 ABI 레슨과 stack overlay
- breakpoint, watchpoint, checkpoint, seek
- 계정, 서버 저장, 업로드, 협업, 임의 native code 실행
- 공식 reference model을 이용한 differential test

## 유지보수 원칙

- 현재 범위를 바꾸는 코드와 이 문서를 같은 변경에서 갱신한다.
- 구체 패키지 버전은 `package.json`과 `package-lock.json`을 기준으로 한다.
- 보안 취약점 수를 문서에 고정하지 않고 CI의 `npm audit` 결과를 기준으로
  판단한다.
- 모든 변경은 최소 `npm run typecheck`, `npm run lint`,
  `npm run test:unit`, `npm run build`, `npm run test:rendered`를 통과해야
  한다. 사용자 흐름 변경은 `npm run test:e2e`까지 실행한다.
