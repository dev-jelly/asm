import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeAddi,
  encodeBeq,
  encodeLw,
  encodeSw,
} from "../lib/rv32i/encoding";
import { summarizeDeltaBatch } from "../app/hooks/useRv32iWorker";
import { Rv32iMachine } from "../lib/rv32i/machine";
import { parseProgram } from "../lib/rv32i/parser";
import type { WorkerCommand, WorkerResponse } from "../lib/rv32i/protocol";
import { appendTrace, DEFAULT_TRACE_LIMIT } from "../lib/rv32i/trace";
import { Rv32iWorkerController } from "../lib/rv32i/worker-controller";
import {
  DATA_BASE,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  PROTOCOL_VERSION,
  Rv32iError,
  type StepDelta,
} from "../lib/rv32i/types";

function command(
  type: WorkerCommand["type"],
  additions: Partial<WorkerCommand> = {},
): WorkerCommand {
  return {
    protocolVersion: PROTOCOL_VERSION,
    runId: "run-1",
    commandId: `command-${type}`,
    type,
    ...additions,
  } as WorkerCommand;
}

test("encodes representative addi, lw, sw, and beq instructions", () => {
  assert.equal(encodeAddi(5, 0, 7), 0x00700293);
  assert.equal(encodeLw(6, 10, 0), 0x00052303);
  assert.equal(encodeSw(5, 10, 0), 0x00552023);
  assert.equal(encodeBeq(5, 6, 8), 0x00628463);
});

test("resolves forward and backward labels without assigning PC space to labels", () => {
  const program = parseProgram(`start:
addi x5, x0, 1
beq x5, x0, end
beq x0, x0, start
end:`);

  assert.equal(program.labels.start, 0);
  assert.equal(program.labels.end, 12);
  assert.equal(program.instructions.length, 3);
  assert.equal(program.instructions[2].address, 8);
  assert.equal(program.instructions[2].mnemonic, "beq");
  if (program.instructions[2].mnemonic === "beq") {
    assert.equal(program.instructions[2].operands[2].address, 0);
  }
  assert.equal(Object.getPrototypeOf(program.labels), null);
});

test("keeps x0 immutable and reports an ignored write", () => {
  const machine = new Rv32iMachine("addi x0, x0, 1");
  const delta = machine.step();

  assert.equal(machine.snapshot().registers[0], 0);
  assert.deepEqual(delta.registerWrites, [
    { register: 0, before: 0, after: 0, committed: false },
  ]);
});

test("wraps arithmetic and register writes to unsigned 32 bits", () => {
  const machine = new Rv32iMachine("addi x5, x5, 1", {
    initialRegisters: { 5: 0xffffffff },
  });
  machine.step();
  assert.equal(machine.snapshot().registers[5], 0);
});

test("stores and reconstructs aligned words in little-endian byte order", () => {
  const machine = new Rv32iMachine(`sw x5, 0(x10)
lw x6, 0(x10)`, {
    initialRegisters: { 5: 0x12345678 },
  });
  const store = machine.step();
  assert.deepEqual(store.memoryPatches[0].after, [0x78, 0x56, 0x34, 0x12]);
  assert.deepEqual(machine.snapshot().memory.slice(0, 4), [
    0x78, 0x56, 0x34, 0x12,
  ]);
  machine.step();
  assert.equal(machine.snapshot().registers[6], 0x12345678);
});

test("rejects misaligned and out-of-bounds word access without mutation", () => {
  const misaligned = new Rv32iMachine("sw x5, 2(x10)", {
    initialRegisters: { 5: 0x12345678 },
  });
  const beforeMisaligned = misaligned.snapshot();
  assert.throws(
    () => misaligned.step(),
    (error) => error instanceof Rv32iError && error.code === "MISALIGNED_WORD",
  );
  assert.deepEqual(misaligned.snapshot(), beforeMisaligned);

  const outOfBounds = new Rv32iMachine("sw x5, 0(x10)", {
    initialRegisters: { 5: 0x12345678, 10: DATA_BASE + 0x1000 },
  });
  const beforeBounds = outOfBounds.snapshot();
  assert.throws(
    () => outOfBounds.step(),
    (error) => error instanceof Rv32iError && error.code === "MEMORY_BOUNDS",
  );
  assert.deepEqual(outOfBounds.snapshot(), beforeBounds);
});

test("executes taken and untaken label-aware branches", () => {
  const source = `beq x5, x6, equal
addi x7, x0, 1
equal:
addi x7, x0, 2`;
  const taken = new Rv32iMachine(source, {
    initialRegisters: { 5: 9, 6: 9 },
  });
  const takenDelta = taken.step();
  assert.equal(takenDelta.controlFlow.taken, true);
  assert.equal(taken.snapshot().pc, 8);

  const notTaken = new Rv32iMachine(source, {
    initialRegisters: { 5: 9, 6: 8 },
  });
  const notTakenDelta = notTaken.step();
  assert.equal(notTakenDelta.controlFlow.taken, false);
  assert.equal(notTaken.snapshot().pc, 4);
});

