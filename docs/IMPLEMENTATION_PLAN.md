# 어셈블리 학습 사이트 구현 계획

- 문서 상태: Draft baseline
- 기준일: 2026-07-24
- 첫 출시 대상: 한국어 기반 초보자용 RV32I 학습 웹 애플리케이션
- 관련 결정: [ADR-0001](./decisions/ADR-0001-primary-isa-and-runtime.md)

## 1. 요약

이 제품은 코드를 입력해 결과만 얻는 온라인 assembler가 아니다. 학습자가 실행 전에 다음 상태를 예측하고, 한 instruction이 읽고 쓴 값과 그 원인을 관찰하며, 되감기·변형·지연 복습을 거쳐 시각화 없이도 machine state를 추적할 수 있게 하는 학습 환경이다.

MVP의 주 ISA는 RV32I이고, 실행은 Dedicated Web Worker 안의 계측 가능한 TypeScript interpreter가 담당한다. Worker가 machine state와 history의 유일한 권위자가 되며 UI는 `Snapshot`, `StepDelta`, `TraceBatch` protocol을 통해서만 상태를 받는다.

제품은 다음 세 층을 동시에 완성해야 한다.

1. 정확하고 결정적인 교육용 machine
2. 예측과 설명을 요구하는 학습 콘텐츠
3. 레지스터·메모리·스택·trace를 접근 가능하게 보여주는 인터페이스

세 층 중 하나라도 빠지면 목표를 달성하지 못한다. 정확한 emulator만 있으면 교육용 debugger에 그치고, 좋은 콘텐츠만 있으면 기존 강의와 다르지 않으며, 화려한 시각화만 있으면 수동 관찰 도구가 된다.

## 2. 해결할 문제

초보자는 어셈블리 학습에서 다음 문제를 반복한다.

- 어셈블리를 하나의 보편 언어로 오해한다.
- register의 값, memory address, 그 주소에 저장된 값을 혼동한다.
- signedness와 type이 bit 자체에 저장된다고 생각한다.
- little-endian을 bit나 hex 문자열을 뒤집는 규칙으로 이해한다.
- pseudo-instruction, assembler directive, machine instruction을 구분하지 못한다.
- stack과 calling convention을 CPU가 자동으로 강제하는 구조로 오해한다.
- simulator의 `ecall`과 memory 초기값을 실제 OS·hardware 규칙으로 일반화한다.
- debugger에서 예측 없이 Step만 반복하여 시각화가 사라지면 상태를 추적하지 못한다.
- 처음부터 전체 ISA, toolchain, pipeline, cache를 동시에 접해 인지 부하가 커진다.

제품은 이런 오개념을 사후 설명으로만 고치지 않고, 문제·상태 표현·오류·진도 모델에 `misconception_tag`를 내장해 적극적으로 탐지하고 복습시켜야 한다.

## 3. 목표

### 3.1 학습 목표

첫 코스를 마친 학습자는 다음을 할 수 있어야 한다.

- assembly, machine code, ISA, ABI, 실행 환경의 차이를 설명한다.
- 짧은 RV32I 프로그램의 register, PC, memory 변화를 손으로 추적한다.
- address와 value, load width, sign extension, endian을 구분한다.
- branch와 loop의 종료 상태를 예측한다.
- 배열과 문자열의 effective address를 계산한다.
- 함수 호출에서 argument, return address, caller/callee-saved register, stack frame을 설명한다.
- pseudo-instruction이 실제 instruction으로 어떻게 확장되는지 확인한다.
- breakpoint, watchpoint와 trace를 사용해 오류의 최초 원인을 찾는다.
- 간단한 C 코드와 compiler-generated assembly를 비교한다.
- 시각화 없이 새로운 입력에 대해 작은 프로그램의 결과를 설명한다.

### 3.2 제품 목표

