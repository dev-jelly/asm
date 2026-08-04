import assert from "node:assert/strict";
import test from "node:test";
import { formatMemoryBytes } from "../app/lib/formatMemoryBytes";

test("formats initialized memory bytes as two-digit hexadecimal", () => {
  assert.equal(
    formatMemoryBytes([0x00, 0x12], [true, true]),
    "00 12",
  );
  assert.equal(formatMemoryBytes([0x00, 0x12]), "00 12");
});

test("masks only memory bytes known to be uninitialized", () => {
  assert.equal(
    formatMemoryBytes([0x00, 0x12], [false, true]),
    "?? 12",
  );
  assert.equal(
    formatMemoryBytes([0x00, 0x12], [false, false]),
    "?? ??",
  );
});
