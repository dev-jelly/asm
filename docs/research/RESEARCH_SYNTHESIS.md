# 어셈블리 학습 사이트 조사 종합

- 조사 기준일: 2026-07-24
- 범위: 학습법, 첫 ISA, 커리큘럼, 시각화, 브라우저 실행, 선행 도구, 접근성, 보안, 콘텐츠 라이선스

## 1. 결론

초보자용 첫 트랙은 **RV32I 기반의 machine-state-first 과정**이 가장 적합하다.

가장 중요한 학습 루프는 다음이다.

```text
예측
  → 한 instruction 실행
  → 읽은 값·계산·쓴 값 관찰
  → 틀린 mental model 설명
  → code 또는 initial state 수정
  → 새로운 맥락의 transfer task
  → 지연 복습
```

제품 차별점은 화려한 memory animation 자체가 아니다. 시각화가 prediction과 explanation을 요구하고, 최종적으로 시각화 없이도 machine state를 추적하게 만드는 것이 차별점이다.

## 2. 왜 RV32I인가

### 교육 장점

- base integer ISA가 작다.
- load/store와 산술이 분리된다.
- C extension 제외 시 instruction이 32비트다.
- condition flags 없이 branch operand를 직접 비교한다.
- register와 address가 32비트라 memory lens와 일관된다.
- 공식 명세, ABI, opcodes, Sail model, architecture tests가 공개되어 있다.
- Venus, Ripes, CREATOR, QtRvSim 등 교육 도구가 풍부하다.

### 주의점

- 32개 register는 초보자에게 많으므로 ABI role로 grouping한다.
- simulator `ecall`을 Linux syscall로 설명하면 안 된다.
- 구체적인 memory map은 ISA가 아니라 실행 환경 정책이다.
- misaligned access 처리는 사이트 policy임을 명시한다.
- RISC-V 전체를 지원한다고 표현하지 않고 “RV32I educational profile”이라고 한다.

## 3. ISA 대안 비교

| ISA | 강점 | 첫 과정의 문제 | 권고 |
|---|---|---|---|
| RV32I | 공개, 작고 규칙적, 실제 생태계, 검증 자료 | register가 많음 | MVP |
| AArch64 | 현대적, fixed encoding, Apple/Android | 첫 toolchain과 vendor 자료, platform 차이 | 두 번째 트랙 |
| x86-64 | PC·보안·리버싱 실용성 | variable length, flags, legacy, syntax/ABI | 고급 트랙 |
| LC-3 | 상태 공간이 작음 | word-addressed, 실제 생태계 전이 약함 | optional pre-course |
| Hack | gate→CPU 연결 | 실제 ISA와 차이 | conceptual bridge |
| 6502 | 작고 재미있음, pixel/MMIO | 현대 compiler·ABI 전이 약함 | optional playful course |
| WebAssembly | browser-native stack machine | native execution 내부 Step 관찰 어려움 | 별도 virtual ISA 과정 |

사용자의 동기가 특정 platform에 강하게 묶인 경우 직접 AArch64 또는 x86-64로 시작할 수 있지만, 일반 초보자 제품의 공통 기반은 RV32I가 낫다.

## 4. 학습법 근거의 종합

### Prediction과 active visualization

program visualization을 그냥 보는 것보다 다음 결과를 먼저 예측하게 하는 방식이 더 높은 참여와 학습 인식을 보였다는 연구가 있다. 이를 assembly Step에 직접 적용할 수 있다.

### Retrieval과 spacing

practice testing과 distributed practice는 여러 자료와 연령에서 비교적 높은 일반성을 보인다. lesson 완료 직후 반복보다 며칠 뒤 새로운 state로 다시 묻는 것이 중요하다.

### Worked example과 fading

초보자는 완전한 blank editor보다 정확한 worked example에서 시작해 지원을 점차 제거하는 편이 낫다.

### Parsons problems

code ordering은 syntax 부담을 줄이고 control flow와 program plan에 집중하게 한다. assembly에서도 label, loop, prologue 순서 문제로 활용할 수 있다.

### Self explanation

정답 확인 후 “왜”를 설명하게 해야 animation을 mental model로 변환할 수 있다. 설명은 자유 서술만 요구하지 않고 read→calculation→write 구조를 제공한다.

이 근거들은 assembly 사이트의 효과를 자동으로 보장하지 않는다. 실제 초보자를 대상으로 transfer와 delayed retention을 측정해야 한다.

