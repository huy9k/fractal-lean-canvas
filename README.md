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

1. **One recursive shape** — Every node is a `FractalLeanCanvas` with the nine Lean Canvas dimensions. On disk, child links are `{ "id": "canvas-id" }` on line-item `node` (one file per canvas; file tree is layout-only). Nested canvases under `node` are also schema-valid (e.g. `fractal-lean-canvas json -r`).
2. **Single root** — Each ecosystem has one `root.flc.json` versioned envelope. All other JSON files are bare canvases (no `schemaVersion`) ending with `.flc.json`.
3. **Homogeneous traversal** — Agents walk the same structure at enterprise depth or task depth (`validateEcosystem` resolves canvas ids from the root).
4. **Git holds truth** — Documents are JSON in Git. Version authority lives only on `root.json`. There is no embedded commit hash.

## Recommended layout

Validators only require a directory (or path) that contains `root.flc.json`. Layout under that tree is free. Prefer this shape so humans and agents can browse easily:

```
recommended/
  root.flc.json       # versioned envelope (only this file)
  nodes/              # every nested canvas (bare JSON ending with .flc.json)
    exec-on-demand-dispatch.flc.json
    concept-personal-driver.flc.json
    companies/        # optional folders — ids still rule nesting
      acme.flc.json
```

Nest edges use canvas `id`, not paths. Filename ≈ `id` is a handy default, not a rule.

## Quick start (library)

```ts
import {
  FractalLeanCanvas,
  validateDocument,
  validateEcosystem,
  markdownFromPath,
  htmlTableFromPath,
  SCHEMA_VERSION,
} from "fractal-lean-canvas";

const issues = validateDocument(json, "path/to/root.flc.json");
if (issues.length) throw new Error(issues.map((i) => i.message).join("\n"));

const result = await validateEcosystem("./recommended"); // expects ./recommended/root.flc.json
if (!result.ok) process.exit(1);

const md = await markdownFromPath("./recommended/root.flc.json");
if (md.ok) console.log(md.markdown);

const html = await htmlTableFromPath("./recommended/root.flc.json", {
  recursive: true,
});
if (html.ok) console.log(html.output);
```

`FractalLeanCanvas` is the TypeBox schema (`typebox` 1.x); use `Type.Static`-compatible types from the same export name for typing.

## CLI

```bash
npx fractal-lean-canvas validate ./recommended
npx fractal-lean-canvas markdown ./recommended/root.flc.json          # one canvas (lists + headings)
npx fractal-lean-canvas markdown ./recommended -r                 # follow node ids
npx fractal-lean-canvas html-table ./recommended/root.flc.json        # classic Lean Canvas HTML
npx fractal-lean-canvas html-table ./recommended -r
npx fractal-lean-canvas json ./recommended/root.flc.json              # one canvas as versioned envelope
npx fractal-lean-canvas json ./recommended -r                     # envelope with every node inlined
# or after build:
npm run validate   # validates ./fixtures/recommended
```

Exit `0` on success, non-zero with path + message diagnostics on failure. `markdown` / `html-table` / `json` write to stdout. Recursive expansion requires `-r` / `--recursive`.

## Document layout

**`root.flc.json` only** — the versioned envelope:

```json
{
  "$schema": "https://example.com/flc/0.1.0.json",
  "schemaVersion": "0.1.0",
  "data": { "...": "FractalLeanCanvas" }
}
```

**Child files** — bare `FractalLeanCanvas` objects (no envelope). Line items share one shape (`id`, `title`, optional `value` / `detail` / `node`). Node slots point at canvases by id:

```json
"node": { "id": "exec-on-demand-dispatch" }
```

Node ids must match another bare canvas’s `id`, must be unique across the ecosystem, and must not target the root canvas. Humans/agents should read `title` (and `value`); treat line-item `id` as machine-only. See [`fixtures/recommended`](fixtures/recommended) (classic Uber Lean Canvas + child nodes).

## What validation covers

| Layer      | Checks                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Structural | Root = envelope; other `.flc.json` = bare canvas                                                             |
| Semantic   | Unique `id`s, max depth (`16`), cycle guard, cost rollups (child expenses ≤ parent / mitigation ≤ line item) |
| Ecosystem  | Requires `root.flc.json`; resolves `{ id }` node links; bans unreachable files; ecosystem-wide id uniqueness |

`validateDocument` validates a root envelope. Nested canvases under `node` are walked; `{ id }` refs need `validateEcosystem` / `fractal-lean-canvas validate`.

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
