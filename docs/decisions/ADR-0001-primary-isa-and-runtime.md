# ADR-0001: MVP 주 ISA와 실행 런타임

- 상태: Accepted
- 결정일: 2026-07-24
- 영향 범위: 교육 과정, assembler, 실행 코어, 시각화 event, 테스트, 콘텐츠 제작

## 맥락

초보자용 어셈블리 학습 사이트는 다음 요구를 동시에 만족해야 한다.

- register와 byte-addressed memory의 관계를 명확하게 가르칠 것
- 한 instruction씩 실행하고 모든 read/write를 정확하게 설명할 것
- browser에서 안전하고 결정적으로 실행할 것
- Step, Back, 임의 seek를 지원할 것
- 공식 명세와 reference model로 정확성을 검증할 수 있을 것
- 이후 AArch64, x86-64, pipeline·cache 과정으로 확장 가능할 것

x86-64는 실용성이 높지만 가변 길이 encoding, flags, 레거시 mode, 복수 syntax와 ABI 차이 때문에 첫 mental model을 만들기 어렵다. AArch64는 현대적이고 규칙적이지만 첫 과정에 필요한 공식 자료·도구·개방성 측면에서 RISC-V보다 제약이 있다. Hack, LC-3, 6502 같은 교육·고전 ISA는 작고 재미있지만 현대 byte-addressed load/store 생태계로의 전이가 약하다.

실행 코어 후보로는 기존 emulator의 WebAssembly port, 서버 측 QEMU·toolchain, 직접 작성한 TypeScript interpreter가 있다. 기존 emulator는 빠르지만 instruction별 교육용 event 계측과 undo를 위해 내부 수정이 필요하다. 서버 실행은 실제 toolchain을 사용할 수 있지만 운영·지연·보안 비용이 크다.

## 결정

MVP는 다음 조합을 사용한다.

1. **주 ISA는 비특권 단일-hart RV32I**로 한다.
2. ABI 기반 함수 과정에서는 **ILP32 calling convention**을 사용한다.
3. `M`, `A`, `F/D`, `C`, CSR, privileged ISA, 실제 Linux 실행은 MVP에서 제외한다.
4. execution environment는 little-endian, 명시적 memory map, 엄격한 misalignment trap, 제한된 deterministic virtual I/O를 사용하는 **교육용 VM**으로 정의한다.
5. 첫 실행 코어는 **순수 TypeScript interpreter**로 작성하고 **Dedicated Web Worker**에서 구동한다.
6. UI는 코어 내부 객체를 직접 읽지 않고 버전이 있는 **`Snapshot + StepDelta` protocol**만 소비한다.
7. undo는 before value를 가진 inverse delta, 긴 seek는 checkpoint + replay로 구현한다.
8. 코어 외부에는 `MachineAdapter` 경계를 두어 이후 Rust/Wasm 또는 다른 ISA 코어로 교체할 수 있게 한다.
9. 정확성은 RISC-V Sail model, Architecture Tests, Spike, GNU/LLVM encoding과 교차검증한다.

## 결정 이유

- RV32I는 load/store와 산술이 분리되어 주소와 값을 가르치기 좋다.
- C extension을 제외하면 instruction 폭이 32비트로 일정하여 PC와 bit field 설명이 단순하다.
- 조건 flags register가 없어 branch가 어떤 두 값을 signed/unsigned로 비교했는지 직접 보여줄 수 있다.
- 공식 명세와 machine-readable 자료, Sail model, architecture tests가 공개되어 있다.
- TypeScript 코어는 교육용 event와 before/after patch를 처음부터 중심 설계로 만들 수 있다.
- Worker는 무한 loop나 큰 trace가 UI main thread를 멈추는 것을 줄인다.
- 서버 compiler 없이도 첫 레슨과 playground를 offline-first로 제공할 수 있다.

## 교육용 VM과 ISA의 경계

다음은 RV32I 자체가 아니라 사이트 정책이다.

