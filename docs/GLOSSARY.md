# 용어집

이 문서는 프로젝트 문서, UI, 레슨, 오류 메시지, 코드 식별자에서 사용하는 용어의 기준이다. 한국어 설명 안에서도 공식 ISA 용어와 mnemonic은 영어 원문을 병기한다.

## 범위 배지

설명·오류·참고 카드에는 가능한 한 다음 배지를 붙인다.

| 배지 | 의미 | 예 |
|---|---|---|
| `일반 컴퓨터 개념` | 특정 ISA와 무관한 개념 | 주소와 값은 다르다 |
| `RV32I 규칙` | RV32I ISA가 정의하는 동작 | `x0`에 대한 write는 반영되지 않는다 |
| `ILP32 ABI 관례` | 함수·레지스터·스택에 관한 소프트웨어 약속 | `s0–s11`은 callee-saved다 |
| `교육용 VM 정책` | 이 사이트가 단순화하거나 추가한 규칙 | 비정렬 load/store를 trap으로 처리한다 |
| `고급 성능 모델` | architectural state가 아닌 pipeline·cache 모델 | forwarding으로 stall이 줄어든다 |

범위가 다른 사실을 한 문장에 섞지 않는다. 예를 들어 “RISC-V 스택은 아래로 자란다” 대신 “이 사이트의 ILP32 실행 환경은 아래 방향으로 자라는 스택을 사용한다”고 쓴다.

## 핵심 용어

