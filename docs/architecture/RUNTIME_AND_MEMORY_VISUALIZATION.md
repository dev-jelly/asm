# 런타임·메모리 시각화 설계

- 기준일: 2026-07-24
- 상태: 구현 전 기술 기준선
- 관련 결정: [ADR-0001](../decisions/ADR-0001-primary-isa-and-runtime.md)

## 1. 기술 목표

실행 시스템은 “빠른 RISC-V emulator”보다 “한 instruction이 만든 원인을 정확히 기록하는 교육용 machine”을 우선한다.

필수 속성:

- deterministic
- instruction-retirement 단위 Step
- register와 memory read/write 관찰
- exact before/after patch
- source와 machine instruction 연결
- Back과 임의 seek
- bounded resource usage
- UI main thread와 분리
- 공식 reference와 differential verification
- screen reader용 deterministic explanation 생성

## 2. 시스템 구조

```text
Application UI
├─ Lesson / Exercise / Playground
├─ Source editor
├─ Register / Memory / Stack / Trace
├─ Prediction / Hint / Feedback
└─ UI state reducer
          │
          │ versioned command/event protocol
          ▼
Dedicated Web Worker
├─ Lexer / Parser
├─ Two-pass assembler
├─ RV32I Machine Core
├─ Sparse MemoryBus
├─ Access Recorder
├─ Breakpoint / Watchpoint
├─ TimeTravelStore
└─ Deterministic Virtual I/O
```

Worker가 authoritative machine state와 history를 소유한다. UI는 local projection을 가지지만 reset, seek, protocol error가 발생하면 Worker `Snapshot`으로 재동기화한다.

## 3. MachineProfile v1

```ts
type MachineProfile = {
  id: "rv32i-edu-v1";
  schemaVersion: 1;
  isa: "RV32I";
  xlen: 32;
  addressBits: 32;
  endianness: "little";
  harts: 1;
  privileged: false;
  extensions: [];
  misalignedAccess: "trap";
  memoryRegions: MemoryRegionSpec[];
  virtualSyscalls: VirtualSyscallSpec[];
  limits: ResourceLimits;
};
```

### 명시적으로 제외

- M, A, F, D, C, V extension
- CSR와 privileged mode
- atomics와 concurrency
- page table·MMU
- 실제 OS syscall ABI
- real-time clock
- ambient random
- host filesystem·network

`ecall`과 `ebreak`은 교육 실행 환경에서만 해석한다.

## 4. Memory map

구체 주소는 구현 fixture에서 확정하되 다음 원칙을 유지한다.

| Region | Permission | 역할 |
|---|---|---|
| `.text` | R/X | assembled instruction |
| `.rodata` | R | read-only constant |
| `.data` | R/W | initialized static data |
| `.bss` | R/W | zero-initialized static data |
| heap | R/W | optional bump allocation |
| guard | none | heap/stack overflow 조기 탐지 |
| stack | R/W | ILP32 stack, downward growth |
| MMIO | device-specific | deterministic educational device |

logical address space는 32비트지만 실제 memory는 4 KiB sparse page map으로 commit한다.

### Page 모델

```ts
type MemoryPage = {
  bytes: Uint8Array;        // 4096
  initialized: Uint8Array;  // shadow bitmap 또는 byte flags
  dirty: Uint8Array;        // per-block dirty bitmap
};
```

전체 4 GiB 배열을 할당하지 않는다. page 수와 총 committed bytes에 budget을 둔다.

### Initialized shadow

초기화 여부는 ISA state가 아니라 교육 metadata다.

- uninitialized read는 profile에 따라 실제 bytes를 읽되 warning event 생성
- 값을 임의로 0이라고 가르치지 않음
- execution semantics를 변경하는 poison value로 사용하지 않음
- UI에서 hatch, icon, text로 표시

## 5. Register와 정수 semantics

```ts
type MachineState = {
  pc: number;
  x: Uint32Array; // 32
  memory: MemoryBus;
  retired: number;
  io: VirtualIoState;
  status: MachineStatus;
};
```

JavaScript `number` 사용 규칙:

- unsigned result: `value >>> 0`
- signed view: `value | 0`
- add/sub는 매 연산 후 u32 normalize
- signed와 unsigned comparison helper 분리
- shift amount는 RV32I 규칙에 맞게 mask
- memory read/write는 `DataView` 또는 명시적 byte 조합
- `x[0]`은 commit 단계에서 항상 0

