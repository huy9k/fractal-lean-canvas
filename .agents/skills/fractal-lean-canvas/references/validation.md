# FLC validation layers

Use `npx fractal-lean-canvas validate <path>` or `validateEcosystem` from `fractal-lean-canvas/node`.

| Layer      | Checks                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Structural | Root = envelope (`currency` ISO 4217); other `.flc.json` = bare canvas; typed line items                                       |
| Semantic   | Unique `id`s, max depth (`16`), cycle guard, date bounds, single-parent cost tree, cadence-aware net-burn ≤ sponsoring expense |
| Ecosystem  | Requires `root.flc.json`; resolves cost `{ id }` links; bans unreachable files; ecosystem-wide id uniqueness                   |

## Semantic highlights

- **Single parent:** each child id appears on at most one expense `node`.
- **No root target:** a cost `node.id` must not equal the root canvas id.
- **Date windows:** child / item dates must respect canvas and sponsor bounds.
- **Net burn:** child costs − child revenues over the overlapping window must fit under the sponsoring expense (revenue assumed paid in time; no proration).

## API split

| API                                | Use when                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| `validateDocument(json, pathHint)` | Single root envelope in memory (walks nested inline nodes if present) |
| `validateEcosystem(dirOrRootPath)` | Multi-file tree with `{ id }` refs across files                       |

CLI `validate` is the ecosystem path. Prefer it after any multi-file edit.

## Out of scope

Business-specific policy (naming conventions, required KPIs, org process) belongs in the **state repo**, not this schema package.
