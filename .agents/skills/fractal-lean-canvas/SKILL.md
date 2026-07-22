---
name: fractal-lean-canvas
description:
  Read, create, edit, and validate Fractal Lean Canvas (FLC) ecosystems —
  recursive Lean Canvas JSON under root.flc.json with cost-sponsored child
  nodes. Use when working with .flc.json files, FLC schemas, Ops-as-Code
  canvases, fractal-lean-canvas CLI/library, or when the user mentions Lean
  Canvas nesting, costStructure.node, validateEcosystem, or life-flc /
  gitops canvas trees.
compatibility: Requires Node.js 20+ and fractal-lean-canvas (npm or repo checkout) for CLI validate/init/render.
---

# Fractal Lean Canvas

FLC is a **recursive Lean Canvas** contract: every node shares one shape; child canvases attach only via a sponsoring cost line. Git holds truth. This package is the **schema authority** — live business state lives in separate repos.

> Pre-release (`<1.0.0`): expect breaking schema changes.

## Critical rules

1. **Never reason from a single `.flc.json` alone.** Discover the ecosystem (`root.flc.json` + all bare canvases), then read the open canvas and its cost-sponsored children.
2. **Fractal nesting only on cost.** Child link is `costStructure.expenses[].node: { "id": "..." }`. No drill-down from UVP, segments, revenue, or a canvas-level `children` list. Nested nodes are **cost centers** under **budgetary control** — see [nesting.md](references/nesting.md).
3. **Tree, not DAG.** Each child canvas has at most one sponsoring expense; ids are unique; children must not target the root id.
4. **Root vs bare.** Only `root.flc.json` is a versioned envelope (`schemaVersion`, `currency`, `data`). Every other `*.flc.json` is a bare `FractalLeanCanvas`.
5. **Ids rule nesting, not paths.** Filename ≈ `id` is a convenience. Links resolve by canvas `id` across the tree. Cross-repo links keep that `id` and add optional `git: { url, ref?, path? }` — never encode locators inside the id string.
6. **Validate after edits.** Run ecosystem validate before claiming success.

## When this skill applies

- Any path ending in `.flc.json`
- Creating or restructuring an FLC ecosystem
- Explaining cost → child sponsorship, net-burn, cadence, or envelope currency
- Using `fractal-lean-canvas` / `fractal-lean-canvas/node` APIs or CLI

## Workflow

Copy and track:

```
FLC task:
- [ ] Locate ecosystem root (directory with root.flc.json)
- [ ] Catalog canvases (ids, titles, parent expense → child id)
- [ ] Read target canvas + sponsored children
- [ ] Edit (preserve envelope vs bare shape)
- [ ] Validate ecosystem
- [ ] Optional: render markdown/html/json for review
```

### 1. Locate the ecosystem

Find the directory containing `root.flc.json` (or the file itself). Recommended layout:

```
ecosystem/
  root.flc.json
  nodes/
    child-id.flc.json
    …
```

Layout under the root is free; validators only require that directory (or path) to contain `root.flc.json`.

### 2. Catalog before deep reads

Walk all `*.flc.json` under the ecosystem. Build a mental index:

| Field         | Source                               |
| ------------- | ------------------------------------ |
| `id`, `title` | each canvas (`data.*` on root)       |
| parent link   | expense with `node.id` on the parent |
| path          | file path for later edits            |

Host tip: some apps expose an FLC index API (e.g. Hub `getFlcIndex`) — use it when available, then still read file bodies for content.

### 3. Edit safely

- **Root file:** keep `$schema`, `schemaVersion`, `currency`; mutate only `data` (and currency when intentional).
- **Child file:** bare object — never wrap children in an envelope.
- **New child:** create bare canvas → add `node: { "id": "<child-id>" }` on exactly one parent expense → ensure child window fits parent / sponsor rules.
- **Money:** `amountMinor` is an integer in the envelope `currency`’s **minor unit** (not major units), **per cadence tick**. For `currency: "USD"`, that means **cents**: `$40,000.00` → `4000000`, `$12.50` → `1250`, `$1.00` → `100`. Never store dollars as a float or as a whole-dollar integer in `amountMinor`. Cadence is `one_time` or `recurring { every, unit }`.
- Prefer `npx fractal-lean-canvas init` / `init --root` over hand-rolled blanks.

### 4. Validate

```bash
npx fractal-lean-canvas validate ./path/to/ecosystem
# or: directory containing root.flc.json, or the root file path
```

Exit `0` only when structural + semantic + ecosystem checks pass. Fix diagnostics (path + message) and re-run.

### 5. Render (optional)

```bash
npx fractal-lean-canvas markdown ./path/to/ecosystem -r
npx fractal-lean-canvas html-table ./path/to/root.flc.json
npx fractal-lean-canvas json ./path/to/ecosystem -r   # envelope with nodes inlined
```

`-r` / `--recursive` follows cost `node` ids.

## CLI cheat sheet

```bash
npx fractal-lean-canvas init ./nodes/new-idea       # → new-idea.flc.json (bare)
npx fractal-lean-canvas init --root ./my-ecosystem  # → my-ecosystem/root.flc.json
npx fractal-lean-canvas validate ./my-ecosystem
npx fractal-lean-canvas schema                      # envelope JSON Schema
```

## Library (when coding against FLC)

Browser-safe:

```ts
import {
  validateDocument,
  markdownCanvas,
  blankRootEnvelopeJson,
} from "fractal-lean-canvas";
```

Node filesystem:

```ts
import { validateEcosystem, markdownFromPath } from "fractal-lean-canvas/node";
```

`validateDocument` checks a root envelope (and nested inline nodes). **Id refs across files** need `validateEcosystem` / CLI `validate`.

## Anti-patterns

- Treating one canvas file as the whole business context
- Putting child envelopes under `nodes/`
- Linking children from non-cost fields (including revenue or canvas-level `children`)
- Treating nesting as profit-center consolidation or rolling child profit into the parent
- Sharing one child across multiple sponsoring expenses
- Using `select`-style “dump everything” mental models — project id / title / sponsor / money fields you need
- Encoding org-specific policy in the schema package (belongs in the state repo)

## References

- [nesting.md](references/nesting.md) — why cost-center funding (not revenue / consolidation)
- [layout.md](references/layout.md) — envelope vs bare, line-item kinds, recommended tree
- [validation.md](references/validation.md) — structural / semantic / ecosystem checks