M extension을 추가하면 high multiply와 division corner case를 위해 `BigInt` 또는 Rust/Wasm core를 검토한다.

## 6. Parser와 assembler 경계

### 지원 문법

- comment
- identifier와 label
- register architectural/ABI name
- decimal, hex, binary integer
- canonical RV32I instruction
- `.text`, `.data`
- `.byte`, `.half`, `.word`, `.string`, `.align`
- 제한된 pseudo: `li`, `la`, `mv`, `nop`, `j`, `jr`, `ret`, `call`

### 지원하지 않는 문법

- arbitrary macro language
- include와 filesystem
- JavaScript expression
- full GNU expression syntax
- linker script
- relaxation 전체
- floating point literal

expression은 `eval` 없이 자체 AST로 계산한다. token 수, identifier 길이, label 수, expression depth에 budget을 둔다.

### Two-pass

1. parse와 section layout, label address 계산
2. instruction encoding, relocation 가능한 제한 expression 해결, data emit

### Assembled image

```ts
type AssembledProgram = {
  profileId: string;
  entryPc: number;
  segments: ProgramSegment[];
  instructions: DecodedInstruction[];
  symbols: SymbolRecord[];
  sourceMap: SourceMapRecord[];
  diagnostics: Diagnostic[];
};
```

### Source mapping

```ts
type SourceMapRecord = {
  address: number;
  size: 4;
  sourceSpan: { from: number; to: number };
  sourceLine: number;
  expansion?: {
    pseudo: string;
    index: number;
    count: number;
  };
};
```

UI는 source Step과 machine-instruction Step을 구분할 수 있다. 기본 정확성 단위는 machine instruction이다.

## 7. Machine core interface

```ts
interface MachineAdapter {
  profile(): MachineProfile;
  assemble(source: string): AssembledProgram;
  load(program: AssembledProgram): Snapshot;
  step(): StepDelta;
  run(options: RunOptions): AsyncIterable<TraceBatch>;
  pause(): void;
  reset(): Snapshot;
  seek(seq: number): Snapshot;
  readMemory(range: MemoryRange): MemoryRangeResult;
  setBreakpoint(spec: BreakpointSpec): void;
  setWatchpoint(spec: WatchpointSpec): void;
}
```

UI는 adapter 구현 종류를 알지 못한다. TypeScript, Rust/Wasm, 다른 ISA adapter가 protocol conformance를 만족하면 교체할 수 있다.

## 8. 중앙 MemoryBus

모든 instruction fetch, data read/write, loader, virtual device 접근이 `MemoryBus`를 지난다.

```ts
interface MemoryBus {
  fetch32(address: number, ctx: AccessContext): number;
  read8(address: number, ctx: AccessContext): number;
  read16(address: number, ctx: AccessContext): number;
  read32(address: number, ctx: AccessContext): number;
  write8(address: number, value: number, ctx: AccessContext): void;
  write16(address: number, value: number, ctx: AccessContext): void;
  write32(address: number, value: number, ctx: AccessContext): void;
}
```

MemoryBus 책임:

- u32 address normalize
- overflow와 cross-boundary 검증
- mapped region과 permission
- alignment policy
- page commit limit
- MMIO routing
- access event recording
- initialized shadow
- dirty range와 before patch 수집

CPU 구현에서 UI event를 직접 만들지 않는다. CPU는 bus와 register file을 사용하고 recorder가 관찰한다.

## 9. StepDelta protocol

```ts
type StepDelta = {
  schemaVersion: 1;
  profileId: string;
  runId: string;
  seq: number;
  retired: number;

  pcBefore: number;
  pcAfter: number;

  instruction: {
    address: number;
    raw: number;
    mnemonic: string;
    operands: string[];
    sourceSpan?: { from: number; to: number };
    sourceLine?: number;
    expansion?: {
      pseudo: string;
      index: number;
      count: number;
    };
  };

  registerReads: Array<{
    id: number;
    value: number;
    role: "rs1" | "rs2" | "address" | "syscall";
  }>;

  registerWrites: Array<{
    id: number;
    before: number;
    after: number;
    committed: boolean;
  }>;

  accesses: Array<{
    kind: "fetch" | "read" | "write";
    address: number;
    size: 1 | 2 | 4;
    bytes: Uint8Array;
    initialized?: boolean[];
  }>;

  memoryPatches: Array<{
    address: number;
    before: Uint8Array;
    after: Uint8Array;
    initializedBefore?: Uint8Array;
    initializedAfter?: Uint8Array;
  }>;

  addressCalculation?: {
    baseRegister: number;
    baseValue: number;
    encodedOffset: number;
    extendedOffset: number;
    effectiveAddress: number;
  };

  controlFlow: {
    kind: "sequential" | "branch" | "jump" | "call" | "return";
    taken?: boolean;
    target?: number;
    comparison?: {
      lhs: number;
      rhs: number;
      interpretation: "signed" | "unsigned" | "equality";
      result: boolean;
    };
  };

  stack?: {
    spBefore: number;
    spAfter: number;
    inferredFrameEvent?: "enter" | "leave";
    confidence?: "pattern" | "symbol";
  };

  io?: Array<{
    kind: "stdout" | "stdin" | "exit";
    data: string;
  }>;

  warnings?: MachineWarning[];
  trap?: MachineTrap;
  explanationKey: string;
};
```

