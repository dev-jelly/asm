import assert from "node:assert/strict";
import test from "node:test";
import {
  expectedPrediction,
  predictionChoices,
  predictionLabel,
  type PredictionCheckpoint,
} from "../app/components/PredictionGate";
import { Rv32iMachine } from "../lib/rv32i/machine";
import { DATA_BASE, type MachineOptions } from "../lib/rv32i/types";

function currentInstruction(
  source: string,
  initialRegisters: Record<number, number> = {},
) {
  const snapshot = new Rv32iMachine(source, {
    initialRegisters,
  }).snapshot();
  assert.ok(snapshot.currentInstruction);
  return {
    instruction: snapshot.currentInstruction,
    registers: snapshot.registers,
  };
}

test("generic predictions follow the instruction effect, including ignored x0 writes", () => {
  const addi = currentInstruction("addi x5, x0, 1");
  assert.equal(
    expectedPrediction(addi.instruction, null, addi.registers),
    "register",
  );

  const ignored = currentInstruction("addi x0, x0, 1");
  assert.equal(
    expectedPrediction(ignored.instruction, null, ignored.registers),
    "none",
  );

  const load = currentInstruction("lb x7, 0(x10)");
  assert.equal(
    expectedPrediction(load.instruction, null, load.registers),
    "register",
  );

  const store = currentInstruction("sw x7, 0(x10)");
  assert.equal(
    expectedPrediction(store.instruction, null, store.registers),
    "memory",
  );
});

test("branch predictions are mutually exclusive and use current register values", () => {
  const taken = currentInstruction(
    `beq x5, x6, target
addi x7, x0, 1
target: addi x8, x0, 2`,
    { 5: 9, 6: 9 },
  );
  const takenChoices = predictionChoices(
    taken.instruction,
    null,
    taken.registers,
  );
  assert.deepEqual(
    takenChoices.map((choice) => choice.id),
    ["branch-taken", "branch-not-taken"],
  );
  assert.equal(
    expectedPrediction(taken.instruction, null, taken.registers),
    "branch-taken",
  );
  assert.match(
    predictionLabel(
      "branch-taken",
      null,
      taken.instruction,
      taken.registers,
    ),
    /다음 PC = 0x00000008 \(분기\)/,
  );

  const notTaken = currentInstruction(
    `beq x5, x6, target
addi x7, x0, 1
target: addi x8, x0, 2`,
    { 5: 9, 6: 10 },
  );
  assert.equal(
    expectedPrediction(
      notTaken.instruction,
      null,
      notTaken.registers,
    ),
    "branch-not-taken",
  );
  assert.match(
    predictionLabel(
      "branch-not-taken",
      null,
      notTaken.instruction,
      notTaken.registers,
    ),
    /다음 PC = 0x00000004 \(순차 실행\)/,
  );
});

test("a mission checkpoint overrides the generic instruction prediction", () => {
  const { instruction, registers } = currentInstruction(
    "addi x5, x0, 1",
  );
  const checkpoint: PredictionCheckpoint = {
    prompt: "PC는?",
    choices: [
      { id: "pc-4", label: "0x00000004" },
      { id: "pc-8", label: "0x00000008" },
    ],
    correctChoiceId: "pc-4",
    explanation: "4바이트 이동",
  };

  assert.equal(
    expectedPrediction(instruction, checkpoint, registers),
    "pc-4",
  );
  assert.deepEqual(
    predictionChoices(instruction, checkpoint, registers),
    checkpoint.choices,
  );
});

test("prediction IDs match the persistent effect of every supported instruction family", () => {
  const initializedMemory = [
    { address: DATA_BASE, bytes: [0x80, 0x01, 0x02, 0x03] },
  ];
  const cases: Array<{
    source: string;
    options?: MachineOptions;
  }> = [
    { source: "addi x5, x0, 1" },
    { source: "addi x0, x0, 1" },
    ...["lb", "lbu", "lh", "lhu", "lw"].flatMap((mnemonic) => [
      {
        source: `${mnemonic} x5, 0(x10)`,
        options: { initialMemory: initializedMemory },
      },
      {
        source: `${mnemonic} x0, 0(x10)`,
        options: { initialMemory: initializedMemory },
      },
    ]),
    {
      source: "sb x7, 0(x10)",
      options: { initialRegisters: { 7: 0x12345678 } },
    },
    {
      source: "sh x7, 0(x10)",
      options: { initialRegisters: { 7: 0x12345678 } },
    },
    {
      source: "sw x7, 0(x10)",
      options: { initialRegisters: { 7: 0x12345678 } },
    },
    {
      source: `beq x5, x6, target
addi x8, x0, 0
target: addi x7, x0, 1`,
      options: { initialRegisters: { 5: 4, 6: 4 } },
    },
    {
      source: `beq x5, x6, target
addi x8, x0, 0
target: addi x7, x0, 1`,
      options: { initialRegisters: { 5: 4, 6: 5 } },
    },
  ];

  assert.equal(cases.length, 17);
  for (const entry of cases) {
    const machine = new Rv32iMachine(entry.source, entry.options);
    const before = machine.snapshot();
    assert.ok(before.currentInstruction);
    const prediction = expectedPrediction(
      before.currentInstruction,
      null,
      before.registers,
    );
    const delta = machine.step();
    const actual =
      delta.controlFlow.kind === "branch"
        ? delta.controlFlow.taken
          ? "branch-taken"
          : "branch-not-taken"
        : delta.memoryPatches.length > 0
          ? "memory"
          : delta.registerWrites.some((write) => write.committed)
            ? "register"
            : "none";

    assert.equal(prediction, actual, entry.source);
    assert.ok(
      predictionChoices(
        before.currentInstruction,
        null,
        before.registers,
      ).some((choice) => choice.id === prediction),
      `${entry.source} must render its expected choice`,
    );
  }
});
