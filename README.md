# Fractal Lean Canvas (FLC)

TypeBox schema, types, and validators for **Fractal Lean Canvas** — a recursive Lean Canvas contract for Operations as Code.

This repo is the **schema authority**. Store live business canvases in a separate state repo and validate them with this package.

> **Pre-release.** This package is still unstable. Expect breaking changes without a major version bump until `1.0.0`.

## Agent skill

Operational playbook for agents (read / edit / validate FLC ecosystems):

[`.agents/skills/fractal-lean-canvas/SKILL.md`](.agents/skills/fractal-lean-canvas/SKILL.md)

Install into another project with the Agent Skills CLI:

```bash
npx skills add huy9k/fractal-lean-canvas
```

## Install

```bash
npm install fractal-lean-canvas
```

Requires Node.js 20+.

## Package layout

| Import                     | Runs where     | Contents                                                                                              |
| -------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| `fractal-lean-canvas`      | Browser + Node | Schema, finance helpers, validate, blank templates, `markdownCanvas` / `leanHtmlCanvas`, JSON helpers |
| `fractal-lean-canvas/node` | Node only      | `validateEcosystem`, `markdownFromPath` / `htmlTableFromPath` / `jsonFromPath`                        |

Source tree mirrors that split: `src/shared/` (pure), `src/node/` (`fs`), `src/cli/` (bin only).

## Concepts

1. **One recursive shape** — Every node is a `FractalLeanCanvas` with the nine Lean Canvas dimensions and a required `startDate`/`endDate` window.
2. **Cost-excuse fractal** — Child canvases attach only via `costStructure.expenses[].node`. Nested nodes are **cost centers** under **budgetary control** (child net burn ≤ sponsoring expense). No revenue rollup, no forced profitability, no canvas-level `children`. Design rationale (managerial-accounting vocabulary): [`.agents/skills/fractal-lean-canvas/references/nesting.md`](.agents/skills/fractal-lean-canvas/references/nesting.md).
3. **Single root** — Each ecosystem has one `root.flc.json` versioned envelope (`schemaVersion` + ISO 4217 `currency`). All other JSON files are bare canvases ending with `.flc.json`.
4. **Homogeneous traversal** — Agents walk the same structure at enterprise depth or task depth (`validateEcosystem` resolves canvas ids from the root).
5. **Git holds truth** — Documents are JSON in Git. Version authority and settlement currency live only on the root envelope.

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

Browser-safe (root):

```ts
import {
  FractalLeanCanvas,
  validateDocument,
  markdownCanvas,
  blankRootEnvelopeJson,
  SCHEMA_VERSION,
} from "fractal-lean-canvas";

const issues = validateDocument(json, "path/to/root.flc.json");
if (issues.length) throw new Error(issues.map((i) => i.message).join("\n"));

const md = markdownCanvas(canvas, { currency: "USD" });
const newFile = blankRootEnvelopeJson({ title: "Untitled" });
```

Node filesystem APIs:

```ts
import {
  validateEcosystem,
  markdownFromPath,
  htmlTableFromPath,
} from "fractal-lean-canvas/node";

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
npx fractal-lean-canvas init ./nodes/new-idea          # bare child canvas → new-idea.flc.json
npx fractal-lean-canvas init --root ./my-ecosystem     # → my-ecosystem/root.flc.json
npx fractal-lean-canvas validate ./recommended
npx fractal-lean-canvas markdown ./recommended/root.flc.json          # one canvas (lists + headings)
npx fractal-lean-canvas markdown ./recommended -r                 # follow cost node ids
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
  "$schema": "https://example.com/flc/0.14.1.json",
  "schemaVersion": "0.14.1",
  "currency": "USD",
  "data": { "...": "FractalLeanCanvas" }
}
```

**Child files** — bare `FractalLeanCanvas` objects (no envelope). Line-item kinds:

| Section                                                                           | Item type         | Money / metrics                                | Fractal `node`      |
| --------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------- | ------------------- |
| Qualitative blocks (problem, solution, segments, UVP, channels, unfair advantage) | `CanvasLineItem`  | —                                              | —                   |
| `costStructure.expenses`                                                          | `CostLineItem`    | `amountMinor` + `cadence` + optional dates     | optional `{ "id" }` |
| `revenueStreams.returns`                                                          | `RevenueLineItem` | same as cost                                   | —                   |
| `keyMetrics.kpis`                                                                 | `MetricLineItem`  | `targetValue` + `comparator` + optional `unit` | —                   |

`amountMinor` is the integer minor unit of envelope `currency` **per cadence tick** (e.g. cents for USD). Cadence is `one_time` or `recurring { every, unit }`. Item dates inherit the canvas window when omitted.

Cost `node` ids must match another bare canvas’s `id`, must be unique across the ecosystem, must not target the root, and each child may have **at most one** sponsoring expense (tree, not DAG). See [`fixtures/recommended`](fixtures/recommended) (early Uber Lean Canvas + cost-sponsored children).

**Value proposition & unfair advantage** — qualitative only:

- `valueProposition.statements` — the UVP pitch (prefer one primary statement)
- `valueProposition.highLevelConcepts` — X-for-Y analogies (may be empty; drill-down lives under a cost line)
- `unfairAdvantage.advantages` — moat bullets

## What validation covers

| Layer      | Checks                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Structural | Root = envelope (`currency` ISO 4217); other `.flc.json` = bare canvas; typed line items                                       |
| Semantic   | Unique `id`s, max depth (`16`), cycle guard, date bounds, single-parent cost tree, cadence-aware net-burn ≤ sponsoring expense |
| Ecosystem  | Requires `root.flc.json`; resolves cost `{ id }` links; bans unreachable files; ecosystem-wide id uniqueness                   |

Net burn = child costs − child revenues over the overlapping window (revenue assumed paid in time; no proration).

`validateDocument` validates a root envelope. Nested canvases under cost `node` are walked; `{ id }` refs need `validateEcosystem` / `fractal-lean-canvas validate`.

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