### 동일 byte 다중 write

한 instruction 안에서 같은 byte를 여러 번 접근할 경우:

- `accesses`는 실제 순서를 모두 보존
- `memoryPatches`는 최초 before와 최종 after로 합쳐 undo에 사용

전체 memory를 Step마다 비교하지 않는다.

## 10. Snapshot과 추가 event

```ts
type Snapshot = {
  schemaVersion: 1;
  profileId: string;
  runId: string;
  seq: number;
  pc: number;
  registers: Uint32Array;
  mappedPages: SerializedPage[];
  initializedPages: SerializedShadowPage[];
  io: VirtualIoState;
  status: MachineStatus;
  stateHash: string;
};

type TraceBatch = {
  runId: string;
  firstSeq: number;
  lastSeq: number;
  deltas: StepDelta[];
  aggregate?: AccessAggregate;
};

type HostEvent = {
  runId: string;
  seq: number;
  kind: "input";
  data: string;
};

type Paused = {
  runId: string;
  seq: number;
  reason:
    | "user"
    | "breakpoint"
    | "watchpoint"
    | "instruction-budget"
    | "memory-budget"
    | "history-budget"
    | "trap"
    | "halt";
};
```

## 11. Worker command protocol

모든 message에는 다음이 있다.

- `protocolVersion`
- `runId`
- `commandId`
- monotonic `seq` 또는 expected seq

명령 후보:

- `ASSEMBLE`
- `LOAD`
- `STEP`
- `RUN`
- `PAUSE`
- `BACK`
- `SEEK`
- `RESET`
- `READ_MEMORY_RANGE`
- `SET_BREAKPOINT`
- `SET_WATCHPOINT`
- `PROVIDE_INPUT`
- `GET_SNAPSHOT`

UI는 reset 후 이전 `runId` message를 버린다. sequence gap을 발견하면 delta 적용을 중지하고 Snapshot을 요청한다.

## 12. Run scheduling

Worker 안에서도 긴 synchronous loop를 사용하지 않는다.

- instruction count 또는 약 5–8ms를 기준으로 chunk
- chunk 후 worker event loop에 control 반환
- Pause command와 heartbeat 처리
- main thread watchdog가 heartbeat 중단을 감지
- hard timeout 시 `worker.terminate()` 후 새 Worker와 last safe source/state로 복구

SharedArrayBuffer는 MVP에서 사용하지 않는다. COOP/COEP 배포 제약과 Atomics 복잡성이 교육용 범위에 비해 크다.

## 13. Rendering 전략

### Step mode

- 모든 read/write 표시
- current instruction, PC, address calculation
- one-step explanation
- polite screen-reader summary

### Run mode

- Worker trace를 batch
- UI frame마다 bounded delta 적용
- rendering 30–60Hz 제한
- 반복 read/write는 heat 또는 count로 aggregate
- screen reader live announcement 중지
- pause 후 summary

### Memory range

전체 memory snapshot을 UI에 보내지 않는다.

- 현재 PC와 stack pointer 주변
- lesson watch range
- user-requested address range
- changed range

hex grid는 row virtualization을 사용한다.

## 14. Time travel

### Back

StepDelta를 역순 적용한다.

- register `after → before`
- memory `after → before`
- initialized shadow 복원
- PC 복원
- retired count 복원
- console length 복원
- virtual input cursor 복원

### Checkpoint

checkpoint 생성 기준:

- 256–1024 Step 범위의 profile 기본값
- 또는 delta byte budget
- page-level copy-on-write

### Seek

1. target 이전 가장 가까운 checkpoint 복원
2. stored deterministic delta 또는 re-execution으로 forward
3. state hash 확인
4. Snapshot emit

