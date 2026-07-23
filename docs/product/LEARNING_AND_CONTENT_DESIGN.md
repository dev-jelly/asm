# 학습·콘텐츠 설계

- 기준일: 2026-07-24
- 대상: 기본적인 변수·조건문·반복문을 이해하는 assembly 초보자
- 주 ISA: RV32I

## 1. 교육 목표

사이트의 목표는 학습자가 instruction mnemonic을 많이 암기하는 것이 아니다. 목표는 다음 질문에 근거를 들어 답할 수 있는 mental model을 만드는 것이다.

- 현재 PC가 가리키는 instruction은 무엇인가?
- instruction은 어떤 register와 memory bytes를 읽는가?
- 계산에 signed 또는 unsigned 해석이 어떻게 적용되는가?
- 어떤 register나 memory bytes가 변경되는가?
- 다음 PC가 왜 그 값이 되는가?
- 이 동작은 ISA, ABI, assembler, 교육용 VM 중 어디에서 정의되는가?

학습 완료 시점에는 시각화를 보지 않고도 새로운 짧은 프로그램을 추적하고, simulator와 실제 환경의 차이를 설명할 수 있어야 한다.

## 2. 학습 설계 원칙

### 2.1 예측을 관찰보다 먼저 둔다

모든 중요한 Step 전에 학습자가 다음 중 하나 이상을 예측하게 한다.

- 다음 PC
- 변경될 register
- register의 새 값
- 접근할 effective address
- 읽거나 쓸 byte 범위
- branch taken 여부
- trap 여부

정답을 맞히는 것만이 목적이 아니다. 예측과 실제 결과의 차이가 오개념을 드러내는 진단 자료가 된다.

### 2.2 PRIMM 흐름을 어셈블리에 적용한다

한 개념의 기본 흐름은 다음과 같다.

1. Predict: 코드를 실행하기 전에 상태를 예측한다.
2. Run: 한 instruction 또는 작은 구간을 실행한다.
3. Investigate: read, calculation, write와 PC 이동을 조사한다.
4. Modify: operand, 초기값, load width, branch 조건을 바꾼다.
5. Make: 비슷하지만 표면이 다른 문제를 직접 해결한다.

### 2.3 지원을 점차 제거한다

```text
완성 예제
  → 핵심 Step 예측
  → 일부 정보가 가려진 예제
  → Parsons 문제
  → 한 operand 또는 한 줄 채우기
  → 오류 수정
  → 처음부터 작성
  → 시각화 없는 전이 문제
```

학습자가 예제를 이해했다고 체크한 것과 독립적으로 해결한 것은 다른 진도 증거로 취급한다.

### 2.4 짧고 반복 가능하게 만든다

- micro-lesson은 8–12분을 목표로 한다.
- 한 lesson의 새 instruction은 보통 2–4개를 넘기지 않는다.
- 긴 설명은 실행 직전 필요한 만큼만 제공한다.
- 동일한 개념을 다른 초기값, 데이터 폭, 코드 맥락으로 반복한다.
- 며칠 뒤 복습 queue에서 다시 출제한다.

### 2.5 시각화에서 독립시키는 것을 성공으로 본다

초기에는 모든 state를 보여주지만, 숙련 단계에서는 관련 panel을 접거나 결과를 가린다. 마지막 평가에서는 simulator 없이 state table 또는 설명을 작성하게 한다.

## 3. 커리큘럼 지도

### 모듈 0. CPU가 보는 세계

학습 결과:

- assembly, machine code, ISA, ABI, execution environment를 구분한다.
- register, PC, memory가 machine state를 구성함을 설명한다.
- `addi` 한 줄의 before/after를 예측한다.

대표 활동:

- `addi t0, zero, 4`
- source 한 줄과 32-bit encoding 연결
- PC가 source line 번호가 아니라 byte address임을 확인

오개념:

- 어셈블리는 하나의 언어다.
- source line과 instruction은 항상 1:1이다.