## 5. 가장 좋은 개인 학습 경로

1. 하나의 ISA·syntax·ABI를 고정한다.
2. 첫날부터 짧은 instruction을 실행한다.
3. register와 memory table을 손으로 추적한다.
4. 매 Step 전에 예측한다.
5. 새 instruction은 소수만 추가한다.
6. array와 string으로 memory를 반복한다.
7. function과 stack을 실제 memory write로 추적한다.
8. C source와 compiler output을 비교한다.
9. breakpoint와 watchpoint로 bug를 찾는다.
10. simulator 없이 state를 설명한다.
11. 그 뒤 목적에 따라 AArch64, x86-64, pipeline, OS로 이동한다.

instruction manual을 처음부터 순서대로 외우거나 큰 program을 pure assembly로 쓰는 방식은 효율적이지 않다.

## 6. 추천 커리큘럼 순서

```text
첫 instruction
  → bits와 representation
  → register와 ALU
  → address와 load/store
  → branch와 loop
  → array/string/pointer
  → function/stack/ABI
  → pseudo/directive/encoding
  → C와 toolchain
  → debugging/OS boundary
  → pipeline/cache/other ISA
```

binary 이론만 여러 주 먼저 배우기보다 instruction이 state를 바꾸는 경험 속에서 representation을 도입한다.

## 7. 좋은 시각화의 조건

### 보여야 하는 것

- current PC와 instruction
- source와 expanded machine instruction
- register read/write
- memory address, bytes, width
- effective-address calculation
- little-endian byte assembly
- sign/zero extension
- branch comparison과 target
- stack pointer와 raw memory
- trace와 Back

### 보여주지 말아야 하는 방식

- 의미 없는 CPU animation
- 모든 panel의 동시 animation
- color-only change
- uninitialized memory를 항상 0으로 표시
- stack frame을 hardware fact처럼 표현
- architectural Step을 one clock이라고 표현
- simulator `ecall`을 실제 OS service라고 일반화

### 설명의 핵심

각 Step을 “읽은 것 → 계산 → 쓴 것 → 다음 PC”로 고정한다.

## 8. 선행 도구에서 배울 점

### Venus

- single-step undo
- source/machine code 병치
- breakpoint
- memory view
- calling-convention checker 사례

가장 가까운 MVP benchmark다.

### Ripes

- datapath
- pipeline
- cache
- MMIO
- C와 assembly 연결

고급 시각화 benchmark로 적합하다.

### CREATOR

- modern browser UI
- 여러 architecture
- register/memory/stack
- Sail integration 방향

기능 범위가 가장 비슷하지만 LGPL 조건을 검토해야 한다.

### emulsiV

- fetch/decode/ALU/memory/PC를 작은 단계로 분해하는 시각화

### ASM Visualizer

- arithmetic/function/full-program mode를 단계적으로 제공
- step forward/back
- stack와 register

초보자 scaffolding 구조가 유용하다.

### Easy 6502

- 첫 페이지의 embedded simulator
- 즉각적인 memory-mapped pixel 결과
- 작은 exercise와 game으로 확장

ISA보다 상호작용 설계를 참고할 가치가 크다.

### Compiler Explorer

- high-level source와 generated assembly의 즉각적 대응
- optimization level 비교

후반 C bridge lesson에 적합하다.

## 9. Browser runtime 비교

| 방식 | 관찰성 | 비용 | 판단 |
|---|---|---|---|
| TypeScript interpreter | 매우 높음 | own core 유지 | MVP |
| C/Rust emulator→Wasm | 계측 수정 필요 | 높은 초기 통합 | 후속 |
| native Wasm learner code | 내부 operand Step 노출 어려움 | 중간 | 별도 과정 |
| iframe | DOM 격리만 도움 | CPU budget 해결 못함 | 단독 사용 부적합 |
| server QEMU/container | 실제 toolchain | 운영·보안·지연 큼 | MVP 제외 |

TypeScript는 성능이 아니라 instrumentation과 time travel 때문에 선택한다. UI와 core 사이에 adapter를 두어 교체 가능하게 해야 한다.

## 10. Real-time의 정의

첫 버전에서 real-time은 다음을 뜻한다.

- 한 retired instruction 후 architectural state 즉시 갱신
- Step mode에서 모든 relevant read/write 표시
- Run mode에서 event는 보존하되 UI는 frame 단위 batch
- Back과 seek 가능

pipeline stage와 clock cycle은 별도 고급 model이다. architectural state event와 한 protocol에 혼합하지 않는다.

