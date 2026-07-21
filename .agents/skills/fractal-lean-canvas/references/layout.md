# FLC document layout

## Root envelope (`root.flc.json` only)

```json
{
  "$schema": "https://raw.githubusercontent.com/huy9k/fractal-lean-canvas/raw-schema-json/envelope-0.13.0.json",
  "schemaVersion": "0.13.0",
  "currency": "USD",
  "data": { "...": "FractalLeanCanvas" }
}
```

- `schemaVersion` must match the installed package version until `1.0.0` stabilizes.
- `currency` is ISO 4217 (`^[A-Z]{3}$`). All `amountMinor` values are in that currency’s minor unit.
- Version authority and settlement currency live **only** on the root envelope.

## Bare child (`*.flc.json`)

Bare `FractalLeanCanvas` — no `$schema` / `schemaVersion` / `currency` wrapper.

Required canvas fields include: `id`, `title`, `ownerId`, `startDate`, `endDate`, plus the nine Lean Canvas sections.

## Line-item kinds

| Section                                                      | Item type         | Money / metrics                                | Fractal `node`      |
| ------------------------------------------------------------ | ----------------- | ---------------------------------------------- | ------------------- |
| problem, solution, segments, UVP, channels, unfair advantage | `CanvasLineItem`  | —                                              | —                   |
| `costStructure.expenses`                                     | `CostLineItem`    | `amountMinor` + `cadence` + optional dates     | optional `{ "id" }` |
| `revenueStreams.returns`                                     | `RevenueLineItem` | same as cost                                   | —                   |
| `keyMetrics.kpis`                                            | `MetricLineItem`  | `targetValue` + `comparator` + optional `unit` | —                   |

Qualitative item shape: `{ id, title, detail? }`.

Timed money cadence:

```json
{ "type": "one_time" }
```

```json
{ "type": "recurring", "every": 1, "unit": "month" }
```

`unit`: `day` | `week` | `month` | `year`. Item dates inherit the canvas window when omitted.

## UVP & unfair advantage (qualitative only)

- `valueProposition.statements` — UVP pitch (prefer one primary)
- `valueProposition.highLevelConcepts` — X-for-Y analogies (may be empty)
- `unfairAdvantage.advantages` — moat bullets

Drill-down for a concept lives under a **cost** line that sponsors a child canvas — not under UVP.

Why only cost (responsibility accounting / cost centers, not profit rollup): [nesting.md](nesting.md).

## Recommended ecosystem tree

```
recommended/
  root.flc.json
  nodes/
    exec-on-demand-dispatch.flc.json
    concept-personal-driver.flc.json
    companies/
      acme.flc.json
```

See package `fixtures/recommended` for a complete role-model (early Uber + cost-sponsored children).

## Cost → child example

Parent expense (inside some canvas):

```json
{
  "id": "exp-infra",
  "title": "Dispatch infrastructure",
  "amountMinor": 5000000,
  "cadence": { "type": "recurring", "every": 1, "unit": "month" },
  "node": { "id": "exec-on-demand-dispatch" }
}
```

Child file `nodes/exec-on-demand-dispatch.flc.json` must have `"id": "exec-on-demand-dispatch"`.
