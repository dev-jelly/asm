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
  stepIndex: number;
};

export type MemoryMissionTransferScenario = {
  source: string;
  setup: readonly string[];
  options: MachineOptions;
};

export type MemoryMissionTransfer = MemoryMissionQuestion & {
  scenario: MemoryMissionTransferScenario;
  wrongHint: string;
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
  transfer: MemoryMissionTransfer;
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
      stepIndex: 0,
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
      scenario: {
        source: `addi x7, x0, 1
addi x8, x7, 2
addi x9, x8, 3`,
        setup: [
          "시작 PC = 0x00000000",
          "각 RV32I 명령어의 길이 = 4바이트",
        ],
        options: {},
      },
      prompt: "새 코드의 세 명령어를 모두 실행하면 완료 PC는 얼마일까요?",
      choices: [
        { id: "three-4", label: "0x00000004" },
        { id: "three-8", label: "0x00000008" },
        { id: "three-12", label: "0x0000000c" },
      ],
      correctChoiceId: "three-12",
      wrongHint: "실행한 명령어 수와 명령어 한 개의 바이트 길이를 따로 세어 보세요.",
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
      stepIndex: 0,
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
      scenario: {
        source: "addi x7, x7, 3",
        setup: ["x7 = 0xfffffffe", "x7은 32비트 레지스터"],
        options: {
          initialRegisters: { 7: 0xfffffffe },
        },
      },
      prompt: "새 코드가 x7에 3을 더하면 어떤 값이 남을까요?",
      choices: [
        { id: "wrap-one", label: "0x00000001" },
        { id: "wrap-max", label: "0xfffffffe" },
        { id: "wrap-wide", label: "0x100000001" },
      ],
      correctChoiceId: "wrap-one",
      wrongHint: "32비트 경계를 넘어간 가장 높은 비트가 레지스터에 남는지 확인해 보세요.",
      explanation:
        "0xfffffffe에 3을 더한 결과의 33번째 비트는 버려집니다. x7에는 낮은 32비트인 0x00000001만 남습니다.",
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
      stepIndex: 1,
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
      scenario: {
        source: `addi x7, x10, 4
lw x8, 4(x10)`,
        setup: [
          "x10 = 0x00001000",
          "0x00001004부터의 네 바이트 = 35 00 00 00",
        ],
        options: {
          initialMemory: [
            {
              address: DATA_BASE + 4,
              bytes: [0x35, 0x00, 0x00, 0x00],
            },
          ],
        },
      },
      prompt: "새 코드를 실행한 뒤 x7과 x8에는 무엇이 있을까요?",
      choices: [
        {
          id: "new-address-then-value",
          label: "x7 = 0x00001004, x8 = 0x00000035",
        },
        {
          id: "new-value-then-address",
          label: "x7 = 0x00000035, x8 = 0x00001004",
        },
        {
          id: "new-both-address",
          label: "x7 = x8 = 0x00001004",
        },
      ],
      correctChoiceId: "new-address-then-value",
      wrongHint: "addi가 계산한 주소와 lw가 그 주소에서 읽은 값을 따로 추적해 보세요.",
      explanation:
        "addi는 기준 주소에 4를 더한 0x00001004를 x7에 씁니다. lw는 그 주소의 워드 0x00000035를 x8에 씁니다.",
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
      stepIndex: 0,
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
      scenario: {
        source: "sb x7, 2(x10)",
        setup: [
          "x7 = 0xa1b2c3d4",
          "x10 = 0x00001000",
          "0x00001000부터의 네 바이트 = 10 20 30 40",
        ],
        options: {
          initialRegisters: { 7: 0xa1b2c3d4 },
          initialMemory: [
            {
              address: DATA_BASE,
              bytes: [0x10, 0x20, 0x30, 0x40],
            },
          ],
        },
      },
      prompt: "새 sb가 바꾸는 주소와 바이트는 무엇일까요?",
      choices: [
        { id: "new-byte-correct", label: "0x00001002 한 칸이 0xd4로 바뀜" },
        { id: "new-byte-high", label: "0x00001002 한 칸이 0xa1로 바뀜" },
        { id: "new-byte-base", label: "0x00001000 한 칸이 0xd4로 바뀜" },
      ],
      correctChoiceId: "new-byte-correct",
      wrongHint: "offset으로 유효 주소를 먼저 구한 뒤 레지스터의 어느 8비트를 저장하는지 확인하세요.",
      explanation:
        "유효 주소는 0x00001000 + 2인 0x00001002입니다. sb는 x7의 낮은 바이트 0xd4 하나만 저장합니다.",
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
      stepIndex: 0,
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
      scenario: {
        source: "sw x7, 0(x10)",
        setup: ["x7 = 0xa1b2c3d4", "x10 = 0x00001000"],
        options: {
          initialRegisters: { 7: 0xa1b2c3d4 },
        },
      },
      prompt: "새 워드를 저장하면 0x1000부터 네 바이트는 어떤 순서일까요?",
      choices: [
        { id: "new-little", label: "d4 c3 b2 a1" },
        { id: "new-big", label: "a1 b2 c3 d4" },
        { id: "new-repeat", label: "d4 d4 d4 d4" },
      ],
      correctChoiceId: "new-little",
      wrongHint: "가장 낮은 주소에 워드의 어느 바이트가 놓이는지부터 정해 보세요.",
      explanation:
        "little-endian에서는 가장 낮은 8비트 0xd4부터 저장하므로 d4 c3 b2 a1 순서가 됩니다.",
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
      stepIndex: 0,
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
      scenario: {
        source: `sh x7, 0(x10)
lw x8, 0(x10)`,
        setup: [
          "x7 = 0x1234abcd",
          "x10 = 0x00001000",
          "0x00001000부터의 네 바이트 = 11 22 33 44",
        ],
        options: {
          initialRegisters: { 7: 0x1234abcd },
          initialMemory: [
            {
              address: DATA_BASE,
              bytes: [0x11, 0x22, 0x33, 0x44],
            },
          ],
        },
      },
      prompt: "새 코드의 두 명령어를 실행한 뒤 x8은 무엇일까요?",
      choices: [
        { id: "new-partial-word", label: "0x4433abcd" },
        { id: "new-source-word", label: "0x1234abcd" },
        { id: "new-old-word", label: "0x44332211" },
      ],
      correctChoiceId: "new-partial-word",
      wrongHint: "sh가 바꾸는 두 바이트와 그대로 남는 두 바이트를 먼저 나누어 적어 보세요.",
      explanation:
        "sh는 낮은 두 바이트를 cd ab로 바꾸고 33 44를 보존합니다. cd ab 33 44를 lw로 조립하면 0x4433abcd입니다.",
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
      stepIndex: 0,
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
      scenario: {
        source: `lb x7, 3(x10)
lbu x8, 3(x10)`,
        setup: [
          "x10 = 0x00001000",
          "0x00001003의 바이트 = 0xfe",
        ],
        options: {
          initialMemory: [{ address: DATA_BASE + 3, bytes: [0xfe] }],
        },
      },
      prompt: "새 코드의 lb와 lbu 뒤에 x7과 x8은 무엇일까요?",
      choices: [
        {
          id: "new-signed-pair",
          label: "x7 = 0xfffffffe, x8 = 0x000000fe",
        },
        {
          id: "new-both-unsigned",
          label: "x7 = x8 = 0x000000fe",
        },
        {
          id: "new-both-signed",
          label: "x7 = x8 = 0xfffffffe",
        },
      ],
      correctChoiceId: "new-signed-pair",
      wrongHint: "같은 8비트를 읽더라도 lb와 lbu가 위쪽 24비트를 어떻게 채우는지 각각 확인하세요.",
      explanation:
        "lb는 0xfe의 부호 비트를 확장해 x7에 0xfffffffe를 쓰고, lbu는 0으로 확장해 x8에 0x000000fe를 씁니다.",
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
      sourceLine: 1,
      stepIndex: 0,
      prompt: "첫 beq의 분기 결과와 다음 PC는 무엇일까요?",
      choices: [
        {
          id: "loop-not-taken",
          label: "분기하지 않고 다음 PC = 0x00000004",
        },
        {
          id: "loop-taken",
          label: "분기하여 다음 PC = 0x00000010",
        },
        {
          id: "loop-wrong-next",
          label: "분기하지 않고 다음 PC = 0x00000008",
        },
      ],
      correctChoiceId: "loop-not-taken",
      explanation:
        "첫 비교의 x5는 0x00001000이고 x6은 0x00001004라서 같지 않습니다. beq는 분기하지 않고 다음 명령어 주소 0x00000004로 이동합니다.",
    },
    transfer: {
      scenario: {
        source: `loop2: beq x8, x9, done2
sb x7, 0(x8)
addi x8, x8, 1
beq x0, x0, loop2
done2:`,
        setup: [
          "x7 = 0x000000c7",
          "x8 = 0x00001002",
          "x9 = 0x00001005",
        ],
        options: {
          initialRegisters: {
            7: 0xc7,
            8: DATA_BASE + 2,
            9: DATA_BASE + 5,
          },
        },
      },
      prompt: "새 반복 프로그램이 끝나면 채워진 주소와 x8은 무엇일까요?",
      choices: [
        {
          id: "new-loop-complete",
          label: "0x1002부터 0x1004까지 채워지고 x8 = 0x1005",
        },
        {
          id: "new-loop-extra",
          label: "0x1002부터 0x1005까지 채워지고 x8 = 0x1006",
        },
        {
          id: "new-loop-once",
          label: "0x1002만 채워지고 x8 = 0x1003",
        },
      ],
      correctChoiceId: "new-loop-complete",
      wrongHint: "포인터가 끝 주소와 같아지는 순간에는 store보다 beq가 먼저 실행된다는 점을 확인하세요.",
      explanation:
        "x8은 0x1002, 0x1003, 0x1004에 0xc7을 쓴 뒤 0x1005가 됩니다. 그때 beq가 done2로 이동하므로 끝 주소 0x1005에는 쓰지 않습니다.",
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