| 용어 | 권장 한국어 | 프로젝트에서의 정의 |
|---|---|---|
| Architecture | 아키텍처 | 문맥에 따라 ISA, microarchitecture, 전체 시스템 구조를 뜻할 수 있으므로 단독 사용을 피한다 |
| ISA | 명령어 집합 구조 | 소프트웨어가 관찰할 수 있는 instruction, register, exception 등의 규약 |
| Microarchitecture | 마이크로아키텍처 | ISA를 구현하는 pipeline, execution unit, cache 등의 내부 구조 |
| Assembly language | 어셈블리 언어 | 특정 ISA의 machine instruction을 기호로 표현하는 언어. 하나의 보편 언어가 아니다 |
| Assembler | 어셈블러 | assembly source를 machine code와 관련 메타데이터로 변환하는 프로그램 |
| Machine code | 기계어 | CPU가 해석하는 binary instruction encoding |
| Instruction | 명령 | ISA가 정의한 하나의 machine instruction |
| Mnemonic | 니모닉 | `addi`, `lw`, `beq`처럼 instruction을 나타내는 짧은 이름 |
| Operand | 피연산자 | instruction이 읽거나 쓰는 register, immediate, memory 표현 |
| Immediate | 즉시값 | instruction encoding 또는 pseudo expansion에 포함되는 상수 |
| Directive | 어셈블러 지시어 | `.text`, `.word`처럼 assembler에게 주는 지시. CPU가 실행하지 않는다 |
| Pseudo-instruction | 가상 명령 | assembler가 하나 이상의 실제 instruction으로 확장하는 편의 문법 |
| Label | 레이블 | source의 위치나 데이터 주소에 붙인 기호 |
| Symbol | 심볼 | assembler·linker가 이름과 주소·속성의 관계를 기록한 항목 |
| Register | 레지스터 | CPU architectural state에 속하는 고정 폭 저장 위치 |
| ABI register name | ABI 레지스터 이름 | `x2`를 `sp`로 부르는 것처럼 역할을 나타내는 별칭 |
| PC | 프로그램 카운터 | 현재 또는 다음 instruction 주소를 나타내는 architectural register |
| Hart | 하트 | RISC-V에서 독립적으로 instruction을 가져와 실행하는 hardware thread |
| Architectural state | 아키텍처 상태 | instruction 경계에서 프로그램이 관찰할 수 있는 register, PC, memory 등의 상태 |
| Retire | 완료·커밋 | instruction 효과가 architectural state에 반영된 시점. “한 클럭”과 같지 않다 |
| Fetch | 명령 가져오기 | PC가 가리키는 주소에서 instruction bytes를 읽는 단계 |
| Decode | 해독 | encoding을 opcode, register, immediate 등으로 해석하는 단계 |
| Execute | 실행 | 산술, 비교, 주소 계산, 제어 흐름 결정 등을 수행하는 단계 |
| Memory | 메모리 | 이 프로젝트에서는 byte-addressed 32-bit logical address space |
| Address | 주소 | 메모리 위치를 식별하는 숫자 |
| Value | 값 | register나 memory bytes를 특정 폭과 해석으로 읽은 결과 |
| Effective address | 유효 주소 | load/store가 실제로 접근하는 `base + signExtend(offset)` 결과 |
| Byte / Halfword / Word | 바이트 / 하프워드 / 워드 | 각각 8, 16, 32비트. 본 프로젝트의 `word`는 RV32I의 32비트를 뜻한다 |
| Endianness | 엔디언 | 여러 byte로 된 값을 주소 순서에 배치하고 조립하는 규칙 |
| Little-endian | 리틀 엔디언 | 값의 최하위 byte를 가장 낮은 주소에 배치하는 방식 |
| Signedness | 부호 해석 | 같은 bit pattern을 signed 또는 unsigned 정수로 해석하는 관점 |
| Sign extension | 부호 확장 | 좁은 signed 값을 넓힐 때 최상위 sign bit를 복제하는 연산 |
| Zero extension | 0 확장 | 좁은 unsigned 값을 넓힐 때 상위 비트를 0으로 채우는 연산 |
| Alignment | 정렬 | 데이터 폭에 맞는 주소 경계. 교육용 VM은 비정렬 접근을 trap으로 처리한다 |
| Memory segment | 메모리 구역 | `.text`, `.rodata`, `.data`, `.bss`, heap, stack, MMIO 등 역할별 주소 구역 |
| Stack | 스택 | 함수 호출 관례에 따라 사용하는 일반 memory 영역. 특별한 물리 메모리가 아니다 |
| Stack frame | 스택 프레임 | 한 함수 호출이 stack에서 사용하는 영역을 ABI 패턴으로 해석한 overlay |
| Heap | 힙 | 실행 중 동적으로 할당하는 memory 영역. MVP에서는 단순 bump allocator 후보 |
| MMIO | 메모리 매핑 I/O | 특정 memory address read/write를 가상 장치와 연결하는 방식 |
| ABI | 응용 프로그램 이진 인터페이스 | 호출 규약, object format, register 역할 등 binary 호환 약속 |
| Calling convention | 호출 규약 | 인수, 반환값, 보존 register, stack alignment에 관한 ABI 일부 |
| Caller-saved | 호출자 보존 | 호출자가 필요하면 함수 호출 전에 보존해야 하는 register |
| Callee-saved | 피호출자 보존 | 피호출 함수가 변경했다면 반환 전에 복원해야 하는 register |
| Trap | 트랩 | instruction 실행을 정상 순서로 계속할 수 없게 하는 동기적 사건의 교육용 통칭 |
| `ecall` | 환경 호출 | 실행 환경에 서비스를 요청하는 instruction. 서비스 번호와 의미는 ISA 자체가 아닌 환경에 의존한다 |
| Breakpoint | 중단점 | 특정 PC나 조건에서 실행을 일시정지하는 디버깅 기능 |
| Watchpoint | 감시점 | 특정 register·memory 접근이나 값 변화에서 실행을 일시정지하는 기능 |
| Trace | 실행 추적 | 순서가 있는 instruction·state-change event 기록 |
| Snapshot | 전체 상태 스냅샷 | 재동기화와 seek를 위해 필요한 특정 시점의 완전한 machine state |
| StepDelta | 단계 변화량 | 한 retired instruction이 만든 read/write와 before/after 정보를 담은 event |
| Inverse delta | 역방향 변화량 | StepDelta의 이전 값을 이용해 직전 상태로 되돌리는 정보 |
| Checkpoint | 체크포인트 | 긴 history에서 임의 seek를 빠르게 하기 위해 저장하는 주기적 Snapshot |
| Deterministic execution | 결정적 실행 | 동일한 초기 상태·코드·입력 event가 항상 동일한 trace를 만드는 실행 |
| Educational VM | 교육용 VM | RV32I 위에 memory map, trap 정책, virtual syscall 등을 고정한 사이트 실행 환경 |
| EEI | 실행 환경 인터페이스 | ISA가 실행 환경에 맡기는 memory, exception, I/O 등의 구체적 계약 |
| Dedicated Web Worker | 전용 Web Worker | UI main thread와 분리되어 parser·assembler·machine core를 실행하는 브라우저 worker |
| WebAssembly | 웹어셈블리 | 브라우저에서 실행되는 portable binary format. 본 프로젝트의 학습 대상 assembly와는 별개다 |
| RV32I | RV32I | 32비트 base integer RISC-V ISA. MVP의 주 ISA |
| RV32M | RV32M | multiply/divide extension. RV32I 학습 이후 추가 후보 |
| RVC / C extension | 압축 명령 확장 | 16비트 encoding을 추가한다. MVP에서는 제외 |
| ILP32 | ILP32 ABI | `int`, `long`, pointer가 32비트인 RISC-V ABI |
| Source span | 소스 범위 | machine instruction이나 오류가 대응하는 source text 위치 |
| Parsons problem | Parsons 문제 | 올바른 코드 조각을 순서대로 배열하는 학습 문제 |
| Transfer task | 전이 과제 | 표면적 상황은 다르지만 같은 개념을 적용해야 하는 새로운 문제 |
| Misconception tag | 오개념 태그 | 반복되는 잘못된 정신 모델을 문제·오답·진도에 연결하는 식별자 |
| Mastery | 숙련 | 예제를 본 상태가 아니라 도움 없이 새 입력과 전이 문제를 해결한 상태 |