### History branch

과거로 rewind한 뒤 source·input·state를 변경하거나 실행을 계속하면:

- 이전 future를 제거
- 새 `runId`
- UI timeline에 branch 경계 표시

### Eviction

step count가 아니라 byte budget 중심으로 제한한다. checkpoint boundary에서 오래된 history를 제거한다.

## 15. Virtual I/O

MVP allowlist:

- stdout text
- deterministic input
- exit
- optional single pixel-buffer MMIO lesson

금지:

- host network
- filesystem
- actual clock
- ambient random
- clipboard
- dynamic module

random을 가르치는 lesson이 필요하면 seeded PRNG를 virtual device로 제공하고 seed를 HostEvent에 저장한다.

## 16. 설명 생성

LLM이 runtime truth를 자유롭게 서술하지 않는다. `StepDelta`에서 deterministic template로 설명한다.

예:

- `addi`: rs1 value + sign-extended immediate = result; rd before→after
- `lw`: base + offset; 4 bytes; little-endian assembly; rd update
- `lb`: byte; sign bit; 32-bit sign extension
- branch: lhs/rhs; signedness; comparison result; target
- `jal`: return address write; target
- x0 write: 계산 결과와 write ignored를 모두 표시

콘텐츠 team은 `explanationKey`별 template와 쉬운 표현을 작성한다. 같은 event가 visual cue, text trace, screen-reader summary, feedback의 단일 근거가 된다.

## 17. Stack inference

RISC-V에는 전용 push/pop/call/return opcode가 없다.

call 후보:

- `jal` 또는 `jalr`
- link destination이 ABI return-address pattern
- symbol/source mapping

return 후보:

- `jalr` pattern과 ABI alias

frame inference:

- `sp` decrement/increment
- saved `ra`, `s*`, optional `fp`
- symbol boundary

UI는 “ABI pattern으로 추론”이라고 표시하며 불확실한 정보를 hardware fact로 표현하지 않는다.

## 18. Breakpoint와 watchpoint

MVP:

- exact PC breakpoint
- source-line breakpoint를 machine address 집합으로 변환
- memory write watchpoint
- register write watchpoint

조건식이 필요해지면 자체 expression AST를 사용한다. JavaScript eval을 사용하지 않는다.

Pause event에는:

- reason
- triggering access
- PC
- seq
- relevant state

를 포함한다.

## 19. Error taxonomy

### ParseDiagnostic

- invalid token
- unknown mnemonic
- wrong operand count
- invalid register

### AssembleDiagnostic

- duplicate symbol
- undefined symbol
- immediate out of range
- section permission conflict
- unsupported directive

### MachineTrap

- instruction access fault
- load/store access fault
- permission
- misaligned access
- illegal instruction
- environment call error
- instruction budget

### GradingFailure

- final state mismatch
- invariant violation
- forbidden instruction
- instruction budget
- out-of-bounds write
- ABI violation

각 오류를 한 개 generic exception으로 합치지 않는다.

## 20. Threat model

learner source는 untrusted input이다.

위험:

- 거대한 source
- 매우 긴 token/comment
- label 폭발
- 깊은 expression
- infinite loop
- page commit 폭발
- trace memory 폭발
- 큰 postMessage
- stale event
- HTML/console injection
- dependency supply-chain

대응:

- no `eval`, `Function`, dynamic import
- source·token·AST·symbol limits
- instruction·memory·history limits
- Worker chunk와 watchdog
- output escaping과 text node
- virtual syscall allowlist
- CSP: `worker-src 'self'`, `object-src 'none'`, 좁은 `connect-src`
- Worker에 secret/token 저장 금지
- dependency와 spec/opcode commit pin
- transferable payload size limit
- malformed input fuzzing

WebAssembly를 사용해도 CPU·memory budget과 watchdog는 계속 필요하다.

## 21. Resource budget 초기안

실제 값은 prototype profiling으로 조정한다.

```ts
type ResourceLimits = {
  sourceBytes: number;
  tokens: number;
  symbols: number;
  expressionDepth: number;
  committedMemoryBytes: number;
  instructionsPerRun: number;
  traceBytes: number;
  messageBytes: number;
  stdoutBytes: number;
};
```

budget pause는 오류가 아니라 명확한 학습 feedback이 될 수 있다.

> 100,000개의 instruction 제한에 도달했습니다. 종료 조건이 변하는지 확인해 보세요.

## 22. 성능 목표

MVP 예제는 교육 규모로 제한한다.