## 11. 흔한 오개념과 설계 대응

| 오개념 | 대응 |
|---|---|
| assembly는 하나 | ISA·syntax·ABI·VM badge |
| source=machine code | source→pseudo expansion→encoding |
| address=value | address/value 선택 문제 |
| memory에 type 저장 | raw bytes + lens |
| signedness가 저장 | same bits dual interpretation |
| endian은 bit reversal | address-by-byte puzzle |
| load는 move | memory unchanged cue |
| stack은 특별한 memory | raw memory overlay |
| call이 자동 push | `jal`과 prologue 분리 |
| pseudo는 opcode | expansion badge |
| instruction=cycle | model scope label |
| simulator=Linux | EEI boundary lesson |

## 12. 콘텐츠와 license 결론

### 개작에 유리

- Easy RISC-V: CC0
- RISC-V Learn: CC0
- Easy 6502: CC BY 4.0
- RISC-V ISA Manual: CC BY 4.0
- RISC-V psABI: CC BY 4.0
- Venus/Ripes code: MIT
- Compiler Explorer code: BSD-2-Clause

### 조건 검토

- CREATOR: LGPL-3.0
- emulsiV: MPL-2.0
- QtRvSim: GPL-3.0
- Arm ABI: CC BY-SA 4.0

### 링크·사실 참고 중심

- Dive Into Systems: CC BY-NC-ND 4.0
- RISC-V Assembly Programming book: free access와 reuse가 다름
- Nand2Tetris: nonprofit educational terms
- Intel/AMD/Arm vendor manuals
- commercial textbooks
- K-MOOC/KOCW course assets

무료 열람은 번역·개작·상업 사용 허가가 아니다.

## 13. 접근성 조사 결론

동적 visualization은 접근성을 별도 layer로 추가해서 해결할 수 없다.

필수:

- semantic memory table
- keyboard controls
- Step text summary
- Run announcement throttling
- reduced motion
- pause
- non-color cues
- address jump
- zoom/reflow
- Canvas/SVG와 동기화된 DOM

manual VoiceOver/NVDA test가 필요하다.

## 14. 보안 조사 결론

learner assembly는 code가 아니라 untrusted data로 처리한다.

- no eval
- Worker
- source/AST limits
- instruction/memory/history budget
- watchdog
- deterministic syscall allowlist
- no host network/files/clock/random
- CSP
- output escaping
- dependency pinning
- fuzzing

Wasm sandbox만으로 infinite loop와 resource exhaustion은 해결되지 않는다.

## 15. 제품 전략

### 첫 vertical slice

`addi`, `lw`, `sw`, `beq`와 prediction, Step, Back, register/memory diff만 구현한다.

### 검증할 가장 큰 가설

1. 초보자가 visual diff를 단순히 보는 대신 prediction에 참여하는가?
2. address/value와 load width를 더 정확하게 설명하는가?
3. Back이 bug의 최초 원인을 찾는 데 도움이 되는가?
4. mobile과 assistive technology에서도 같은 학습이 가능한가?
5. event schema가 lesson, UI, grader, explanation을 모두 지원하는가?

### 후속 확장

- function/ABI
- C bridge
- RV32M
- pipeline/cache
- AArch64
- x86-64
- classroom

## 16. 성공의 정의

사이트가 성공했다는 뜻은 사용자가 오래 머물렀다는 것이 아니다.

- 새로운 state-tracing problem을 해결
- multiple randomized state에서 성공
- hint 없이 해결
- 7일 뒤 기억
- misconception recurrence 감소
- visualizer 없이 설명
- keyboard/screen-reader로 동일 task 완료

## 17. 주요 연구·공식 출처

- [RISC-V ISA](https://docs.riscv.org/reference/isa/unpriv/unpriv-index.html)
- [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)
- [RISC-V Learn](https://github.com/riscv/learn)
- [Easy RISC-V](https://easyriscv.dram.page/)
- [PRIMM](https://doi.org/10.1145/3137065.3137084)
- [Effective learning techniques](https://doi.org/10.1177/1529100612453266)
- [Program visualization prediction study](https://pmc.ncbi.nlm.nih.gov/articles/PMC6302837/)
- [Parsons problems and learning theories](https://doi.org/10.1145/3769994.3770032)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

세부 catalog와 이용 조건은 [RESOURCE_CATALOG.md](./RESOURCE_CATALOG.md)에 기록한다.
