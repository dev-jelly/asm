import assert from "node:assert/strict";
import test from "node:test";
import {
  getMemoryMission,
  getMemoryMissionsByModule,
  MEMORY_MISSION_IDS,
  MEMORY_MISSIONS,
  type MemoryMission,
} from "../app/content/memoryMissions";
import { Rv32iMachine } from "../lib/rv32i/machine";
import { parseProgram } from "../lib/rv32i/parser";
import {
  DATA_BASE,
  type MachineOptions,
  type Snapshot,
  type StepDelta,
} from "../lib/rv32i/types";

type CompletedRun = {
  snapshot: Snapshot;
  deltas: StepDelta[];
};

function runProgram(
  source: string,
  options: MachineOptions,
  label: string,
): CompletedRun {
  const machine = new Rv32iMachine(source, options);
  const deltas: StepDelta[] = [];

  while (machine.snapshot().status !== "completed" && deltas.length < 512) {
    deltas.push(machine.step());
  }

  const snapshot = machine.snapshot();
  assert.equal(
    snapshot.status,
    "completed",
    `${label} did not complete within 512 steps`,
  );
  return { snapshot, deltas };
}

function runMission(mission: MemoryMission): CompletedRun {
  return runProgram(mission.source, mission.options, mission.id);
}

function runTransferScenario(mission: MemoryMission): CompletedRun {
  return runProgram(
    mission.transfer.scenario.source,
    mission.transfer.scenario.options,
    `${mission.id} transfer`,
  );
}

test("memory mission catalog has the canonical unique IDs and working lookups", () => {
  const ids = MEMORY_MISSIONS.map((mission) => mission.id);

  assert.deepEqual(ids, [...MEMORY_MISSION_IDS]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getMemoryMission("pc-next"), MEMORY_MISSIONS[0]);
  assert.equal(getMemoryMission("missing-mission"), undefined);
  assert.deepEqual(
    getMemoryMissionsByModule("m").map((mission) => mission.id),
    [
      "memory-address-value",
      "memory-store-byte",
      "memory-little-endian",
      "memory-partial-store",
      "memory-signed-loads",
    ],
  );
  assert.deepEqual(
    MEMORY_MISSIONS.map((mission) => mission.checkpoint.stepIndex),
    [0, 0, 1, 0, 0, 0, 0, 0],
  );
});

test("every checkpoint and transfer question has one reachable answer", () => {
  for (const mission of MEMORY_MISSIONS) {
    const program = parseProgram(mission.source);
    assert.ok(
      Number.isInteger(mission.checkpoint.stepIndex) &&
        mission.checkpoint.stepIndex >= 0,
      `${mission.id} checkpoint step index must be a non-negative integer`,
    );
    assert.equal(
      program.instructions[mission.checkpoint.stepIndex]?.sourceLine,
      mission.checkpoint.sourceLine,
      `${mission.id} checkpoint step must point to its declared source line`,
    );

    for (const question of [mission.checkpoint, mission.transfer]) {
      const choiceIds = question.choices.map((choice) => choice.id);
      assert.ok(
        choiceIds.length >= 2,
        `${mission.id} question needs at least two choices`,
      );
      assert.equal(
        new Set(choiceIds).size,
        choiceIds.length,
        `${mission.id} question choice IDs must be unique`,
      );
      assert.equal(
        choiceIds.filter((id) => id === question.correctChoiceId).length,
        1,
        `${mission.id} question must contain its correct choice exactly once`,
      );
    }

    assert.notEqual(
      mission.transfer.scenario.source,
      mission.source,
      `${mission.id} transfer must use a distinct program`,
    );
    assert.ok(
      mission.transfer.scenario.setup.length > 0,
      `${mission.id} transfer needs visible setup data`,
    );
    assert.doesNotThrow(
      () => parseProgram(mission.transfer.scenario.source),
      `${mission.id} transfer source must parse`,
    );
    const correctLabel = mission.transfer.choices.find(
      (choice) => choice.id === mission.transfer.correctChoiceId,
    )!.label;
    assert.ok(
      mission.transfer.wrongHint.trim().length > 0,
      `${mission.id} transfer needs a wrong-answer hint`,
    );
    assert.equal(
      mission.transfer.wrongHint.includes(correctLabel),
      false,
      `${mission.id} wrong-answer hint must not expose the correct choice`,
    );
    assert.notEqual(
      mission.transfer.wrongHint,
      mission.transfer.explanation,
      `${mission.id} hint and solved explanation must be distinct`,
    );
  }
});