- 첫 방문 후 5분 안에 한 instruction의 상태 변화를 경험하게 한다.
- 로그인 없이 핵심 학습·playground·local progress가 동작하게 한다.
- Step, Back, Run, Pause, Reset, seek가 결정적으로 동작하게 한다.
- UI가 register, memory, stack, source, machine instruction 사이의 인과관계를 보여주게 한다.
- 한국어 설명과 영어 공식 용어를 함께 제공한다.
- 핵심 학습 흐름을 WCAG 2.2 AA 수준으로 구현한다.
- 공식 명세와 reference model을 이용한 자동 정확성 검증을 갖춘다.
- 콘텐츠·machine profile·protocol에 version을 부여한다.

### 3.3 기술 목표

- UI와 execution core를 `MachineAdapter`와 versioned protocol로 분리한다.
- 모든 memory access가 중앙 `MemoryBus`를 지나도록 한다.
- 한 instruction의 before/after patch만으로 UI 갱신과 undo가 가능하게 한다.
- parser·assembler·execution·grading 오류를 서로 다른 계층으로 분류한다.
- source 크기, instruction, memory, trace history에 명시적 budget을 둔다.
- 서버 실행 없이 MVP를 배포할 수 있게 한다.

## 4. 비목표

MVP에서는 다음을 만들지 않는다.

- x86-64, AArch64, MIPS 등 복수 ISA 동시 지원
- RV32M/A/F/D/C, privileged ISA, CSR 전체 지원
- Linux kernel 또는 실제 process emulation
- GNU assembler 전체 문법과 완전한 ELF linker
- cycle-accurate pipeline 또는 cache simulator
- 3D memory·CPU 애니메이션
- 공개 속도 순위표와 경쟁 중심 gamification
- 사용자 제작 콘텐츠 marketplace
- AI가 즉시 정답 assembly를 작성해 주는 tutor
- 계정·결제·교사 dashboard·조직 관리
- 서버 측 arbitrary compiler execution
- 실시간 공동 편집

비목표는 영구 제외가 아니라 MVP의 학습 검증을 방해하지 않기 위한 순서 결정이다.

## 5. 대상 사용자

### 5.1 주 사용자

기본적인 변수, 조건문, 반복문을 본 적은 있지만 computer architecture와 assembly는 처음인 학습자다. C 경험은 도움이 되지만 필수로 가정하지 않는다.

### 5.2 보조 사용자

- 고급 언어 개발자로서 memory·ABI·compiler output을 이해하려는 사람
- 대학 computer architecture 수업의 보충 실습을 찾는 학생
- embedded, reverse engineering, security 과정으로 넘어가기 전 기초를 다지려는 사람
- 한국어 설명이 필요하지만 공식 영어 용어도 함께 익히고 싶은 학습자
- 키보드, screen reader, reduced motion 등 접근성 요구가 있는 학습자

### 5.3 후속 사용자

- 교사와 강사
- AArch64·x86-64 전이 과정 학습자
- pipeline·cache·compiler·OS 심화 과정 학습자

교사 기능은 실제 파일럿 수요가 확인된 뒤 별도 제품 영역으로 다룬다.

## 6. 핵심 제품 결정

| 영역 | 결정 | 이유 |
|---|---|---|
| 첫 ISA | RV32I | 작은 load/store ISA, 공개 명세, 고정 32비트 instruction |
| ABI | ILP32 | 32비트 address·register와 일관되고 공식 호출 규약 사용 가능 |
| 실행 | TypeScript interpreter | 교육 event 계측, undo, 디버깅과 테스트가 쉬움 |
| 실행 위치 | Dedicated Web Worker | main thread 보호와 강제 종료 가능 |
| 상태 전달 | `Snapshot + StepDelta` | UI와 core 결합을 줄이고 time travel을 일관되게 구현 |
| memory | 32-bit logical space + sparse 4 KiB pages | 실제 주소 개념을 유지하면서 자원을 제한 |
| progress | local-first | 로그인 없이 학습 가능, privacy와 MVP 범위 단순화 |
| 설명 생성 | deterministic template | trace에서 재현 가능하며 오답·접근성 문장을 안정적으로 생성 |
| 시각 디자인 | 차분한 실험실 | “해커 터미널” 고정관념과 과도한 장식을 피함 |
| 콘텐츠 언어 | 한국어 설명 + 영어 공식 용어 | 이해와 공식 자료 전이를 동시에 지원 |

