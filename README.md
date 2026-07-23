# ASM LAB

A Korean-first RV32I learning laboratory. Learners predict the next state
change before executing code, then inspect the exact register, program counter,
and byte-addressed memory delta.

## What is included

- A deterministic educational RV32I subset with `addi`, `lw`, `sw`, and `beq`
- A Dedicated Web Worker protocol for Step, Back, Reset, Run, and Pause
- Immutable `x0`, unsigned 32-bit wraparound, aligned little-endian word memory,
  label-aware branches, bounded execution, and reversible history
- A prediction-gated first lesson, address-versus-value practice, instruction
  reference, and device-local progress
- Responsive light and dark themes with keyboard and screen-reader support

The implementation intentionally does not include accounts, server
persistence, uploads, external data, or a generalized assembly IDE.

## Local development

Node.js `>=22.13.0` is required.

```bash
npm install
npm run dev
npm run build
```

Useful checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:rendered
npm test
```

The existing vinext, Vite, Cloudflare Worker, Tailwind v4, and Sites packaging
architecture is preserved. `.openai/hosting.json` deliberately declares no D1
or R2 resources for this local-first version.
