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
import { DATA_BASE, type Snapshot, type StepDelta } from "../lib/rv32i/types";

type CompletedRun = {
  snapshot: Snapshot;
  deltas: StepDelta[];
};

function runMission(mission: MemoryMission): CompletedRun {
  const machine = new Rv32iMachine(mission.source, mission.options);
  const deltas: StepDelta[] = [];

  while (machine.snapshot().status !== "completed" && deltas.length < 512) {
    deltas.push(machine.step());
  }

  const snapshot = machine.snapshot();
  assert.equal(
    snapshot.status,
    "completed",
    `${mission.id} did not complete within 512 steps`,
  );
  return { snapshot, deltas };
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
});

test("every checkpoint and transfer question has one reachable answer", () => {
  for (const mission of MEMORY_MISSIONS) {
    const program = parseProgram(mission.source);
    assert.ok(
      program.instructions.some(
        (instruction) =>
          instruction.sourceLine === mission.checkpoint.sourceLine,
      ),
      `${mission.id} checkpoint must point to an instruction line`,
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
  const pc = runMission(getMemoryMission("pc-next")!);
  assert.equal(pc.snapshot.pc, 8);

  const zeroWrap = runMission(getMemoryMission("x-zero-wrap")!);
  assert.equal(zeroWrap.snapshot.registers[0], 0);
  assert.equal(zeroWrap.snapshot.registers[5], 0);
  assert.equal(zeroWrap.deltas[0].registerWrites[0].committed, false);

  const addressValue = runMission(getMemoryMission("memory-address-value")!);
  assert.equal(addressValue.snapshot.registers[5], DATA_BASE);
  assert.equal(addressValue.snapshot.registers[6], 42);
  assert.equal(addressValue.deltas[1].memoryAccesses[0].address, DATA_BASE);

  const byteStore = runMission(getMemoryMission("memory-store-byte")!);
  assert.deepEqual(byteStore.snapshot.memory.slice(0, 4), [
    0xaa,
    0x44,
    0xcc,
    0xdd,
  ]);
  assert.deepEqual(byteStore.deltas[0].memoryPatches[0].after, [0x44]);

  const littleEndian = runMission(
    getMemoryMission("memory-little-endian")!,
  );
  assert.deepEqual(littleEndian.snapshot.memory.slice(0, 4), [
    0x78,
    0x56,
    0x34,
    0x12,
  ]);

  const partialStore = runMission(
    getMemoryMission("memory-partial-store")!,
  );
  assert.deepEqual(partialStore.snapshot.memory.slice(0, 4), [
    0x11,
    0x22,
    0xdd,
    0xcc,
  ]);
  assert.equal(partialStore.snapshot.registers[6], 0xccdd2211);

  const signedLoads = runMission(
    getMemoryMission("memory-signed-loads")!,
  );
  assert.equal(signedLoads.snapshot.registers[5], 0xffffff80);
  assert.equal(signedLoads.snapshot.registers[6], 0x00000080);

  const branchLoop = runMission(getMemoryMission("branch-memory-loop")!);
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
});
