# 어셈블리 학습 자료·도구 카탈로그

> 최종 확인일: 2026-07-24  
> 목적: ASM/LAB의 커리큘럼, 설명문, 실습, 런타임 검증, 참고 문헌을 만들 때 사용할 원자료를 한곳에서 관리한다.  
> 주의: 이 문서는 링크 모음이 아니라 **사용 목적·신뢰도·재사용 조건·제품 반영 방식**까지 기록하는 소스 레지스트리다.

## 1. 이 카탈로그를 사용하는 법

자료는 다음 네 등급으로 다룬다.

| 등급 | 의미 | 제품에서 허용할 기본 행동 |
|---|---|---|
| A — 각색 가능 | 명시적 오픈 라이선스가 있고 조건을 충족할 수 있음 | 출처·라이선스를 표시하고 독자적으로 재구성 |
| B — 조건부 | 라이선스 또는 의존성 범위를 추가 확인해야 함 | 아이디어·검증용으로만 사용하고 배포 전 법적 검토 |
| C — 링크 전용 | 비영리·변경금지·상업 출판물·불명확한 조건 | 요약도 자체 문장으로 쓰고 원문·도표·문제는 복제하지 않음 |
| D — 실행 검증 | 정답 판정이나 호환성 비교를 위한 도구 | 콘텐츠 원문이 아니라 테스트 오라클 또는 참고 구현으로 사용 |

모든 신규 소스는 아래 필드를 가진 레코드로 추가한다.

```yaml
id: stable-kebab-id
title: 원제
url: 정규 URL
kind: spec | course | textbook | paper | simulator | tool | manual
authority: primary | official-course | peer-reviewed | community
scope: 어떤 결정을 뒷받침하는가
license: SPDX 또는 원문 표기
reuse: A | B | C | D
language: ko | en | ...
last_verified: YYYY-MM-DD
notes: 버전, 한계, 제품 반영 방식
```

다음 문서와 함께 읽는다.

- 제품·개발 전체 계획: [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md)
- 학습 설계: [LEARNING_AND_CONTENT_DESIGN.md](../product/LEARNING_AND_CONTENT_DESIGN.md)
- 메모리 시각화 구조: [RUNTIME_AND_MEMORY_VISUALIZATION.md](../architecture/RUNTIME_AND_MEMORY_VISUALIZATION.md)
- 조사 결론: [RESEARCH_SYNTHESIS.md](./RESEARCH_SYNTHESIS.md)

## 2. 가장 먼저 읽을 핵심 묶음

초기 제작자가 모든 자료를 읽을 필요는 없다. 아래 12개를 순서대로 읽으면 MVP에 필요한 기준선이 생긴다.

1. RISC-V Unprivileged ISA의 RV32I 장
2. RISC-V Assembly Programmer’s Manual
3. RISC-V ELF psABI의 레지스터·호출 규약 장
4. CS61C의 RISC-V 및 CALL 노트
5. Venus instruction/reference 문서
6. Dive Into Systems의 어셈블리·메모리 설명과 ASM Visualizer
7. Ripes의 실행·파이프라인·메모리 시각화
8. PRIMM 연구
9. 검색 연습과 분산 연습 연구
10. Parsons problem 연구
11. Python Tutor의 실행 이력 표현
12. WCAG 2.2 및 ARIA live-region 지침

## 3. RISC-V 규격과 정답 기준

### 3.1 규범 문서