test("every mission source parses and runs to completion", () => {
  for (const mission of MEMORY_MISSIONS) {
    assert.doesNotThrow(
      () => parseProgram(mission.source),
      `${mission.id} source must parse`,
    );
    runMission(mission);
  }
});

test("mission programs produce the memory and register states they teach", () => {
  const pcMission = getMemoryMission("pc-next")!;
  const pc = runMission(pcMission);
  assert.equal(pc.snapshot.pc, 8);
  assert.equal(pc.deltas[0].pcAfter, 4);
  assert.equal(pcMission.checkpoint.correctChoiceId, "pc-4");

  const zeroWrapMission = getMemoryMission("x-zero-wrap")!;
  const zeroWrap = runMission(zeroWrapMission);
  assert.equal(zeroWrap.snapshot.registers[0], 0);
  assert.equal(zeroWrap.snapshot.registers[5], 0);
  assert.equal(zeroWrap.deltas[0].registerWrites[0].committed, false);
  assert.equal(zeroWrapMission.checkpoint.correctChoiceId, "zero-stays");

  const addressValueMission = getMemoryMission("memory-address-value")!;
  const addressValue = runMission(addressValueMission);
  assert.equal(addressValue.snapshot.registers[5], DATA_BASE);
  assert.equal(addressValue.snapshot.registers[6], 42);
  assert.equal(addressValue.deltas[1].memoryAccesses[0].address, DATA_BASE);
  assert.equal(
    addressValueMission.checkpoint.correctChoiceId,
    "address-then-value",
  );

  const byteStoreMission = getMemoryMission("memory-store-byte")!;
  const byteStore = runMission(byteStoreMission);
  assert.deepEqual(byteStore.snapshot.memory.slice(0, 4), [
    0xaa,
    0x44,
    0xcc,
    0xdd,
  ]);
  assert.deepEqual(byteStore.deltas[0].memoryPatches[0].after, [0x44]);
  assert.equal(byteStoreMission.checkpoint.correctChoiceId, "byte-correct");

  const littleEndianMission = getMemoryMission("memory-little-endian")!;
  const littleEndian = runMission(littleEndianMission);
  assert.deepEqual(littleEndian.snapshot.memory.slice(0, 4), [
    0x78,
    0x56,
    0x34,
    0x12,
  ]);
  assert.equal(littleEndianMission.checkpoint.correctChoiceId, "little");

  const partialStoreMission = getMemoryMission("memory-partial-store")!;
  const partialStore = runMission(partialStoreMission);
  assert.deepEqual(partialStore.snapshot.memory.slice(0, 4), [
    0x11,
    0x22,
    0xdd,
    0xcc,
  ]);
  assert.equal(partialStore.snapshot.registers[6], 0xccdd2211);
  assert.equal(
    partialStoreMission.checkpoint.correctChoiceId,
    "partial-correct",
  );

  const signedLoadsMission = getMemoryMission("memory-signed-loads")!;
  const signedLoads = runMission(signedLoadsMission);
  assert.equal(signedLoads.snapshot.registers[5], 0xffffff80);
  assert.equal(signedLoads.snapshot.registers[6], 0x00000080);
  assert.equal(
    signedLoadsMission.checkpoint.correctChoiceId,
    "signed-extended",
  );

  const branchLoopMission = getMemoryMission("branch-memory-loop")!;
  const branchLoop = runMission(branchLoopMission);
  assert.deepEqual(branchLoop.snapshot.memory.slice(0, 4), [
    0x5a,
    0x5a,
    0x5a,
    0x5a,
  ]);
  assert.equal(branchLoop.snapshot.registers[5], DATA_BASE + 4);
  assert.deepEqual(
    branchLoop.deltas
      .flatMap((delta) => delta.memoryAccesses)
      .filter((access) => access.kind === "write")
      .map((access) => access.address),
    [DATA_BASE, DATA_BASE + 1, DATA_BASE + 2, DATA_BASE + 3],
  );
  assert.equal(branchLoop.deltas[0].controlFlow.kind, "branch");
  assert.equal(branchLoop.deltas[0].controlFlow.taken, false);
  assert.equal(branchLoop.deltas[0].pcAfter, 4);
  assert.equal(
    branchLoopMission.checkpoint.correctChoiceId,
    "loop-not-taken",
  );
});

