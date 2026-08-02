import assert from "node:assert/strict";
import test from "node:test";
import { registerSummary } from "../app/components/ExecutionTimeline";
import { traceAfterBack } from "../app/hooks/useRv32iWorker";
import { Rv32iMachine } from "../lib/rv32i/machine";

test("Back restores the previous remaining trace delta without mutating the input", () => {
  const machine = new Rv32iMachine(`addi x5, x0, 7
addi x6, x5, 1`);
  const first = machine.step();
  const second = machine.step();
  const trace = [first, second];

  const rewound = traceAfterBack(trace);

  assert.deepEqual(rewound, [first]);
  assert.equal(rewound.at(-1), first);
  assert.deepEqual(trace, [first, second]);
  assert.deepEqual(traceAfterBack(rewound), []);
});

test("timeline register summary distinguishes ignored and committed writes", () => {
  const ignored = new Rv32iMachine("addi x0, x0, 1").step();
  const committed = new Rv32iMachine("addi x5, x0, 7").step();

  assert.equal(
    registerSummary(ignored),
    "x0 쓰기 무시, 값 0x00000000 유지",
  );
  assert.equal(
    registerSummary(committed),
    "x5 0x00000000 → 0x00000007",
  );
});
