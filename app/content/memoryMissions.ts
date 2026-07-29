import {
  DATA_BASE,
  type MachineOptions,
  type MemoryAccessSize,
} from "../../lib/rv32i/types";
import {
  type MemoryMissionId,
  type MemoryMissionModuleId,
} from "./memoryMissionIds";

export { MEMORY_MISSION_IDS } from "./memoryMissionIds";
export type {
  MemoryMissionId,
  MemoryMissionModuleId,
} from "./memoryMissionIds";
export type MemoryMissionPanel = "pc" | "registers" | "memory" | "branch";

export type MemoryMissionChoice = {
  id: string;
  label: string;
};

export type MemoryMissionQuestion = {
  prompt: string;
  choices: readonly MemoryMissionChoice[];
  correctChoiceId: string;
  explanation: string;
};

export type MemoryMissionCheckpoint = MemoryMissionQuestion & {
  sourceLine: number;
};

export type MemoryMissionFocus = {
  panel: MemoryMissionPanel;
  registers: readonly number[];
  address: number | null;
  unit: MemoryAccessSize | null;
};

export type MemoryMission = {
  id: MemoryMissionId;
  moduleId: MemoryMissionModuleId;
  marker: string;
  title: string;
  summary: string;
  objective: string;
  source: string;
  options: MachineOptions;
  focus: MemoryMissionFocus;
  checkpoint: MemoryMissionCheckpoint;
  transfer: MemoryMissionQuestion;
};

