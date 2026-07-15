# Fractal Lean Canvas (FLC)

TypeBox schema, TypeScript types, and validators for **Fractal Lean Canvas** — a recursive Lean Canvas contract for Operations as Code.

This repo is the **schema authority**. Store live business canvases in a separate state repo and validate them with this package.

> **Pre-release.** This package is still unstable. Expect breaking changes without a major version bump until `1.0.0`.

## Install

```bash
npm install fractal-lean-canvas
```

Requires Node.js 20+.

## Concepts

1. **One recursive shape** — Every node is a `FractalLeanCanvas` with the nine Lean Canvas dimensions. Nest slots are always `{ "id": "canvas-id" }` (no inline nests, no file paths — one file per canvas; file tree is layout-only).
2. **Single root** — Each ecosystem has one `root.json` versioned envelope. All other JSON files are bare canvases (no `schemaVersion`).
3. **Homogeneous traversal** — Agents walk the same structure at enterprise depth or task depth (`validateEcosystem` resolves canvas ids from the root).
4. **Git holds truth** — Documents are JSON in Git. Version authority lives only on `root.json`. There is no embedded commit hash.

## Quick start (library)

```ts
import {
  FractalLeanCanvas,
  validateDocument,
  validateEcosystem,
  SCHEMA_VERSION,
} from "fractal-lean-canvas";

const issues = validateDocument(json, "path/to/root.json");
if (issues.length) throw new Error(issues.map((i) => i.message).join("\n"));

const result = await validateEcosystem("./canvases"); // expects ./canvases/root.json
if (!result.ok) process.exit(1);
```

`FractalLeanCanvas` is the TypeBox schema (`typebox` 1.x); use `Type.Static`-compatible types from the same export name for typing.

## CLI

```bash
npx flc validate ./canvases
# or after build:
npm run validate   # validates ./fixtures (requires fixtures/root.json)
```

Exit `0` on success, non-zero with path + message diagnostics on failure.

## Document layout

**`root.json` only** — the versioned envelope:

```json
{
  "$schema": "https://example.com/flc/0.1.0.json",
  "schemaVersion": "0.1.0",
  "data": { "...": "FractalLeanCanvas" }
}
```

**Child files** — bare `FractalLeanCanvas` objects (no envelope). Nest slots point at them by canvas `id` (file path does not matter):

```json
"executionCanvas": { "id": "exec-on-demand-dispatch" }
```

Nest ids must match another bare canvas’s `id`, must be unique across the ecosystem, and must not target the root canvas. See [`fixtures/root.json`](fixtures/root.json) (classic Uber Lean Canvas), [`fixtures/exec-on-demand-dispatch.json`](fixtures/exec-on-demand-dispatch.json), and [`fixtures/concept-personal-driver.json`](fixtures/concept-personal-driver.json).

## What validation covers

| Layer      | Checks                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Structural | Root = envelope; other `.json` = bare canvas                                                                 |
| Semantic   | Unique `id`s, max depth (`16`), cycle guard, cost rollups (child expenses ≤ parent / mitigation ≤ line item) |
| Ecosystem  | Requires `root.json`; resolves `{ id }` nests; bans unreachable files; ecosystem-wide id uniqueness          |

`validateDocument` validates a root envelope and does not follow nest slots. Use `validateEcosystem` / `flc validate` for the full graph.

Business-specific policy belongs in your state repo (or a future plugin), not here.

## Development

```bash
npm install
npm run build
npm test
npm run validate
```

## License

MIT