## 7. 제품 영역과 페이지

### 7.1 공개 페이지

- 홈: 즉시 실행 가능한 3–5줄 데모, 제품 설명, 추천 시작점
- 배우기: 단계별 course와 lesson
- 연습: 개념별·오개념별 exercise
- 플레이그라운드: 자유 코드, example, share/export
- 명령어 사전: canonical instruction, pseudo, directive, encoding
- 용어 사전: 한·영 glossary와 범위 배지
- 진도: concept mastery, 복습 예정, 반복 오개념
- 출처와 버전: spec profile, 콘텐츠 source, license, app version
- 접근성 도움말: keyboard shortcut, screen reader mode, motion 설정

### 7.2 핵심 학습 화면

- 설명·문제 panel
- source editor
- source ↔ expanded instruction ↔ encoding view
- execution controls
- register view
- memory view
- stack overlay
- trace timeline
- deterministic console
- prediction input과 explanation checkpoint
- hint ladder와 error card

자세한 화면 규칙은 [UX_AND_ACCESSIBILITY.md](./product/UX_AND_ACCESSIBILITY.md)를 따른다.

## 8. MVP 범위

### 8.1 Machine

- RV32I educational subset 20–25개 instruction부터 시작
- canonical instruction과 제한된 pseudo-instruction
- labels와 `.text`, `.data`, `.byte`, `.half`, `.word`, `.string`, `.align`
- register, PC, sparse memory, initialized-byte shadow
- `.text`, `.rodata`, `.data`, `.bss`, heap, stack, MMIO region
- strict alignment trap
- console/input/exit virtual syscall
- breakpoint와 memory-write watchpoint
- deterministic Step, Run, Pause, Back, Reset, seek

### 8.2 Learning

- 모듈 0–6
- 20–25개 micro-lesson
- 40–60개 exercise
- 배열 합계와 ASCII 변환 capstone
- prediction, Parsons, fill, repair, write, transfer 문제
- 최소 3단계 hint ladder
- local concept mastery와 복습 queue
- 한국어 instruction·glossary reference

### 8.3 UX

- desktop·tablet·mobile responsive layout
- keyboard-only 핵심 흐름
- screen reader Step summary
- light/dark theme
- reduced motion과 animation off
- color 외에 text·icon·border를 사용한 diff
- accessible memory table과 address jump
- local progress export/reset

### 8.4 운영

- 정적 front-end 배포 가능
- 서버 계정·개인정보 없이 core experience 제공
- content와 app version 분리
- error telemetry는 opt-in 또는 privacy-preserving 방식만 검토

## 9. 구현 workstream

### W1. Domain contract와 콘텐츠 기반

산출물:

- `MachineProfile` v1
- glossary와 scope badge
- curriculum map
- lesson·exercise schema
- source registry와 license policy
- misconception taxonomy

선행 의존성: 없음

종료 조건:

- 같은 용어가 문서·UI·event schema에서 같은 의미로 사용됨
- ISA, ABI, VM policy를 구분하는 예시가 승인됨
- 첫 8–10개 lesson outline과 15–20개 exercise가 schema로 표현 가능

### W2. Parser와 assembler

산출물:

- lexer와 parser
- two-pass label resolution
- canonical instruction encoder
- data directive assembler
- pseudo expansion
- source span과 diagnostics
- assembled image와 symbol table

선행 의존성: `MachineProfile`, 지원 문법 목록

종료 조건:

- 지원 instruction이 GNU/LLVM reference encoding과 일치
- duplicate·undefined label, immediate range, operand type 오류가 계층적으로 보고됨
- pseudo 하나가 여러 instruction으로 확장될 때 source mapping이 보존됨