### 모듈 1. 같은 비트, 다른 해석

학습 결과:

- binary, hex, unsigned, signed 표현을 변환한다.
- two’s complement와 overflow wrap을 설명한다.
- 같은 bits에 타입 태그가 저장되는 것이 아님을 이해한다.

대표 활동:

- `0xFFFFFFFF`를 unsigned와 signed로 해석
- 8/16/32-bit lens
- sign bit와 sign extension animation

오개념:

- signedness가 데이터 자체의 속성이다.
- overflow가 항상 trap을 만든다.

### 모듈 2. Register와 산술

지원 instruction 예:

- `add`, `sub`, `addi`
- `and`, `or`, `xor`
- `sll`, `srl`, `sra`
- `slt`, `sltu`

학습 결과:

- source와 destination register를 구분한다.
- `x0` write가 무시됨을 설명한다.
- logical shift와 arithmetic shift를 비교한다.
- signed와 unsigned comparison을 구분한다.

### 모듈 3. 주소와 Memory

지원 instruction 예:

- `lb`, `lbu`, `lh`, `lhu`, `lw`
- `sb`, `sh`, `sw`

학습 결과:

- address와 address에 저장된 value를 구분한다.
- `base + signExtend(offset)`로 effective address를 계산한다.
- load/store width와 접근 byte 범위를 예측한다.
- little-endian 조립과 sign/zero extension을 설명한다.
- alignment와 교육용 trap 정책을 구분한다.

대표 활동:

#### Signed Load Lens

```asm
x10 = 0x1000
memory[0x1000..0x1003] = 80 FF 7F 01

lb x5, 1(x10)
```

학습자는 `0x1001`, 읽을 byte `FF`, 결과 `0xFFFFFFFF`를 순서대로 예측한다. 이후 `lb`를 `lbu`로 바꾸어 `0x000000FF`와 비교한다.

#### Little-endian 퍼즐

```asm
x5  = 0x12345678
x10 = 0x1000
sw x5, 0(x10)
```

낮은 주소부터 `78 56 34 12`를 직접 배열하고 8/16/32-bit lens를 바꿔 본다.

#### 주소인가 내용인가

```asm
addi x5, x10, 0
lw   x5, 0(x10)
```

목표 state에 따라 둘 중 맞는 의미를 선택한다.

### 모듈 4. Branch와 Loop

지원 instruction 예:

- `beq`, `bne`
- `blt`, `bge`, `bltu`, `bgeu`
- `jal`, `jalr`의 기본 jump 용도

학습 결과:

- branch가 비교하는 두 operand와 signedness를 설명한다.
- taken/not-taken일 때 next PC를 계산한다.
- loop invariant와 종료 조건을 추적한다.
- instruction count와 source line count가 다름을 이해한다.

대표 활동:

- countdown
- 1부터 N까지 합
- max 찾기
- signed/unsigned branch bug

### 모듈 5. 배열·문자열·Pointer

학습 결과:

- element size를 포함해 array address를 계산한다.
- byte string과 word array를 구분한다.
- sentinel과 length 기반 loop를 비교한다.
- pointer를 증가시킬 때 변경되는 단위를 설명한다.

대표 과제:

- array sum
- max/min
- `strlen`
- `memcpy`
- ASCII case conversion
- binary search

### 모듈 6. 함수·Stack·ABI

학습 결과:

- `jal`이 return address와 target을 어떻게 만드는지 설명한다.
- argument/return, temporary, saved register 역할을 구분한다.
- prologue와 epilogue가 실제 instruction과 memory write임을 추적한다.
- nested call에서 callee-saved와 `sp` invariant를 검사한다.
- stack frame이 hardware object가 아니라 ABI 기반 overlay임을 이해한다.

대표 활동:

- leaf function
- nested function
- 잘못된 `s0` restore 수정
- 잘못된 `sp` alignment 수정
- recursive factorial은 후반 선택 과제