export const MEMORY_MISSIONS: readonly MemoryMission[] = [
  {
    id: "pc-next",
    moduleId: "pc",
    marker: "PC",
    title: "PC는 다음 명령어를 가리킵니다",
    summary: "순차 실행에서 PC가 명령어 한 칸인 4바이트씩 이동합니다.",
    objective: "현재 명령어의 주소와 실행 뒤의 PC를 구분합니다.",
    source: `addi x5, x0, 7
addi x6, x5, 1`,
    options: {},
    focus: {
      panel: "pc",
      registers: [5, 6],
      address: null,
      unit: null,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "1행을 실행한 직후 PC는 어디를 가리킬까요?",
      choices: [
        { id: "pc-0", label: "0x00000000" },
        { id: "pc-4", label: "0x00000004" },
        { id: "pc-8", label: "0x00000008" },
      ],
      correctChoiceId: "pc-4",
      explanation:
        "RV32I 명령어는 4바이트입니다. 분기가 없는 첫 명령어 뒤의 PC는 0x00000004입니다.",
    },
    transfer: {
      prompt: "순차 명령어 세 개를 모두 실행하면 완료 PC는 얼마일까요?",
      choices: [
        { id: "three-4", label: "0x00000004" },
        { id: "three-8", label: "0x00000008" },
        { id: "three-12", label: "0x0000000c" },
      ],
      correctChoiceId: "three-12",
      explanation:
        "PC는 명령어마다 4씩 이동하므로 세 명령어 뒤에는 12인 0x0000000c가 됩니다.",
    },
  },
  {
    id: "x-zero-wrap",
    moduleId: "x",
    marker: "x",
    title: "x0는 고정되고 계산은 32비트로 감깁니다",
    summary: "x0 쓰기는 무시되고 0xffffffff에 1을 더하면 0으로 돌아옵니다.",
    objective: "고정 레지스터와 32비트 unsigned wrap을 실행 결과로 확인합니다.",
    source: `addi x0, x0, 1
addi x5, x5, 1`,
    options: {
      initialRegisters: { 5: 0xffffffff },
    },
    focus: {
      panel: "registers",
      registers: [0, 5],
      address: null,
      unit: null,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "1행이 x0에 1을 쓰려고 한 뒤 x0의 값은 무엇일까요?",
      choices: [
        { id: "zero-stays", label: "0x00000000" },
        { id: "zero-one", label: "0x00000001" },
        { id: "zero-unknown", label: "정해지지 않음" },
      ],
      correctChoiceId: "zero-stays",
      explanation:
        "x0에 대한 쓰기는 커밋되지 않습니다. x0는 언제나 0을 읽습니다.",
    },
    transfer: {
      prompt: "초기값이 0xffffffff인 x5에 1을 더하면 무엇이 남을까요?",
      choices: [
        { id: "wrap-zero", label: "0x00000000" },
        { id: "wrap-max", label: "0xffffffff" },
        { id: "wrap-wide", label: "0x100000000" },
      ],
      correctChoiceId: "wrap-zero",
      explanation:
        "레지스터는 32비트만 보관합니다. 가장 높은 값을 넘긴 비트는 버려져 0이 됩니다.",
    },
  },
  {
    id: "memory-address-value",
    moduleId: "m",
    marker: "M",
    title: "주소와 그 주소의 값은 다릅니다",
    summary: "addi는 주소를 복사하고 lw는 그 주소의 4바이트 값을 읽습니다.",
    objective: "레지스터에 든 주소와 메모리에서 읽은 값을 구분합니다.",
    source: `addi x5, x10, 0
lw x6, 0(x10)`,
    options: {
      initialMemory: [
        { address: DATA_BASE, bytes: [0x2a, 0x00, 0x00, 0x00] },
      ],
    },
    focus: {
      panel: "memory",
      registers: [5, 6, 10],
      address: DATA_BASE,
      unit: 4,
    },
    checkpoint: {
      sourceLine: 2,
      prompt: "2행까지 실행했을 때 x5와 x6에는 무엇이 있을까요?",
      choices: [
        {
          id: "address-then-value",
          label: "x5 = 0x00001000, x6 = 0x0000002a",
        },
        {
          id: "value-then-address",
          label: "x5 = 0x0000002a, x6 = 0x00001000",
        },
        {
          id: "both-address",
          label: "x5 = x6 = 0x00001000",
        },
      ],
      correctChoiceId: "address-then-value",
      explanation:
        "addi는 x10의 주소를 x5로 복사합니다. lw는 그 주소부터 4바이트를 읽어 x6에 42를 씁니다.",
    },
    transfer: {
      prompt: "같은 주소의 워드가 7로 바뀌면 어떤 값이 달라질까요?",
      choices: [
        { id: "only-x5", label: "x5만 7로 바뀜" },
        { id: "only-x6", label: "x6만 7로 바뀜" },
        { id: "both-seven", label: "x5와 x6이 모두 7로 바뀜" },
      ],
      correctChoiceId: "only-x6",
      explanation:
        "주소는 그대로 0x00001000입니다. 그 주소에서 lw가 읽는 값만 7로 달라집니다.",
    },
  },
  {
    id: "memory-store-byte",
    moduleId: "m",
    marker: "M",
    title: "sb는 한 바이트만 바꿉니다",
    summary: "레지스터의 낮은 8비트를 선택한 주소 한 칸에 저장합니다.",
    objective: "sb의 주소, 저장 바이트, 바뀌지 않는 이웃 바이트를 예측합니다.",
    source: "sb x5, 1(x10)",
    options: {
      initialRegisters: { 5: 0x11223344 },
      initialMemory: [
        { address: DATA_BASE, bytes: [0xaa, 0xbb, 0xcc, 0xdd] },
      ],
    },
    focus: {
      panel: "memory",
      registers: [5, 10],
      address: DATA_BASE + 1,
      unit: 1,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "이 sb가 바꾸는 주소와 바이트는 무엇일까요?",
      choices: [
        { id: "byte-correct", label: "0x00001001에 0x44" },
        { id: "byte-high", label: "0x00001001에 0x11" },
        { id: "byte-base", label: "0x00001000에 0x44" },
      ],
      correctChoiceId: "byte-correct",
      explanation:
        "유효 주소는 x10 + 1입니다. sb는 x5의 가장 낮은 바이트 0x44만 그 주소에 씁니다.",
    },
    transfer: {
      prompt: "같은 x5로 sb x5, 3(x10)을 실행하면 무엇이 바뀔까요?",
      choices: [
        { id: "offset-three", label: "0x00001003 한 칸이 0x44로 바뀜" },
        { id: "four-bytes", label: "0x00001000부터 네 칸이 모두 바뀜" },
        { id: "offset-value", label: "0x00000003 주소가 0x44로 바뀜" },
      ],
      correctChoiceId: "offset-three",
      explanation:
        "offset은 저장할 값이 아니라 기준 주소에 더할 거리입니다. sb의 폭은 언제나 1바이트입니다.",
    },
  },
  {
    id: "memory-little-endian",
    moduleId: "m",
    marker: "M",
    title: "바이트 조립과 little-endian",
    summary: "0x12345678을 낮은 주소부터 78 56 34 12 순서로 저장합니다.",
    objective: "32비트 워드와 메모리의 little-endian 바이트 배열을 연결합니다.",
    source: "sw x5, 0(x10)",
    options: {
      initialRegisters: { 5: 0x12345678 },
    },
    focus: {
      panel: "memory",
      registers: [5, 10],
      address: DATA_BASE,
      unit: 4,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "sw 뒤에 0x1000부터 보이는 네 바이트의 순서는 무엇일까요?",
      choices: [
        { id: "little", label: "78 56 34 12" },
        { id: "big", label: "12 34 56 78" },
        { id: "repeat", label: "78 78 78 78" },
      ],
      correctChoiceId: "little",
      explanation:
        "little-endian은 가장 낮은 8비트 0x78을 가장 낮은 주소에 둡니다.",
    },
    transfer: {
      prompt: "저장 직후 같은 주소를 lw로 읽으면 어떤 워드가 복원될까요?",
      choices: [
        { id: "word-original", label: "0x12345678" },
        { id: "word-reversed", label: "0x78563412" },
        { id: "word-byte", label: "0x00000078" },
      ],
      correctChoiceId: "word-original",
      explanation:
        "lw도 같은 little-endian 규칙으로 네 바이트를 조립하므로 원래 워드가 복원됩니다.",
    },
  },
  {
    id: "memory-partial-store",
    moduleId: "m",
    marker: "M",
    title: "부분 store는 이웃 바이트를 보존합니다",
    summary: "sh가 워드의 위쪽 두 바이트만 바꾸고 나머지 두 바이트는 남깁니다.",
    objective: "store 폭과 offset으로 정확한 변경 범위를 찾습니다.",
    source: `sh x5, 2(x10)
lw x6, 0(x10)`,
    options: {
      initialRegisters: { 5: 0xaabbccdd },
      initialMemory: [
        { address: DATA_BASE, bytes: [0x11, 0x22, 0x33, 0x44] },
      ],
    },
    focus: {
      panel: "memory",
      registers: [5, 6, 10],
      address: DATA_BASE + 2,
      unit: 2,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "1행의 sh 뒤에 워드의 네 바이트는 어떻게 될까요?",
      choices: [
        { id: "partial-correct", label: "11 22 dd cc" },
        { id: "partial-low", label: "dd cc 33 44" },
        { id: "partial-all", label: "dd cc bb aa" },
      ],
      correctChoiceId: "partial-correct",
      explanation:
        "sh는 x5의 낮은 16비트 0xccdd만 씁니다. offset 2이므로 주소 0x1002와 0x1003에 dd cc가 놓입니다.",
    },
    transfer: {
      prompt: "이어서 lw x6, 0(x10)을 실행하면 x6은 무엇일까요?",
      choices: [
        { id: "partial-word", label: "0xccdd2211" },
        { id: "source-word", label: "0xaabbccdd" },
        { id: "old-word", label: "0x44332211" },
      ],
      correctChoiceId: "partial-word",
      explanation:
        "남은 네 바이트 11 22 dd cc를 little-endian 워드로 조립하면 0xccdd2211입니다.",
    },
  },
  {
    id: "memory-signed-loads",
    moduleId: "m",
    marker: "M",
    title: "부호 확장으로 같은 바이트를 다르게 읽습니다",
    summary: "lb와 lbu가 같은 0x80을 서로 다른 32비트 값으로 확장합니다.",
    objective: "메모리 바이트와 signed, unsigned 레지스터 결과를 구분합니다.",
    source: `lb x5, 0(x10)
lbu x6, 0(x10)`,
    options: {
      initialMemory: [{ address: DATA_BASE, bytes: [0x80] }],
    },
    focus: {
      panel: "registers",
      registers: [5, 6, 10],
      address: DATA_BASE,
      unit: 1,
    },
    checkpoint: {
      sourceLine: 1,
      prompt: "lb가 바이트 0x80을 x5에 읽으면 어떤 32비트 값이 될까요?",
      choices: [
        { id: "signed-extended", label: "0xffffff80" },
        { id: "zero-extended", label: "0x00000080" },
        { id: "address-result", label: "0x00001000" },
      ],
      correctChoiceId: "signed-extended",
      explanation:
        "lb는 비트 7을 부호 비트로 보고 위쪽 24비트를 1로 채워 0xffffff80을 만듭니다.",
    },
    transfer: {
      prompt: "같은 바이트를 lbu로 읽은 x6의 값은 무엇일까요?",
      choices: [
        { id: "unsigned-byte", label: "0x00000080" },
        { id: "unsigned-signed", label: "0xffffff80" },
        { id: "unsigned-zero", label: "0x00000000" },
      ],
      correctChoiceId: "unsigned-byte",
      explanation:
        "lbu는 위쪽 비트를 0으로 채웁니다. 메모리의 0x80은 그대로이고 해석만 달라집니다.",
    },
  },
  {
    id: "branch-memory-loop",
    moduleId: "b",
    marker: "B",
    title: "beq로 메모리 구간을 반복해서 씁니다",
    summary: "포인터가 끝 주소에 닿을 때까지 네 바이트를 차례로 채웁니다.",
    objective: "분기 결과, 다음 PC, 연속된 메모리 쓰기를 하나의 흐름으로 추적합니다.",
    source: `loop: beq x5, x6, done
sb x7, 0(x5)
addi x5, x5, 1
beq x0, x0, loop
done:`,
    options: {
      initialRegisters: {
        5: DATA_BASE,
        6: DATA_BASE + 4,
        7: 0x5a,
      },
    },
    focus: {
      panel: "branch",
      registers: [0, 5, 6, 7],
      address: DATA_BASE,
      unit: 1,
    },
    checkpoint: {
      sourceLine: 2,
      prompt: "첫 반복의 sb가 만드는 첫 메모리 변화는 무엇일까요?",
      choices: [
        { id: "loop-first", label: "0x00001000에 0x5a를 씀" },
        { id: "loop-end", label: "0x00001004에 0x5a를 씀" },
        { id: "loop-word", label: "0x00001000부터 4바이트를 한 번에 씀" },
      ],
      correctChoiceId: "loop-first",
      explanation:
        "첫 비교에서는 x5와 x6이 다릅니다. 분기를 통과한 sb는 현재 x5 주소 0x1000에 한 바이트를 씁니다.",
    },
    transfer: {
      prompt: "프로그램이 끝났을 때 채워진 주소와 x5의 값은 무엇일까요?",
      choices: [
        {
          id: "loop-complete",
          label: "0x1000부터 0x1003까지 채워지고 x5 = 0x1004",
        },
        {
          id: "loop-extra",
          label: "0x1000부터 0x1004까지 채워지고 x5 = 0x1005",
        },
        {
          id: "loop-once",
          label: "0x1000만 채워지고 x5 = 0x1001",
        },
      ],
      correctChoiceId: "loop-complete",
      explanation:
        "x5가 0x1004가 되면 첫 beq가 done으로 이동합니다. 끝 주소 자체에는 쓰지 않습니다.",
    },
  },
];

const MEMORY_MISSION_BY_ID = new Map<string, MemoryMission>(
  MEMORY_MISSIONS.map((mission) => [mission.id, mission]),
);

export function getMemoryMission(id: string): MemoryMission | undefined {
  return MEMORY_MISSION_BY_ID.get(id);
}

export function getMemoryMissionsByModule(
  moduleId: MemoryMissionModuleId,
): readonly MemoryMission[] {
  return MEMORY_MISSIONS.filter((mission) => mission.moduleId === moduleId);
}