| ID | 자료 | 용도 | 라이선스·사용 등급 | 제품 반영 |
|---|---|---|---|---|
| `riscv-ratified-specs` | [RISC-V Ratified Specifications](https://riscv.org/specifications/ratified/) | 실제 ratified 버전의 기준점 | 공개 열람, 개별 문서 조건 확인 / C | 런타임이 따르는 버전을 릴리스 노트에 고정 |
| `riscv-isa-manual` | [RISC-V ISA Manual 저장소](https://github.com/riscv/riscv-isa-manual) | RV32I 의미론, 인코딩, 예외 | CC BY 4.0 / A | 명령 설명을 그대로 복사하지 않고 초보자 문장으로 각색·출처 표시 |
| `riscv-unprivileged-html` | [Unprivileged ISA HTML snapshot](https://riscv.github.io/riscv-isa-manual/snapshot/unprivileged/) | 빠른 검색과 절 링크 | CC BY 4.0 / A | 각 명령 레퍼런스의 “규격 보기” 링크 |
| `riscv-spec-library` | [RISC-V 공식 사양 라이브러리](https://docs.riscv.org/reference/isa/) | 공식 PDF·HTML 탐색 | 문서별 표기 / C | 버전 확인용 허브 |
| `riscv-asm-manual` | [RISC-V Assembly Programmer’s Manual](https://github.com/riscv-non-isa/riscv-asm-manual) | 문법, 지시어, pseudo instruction | CC BY 4.0 / A | 파서 문법과 오류 메시지의 근거 |
| `riscv-elf-psabi` | [RISC-V ELF psABI](https://github.com/riscv-non-isa/riscv-elf-psabi-doc) | ABI 이름, 호출 규약, 스택 정렬, 재배치 | CC BY 4.0 / A | `ra`, `sp`, `a0`, caller/callee-saved 설명 |
| `riscv-opcodes` | [riscv-opcodes](https://github.com/riscv/riscv-opcodes) | opcode·필드의 기계 판독 원천 | BSD-3-Clause / A | 인코딩 테이블 생성 후보. 버전을 고정하고 생성물 provenance 기록 |

**MVP 적용 원칙**

- RV32I만 필수로 지원하고 `M`, `C`, CSR, privilege는 후속 모듈로 분리한다.
- `x0` 고정, XLEN=32 wraparound, little-endian, 정렬 정책을 테스트로 잠근다.
- 실제 하드웨어의 모든 trap을 흉내 내기보다 “교육용 머신 프로필”과 규격 차이를 UI에 명시한다.
- pseudo instruction은 파서 단계에서 base instruction으로 낮춘 뒤, UI에는 원문과 실제 실행 명령을 모두 보여준다.

### 3.2 형식 모델·호환성 시험

| ID | 자료 | 용도 | 라이선스·등급 | 주의 |
|---|---|---|---|---|
| `sail-riscv` | [Sail RISC-V model](https://github.com/riscv/sail-riscv) | 공식에 가까운 실행 의미론 비교 | BSD-2-Clause / D | 브라우저 런타임에 직접 포함하기보다 명령 의미론 검증에 사용 |
| `riscv-arch-test` | [RISC-V Architectural Test Framework](https://github.com/riscv-non-isa/riscv-arch-test) | 아키텍처 준수 시험 | Apache-2.0 / D | 교육용 메모리 맵에 맞는 harness가 별도로 필요 |
| `spike` | [Spike ISA Simulator](https://github.com/riscv-software-src/riscv-isa-sim) | reference simulator와 결과 비교 | BSD-3-Clause / D | OS·환경 호출 차이를 제외한 순수 명령 결과를 비교 |
| `riscv-tests` | [riscv-tests](https://github.com/riscv-software-src/riscv-tests) | 회귀 테스트 입력과 예제 | BSD-3-Clause / D | 현재 권장 준수 체계는 arch-test인지 함께 확인 |
| `riscv-formal` | [riscv-formal](https://github.com/SymbioticEDA/riscv-formal) | 명령 인터페이스·형식 검증 개념 | ISC / D | MVP 필수는 아니며 런타임 정확도 강화 단계에서 참고 |

## 4. RISC-V 학습 자료

### 4.1 공개 강좌와 대학 자료

| ID | 자료 | 대상·강점 | 재사용 판단 | ASM/LAB 활용 |
|---|---|---|---|---|
| `linux-foundation-lfd117x` | [Foundations of RISC-V Assembly Programming (LFD117x)](https://training.linuxfoundation.org/training/foundations-of-risc-v-assembly-programming-lfd117x/) | Linux 환경에서 실습하려는 입문자; 도구 설치부터 프로그램 작성 | 강좌 콘텐츠 라이선스 별도 확인 / C | 외부 심화 과정 링크, 목차 범위 비교 |
| `ost2-arch1005` | [OpenSecurityTraining2 Architecture 1005](https://ost2.fyi/Arch1005) | 역공학·보안 관점의 장시간 RISC-V 과정 | 사이트 조건 확인 / C | 기본기 이후 보안 트랙으로 연결 |
| `cs61c-notes` | [UC Berkeley CS61C Course Notes](https://notes.cs61c.org/) | 수 표현→C→RISC-V→호출→CPU의 수직 연결 | CC BY-NC-ND 4.0 / C | 원문·도표는 복제하지 않고 구조만 비교; 외부 읽기 링크 |
| `cs61c-course` | [CS61C 공개 강좌 사이트](https://cs61c.org/) | 강의, lab, 프로젝트, reference | 학기별 조건 확인 / C | 과제 난이도와 선행지식 벤치마크 |
| `cs61c-resources` | [CS61C Resources](https://cs61c.org/sp25/resources/) | Venus reference와 RISC-V reference card 진입점 | 각 자료별 조건 / C | 명령 레퍼런스 교차 확인 |
| `cornell-cs3410` | [Cornell CS 3410](https://www.cs.cornell.edu/courses/cs3410/) | ISA와 컴퓨터 구조를 함께 다루는 공개 수업 | 학기별 조건 확인 / C | datapath·calling convention 심화 자료 |
| `riscv-ale` | [RISC-V ALE Exercise Book](https://riscv-programming.org/ale/) | 단계적 assembly exercise와 자동 채점 아이디어 | 저장소 라이선스 재확인 / B | 문제 유형·진도 설계 비교, 문항 복제 금지 |

### 4.2 보조 교재

| ID | 자료 | 강점 | 라이선스·등급 | 채택 방식 |
|---|---|---|---|---|
| `riscv-reader` | [The RISC-V Reader](http://www.riscvbook.com/) | ISA 설계 배경과 명령군 개괄 | 상업 출판물 / C | 도서 추천과 사실 교차 확인 |
| `cod-riscv` | [Computer Organization and Design, RISC-V Edition](https://www.elsevier.com/books/computer-organization-and-design-risc-v-edition/patterson/978-0-12-820331-6) | 하드웨어/소프트웨어 인터페이스의 표준적 설명 | 상업 출판물 / C | 심화 독서 경로; 문제·그림 복제 금지 |
| `programming-riscv` | [Programming with 64-Bit RISC-V Assembly Language](https://github.com/Apress/programming-with-64-bit-risc-v-assembly-language) | 긴 프로그램·도구 체인 예제 | 저장소·책 조건 분리 확인 / B/C | RV64 심화 트랙 참고, MVP의 RV32I와 혼동 금지 |

## 5. 어셈블리·시스템 개념을 잇는 자료

| ID | 자료 | 왜 유용한가 | 재사용 판단 | 제품 반영 |
|---|---|---|---|---|
| `dive-into-systems` | [Dive Into Systems](https://diveintosystems.cs.swarthmore.edu/) | C, 이진수, 어셈블리, 메모리, OS를 초보자 언어로 연결 | CC BY-NC-ND 4.0 / C | 링크 전용. 문장·예제·도표를 변형해 재사용하지 않음 |
| `asm-visualizer` | [Dive Into Systems — ASM Visualizer 소개](https://diveintosystems.cs.swarthmore.edu/) | 전진/후진, 레지스터·스택 변화, 초급/함수/전체 프로그램 모드 | 서비스·소스 조건 별도 / C | “점진적 UI 공개”와 step-back UX 비교 |
| `nand2tetris` | [Nand2Tetris](https://www.nand2tetris.org/) | 게이트에서 머신·VM·언어까지 구축하는 constructionist 경로 | 자료별 사용 조건 / C | “직접 만들어 이해하기” 심화 트랙 |
| `nand2tetris-web-ide` | [Nand2Tetris Web IDE](https://nand2tetris.github.io/web-ide/) | 설치 없는 실행과 하드웨어 시뮬레이션 | 저장소 조건 확인 / B | 브라우저 우선 실습의 선례 |
| `easy6502` | [Easy 6502](https://skilldrick.github.io/easy6502/) | 짧은 설명과 즉시 실행 가능한 6502 실습 | 사이트·저장소 라이선스 확인 / B | 한 화면에 설명+편집기+상태를 놓는 정보 밀도 참고 |
| `peter-cordes-x86` | [Stack Overflow x86 태그 위키](https://stackoverflow.com/tags/x86/info) | x86 학습·디버깅 자료로 연결되는 커뮤니티 허브 | CC BY-SA 적용 범위 확인 / B | x86 후속 트랙 링크 허브; 답변 복제보다 원문 링크 |

## 6. 시뮬레이터와 시각화 도구 비교

### 6.1 RISC-V 중심

| ID | 자료 | 핵심 기능 | 라이선스·등급 | 제품 결정에 주는 교훈 |
|---|---|---|---|---|
| `venus` | [Venus](https://venus.cs61c.org/) / [저장소](https://github.com/kvakil/venus) | 브라우저 RISC-V assembler/simulator, register·memory·disassembly | MIT / D·A | 교육용 syscall과 지원 문법은 우리 머신 프로필과 분리해 표기 |
| `venus-mit` | [MIT Venus fork](https://github.com/61c-teach/venus) | 교육 환경용 Venus 계열 구현 | 저장소 LICENSE 확인 / D | 웹 worker 또는 WASM 대안 평가 |
| `ripes` | [Ripes](https://github.com/mortbopet/Ripes) / [웹 실행](https://ripes.me/) | RV32/64, processor pipeline, cache, memory-mapped I/O | MIT로 표기되나 submodule·Qt 의존성은 별도 감사 / B·D | MVP 이후 pipeline/cache 모드의 가장 강한 비교 대상 |
| `creator` | [CREATOR](https://github.com/creatorsim/creator) | 교육용 assembly simulator, 여러 아키텍처 표현 | LGPL-3.0 / B·D | 플러그인 ISA 모델과 instruction definition 구조 참고 |
| `emulsiv` | [emulsiV](https://github.com/ESEO-Tech/emulsiV) | RISC-V 기반 최소 CPU의 시각적 실행 | MPL-2.0 / B·D | 파일 단위 copyleft 경계를 설계 전에 확인 |
| `qtrvsim` | [QtRvSim](https://github.com/cvut/qtrvsim) | RISC-V CPU·cache 시뮬레이션 | GPL-3.0 / C·D | 실행 비교는 가능하나 코드 결합은 제품 라이선스와 충돌 가능 |
| `rars` | [RARS](https://github.com/TheThirdOne/rars) | MARS 계열 RISC-V assembler/simulator, 교육용 syscall | 저장소의 LICENSE 및 포함 파일별 권리 수동 확인 / B·D | 예제 호환성 비교 전 syscall·pseudo instruction 차이 기록 |
| `rv32emu` | [rv32emu](https://github.com/sysprog21/rv32emu) | 가벼운 RV32 에뮬레이터, 다양한 확장 | MIT / D·A | 성능·정확도 회귀 비교 후보 |

### 6.2 범용 프로그램 실행 시각화

| ID | 자료 | 핵심 기능 | 활용 |
|---|---|---|---|
| `python-tutor` | [Python Tutor](https://pythontutor.com/) / [저장소](https://github.com/pgbovine/OnlinePythonTutor) | step history, stack/heap/object pointer, 공유 가능한 실행 | 시간축·이전 단계·객체 관계를 한 화면에 표현하는 법을 연구 |
| `compiler-explorer` | [Compiler Explorer](https://godbolt.org/) / [저장소](https://github.com/compiler-explorer/compiler-explorer) | 소스↔assembly 대응, compiler/options 비교 | 고급 “C 한 줄이 어떤 명령이 되는가” 실험실로 외부 연결 |
| `gdb` | [GDB Documentation](https://sourceware.org/gdb/documentation/) | 실제 binary step, register/memory inspect | 브라우저 학습 후 실제 도구로 넘어가는 디버깅 다리 |
| `llvm-mca` | [llvm-mca](https://llvm.org/docs/CommandGuide/llvm-mca.html) | instruction throughput·resource pressure 분석 | 성능 트랙에서만 사용; 초급 실행 의미와 섞지 않음 |

### 6.3 비교 체크리스트

각 도구를 다시 평가할 때 다음을 동일한 표로 기록한다.

- ISA와 확장: RV32I, M, C, RV64, CSR, privilege
- assembler 문법: GNU 호환 범위, pseudo instruction, directive
- 머신 모델: 메모리 맵, alignment, syscall, 초기 register
- 실행: step, run, pause, breakpoint, forward/backward
- 시각화: register delta, byte memory, stack frames, heap, pipeline, cache
- 접근성: keyboard, focus, non-color cues, screen-reader announcement
- 임베드: library/API/worker/WASM 가능 여부
- 라이선스: 본체뿐 아니라 submodule, generated table, asset, 문제 세트
- 유지보수: 최근 릴리스, issue 응답, test suite, 문서화

## 7. 교수법과 학습과학 근거

### 7.1 수업 순환 구조

| ID | 연구·자료 | 핵심 결론 | ASM/LAB에서의 구체적 채택 |
|---|---|---|---|
| `primm` | [Teaching programming with PRIMM: a sociocultural perspective](https://qmro.qmul.ac.uk/xmlui/handle/123456789/57800) | Predict–Run–Investigate–Modify–Make의 구조로 읽기에서 만들기로 책임을 이양 | 모든 새 명령의 첫 실습은 실행 전 register/memory 변화를 예측하게 함 |
| `retrieval-practice` | [Roediger & Karpicke, Test-Enhanced Learning](https://doi.org/10.1111/j.1467-9280.2006.01693.x) | 다시 읽기보다 검색 연습이 지연된 기억에 유리할 수 있음 | 레슨 종료 24시간·7일 뒤 짧은 recall 문제를 재노출 |
| `effective-techniques` | [Dunlosky et al., Improving Students’ Learning](https://www.psychologicalscience.org/publications/journals/pspi/learning-techniques.html) | practice testing과 distributed practice가 폭넓게 유용 | “완료율”보다 간격을 둔 재도전과 무힌트 성공을 mastery에 반영 |
| `spacing-meta` | [Cepeda et al., Distributed practice meta-analysis](https://doi.org/10.1037/0033-2909.132.3.354) | 학습 간격과 목표 보존 기간의 상호작용 | 고정된 매일 streak 대신 1일→3일→7일의 적응형 복습 후보 |
| `worked-examples` | [Cognitive Load Theory and the Format of Instruction](https://doi.org/10.1207/s1532690xci0804_2) | 초보자에게 문제 해결만 강요하기보다 worked example이 부하를 줄일 수 있음 | 완성 코드 trace→빈칸 trace→부분 코드→자유 작성 순서 |

### 7.2 컴퓨팅 교육 특화 자료

| ID | 연구·자료 | 핵심 관찰 | 제품 반영 |
|---|---|---|---|
| `parsons` | [Parsons & Haden, Parson’s Programming Puzzles](https://www.cs.otago.ac.nz/staffpriv/anthony/Sites/anthony/pages/publications/ACE2006.pdf) | 코드를 처음부터 생성하기 전 순서 배열 문제로 구조 연습 가능 | branch/loop/function prologue를 줄 블록 재배열 문제로 제공 |
| `parsons-review` | [Parsons problems and computing education learning theories](https://doi.org/10.1145/3769994.3770032) | Parsons 문제와 notional machine·programming plan의 연결, 동시에 연구 공백도 존재 | 모든 내용에 만능 형식으로 쓰지 않고 초기 scaffold로 제한 |
| `program-visualization` | [Hundhausen et al., Algorithm Visualization Effectiveness Meta-study](https://doi.org/10.1006/jvlc.2002.0237) | 단순히 애니메이션을 보는 것보다 학습자가 시각화와 상호작용하는 방식이 중요 | 실행 전 예측, 특정 byte 클릭 설명, 오류 탐지 같은 능동 과제 결합 |
| `notional-machines` | [Towards a Notional Machine for Runtime Stacks and Scope](https://cs.brown.edu/~sk/Publications/Papers/Published/ck-nm-stacks/paper.pdf) | 초보자가 추론할 수 있는 명시적 머신 모델의 필요 | ISA 실재와 교육적 단순화를 구분하는 “이 실험실의 머신” 패널 |
| `asm-visualizer-paper` | [Dive Into Systems research and ASM Visualizer](https://diveintosystems.cs.swarthmore.edu/) | assembly 실행과 high-level code 관계, 전진/후진 시각화 | delta 중심 타임라인과 단계별 UI 공개의 비교 기준 |

### 7.3 근거를 과장하지 않는 규칙

- “시각화하면 학습된다”라고 쓰지 않는다. 예측·설명·수정·검색 연습 같은 행동과 결합한다.
- 학습 스타일에 따라 색·동영상·텍스트를 고르는 식의 진단을 하지 않는다.
- mastery는 한 번의 정답이 아니라 `무힌트 성공 + 다른 맥락으로 전이 + 지연 재검사`로 정의한다.
- 효능 주장은 실제 사용자 연구 전까지 가설로 표시한다.

## 8. 접근성·인터랙션 표준

| ID | 자료 | 적용 범위 |
|---|---|---|
| `wcag-22` | [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/) | 대비, 키보드, focus, target size, error identification, reduced motion |
| `wai-aria-apg` | [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) | tabs, disclosure, toolbar, dialog 등 복합 위젯 |
| `aria-live` | [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) | “x5가 0에서 8로 변경됨” 같은 step 결과의 보조기기 알림 |
| `forced-colors` | [CSS forced-colors](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors) | Windows High Contrast 등에서 상태 표시 보존 |
| `reduced-motion` | [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | flash·scroll·transition의 축소 또는 제거 |

메모리 변화는 색만으로 전달하지 않는다. 최소한 `주소`, `이전 값 → 새 값`, `읽기/쓰기 라벨`, 테두리 또는 기호를 함께 사용한다. 실행 후 announcement는 너무 잦지 않도록 한 step당 하나의 요약으로 병합한다.

## 9. 대체 ISA와 후속 학습 경로

MVP 런타임은 RV32I 하나에 집중하지만, 사용자의 실제 목적에 맞춰 다음 경로를 연결한다.

### 9.1 Arm AArch64

| 자료 | 역할 | 재사용 |
|---|---|---|
| [Arm Architecture Reference Manuals](https://developer.arm.com/Architectures) | 명령 의미론과 programmer’s model | Arm 이용 조건 확인 / C |
| [Procedure Call Standard for the Arm 64-bit Architecture](https://github.com/ARM-software/abi-aa) | register 역할, stack, 함수 호출 | CC BY-SA 4.0 표기 / A(동일조건 주의) |
| [Arm Learning Paths](https://learn.arm.com/) | 공식 hands-on 후속 과정 | 링크 전용 / C |

### 9.2 x86-64

| 자료 | 역할 | 재사용 |
|---|---|---|
| [Intel Software Developer Manuals](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html) | x86-64 규격과 system programming | Intel 조건 / C |
| [AMD64 Architecture Programmer’s Manual](https://www.amd.com/en/search/documentation/hub.html#sortCriteria=%40amd_release_date%20descending&f-amd_archive_status=Active&f-amd_document_type=Programmer%20Reference) | AMD64 명령·시스템 모델 | AMD 조건 / C |
| [System V AMD64 ABI](https://gitlab.com/x86-psABIs/x86-64-ABI) | Unix calling convention | 저장소 조건 확인 / B |
| [OST2 Architecture 1001](https://ost2.fyi/Arch1001) | x86-64 assembly·reverse engineering | 링크 전용 / C |

### 9.3 선택 기준

- “처음 저수준 사고를 배우기” → RV32I
- “모바일·임베디드·Apple Silicon” → AArch64
- “데스크톱 Linux/Windows 역공학” → x86-64
- “CPU datapath 자체 만들기” → Nand2Tetris 또는 HDL/RISC-V core 트랙

## 10. 한국어 자료 후보

한국어 자료는 공개 여부와 강좌 상태가 자주 바뀌므로 자동 편입하지 않는다.

| 소스 | 확인할 것 | 기본 처리 |
|---|---|---|
| [K-MOOC](https://www.kmooc.kr/) | 강좌 운영 기간, 청강 가능 여부, 강의 자료 라이선스 | 과정 소개만 요약하고 원문·슬라이드는 링크 전용 |
| [KOCW](http://www.kocw.net/) | 동영상 재생, 주차별 자료 접근, 저작권 표기 | 컴퓨터 구조·시스템 프로그래밍 보충 강의로 링크 |
| 국내 대학 공개 강의 페이지 | 학기 만료, 과제 공개 범위, 외부인 접근 | URL·교수·학기·확인일을 함께 기록 |

2026-07-24 조사 시 일부 검색 결과는 종료된 강좌 또는 로그인이 필요한 페이지였다. “한국어 추천” 섹션은 공개 재생을 직접 확인한 뒤 노출하고, 종료 강좌는 아카이브 라벨을 붙인다.

## 11. 저작권·라이선스 운영 규칙

### 11.1 제품 콘텐츠

1. 모든 설명과 문제는 ASM/LAB의 자체 문장과 자체 예제로 작성한다.
2. 규격의 사실은 참조하되, 원문의 문단·표·도식 구성을 따라 복제하지 않는다.
3. CC BY 자료를 각색하면 페이지 하단과 `/credits`에 제목, 저자, URL, 라이선스, 변경 사실을 적는다.
4. CC BY-SA 자료의 각색은 결과물의 동일조건 범위를 검토하기 전 배포하지 않는다.
5. CC BY-NC-ND는 상업 여부와 무관하게 **변경 금지**이므로 링크 전용으로 취급한다.
6. 공개 웹페이지라는 사실만으로 문제·그림·코드를 재사용하지 않는다.

### 11.2 코드와 런타임

1. 의존성 도입 전 SPDX 식별자뿐 아니라 `LICENSE`, `NOTICE`, submodule을 확인한다.
2. GPL 도구는 외부 검증 도구로 실행할 수 있으나 제품 코드와 결합하거나 배포하는 결정은 별도 검토한다.
3. LGPL/MPL은 동적 링크·수정 파일 공개 등 실제 결합 방식에 따른 의무를 검토한다.
4. instruction table을 생성하면 원천 저장소 commit과 생성 스크립트를 보존한다.
5. GitHub 표시 라이선스가 불명확하거나 파일별 헤더가 충돌하면 B 등급으로 내린다.

### 11.3 출처 표시 예시

```text
RISC-V ISA 설명은 RISC-V Instruction Set Manual, Volume I을 참고해
ASM/LAB이 초보자용으로 새로 작성했습니다.
원문: RISC-V International, CC BY 4.0.
변경: 용어 단순화, 자체 예제 및 도식 추가.
```

## 12. 콘텐츠 제작용 매핑

| 레슨 주제 | 1차 근거 | 보조 비교 | 시각화 초점 |
|---|---|---|---|
| 이진수·2의 보수 | RISC-V ISA programmer’s model, CS61C L02 | Dive Into Systems | 동일 bit pattern의 signed/unsigned 해석 |
| register와 `x0` | RV32I spec | Venus, Ripes | write 무시와 delta |
| `addi`, 산술 | RV32I spec | CS61C, Venus | source read → ALU → destination write |
| byte/word, endian | RV32I load/store | Dive Into Systems | 4개 byte가 한 word로 조합되는 과정 |
| load/store | RV32I spec | Ripes | address 계산과 memory bus event |
| branch/loop | RV32I spec | Parsons problems | 조건 평가와 PC 선택 |
| function call | psABI | CS61C CALL | `ra`, `sp`, frame, saved register |
| stack | psABI | notional-machine 연구, ASM Visualizer | frame 수명과 memory delta |
| C↔assembly | psABI, compiler output | Compiler Explorer | source line과 instruction group |
| 실제 디버깅 | GDB docs | OST2 | breakpoint, register, memory inspect |

## 13. 출시 전 재검증 체크리스트

- [ ] 공식 사양의 ratified 버전과 런타임 `machineProfile.version`이 일치한다.
- [ ] opcode/ABI/assembly manual의 URL과 라이선스를 다시 확인했다.
- [ ] 각 레슨 fact sheet에 최소 하나의 1차 근거가 있다.
- [ ] 외부 예제와 유사한 모든 문항은 독립 창작 여부를 검토했다.
- [ ] 오픈소스 의존성의 transitive license report를 저장했다.
- [ ] RARS, Ripes, CREATOR 등 조건부 자료의 결합 여부를 법적 관점에서 검토했다.
- [ ] 한국어 강좌 링크가 로그아웃 상태에서도 재생되는지 확인했다.
- [ ] 외부 사이트가 사라질 때를 대비해 제목·저자·발행 연도·DOI를 보관했다.
- [ ] 깨진 링크를 CI 또는 정기 작업으로 검사하되, rate limit과 robots 정책을 지킨다.
- [ ] `/credits`와 저장소 `THIRD_PARTY_NOTICES`가 실제 사용 자료와 일치한다.

## 14. 조사 백로그

MVP 이후 다음 항목을 별도 조사 티켓으로 진행한다.

1. Venus와 GNU assembler의 directive/pseudo instruction 차이표
2. Ripes WebAssembly build의 bundle 크기·worker 가능성·submodule 라이선스
3. `Sail` 모델과 자체 TypeScript runtime의 differential testing harness
4. RV32I misaligned load/store를 trap으로 할지 교육용으로 허용할지 사용자 연구
5. screen reader 사용자에게 byte-grid를 table, list, 요약 중 무엇으로 노출할지
6. 저시력·색각 다양성 환경에서 read/write/PC 상태 토큰 검증
7. 한국어 register·memory·address 용어의 표준 번역과 현업 표현 비교
8. 초보자의 대표 오개념 인터뷰: “변수=register”, “주소=값”, “stack=자료구조”
9. 모바일에서 editor+machine state를 학습 가능한 밀도로 보여주는 방식
10. 자유 코딩 전환 시 sandbox 자원 제한과 무한 루프 진단 UX

---

이 카탈로그는 “많이 모으기”보다 **어떤 근거를 어디에 어떻게 쓸지 추적 가능하게 만들기** 위한 문서다. 신규 자료는 링크만 추가하지 말고 등급, 용도, 라이선스, 확인일을 함께 기록한다.