### 모듈 7. Source에서 Encoding까지

학습 결과:

- directive, pseudo-instruction, canonical instruction을 구분한다.
- source 한 줄이 여러 machine instruction으로 확장될 수 있음을 설명한다.
- instruction field와 immediate 재조립을 읽는다.
- assembler, object, linker의 역할을 개념적으로 구분한다.

대표 활동:

- `li`, `la`, `mv`, `ret` 해부
- R/I/S/B/U/J field puzzle
- label과 PC-relative offset

### 모듈 8. C와 Assembly 연결

학습 결과:

- 간단한 C 표현, loop, function과 assembly를 대응한다.
- `-O0`와 `-O2` 결과가 source와 1:1이 아닐 수 있음을 설명한다.
- calling convention이 언어 간 연결을 가능하게 함을 이해한다.

도구:

- Compiler Explorer
- GNU/LLVM disassembly

### 모듈 9. Debugging과 OS 경계

학습 결과:

- syntax, assembly/link, execution, logic/contract 오류를 구분한다.
- breakpoint와 watchpoint로 최초 잘못된 변화 지점을 찾는다.
- 교육용 `ecall`과 실제 Linux syscall을 구분한다.
- simulator의 memory map과 실제 virtual memory 차이를 설명한다.

### 모듈 10. 고급 전이

후속 트랙:

- RV32M
- pipeline, hazard, forwarding
- cache와 memory hierarchy
- AArch64
- x86-64와 reversing
- ELF, linker, relocation
- OS와 privileged architecture

architectural state와 cycle state는 동일 화면에서 혼합하지 않는다.

## 4. Lesson 구조

모든 lesson은 다음 필드를 갖는다.

```text
id
title
summary
learning_objectives
prerequisites
concepts
misconception_tags
machine_profile
new_instructions
worked_example
prediction_checkpoints
activities
independent_exercise
transfer_exercise
delayed_review
accessible_summary
source_refs
license
content_version
```

### 고정 진행 구조

1. 왜 필요한가: 30초짜리 실제 문제
2. 한 개의 명확한 학습 목표
3. 필요한 state만 보이는 worked example
4. 실행 전 prediction
5. Step 후 read→calculation→write 조사
6. 설명 또는 자기 설명 checkpoint
7. 일부 지원을 제거한 문제
8. independent exercise
9. transfer exercise
10. lesson summary와 복습 예약

한 화면에서 너무 많은 panel을 동시에 열지 않는다. lesson이 memory를 가르치면 memory view를 우선하고 stack·encoding은 접어 둔다.

## 5. Exercise 유형

### State prediction

다음 PC, register, address, bytes 또는 trap을 예측한다.

### Trace completion

일부가 비어 있는 register/memory state table을 채운다.

### Parsons

주어진 instruction을 올바른 순서로 배열한다. 문법 부담 없이 control flow와 address calculation에 집중하게 한다.

### Operand fill

instruction은 주어지고 register 또는 immediate 하나를 채운다.

### Bug repair

오류가 있는 코드를 최소한으로 수정한다. 오류의 최초 원인을 trace에서 찾게 한다.

### State matching

정확한 instruction sequence가 아니라 목표 final state와 invariants를 만족하게 한다.

### Write from scratch

허용 instruction과 budget 안에서 프로그램을 작성한다.

### Explain

왜 그 state가 되었는지 자연어 또는 구조화된 선택지로 설명한다.

### Transfer

학습 예제와 다른 자료 구조·상수·순서에서 같은 개념을 적용한다.

## 6. Exercise schema