test("transfer scenarios execute to the state named by their correct answer", () => {
  const pcMission = getMemoryMission("pc-next")!;
  const pc = runTransferScenario(pcMission);
  assert.equal(pc.snapshot.pc, 0x0c);
  assert.equal(pcMission.transfer.correctChoiceId, "three-12");

  const zeroWrapMission = getMemoryMission("x-zero-wrap")!;
  const zeroWrap = runTransferScenario(zeroWrapMission);
  assert.equal(zeroWrap.snapshot.registers[7], 1);
  assert.equal(zeroWrapMission.transfer.correctChoiceId, "wrap-one");

  const addressValueMission = getMemoryMission("memory-address-value")!;
  const addressValue = runTransferScenario(addressValueMission);
  assert.equal(addressValue.snapshot.registers[7], DATA_BASE + 4);
  assert.equal(addressValue.snapshot.registers[8], 0x35);
  assert.equal(
    addressValueMission.transfer.correctChoiceId,
    "new-address-then-value",
  );

  const byteStoreMission = getMemoryMission("memory-store-byte")!;
  const byteStore = runTransferScenario(byteStoreMission);
  assert.deepEqual(byteStore.snapshot.memory.slice(0, 4), [
    0x10,
    0x20,
    0xd4,
    0x40,
  ]);
  assert.equal(
    byteStoreMission.transfer.correctChoiceId,
    "new-byte-correct",
  );

  const littleEndianMission = getMemoryMission("memory-little-endian")!;
  const littleEndian = runTransferScenario(littleEndianMission);
  assert.deepEqual(littleEndian.snapshot.memory.slice(0, 4), [
    0xd4,
    0xc3,
    0xb2,
    0xa1,
  ]);
  assert.equal(
    littleEndianMission.transfer.correctChoiceId,
    "new-little",
  );

  const partialStoreMission = getMemoryMission("memory-partial-store")!;
  const partialStore = runTransferScenario(partialStoreMission);
  assert.deepEqual(partialStore.snapshot.memory.slice(0, 4), [
    0xcd,
    0xab,
    0x33,
    0x44,
  ]);
  assert.equal(partialStore.snapshot.registers[8], 0x4433abcd);
  assert.equal(
    partialStoreMission.transfer.correctChoiceId,
    "new-partial-word",
  );

  const signedLoadsMission = getMemoryMission("memory-signed-loads")!;
  const signedLoads = runTransferScenario(signedLoadsMission);
  assert.equal(signedLoads.snapshot.registers[7], 0xfffffffe);
  assert.equal(signedLoads.snapshot.registers[8], 0x000000fe);
  assert.equal(
    signedLoadsMission.transfer.correctChoiceId,
    "new-signed-pair",
  );

  const branchLoopMission = getMemoryMission("branch-memory-loop")!;
  const branchLoop = runTransferScenario(branchLoopMission);
  assert.deepEqual(branchLoop.snapshot.memory.slice(0, 6), [
    0,
    0,
    0xc7,
    0xc7,
    0xc7,
    0,
  ]);
  assert.equal(branchLoop.snapshot.registers[8], DATA_BASE + 5);
  assert.equal(
    branchLoopMission.transfer.correctChoiceId,
    "new-loop-complete",
  );
});