## UI 표기 규칙

- instruction과 register는 `addi`, `x5`, `t0`처럼 code style을 사용한다.
- 첫 등장에는 “유효 주소(effective address)”처럼 한·영을 병기하고 이후 한국어 또는 영어 하나로 통일한다.
- `메모리 셀`보다 `byte`, `주소`, `범위`를 우선 사용한다.
- “값이 이동했다”보다 “읽었다”, “복사했다”, “썼다”를 사용한다.
- “CPU가 `li`를 실행했다”라고 쓰지 않고 “assembler가 `li`를 실제 instruction으로 확장했다”고 쓴다.
- “스택에 push된다”는 추상 표현만 쓰지 않고 `sp` 변경과 memory write를 함께 설명한다.
- 숫자는 기본적으로 hex를 보여주되 signed decimal, unsigned decimal, binary, ASCII 전환을 제공한다.
- 오류는 `무슨 일`, `증거`, `적용 규칙`, `다음 행동` 순서로 쓴다.

## 코드 식별자 권장안

- machine state: `MachineState`
- 전체 상태 전달: `Snapshot`
- 한 instruction 변화: `StepDelta`
- 여러 변화 묶음: `TraceBatch`
- 외부 입력 기록: `HostEvent`
- 실행 중지 이유: `PauseReason`
- 교육용 프로필: `MachineProfile`
- 메모리 계층: `MemoryBus`, `MemoryPage`, `MemoryRegion`
- 학습 콘텐츠: `Lesson`, `Activity`, `Exercise`, `Hint`, `Misconception`
- 진도: `ConceptMastery`, `AttemptEvidence`, `ReviewSchedule`

용어 변경은 API·콘텐츠·분석 데이터에 넓게 영향을 주므로 새 의미를 기존 단어에 덮어쓰지 않는다. 의미가 달라지면 migration과 ADR을 함께 작성한다.