### W3. Machine core와 memory

산출물:

- `MachineState`
- 32-bit integer helper
- register file와 x0 invariant
- sparse `MemoryBus`
- permission과 trap
- RV32I execution semantics
- virtual I/O

선행 의존성: `MachineProfile`, assembler output format

종료 조건:

- instruction unit test와 memory boundary test 통과
- Sail·Spike와 선택 trace가 일치
- 동일 input이 동일 state hash를 생성

### W4. Trace와 time travel

산출물:

- access recorder
- `StepDelta`, `TraceBatch`, `Snapshot`, `HostEvent`
- inverse delta
- checkpoint와 seek
- breakpoint·watchpoint
- history budget과 eviction

선행 의존성: W3

종료 조건:

- `state0 → step → undo === state0`
- `checkpoint → replay` state hash 일치
- rewind 후 실행하면 기존 future history가 제거되고 새 `runId`가 생성됨

### W5. Worker protocol

산출물:

- message command schema
- `runId`, `commandId`, `seq`
- chunked execution
- heartbeat와 watchdog
- stale message discard
- snapshot resync

선행 의존성: W3, W4

종료 조건:

- infinite loop가 UI를 멈추지 않음
- reset 후 늦게 도착한 이전 batch가 UI에 적용되지 않음
- budget 초과가 일관된 `Paused` event로 보고됨

### W6. State visualization

산출물:

- register table
- memory hex/ASCII/lens
- source·expanded instruction·encoding
- PC와 control-flow
- stack overlay
- trace timeline
- effective-address explanation

선행 의존성: W4, W5

종료 조건:

- UI가 core internal state를 직접 참조하지 않음
- 한 Step의 모든 변화가 text summary와 visual diff로 일치
- 32-bit address space를 표시하면서 DOM row 수가 bounded됨

### W7. Learning engine

산출물:

- lesson renderer
- prediction prompt
- exercise sandbox
- state/invariant grader
- deterministic random seeds
- hint ladder
- misconception detection
- mastery evidence

선행 의존성: W1, W4, W6

종료 조건:

- 동일한 정답 문자열이 아니어도 success predicate를 만족하는 해법을 인정
- 실패 시 최소 반례와 trace를 제시
- 정답 열람과 독립 해결을 다른 mastery evidence로 기록

### W8. Content production

산출물:

- 모듈 0–6 lesson
- 40–60개 exercise
- capstone 2개
- instruction·glossary reference
- delayed review variants
- source and attribution metadata

선행 의존성: W1, W7 schema 안정화

종료 조건:

- 모든 lesson에 objective, prerequisite, prediction, independent task, source가 있음
- 모든 exercise에 deterministic seed, success predicate, invariants, instruction budget가 있음
- 외부 자료의 번역·개작 권한이 불명확한 문항은 포함하지 않음

### W9. Accessibility와 responsive QA

산출물:

- keyboard interaction
- focus management
- screen reader summary
- reduced motion
- non-color state cues
- mobile tab layout
- zoom·reflow support

선행 의존성: W6, W7

종료 조건:

- keyboard-only로 lesson 시작부터 제출까지 완료
- VoiceOver+Safari와 NVDA+Chrome 또는 Firefox에서 핵심 task 수행
- 320 CSS px reflow, 200–400% zoom, high contrast에서 기능 손실 없음

### W10. Verification와 release

산출물:

- unit, property, differential, protocol, security, accessibility test
- browser matrix
- source/license audit
- release checklist
- versioned profile and changelog

선행 의존성: 모든 workstream

종료 조건:

- MVP acceptance criteria 통과
- unresolved correctness 또는 accessibility blocker 없음
- 출처·license·spec version 페이지가 실제 build와 일치

## 10. Tracer-bullet 구현 순서

### Tracer-bullet 0: 네 instruction 세로 slice

지원 범위:

- `addi`, `lw`, `sw`, `beq`
- register와 작은 memory
- Step, Back, Reset
- current PC와 register/memory diff
- 한 개 lesson: 주소인가 값인가

목적:

- parser→assembler→core→delta→UI→prediction의 전체 경로를 조기에 검증
- 추상 interface와 event schema의 결함을 구현 초기에 발견

종료 조건:

- 초보자 5명이 next-state prediction부터 독립 문제까지 완료
- 한 Step 설명과 실제 patch가 항상 일치
- keyboard와 screen reader로 같은 과정을 완료

### Tracer-bullet 1: memory lesson vertical slice

- `lb/lbu/lh/lhu/lw`, `sb/sh/sw`
- initialized shadow
- endian lens
- effective-address explanation
- misalignment trap
- signed-load transfer task

### Tracer-bullet 2: branch와 trace

- compare·branch
- loop timeline
- breakpoint
- checkpoint·seek
- instruction budget

### Tracer-bullet 3: function과 stack

- `jal/jalr`
- ILP32 register roles
- stack overlay
- ABI invariant grader
- caller/callee-saved bug repair

### Tracer-bullet 4: content-complete MVP

- 모듈 0–6
- local mastery
- delayed review
- reference pages
- capstone
- release QA

## 11. Milestone

### M0. 계약과 위험 검증

포함:

- machine profile
- glossary
- event schema
- 4-instruction prototype
- accessibility memory-table prototype

종료 조건:

- 핵심 vertical slice가 동작하고 사용자 테스트에서 address/value 차이를 설명할 수 있음

### M1. 학습 프로토타입

포함:

- 모듈 0–3
- 8–10개 lesson
- 15–20개 exercise
- Step/Back, memory diff, 3단계 hint

종료 조건:

- 처음 보는 load/store transfer task에서 baseline보다 개선됨

### M2. MVP

포함:

- 모듈 0–6
- 20–25개 lesson
- 40–60개 exercise
- capstone 2개
- local progress
- WCAG 핵심 QA
- official reference differential test

종료 조건:

- 아래 MVP acceptance criteria 전부 충족

### M3. Beta

포함:

- 함수·ILP32 심화
- pseudo/directive·encoding
- C `-O0/-O2` 비교
- 7일 delayed review
- 선택형 account sync 조사

종료 조건:

- 실제 학습 cohort에서 retention과 transfer 개선 근거 확보

### M4. Advanced

후보:

- RV32M과 전체 RV32I
- ELF·linking·debug info
- pipeline·cache
- AArch64·x86-64 전이
- 교사용 assignment bundle
- content authoring tool

## 12. MVP acceptance criteria

### 정확성

- 지원하는 instruction의 semantics와 encoding이 pinned reference와 일치한다.
- x0, overflow wrap, signed/unsigned comparison, shift, sign extension, endian test를 통과한다.
- 선택한 RV32I Architecture Tests와 differential traces를 통과한다.
- Step/undo와 checkpoint/replay가 bit-identical하다.

### 학습

- 학습자가 실행 전에 prediction을 제출할 수 있다.
- 문제는 final state와 invariant를 기준으로 여러 해법을 인정한다.
- hint 사용과 독립 해결을 별도로 기록한다.
- 최소 두 가지 randomized initial state를 통과해야 mastery evidence가 된다.
- 시각화를 숨긴 transfer task가 존재한다.

### UX

- Step, Back, Run, Pause, Reset을 keyboard와 pointer로 사용할 수 있다.
- code, register, memory, trace가 같은 `seq` 상태를 표시한다.
- mobile에서 핵심 기능이 삭제되지 않는다.
- 빠른 Run이 main thread를 장시간 block하지 않는다.

### 접근성

- color 외의 cue가 모든 상태 변화에 존재한다.
- memory와 register 정보를 semantic DOM 또는 동등한 text form으로 탐색할 수 있다.
- reduced-motion 환경에서 의미 손실이 없다.
- screen reader가 Step summary를 받을 수 있고 Run 중 과도하게 발표하지 않는다.