- 구체적인 `.text`, `.data`, heap, stack 주소
- memory permission과 guard page
- misaligned load/store를 항상 trap으로 처리하는 규칙
- console, input, exit를 위한 `ecall` 번호
- 초기화되지 않은 byte에 대한 경고
- instruction·memory·history budget
- stack이 아래 방향으로 자라는 ILP32 실행 환경

UI와 문서에서는 각 규칙에 범위 배지를 붙인다.

## 검토한 대안

### RV32IM을 첫 범위로 사용

곱셈·나눗셈이 편리하고 실제 예제를 짧게 만들 수 있다. 그러나 첫 목표는 산술 편의보다 register, address, load/store, branch mental model이며 M extension은 JavaScript 정수 corner case와 테스트 범위를 늘린다. RV32I가 숙련된 뒤 별도 모듈로 추가한다.

### AArch64 우선

Apple Silicon과 Android로의 직접 전이는 좋다. 하지만 첫 MVP에서는 공개 specification ecosystem과 교육용 reference tool의 이점이 더 큰 RV32I를 선택한다. AArch64는 두 번째 ISA 트랙 후보로 남긴다.

### x86-64 우선

보안·리버싱 수요에는 적합하지만 첫 학습 인지 부하와 정확한 browser emulator 비용이 크다. 고급 전이 트랙으로 둔다.

### 기존 emulator를 WebAssembly로 즉시 채택

성능과 ISA 범위는 좋지만 교육 event, source mapping, time travel, deterministic virtual I/O를 맞추는 비용이 불명확하다. MVP 이후 `MachineAdapter` 뒤에서 검토한다.

### 서버 측 toolchain/QEMU

실제 ELF·GDB 경험에는 유리하지만 운영과 보안 경계가 과도하다. 베타 이후 별도 sandbox service가 필요한 경우 새 ADR로 결정한다.

## 결과

### 긍정적 결과

- 학습 목표와 machine model이 단순해진다.
- 모든 상태 변화를 일관된 event로 만들 수 있다.
- undo, trace, 설명 생성, 접근성 요약이 동일한 데이터에서 나온다.
- 오프라인과 정적 배포가 가능하다.
- 향후 코어 교체와 다른 ISA 지원을 UI에서 분리할 수 있다.

### 비용과 제약

- own interpreter와 assembler의 장기 유지 비용이 생긴다.
- 초기에는 실제 GNU assembler의 모든 directive와 ELF를 지원하지 않는다.
- RISC-V 전체를 지원한다고 표현할 수 없고 교육용 subset임을 명시해야 한다.
- TypeScript number의 32비트 정수 처리를 helper로 엄격하게 통제해야 한다.
- 성능보다 계측과 설명을 우선하므로 큰 프로그램 실행에는 적합하지 않다.

## 재검토 조건

다음 중 하나가 발생하면 새 ADR을 작성해 결정을 재검토한다.

- 교육 프로그램이 history budget 안에서도 browser에서 목표 성능을 달성하지 못함
- Sail/Architecture Tests와의 정합성을 유지하기 어려움
- 실제 ELF·Linux 실행이 핵심 학습 목표로 승격됨
- AArch64 또는 x86-64가 독립 트랙이 아니라 핵심 MVP 요구가 됨
- Worker protocol이 다른 machine core를 수용하지 못함
- accessibility 요구가 현재 event granularity로 충족되지 않음

## 참고

- [RISC-V Unprivileged ISA](https://docs.riscv.org/reference/isa/unpriv/unpriv-index.html)
- [RISC-V ISA Manual source](https://github.com/riscv/riscv-isa-manual)
- [RISC-V psABI](https://riscv-non-isa.github.io/riscv-elf-psabi-doc/)
- [Sail RISC-V model](https://github.com/riscv/sail-riscv)
- [RISC-V Architecture Tests](https://github.com/riscv/riscv-arch-test)