test("Back restores identical single-step and multi-step state", () => {
  const machine = new Rv32iMachine(`addi x5, x0, 7
sw x5, 0(x10)
lw x6, 0(x10)`);
  const initial = machine.snapshot();
  machine.step();
  const afterOne = machine.snapshot();
  machine.step();
  machine.step();

  machine.back();
  machine.back();
  assert.deepEqual(machine.snapshot(), afterOne);
  machine.back();
  assert.deepEqual(machine.snapshot(), initial);
  assert.equal(machine.back(), null);
});

test("bounds reversible history with a validated and capped limit", () => {
  const source = "loop: beq x0, x0, loop";
  const defaults = new Rv32iMachine(source);
  for (let index = 0; index < DEFAULT_HISTORY_LIMIT + 9; index += 1) {
    defaults.step();
  }
  assert.equal(defaults.snapshot().historyDepth, DEFAULT_HISTORY_LIMIT);

  const configured = new Rv32iMachine(source, { historyLimit: 3 });
  for (let index = 0; index < 8; index += 1) configured.step();
  assert.equal(configured.snapshot().historyDepth, 3);
  assert.ok(configured.back());
  assert.ok(configured.back());
  assert.ok(configured.back());
  assert.equal(configured.back(), null);
  assert.equal(configured.snapshot().stepIndex, 5);

  const capped = new Rv32iMachine(source, {
    historyLimit: MAX_HISTORY_LIMIT + 10_000,
  });
  for (let index = 0; index < MAX_HISTORY_LIMIT + 2; index += 1) {
    capped.step();
  }
  assert.equal(capped.snapshot().historyDepth, MAX_HISTORY_LIMIT);

  for (const historyLimit of [-1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => new Rv32iMachine(source, { historyLimit }),
      (error) =>
        error instanceof Rv32iError && error.code === "HISTORY_LIMIT",
    );
  }
});

test("bounds client trace across repeated delta batches", () => {
  const machine = new Rv32iMachine("loop: beq x0, x0, loop", {
    historyLimit: 400,
  });
  const deltas: StepDelta[] = [];
  for (let index = 0; index < DEFAULT_TRACE_LIMIT + 20; index += 1) {
    deltas.push(machine.step());
  }

  let trace = appendTrace([], deltas.slice(0, 120));
  trace = appendTrace(trace, deltas.slice(120, 220));
  trace = appendTrace(trace, deltas.slice(220));

  assert.equal(trace.length, DEFAULT_TRACE_LIMIT);
  assert.equal(trace[0].stepIndexBefore, 20);
  assert.equal(trace.at(-1)?.stepIndexAfter, DEFAULT_TRACE_LIMIT + 20);
  assert.deepEqual(appendTrace(trace, deltas.slice(0, 4), 0), []);
  assert.throws(() => appendTrace(trace, [], -1), RangeError);
});

test("summarizes every delta in a completed Run batch", () => {
  const machine = new Rv32iMachine(`addi x5, x0, 7
sw x5, 0(x10)
lw x6, 0(x10)`);
  const deltas = [machine.step(), machine.step(), machine.step()];
  const summary = summarizeDeltaBatch(deltas, machine.snapshot().pc);

  assert.match(summary, /3개 명령어/);
  assert.match(summary, /레지스터 쓰기 2회/);
  assert.match(summary, /메모리 읽기 1회/);
  assert.match(summary, /메모리 쓰기 1회/);
});