### 보안·자원

- learner source를 `eval`, `Function`, dynamic import로 실행하지 않는다.
- source, token, label, expression depth, page, instruction, history budget가 적용된다.
- worker hang을 terminate하고 안전하게 reset할 수 있다.
- virtual syscall은 allowlist만 제공한다.

### 콘텐츠·license

- 모든 lesson과 exercise에 source metadata가 있다.
- 직접 작성한 콘텐츠와 외부 자료의 license 범위가 분리되어 있다.
- ND·all-rights-reserved 자료를 번역·개작한 콘텐츠가 없다.
- 앱의 실제 machine profile과 source page가 일치한다.

## 13. 의존성 지도

```text
Glossary + MachineProfile
        ├── Assembler ── Machine Core ── Trace/History ── Worker ── Visualization
        │                                             └──────────── Learning Engine
        └── Curriculum + Content Schema ─────────────────────────── Content

Visualization + Learning Engine ── Accessibility QA
All workstreams ────────────────── Verification + Release
```

핵심 병목은 UI가 아니라 `MachineProfile`, event schema, content schema다. 이 계약이 불안정하면 UI·lesson·test가 동시에 재작업된다.

## 14. 데이터와 version 전략

- `machineProfileVersion`: ISA subset, memory map, trap, syscall 계약
- `protocolVersion`: Worker command와 event schema
- `contentSchemaVersion`: lesson·exercise 구조
- `contentVersion`: 실제 lesson bundle
- `appVersion`: UI와 execution build

학습 attempt에는 위 version을 함께 저장해 나중에 규칙이 바뀌어도 결과를 해석할 수 있게 한다. incompatible change는 silent migration하지 않고 reset 또는 explicit migration을 제공한다.

## 15. Privacy와 analytics

MVP는 계정이 없는 local-first를 기본으로 한다.

로컬에 저장할 수 있는 정보:

- lesson completion
- attempt count
- hint level
- concept mastery
- review schedule
- misconception tag
- 사용자 설정

서버 analytics를 도입한다면 다음 원칙을 따른다.

- 필요한 event만 수집
- source code와 console input은 기본적으로 전송하지 않음
- 개인 식별 정보와 학습 event를 불필요하게 결합하지 않음
- retention·transfer 개선에 쓰이지 않는 vanity metric은 수집하지 않음
- export와 reset 제공
- 문서화된 retention policy

## 16. 위험 등록부

| 위험 | 가능성/영향 | 조기 신호 | 대응 |
|---|---|---|---|
| 잘못된 emulator가 오개념을 가르침 | 중/매우 큼 | reference trace 불일치 | Sail·Spike·arch-test differential CI |
| 시각화가 수동 관찰을 강화 | 높음/큼 | prediction 없이 Step 반복 | prediction gate, explanation, transfer task |
| 범위 확장으로 MVP 지연 | 높음/큼 | M/C/ELF/pipeline 요구 유입 | ADR과 비목표, tracer-bullet exit criteria |
| UI와 core 상태 불일치 | 중/큼 | reset 후 stale event | authoritative Worker, runId/seq, snapshot resync |
| history가 memory를 소진 | 중/큼 | 긴 loop에서 급증 | byte budget, checkpoint, eviction, aggregate mode |
| 대형 code가 UI를 정지 | 중/큼 | Run 시 input 지연 | Worker chunk, render batching, watchdog |
| source parser 공격·DoS | 중/큼 | deep expression·많은 label | input limit, AST depth, no eval, fuzz test |
| 접근성을 나중에 추가 | 높음/큼 | canvas-only prototype | first tracer부터 semantic table과 text trace |
| 무료 자료를 오픈 license로 오인 | 중/큼 | 번역·스크린샷 포함 | source registry와 content review gate |
| simulator syscall을 Linux로 오해 | 높음/중 | lesson 설명 혼합 | VM policy badge와 comparison lesson |
| 모바일에서 panel 과밀 | 높음/중 | horizontal page scroll | task-focused tab, virtualized view, user test |
| 콘텐츠 제작이 code보다 늦음 | 높음/큼 | empty shell만 완성 | schema-first, content workstream 병행 |
| mastery가 클릭 수로 변질 | 중/큼 | 높은 completion, 낮은 transfer | randomized independent task와 delayed review |

