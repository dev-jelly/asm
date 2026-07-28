# ASM LAB

A Korean-first RV32I learning laboratory. Learners predict the next state
change before executing code, then inspect the exact register, program counter,
and byte-addressed memory delta.

## What is included

- A deterministic educational RV32I subset with `addi`, `lb/lbu/lh/lhu/lw`,
  `sb/sh/sw`, and `beq`
- A Dedicated Web Worker protocol for Step, Back, Reset, Run, and Pause
- Immutable `x0`, unsigned 32-bit wraparound, aligned little-endian byte,
  halfword, and word memory, initialized-byte tracking, label-aware branches,
  bounded execution, and reversible history
- A prediction-gated first lesson, address-versus-value practice, instruction
  reference, editable source, execution timeline, and exportable device-local
  progress
- A 16-byte memory map with address navigation, byte/halfword/word grouping,
  signed/unsigned/hex views, little-endian explanation, and initialized-byte
  visualization
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
npm run test:e2e
npm test
```

`npm test` runs the unit suite, production build, rendered-output checks, and
desktop/mobile Chromium E2E suite.

## Deployment

The site is a static vinext export hosted at
[dev-jelly.github.io/asm](https://dev-jelly.github.io/asm/). Pull requests
targeting `main` and pushes to `main` run type checking, lint, unit tests, the
production build, rendered-output tests, and desktop/mobile Chromium tests.
Only a push to `main` or a manual workflow dispatch uploads `dist/client` to
GitHub Pages. The `/asm/` base path is configured for this project site, and
`public/.nojekyll` keeps GitHub Pages from applying Jekyll processing.

The learning runtime remains entirely local to the browser. It does not use a
Cloudflare Worker, D1, R2, or a server-side persistence service.

## Dependency security

The production dependency audit is a blocking CI check. A full audit also runs
with a critical-severity failure threshold; it currently reports nine
high-severity findings in the development-only ESLint/minimatch dependency tree
without failing the workflow because they cannot yet be removed without
incompatible ecosystem upgrades. The `postcss` and `sharp` overrides are
temporary security pins and should be removed once upstream-compatible patched
versions are available.