```yaml
id: memory.signed-load.03
title: 부호 있는 바이트 읽기
machine_profile: rv32i-edu-v1
concepts:
  - effective-address
  - sign-extension
prerequisites:
  - memory.address-vs-value
misconception_tags:
  - signedness-is-stored
  - load-width-hidden
prompt: ...
initial_state:
  seed: 4102
  registers: ...
  memory: ...
allowed_instructions:
  - lb
  - lbu
success_predicate: ...
invariants:
  - x10 unchanged
  - memory unchanged
instruction_budget: 3
hint_ladder: ...
known_wrong_patterns: ...
accessible_state_summary: ...
source_refs: ...
license: project-content
```

정답 source 문자열 비교를 피한다. 여러 valid strategy를 허용하고 final state, memory safety, preserved register, instruction budget을 검사한다.

실패 시 다음을 제공한다.

- 실패한 구체적 초기값
- 최초로 expected state와 달라진 Step
- 관련 register·address
- 적용되는 규칙
- 가장 작은 다음 행동

“숨겨진 테스트에 실패했습니다”만 표시하지 않는다.

## 7. Hint 설계

힌트는 점진적으로 강해진다.

1. 개념 질문: “읽어야 하는 것은 주소입니까, 그 주소의 값입니까?”
2. 관련 state 강조
3. 필요한 instruction 종류
4. operand 일부
5. 부분 solution
6. 전체 solution과 자기 설명

진도에는 `정답 여부`와 `최대 사용 hint 단계`를 모두 남긴다. 전체 답을 본 완료는 independent mastery가 아니다.

## 8. 오류와 피드백

### 오류 분류

1. Parser: 알 수 없는 token, operand 수, 문법
2. Assembler: undefined label, duplicate symbol, immediate range
3. Runtime: unmapped, permission, alignment, budget, trap
4. Logic/contract: wrong final state, ABI violation, memory pollution

### Error card 구조

- 무슨 일이 일어났는가
- 어떤 PC·주소·값이 증거인가
- 어떤 범위의 규칙인가
- 지금 할 수 있는 가장 작은 행동
- 관련 2–3분 복습

피드백은 학습자의 성격이나 능력을 평가하지 않는다. 현재 task, strategy, self-regulation에 초점을 둔다.

## 9. 오개념 taxonomy

| ID | 오개념 | 탐지 신호 | 교정 활동 |
|---|---|---|---|
| `assembly-is-universal` | assembly가 하나의 언어 | ISA 질문에서 환경 무시 | ISA/ABI/VM badge 분류 |
| `address-equals-value` | 주소와 저장값 혼동 | `addi`와 `lw` 오선택 | 주소인가 내용인가 |
| `type-in-memory` | memory byte에 타입이 저장 | lens 변경 시 값이 바뀐다고 판단 | 동일 bytes 다중 해석 |
| `signedness-is-stored` | signed tag가 bits에 존재 | `slt/sltu`, `lb/lbu` 혼동 | signed load lens |
| `endian-reverses-bits` | bit 자체를 뒤집음 | byte-order puzzle 오류 | 주소별 byte 배열 |
| `load-moves-value` | load 후 memory가 사라짐 | memory change 예측 | read/write cue 비교 |
| `stack-is-special-memory` | stack을 별도 hardware로 봄 | raw address를 설명 못함 | raw memory overlay |
| `call-auto-pushes` | call이 자동 push | `jal` 효과와 prologue 혼동 | instruction별 call 재생 |
| `pseudo-is-opcode` | `li`를 CPU instruction으로 봄 | encoding field를 찾으려 함 | pseudo expansion |
| `instruction-is-cycle` | 한 instruction=한 cycle | pipeline 결과와 혼동 | model scope lesson |
| `simulator-is-linux` | 교육용 syscall 일반화 | syscall 번호 전이 | EEI comparison |

반복되는 tag는 진도 추천과 delayed review에 사용한다.

## 10. Mastery 모델

개념별 단계:

1. 미노출
2. 예제 이해
3. 도움을 받아 해결
4. 독립 해결
5. 전이 문제 통과
6. 지연 복습 통과

증거:

- first-attempt correctness
- max hint level
- randomized state 수
- independent solution
- transfer success
- delayed review
- explanation quality
- misconception recurrence