test("controller stops an infinite branch at its instruction budget", () => {
  const responses: WorkerResponse[] = [];
  const tasks = new Map<number, () => void>();
  let taskId = 0;
  const controller = new Rv32iWorkerController(
    (response) => responses.push(response),
    {
      chunkSize: 2,
      instructionBudget: 5,
      schedule: (callback) => {
        taskId += 1;
        tasks.set(taskId, callback);
        return taskId as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: (handle) => tasks.delete(handle as unknown as number),
    },
  );

  controller.handle(
    command("LOAD", { source: "loop: beq x0, x0, loop" }),
  );
  controller.handle(command("RUN"));
  while (tasks.size) {
    const [id, task] = tasks.entries().next().value as [number, () => void];
    tasks.delete(id);
    task();
  }

  const final = responses.at(-1);
  assert.equal(final?.type, "STATE");
  if (final?.type === "STATE") {
    assert.equal(final.status, "paused");
    assert.equal(final.reason, "instruction-budget");
    assert.equal(final.snapshot.stepIndex, 5);
  }
  assert.doesNotThrow(() => structuredClone(responses));
});

test("Pause and Reset cancel scheduled Run work deterministically", () => {
  const responses: WorkerResponse[] = [];
  const tasks = new Map<number, () => void>();
  let taskId = 0;
  const controller = new Rv32iWorkerController(
    (response) => responses.push(response),
    {
      chunkSize: 1,
      schedule: (callback) => {
        taskId += 1;
        tasks.set(taskId, callback);
        return taskId as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: (handle) => tasks.delete(handle as unknown as number),
    },
  );

  controller.handle(
    command("LOAD", { source: "loop: beq x0, x0, loop" }),
  );
  controller.handle(command("RUN"));
  assert.equal(tasks.size, 1);
  controller.handle(command("PAUSE"));
  assert.equal(tasks.size, 0);
  let final = responses.at(-1);
  assert.equal(final?.type === "STATE" && final.status, "paused");

  controller.handle(command("RUN"));
  controller.handle(command("RESET"));
  assert.equal(tasks.size, 0);
  final = responses.at(-1);
  if (final?.type === "STATE") {
    assert.equal(final.reason, "reset");
    assert.equal(final.snapshot.pc, 0);
    assert.equal(final.snapshot.stepIndex, 0);
  } else {
    assert.fail("expected reset state");
  }
});

test("Pause after completion reports completion instead of a user pause", () => {
  const responses: WorkerResponse[] = [];
  const controller = new Rv32iWorkerController((response) =>
    responses.push(response),
  );

  controller.handle(command("LOAD", { source: "addi x5, x0, 1" }));
  controller.handle(command("STEP"));
  controller.handle(command("PAUSE"));

  const final = responses.at(-1);
  assert.equal(final?.type, "STATE");
  if (final?.type === "STATE") {
    assert.equal(final.status, "completed");
    assert.equal(final.reason, "completed");
  }
});

test("Run errors include committed deltas from the partial chunk", () => {
  const responses: WorkerResponse[] = [];
  const tasks = new Map<number, () => void>();
  let taskId = 0;
  const controller = new Rv32iWorkerController(
    (response) => responses.push(response),
    {
      chunkSize: 4,
      schedule: (callback) => {
        taskId += 1;
        tasks.set(taskId, callback);
        return taskId as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: (handle) => tasks.delete(handle as unknown as number),
    },
  );

  controller.handle(
    command("LOAD", {
      source: `addi x5, x0, 7
sw x5, 2(x10)`,
    }),
  );
  controller.handle(command("RUN"));
  const [scheduledId, scheduledRun] = tasks.entries().next().value as [
    number,
    () => void,
  ];
  tasks.delete(scheduledId);
  scheduledRun();

  const final = responses.at(-1);
  assert.equal(final?.type, "ERROR");
  if (final?.type === "ERROR") {
    assert.equal(final.code, "MISALIGNED_WORD");
    assert.equal(final.deltas?.length, 1);
    assert.equal(final.deltas?.[0].instruction.mnemonic, "addi");
    assert.equal(final.snapshot?.stepIndex, 1);
    assert.equal(final.snapshot?.registers[5], 7);
  }
  assert.doesNotThrow(() => structuredClone(final));
});

test("history remains bounded across paused and resumed Run commands", () => {
  const responses: WorkerResponse[] = [];
  const tasks = new Map<number, () => void>();
  let taskId = 0;
  const controller = new Rv32iWorkerController(
    (response) => responses.push(response),
    {
      chunkSize: 2,
      instructionBudget: 4,
      schedule: (callback) => {
        taskId += 1;
        tasks.set(taskId, callback);
        return taskId as unknown as ReturnType<typeof setTimeout>;
      },
      cancel: (handle) => tasks.delete(handle as unknown as number),
    },
  );
  const drain = () => {
    while (tasks.size) {
      const [id, task] = tasks.entries().next().value as [
        number,
        () => void,
      ];
      tasks.delete(id);
      task();
    }
  };

  controller.handle(
    command("LOAD", {
      source: "loop: beq x0, x0, loop",
      options: { historyLimit: 3 },
    }),
  );
  controller.handle(command("RUN"));
  drain();
  let final = responses.at(-1);
  assert.equal(final?.type === "STATE" && final.snapshot.stepIndex, 4);
  assert.equal(final?.type === "STATE" && final.snapshot.historyDepth, 3);

  controller.handle(command("RUN"));
  drain();
  final = responses.at(-1);
  assert.equal(final?.type === "STATE" && final.snapshot.stepIndex, 8);
  assert.equal(final?.type === "STATE" && final.snapshot.historyDepth, 3);

  controller.handle(command("BACK"));
  controller.handle(command("BACK"));
  controller.handle(command("BACK"));
  controller.handle(command("BACK"));
  final = responses.at(-1);
  if (final?.type === "STATE") {
    assert.equal(final.reason, "empty-history");
    assert.equal(final.snapshot.stepIndex, 5);
  } else {
    assert.fail("expected bounded history state");
  }
});

test("controller rejects stale commands and keeps responses serializable", () => {
  const responses: WorkerResponse[] = [];
  const controller = new Rv32iWorkerController((response) =>
    responses.push(response),
  );
  controller.handle(command("LOAD", { source: "addi x5, x0, 1" }));
  controller.handle({
    ...command("STEP"),
    runId: "old-run",
  });

  const final = responses.at(-1);
  assert.equal(final?.type, "ERROR");
  if (final?.type === "ERROR") assert.equal(final.code, "STALE_RUN");
  assert.doesNotThrow(() => structuredClone(final));
  controller.dispose();
});
