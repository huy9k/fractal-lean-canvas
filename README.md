# Fractal Lean Canvas (FLC)

TypeBox schema, types, and validators for **Fractal Lean Canvas** — a recursive Lean Canvas contract for Operations as Code.

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

## Recommended layout

Validators only require a directory (or path) that contains `root.json`. Layout under that tree is free. Prefer this shape so humans and agents can browse easily:

```
recommended/
  root.json           # versioned envelope (only this file)
  nodes/              # every nested canvas (bare JSON)
    exec-on-demand-dispatch.json
    concept-personal-driver.json
    companies/        # optional folders — ids still rule nesting
      acme.json
```

Nest edges use canvas `id`, not paths. Filename ≈ `id` is a handy default, not a rule.

## Quick start (library)

```ts
import {
  FractalLeanCanvas,
  validateDocument,
  validateEcosystem,
  markdownFromPath,
  SCHEMA_VERSION,
} from "fractal-lean-canvas";

const issues = validateDocument(json, "path/to/root.json");
if (issues.length) throw new Error(issues.map((i) => i.message).join("\n"));

const result = await validateEcosystem("./recommended"); // expects ./recommended/root.json
if (!result.ok) process.exit(1);

const md = await markdownFromPath("./recommended");
if (md.ok) console.log(md.markdown);
```

`FractalLeanCanvas` is the TypeBox schema (`typebox` 1.x); use `Type.Static`-compatible types from the same export name for typing.

## CLI

```bash
npx flc validate ./recommended
npx flc markdown ./recommended          # ecosystem → markdown on stdout
npx flc markdown ./recommended/nodes/x.json
# or after build:
npm run validate   # validates ./fixtures/recommended
```

Exit `0` on success, non-zero with path + message diagnostics on failure. `markdown` writes the document to stdout.

## Document layout

**`root.json` only** — the versioned envelope:

```json
{
  "$schema": "https://example.com/flc/0.1.0.json",
  "schemaVersion": "0.1.0",
  "data": { "...": "FractalLeanCanvas" }
}
```

**Child files** — bare `FractalLeanCanvas` objects (no envelope). Nest slots point at them by canvas `id`:

```json
"executionCanvas": { "id": "exec-on-demand-dispatch" }
```

Nest ids must match another bare canvas’s `id`, must be unique across the ecosystem, and must not target the root canvas. See [`fixtures/recommended`](fixtures/recommended) (classic Uber Lean Canvas + nested nodes).

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