목표:

- Step input 후 즉각적인 feedback
- Run 중 main thread responsiveness 유지
- visible state는 frame budget 안에서 update
- memory table은 주소 공간 크기와 무관하게 bounded DOM
- history memory는 configured budget 안에서 유지

최적화 순서:

1. 정확한 instrumentation
2. delta-only message
3. batching
4. row virtualization
5. compact ArrayBuffer trace
6. core profiling
7. 필요할 때 Wasm adapter

초기에 SharedArrayBuffer, JIT, binary protocol을 도입하지 않는다.

## 23. 테스트 전략

### Parser·assembler

- canonical syntax
- whitespace/comment
- register aliases
- label forward/backward
- immediate boundaries
- duplicate/undefined symbol
- data directive와 alignment
- pseudo expansion
- source mapping
- encoder/decoder round-trip
- GNU `as` 또는 LLVM `llvm-mc` encoding 비교

### Integer semantics

- x0 invariant
- u32 wrap
- signed/unsigned comparison
- shift amount
- arithmetic shift
- sign/zero extension
- branch/JAL boundary

### Memory

- little-endian
- byte/half/word
- cross-page
- mapped/unmapped
- permission
- alignment
- page budget
- initialized shadow
- MMIO

### Differential

- RISC-V Sail model
- RV32I Architecture Tests
- `riscv-tests` 관련 case
- Spike small program trace
- random legal instruction sequence state digest

### Time travel

- `state0 → step → undo === state0`
- N step 후 N Back
- checkpoint restore + replay hash
- rewind 후 branch
- HostEvent replay
- history eviction boundary

### Protocol

- stale runId
- seq gap
- reset 중 arriving batch
- worker terminate/restart
- bounded queue
- snapshot resync

### Robustness

- malformed/fuzzed source
- long comment
- Unicode identifier policy
- many labels
- deep expression
- infinite loop
- huge output
- large transferable

### UI와 접근성

- delta reducer
- same seq across views
- keyboard
- screen reader summary
- reduced motion
- non-color cues
- virtualized memory navigation
- Chromium, Firefox, Safari

## 24. CI gate

PR 또는 release gate 후보:

1. typecheck
2. unit test
3. assembler encoding suite
4. RV32I semantic suite
5. selected Architecture Tests
6. time-travel invariant
7. protocol tests
8. accessibility automation
9. production build
10. source/license validation

공식 reference version과 test subset을 build artifact에 기록한다.

## 25. 관측성과 오류 보고

privacy 원칙상 learner source와 input을 기본 전송하지 않는다.

수집 후보:

- app/profile/protocol version
- browser class
- worker restart count
- pause reason
- state desync recovery
- build-independent error code

사용자에게 exportable debug bundle을 제공한다면:

- source 포함 여부를 명시적으로 선택
- personal input 제거
- profile과 event schema version 포함
- secret과 local storage 전체 dump 금지

## 26. 완료 조건

- RV32I educational subset의 semantics와 encoding이 reference test를 통과한다.
- StepDelta가 모든 register/memory change의 before/after를 설명한다.
- UI는 MachineAdapter 내부 state를 직접 읽지 않는다.
- Back과 checkpoint/replay invariant가 통과한다.
- worker hang과 stale message를 복구한다.
- memory view는 32-bit address space에서 bounded하게 동작한다.
- screen reader와 text trace가 visual state와 동일한 event를 사용한다.
- ISA, ABI, VM policy가 UI와 error에서 구분된다.
- threat model의 input·execution·memory·history budget이 자동 검증된다.

## 27. 공식·구현 참고

- [RISC-V Unprivileged ISA](https://docs.riscv.org/reference/isa/unpriv/unpriv-index.html)
- [RISC-V ISA Manual](https://github.com/riscv/riscv-isa-manual)
- [RISC-V Assembly Programmer’s Manual](https://github.com/riscv-non-isa/riscv-asm-manual)
- [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)
- [riscv-opcodes](https://github.com/riscv/riscv-opcodes)
- [Sail RISC-V](https://github.com/riscv/sail-riscv)
- [RISC-V Architecture Tests](https://github.com/riscv/riscv-arch-test)
- [Spike](https://github.com/riscv-software-src/riscv-isa-sim)
- [Web Workers](https://html.spec.whatwg.org/multipage/workers.html)
- [WebAssembly Security](https://webassembly.org/docs/security/)
- [Content Security Policy Level 3](https://www.w3.org/TR/CSP/)