## 17. 검증 계획

### 자동 검증

- parser·assembler unit test
- encoder/decoder round-trip
- instruction semantic property test
- memory boundary·permission·alignment
- pseudo source mapping
- step/undo invariant
- checkpoint/replay hash
- protocol stale-message test
- instruction/memory/history budget
- malformed source fuzzing
- accessibility lint와 component test
- visual regression

### 수동 검증

- beginner usability
- expert trace review
- keyboard-only
- VoiceOver+Safari
- NVDA+Chrome 또는 Firefox
- 320 CSS px reflow
- 200–400% zoom
- dark/light/high-contrast
- reduced motion
- Chromium, Firefox, Safari

### 학습 효과 검증

- 사전·사후에 표면이 다른 state-tracing 문제 사용
- 첫 시도 정확도
- 최대 hint level
- 두 개 이상 randomized input 성공
- 7일 뒤 delayed transfer
- misconception recurrence
- 시각화 없이 explanation 가능 여부

## 18. 성공 지표

North-star는 “시뮬레이터 없이도 새로운 작은 프로그램의 상태 변화를 설명할 수 있는 학습자 비율”이다.

보조 지표:

- 첫 lesson의 prediction 제출과 완료율
- independent solution rate
- hint 없이 transfer task를 통과한 비율
- address/value, endian, sign extension 오개념 재발률
- error 이후 full answer 없이 복구한 비율
- 7일 retention
- keyboard·screen reader 핵심 task 성공률
- worker crash·budget pause·state desync 빈도

체류 시간, Run 클릭 수, instruction 실행 수는 진단 자료일 뿐 학습 성공 지표로 사용하지 않는다.

## 19. 초기 issue 분해안

1. `MachineProfile v1` 문서와 fixture
2. RV32I integer helper와 register file
3. sparse paged `MemoryBus`
4. lexer·parser 기본 문법
5. `addi` assembler와 execution
6. `StepDelta` v1과 text trace
7. Worker command·snapshot
8. register table
9. memory range API와 table
10. Step/Back vertical slice
11. `lw/sw`와 effective-address explanation
12. prediction activity schema
13. address/value lesson
14. keyboard·screen-reader vertical slice
15. branch·loop·instruction budget
16. checkpoint·seek
17. pseudo expansion
18. function·stack·ABI
19. state/invariant grader
20. local mastery와 review queue
21. source registry·license page
22. Sail/Architecture Test differential harness
23. content-complete MVP
24. cross-browser·accessibility release gate

각 issue는 하나의 end-to-end observable behavior를 우선하며, parser만 또는 UI만 크게 완성하는 수평 분할을 피한다.

## 20. 다음 행동

1. [GLOSSARY.md](./GLOSSARY.md)를 팀 기준 용어로 승인한다.
2. [ADR-0001](./decisions/ADR-0001-primary-isa-and-runtime.md)의 재검토 조건을 확인한다.
3. [RUNTIME_AND_MEMORY_VISUALIZATION.md](./architecture/RUNTIME_AND_MEMORY_VISUALIZATION.md)의 `MachineProfile`과 event schema를 구현 가능한 수준으로 고정한다.
4. Tracer-bullet 0을 issue 5–6개로 세분화한다.
5. 동시에 첫 lesson과 accessibility test script를 작성한다.
6. beginner 5명 대상 테스트를 예약한 뒤 prototype을 구현한다.

구현 완료가 아니라 학습 위험을 가장 빨리 검증하는 순서가 우선이다.