단일 점수로 모든 개념을 합치지 않는다. 진도 화면은 다음 추천의 이유를 설명한다.

> 주소 계산은 독립 해결했지만 `lb/lbu` 전이 문제에서 sign extension을 다시 혼동해 짧은 복습을 추천합니다.

## 11. 복습 scheduling

MVP는 복잡한 적응형 알고리즘보다 명시적인 규칙으로 시작한다.

- lesson 직후 independent variant
- 다음 session 시작 시 짧은 recall
- 2–3일 후 transfer
- 7일 후 delayed review
- 실패한 misconception은 1–2개 lesson 안에 다시 등장

일정은 device local time을 사용하되 export 가능한 상대적 evidence도 저장한다.

## 12. Capstone

### Capstone A: 배열 합계

평가 개념:

- pointer와 element width
- `lw`
- loop와 branch
- accumulator
- overflow wrap
- preserved input register

여러 길이와 값으로 채점한다. 빈 배열과 signed 값도 포함한다.

### Capstone B: ASCII case conversion

평가 개념:

- byte load/store
- range comparison
- in-place write
- sentinel 또는 length
- 허용 memory 범위

문자열 밖 write, terminator 손상, input pointer 불복원을 검사한다.

## 13. 콘텐츠 제작 workflow

1. objective와 misconception을 먼저 정의
2. smallest observable example 작성
3. prediction checkpoint 설계
4. event 기반 explanation template 확인
5. independent와 transfer variant 작성
6. success predicate와 invariants 작성
7. accessibility summary 작성
8. source·license 등록
9. expert correctness review
10. beginner usability test
11. delayed review 결과로 수정

외부 교재의 문제 문장, diagram, solution을 그대로 번역하거나 변형하지 않는다. 공식 규칙을 참고해 프로젝트 고유의 state와 문제를 작성한다.

## 14. 콘텐츠 품질 checklist

- 한 lesson에 학습 목표가 하나 또는 강하게 연결된 소수인가?
- 첫 5분 안에 실행이 있는가?
- 중요한 state를 보여주기 전에 prediction이 있는가?
- read→calculation→write 인과가 설명되는가?
- ISA/ABI/VM 범위가 표시되는가?
- 오답이 무엇을 실제로 수행했는지 설명하는가?
- 여러 valid solution을 인정하는가?
- 시각화를 줄인 transfer가 있는가?
- keyboard와 screen reader로 문제를 풀 수 있는가?
- source와 license가 등록되었는가?

## 15. 학습 효과 측정

주요 지표:

- 사전·사후 state-tracing transfer accuracy
- first-attempt prediction accuracy
- independent solution rate
- 최대 hint level
- 두 개 이상 randomized input 성공률
- 7일 delayed review
- misconception recurrence
- visualizer 없이 explanation 성공

피해야 할 지표:

- 단순 페이지뷰
- 총 실행 instruction 수
- 오래 머문 시간
- 공개 속도 순위
- 정답을 본 뒤의 completion만으로 계산한 진도

## 16. 연구 기반

- [PRIMM: Predict–Run–Investigate–Modify–Make](https://doi.org/10.1145/3137065.3137084)
- [Practice testing과 distributed practice 검토](https://doi.org/10.1177/1529100612453266)
- [Retrieval/testing effect](https://doi.org/10.1111/j.1467-9280.2006.01693.x)
- [Prediction을 포함한 program visualization 연구](https://pmc.ncbi.nlm.nih.gov/articles/PMC6302837/)
- [Parsons problems와 computing education learning theories](https://doi.org/10.1145/3769994.3770032)
- [Feedback 설계](https://doi.org/10.3102/003465430298487)

이 연구들은 제품의 구체적 효과를 보장하지 않는다. 실제 target learner를 대상으로 transfer와 delayed retention을 측정해 설계를 검증해야 한다.
